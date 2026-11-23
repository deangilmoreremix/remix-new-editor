-- Stage 11 (Fix O) assertions for 20261117100000_heatmap_campaign_filter.sql (run by run-heatmap-assertions.sh after 70_*).
-- Phase 1 runs with NO campaign linkage (the real state of every database without the campaigns branch).
-- Phase 2 adds a TEST-ONLY shim: video_view_sessions.campaign_id (+ a minimal video_campaigns table). Neither exists in any
-- migration; they stand in for the linkage that only the unmerged campaigns branch could define (docs/stage-11/FIX_O_REPORT.md).
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
create schema if not exists t;
create or replace function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'ASSERTION FAILED: %', label; end if; raise notice 'ok - %', label; end $$;
drop function if exists t.fails(text, text);
create or replace function t.fails(label text, stmt text, code text default null) returns void language plpgsql as $$
begin begin execute stmt; exception when others then
    if code is not null and sqlstate <> code then raise exception 'ASSERTION FAILED (wrong error % for %): %', sqlstate, label, sqlerrm; end if;
    raise notice 'ok - % (%)', label, left(sqlerrm, 60); return; end;
  raise exception 'ASSERTION FAILED (statement succeeded): %', label; end $$;
grant usage on schema t to anon, authenticated, service_role;
grant execute on all functions in schema t to anon, authenticated, service_role;

set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
insert into published_videos(id,title,project) values
  ('vidC000001','Big','{"timelineSeconds":20,"tracks":[]}'),
  ('vidC000002','Small remainder','{"timelineSeconds":20,"tracks":[]}'),
  ('vidC000003','Pooled','{"timelineSeconds":20,"tracks":[]}');
reset role;

-- n sessions for a video; group tag stored in a scratch table so campaign ids can be attached later
create table t.grp (video_id text, session_key text, grp text);
grant all on t.grp to public;
create or replace function t.seed(p_video text, p_grp text, p_n int, p_x numeric, p_y numeric, p_last int) returns void language plpgsql as $$
declare i int; sk text; base int;
begin
  select count(*) into base from t.grp where video_id = p_video;
  for i in 1..p_n loop
    sk := 'sess_' || p_video || '_' || lpad((base + i)::text, 4, '0');
    perform public.ingest_video_events(p_video, sk, null, null, 'desktop', null, '[{"type":"page_open","seq":0}]');
    perform public.ingest_video_heat_events(p_video, sk, jsonb_build_array(
      jsonb_build_object('type','cta_impression','seq',1,'props',jsonb_build_object('vp','desktop','cta','c_'||p_grp,'kind','book_call','label','Book '||p_grp)),
      jsonb_build_object('type','heat_click','seq',2,'props',jsonb_build_object('vp','desktop','x',p_x,'y',p_y,'pb',3,'cta','c_'||p_grp,'kind','book_call','label','Book '||p_grp)),
      jsonb_build_object('type','scroll_depth','seq',3,'props',jsonb_build_object('vp','desktop','v',25)),
      jsonb_build_object('type','scroll_depth','seq',4,'props',jsonb_build_object('vp','desktop','v',50)),
      jsonb_build_object('type','watch_buckets','seq',5,'props',jsonb_build_object('vp','desktop','r',jsonb_build_array(jsonb_build_array(0,p_last))))));
    insert into t.grp values (p_video, sk, p_grp);
  end loop;
end $$;

grant execute on function t.seed(text,text,int,numeric,numeric,int) to public;
set role service_role;
-- vidC000001: campaign X (6 sessions), campaign Y (5), unattributed (6)
select t.seed('vidC000001','X',6,0.5,0.25,3);
select t.seed('vidC000001','Y',5,0.1,0.9,1);
select t.seed('vidC000001','N',6,0.8,0.8,2);
-- vidC000002: campaign P (6) + only 3 unattributed sessions (below K=5)
select t.seed('vidC000002','P',6,0.5,0.5,3);
select t.seed('vidC000002','N',3,0.2,0.2,2);
-- vidC000003: P (6), Q (3), unattributed (3): the two small groups pool to 6 >= K
select t.seed('vidC000003','P',6,0.5,0.5,3);
select t.seed('vidC000003','Q',3,0.7,0.7,1);
select t.seed('vidC000003','N',3,0.2,0.2,2);
reset role;

-- ================================================================ phase 1: no linkage column
select t.ok('PHASE 1: no campaign_id column exists', not exists (select 1 from information_schema.columns where table_name='video_view_sessions' and column_name='campaign_id'));
select t.ok('exactly one overload per RPC (a second overload would make PostgREST calls ambiguous)',
  (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname in ('video_heat_clicks','video_heat_cta_stats','video_heat_scroll','video_heat_engagement')) = 4);
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
create temp table before_clicks as select public.video_heat_clicks('vidC000001', current_date-1, current_date+1) as j;
create temp table before_cta as select public.video_heat_cta_stats('vidC000001', current_date-1, current_date+1) as j;
create temp table before_scroll as select public.video_heat_scroll('vidC000001', current_date-1, current_date+1) as j;
create temp table before_eng as select public.video_heat_engagement('vidC000001', current_date-1, current_date+1) as j;
grant select on before_clicks, before_cta, before_scroll, before_eng to public;
select t.ok('options: available=false and no campaigns', (public.video_heat_campaign_options('vidC000001')) = '{"available": false, "campaigns": []}'::jsonb);
select t.ok('old-style positional 3-arg call still works', (public.video_heat_clicks('vidC000001', current_date-1, current_date+1)->>'sessions')::int = 17);
select t.ok('old-style 6-arg call (viewport, cta, page bucket) still works', (public.video_heat_clicks('vidC000001', current_date-1, current_date+1, 'desktop', 'c_X', 3)->>'sessions')::int = 6);
select t.ok('old-style 4-arg scroll and engagement calls still work',
  (public.video_heat_scroll('vidC000001', current_date-1, current_date+1, 'desktop')->>'sessions')::int = 17
  and (public.video_heat_engagement('vidC000001', current_date-1, current_date+1, null)->>'sessions')::int = 17);
select t.ok('explicit p_campaign => null is the unfiltered view', public.video_heat_clicks('vidC000001', current_date-1, current_date+1, null, null, null, null) = (select j from before_clicks));
select t.fails('campaign filter without linkage raises campaign_filter_unavailable (never silently unfiltered)',
  $q$select public.video_heat_clicks('vidC000001', current_date-1, current_date+1, null, null, null, gen_random_uuid())$q$, '0A000');
select t.fails('same for cta/scroll/engagement', $q$select public.video_heat_scroll('vidC000001', current_date-1, current_date+1, null, gen_random_uuid())$q$, '0A000');
select t.fails('anon cannot call the new options RPC', $q$set local role anon; select public.video_heat_campaign_options('vidC000001')$q$);
reset role;
set role anon;
select t.fails('anon denied on clicks with campaign arg', $q$select public.video_heat_clicks('vidC000001', current_date-1, current_date+1, null, null, null, null)$q$);
reset role;

-- ================================================================ phase 2: TEST-ONLY shim
alter table public.video_view_sessions add column campaign_id uuid;
create table public.video_campaigns (id uuid primary key default gen_random_uuid(), clerk_user_id text not null, name text not null);
insert into public.video_campaigns(id, clerk_user_id, name) values
  ('00000000-0000-0000-0000-0000000000aa','userA','Spring outreach'),
  ('00000000-0000-0000-0000-0000000000bb','userA','Webinar'),
  ('00000000-0000-0000-0000-0000000000cc','userB','B secret campaign');
-- X = aa, Y = bb, P = cc-like ids reused per video (P/Q ids are per-video distinct sessions anyway)
update public.video_view_sessions s set campaign_id = '00000000-0000-0000-0000-0000000000aa' from t.grp g where g.session_key = s.session_key and g.grp in ('X','P');
update public.video_view_sessions s set campaign_id = '00000000-0000-0000-0000-0000000000bb' from t.grp g where g.session_key = s.session_key and g.grp in ('Y','Q');

select t.ok('PHASE 2: shim column present', public._heat_campaign_linked());
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
select t.ok('adding the (empty-meaning) column does not change unfiltered results: clicks', public.video_heat_clicks('vidC000001', current_date-1, current_date+1) = (select j from before_clicks));
select t.ok('... cta', public.video_heat_cta_stats('vidC000001', current_date-1, current_date+1) = (select j from before_cta));
select t.ok('... scroll', public.video_heat_scroll('vidC000001', current_date-1, current_date+1) = (select j from before_scroll));
select t.ok('... engagement', public.video_heat_engagement('vidC000001', current_date-1, current_date+1) = (select j from before_eng));
select t.ok('options: available with named campaigns of this owner only',
  (public.video_heat_campaign_options('vidC000001')->>'available')::boolean
  and jsonb_array_length(public.video_heat_campaign_options('vidC000001')->'campaigns') = 2
  and (public.video_heat_campaign_options('vidC000001')::text like '%Spring outreach%')
  and (public.video_heat_campaign_options('vidC000001')::text not like '%secret%'));

-- filtering: vidC000001, X (aa) = 6 sessions, Y (bb) = 5, rest = 6
create temp table cx as select public.video_heat_clicks('vidC000001', current_date-1, current_date+1, null, null, null, '00000000-0000-0000-0000-0000000000aa') as j;
create temp table cy as select public.video_heat_clicks('vidC000001', current_date-1, current_date+1, null, null, null, '00000000-0000-0000-0000-0000000000bb') as j;
grant select on cx, cy to public;
select t.ok('click heatmap X: only X sessions (6), one cell at the X position with 6 clicks',
  (select (j->>'sessions')::int = 6 and (j->>'clicks')::int = 6 and j->'cells' = '[[25, 12, 6]]'::jsonb and not (j->>'suppressed')::boolean from cx));
select t.ok('click heatmap Y: exactly K=5 sessions are shown, only the Y position',
  (select (j->>'sessions')::int = 5 and j->'cells' = '[[5, 45, 5]]'::jsonb from cy));
select t.ok('campaign + CTA filter composes (X sessions, cta c_Y -> nothing, suppressed)',
  (public.video_heat_clicks('vidC000001', current_date-1, current_date+1, null, 'c_Y', null, '00000000-0000-0000-0000-0000000000aa')->>'suppressed')::boolean);
select t.ok('cta stats X: only X CTA, 6 impressions',
  (select jsonb_array_length(j->'ctas') = 1 and j->'ctas'->0->>'cta_key' = 'c_X' and (j->'ctas'->0->>'impressions')::int = 6
     from (select public.video_heat_cta_stats('vidC000001', current_date-1, current_date+1, null, '00000000-0000-0000-0000-0000000000aa') j) q));
select t.ok('scroll X: 6 sessions, all reached 50, none 75',
  (select (j->>'sessions')::int = 6 and (j->'reached'->>'50')::int = 6 and (j->'reached'->>'75')::int = 0
     from (select public.video_heat_scroll('vidC000001', current_date-1, current_date+1, null, '00000000-0000-0000-0000-0000000000aa') j) q));
select t.ok('engagement X (watched seconds 0..3): viewers 6 for seconds 0-3 and no later second',
  (select j->'seconds'->'viewers' = '[6, 6, 6, 6]'::jsonb and (j->>'sessions')::int = 6
     from (select public.video_heat_engagement('vidC000001', current_date-1, current_date+1, null, '00000000-0000-0000-0000-0000000000aa') j) q));
select t.ok('engagement Y (seconds 0..1): series ends at second 1',
  (select j->'seconds'->'viewers' = '[5, 5]'::jsonb
     from (select public.video_heat_engagement('vidC000001', current_date-1, current_date+1, null, '00000000-0000-0000-0000-0000000000bb') j) q));
select t.ok('unknown campaign id: suppressed with 0 sessions',
  (select (j->>'suppressed')::boolean and (j->>'sessions')::int = 0 from (select public.video_heat_clicks('vidC000001', current_date-1, current_date+1, null, null, null, gen_random_uuid()) j) q));

-- ---------------- differencing / min-cohort
-- vidC000002: P=6 sessions, unattributed=3 (<K). Unfiltered shows 9 sessions; P minus-total would expose the 3 => P is withheld.
select t.ok('differencing: unfiltered total (9) is shown', (public.video_heat_clicks('vidC000002', current_date-1, current_date+1)->>'sessions')::int = 9);
select t.ok('differencing: campaign P (6 >= K) is WITHHELD because the 3 unattributed sessions would be derivable as 9 - 6',
  (select (j->>'suppressed')::boolean and (j->>'sessions')::int = 0 and not j ? 'cells' from (select public.video_heat_clicks('vidC000002', current_date-1, current_date+1, null, null, null, '00000000-0000-0000-0000-0000000000aa') j) q));
select t.ok('differencing: same for scroll, engagement, cta stats',
  (public.video_heat_scroll('vidC000002', current_date-1, current_date+1, null, '00000000-0000-0000-0000-0000000000aa')->>'suppressed')::boolean
  and (public.video_heat_engagement('vidC000002', current_date-1, current_date+1, null, '00000000-0000-0000-0000-0000000000aa')->>'suppressed')::boolean
  and public.video_heat_cta_stats('vidC000002', current_date-1, current_date+1, null, '00000000-0000-0000-0000-0000000000aa')->'ctas' = '[]'::jsonb);
-- vidC000003: P=6, Q=3, N=3 -> small groups pool to 6 >= K: P allowed (rest 6), Q (3 < K) withheld
select t.ok('pooled remainder: P allowed when the small groups pool to >= K (rest = 6)',
  (select not (j->>'suppressed')::boolean and (j->>'sessions')::int = 6 from (select public.video_heat_clicks('vidC000003', current_date-1, current_date+1, null, null, null, '00000000-0000-0000-0000-0000000000aa') j) q));
select t.ok('cohort floor: campaign Q with 3 sessions is withheld even though the remainder is large',
  (public.video_heat_clicks('vidC000003', current_date-1, current_date+1, null, null, null, '00000000-0000-0000-0000-0000000000bb')->>'suppressed')::boolean);
-- the viewport filter changes the scope the gate is evaluated in: mobile has 0 sessions of everything
select t.ok('device filter: gate is evaluated inside the same device scope (mobile -> nothing, suppressed)',
  (public.video_heat_clicks('vidC000001', current_date-1, current_date+1, 'mobile', null, null, '00000000-0000-0000-0000-0000000000aa')->>'suppressed')::boolean);
-- exhaustive: for every campaign x video x endpoint the returned session count is 0 or >= 5 and never a small number
select t.ok('no campaign view anywhere reports a session count in 1..4',
  not exists (select 1 from (values ('vidC000001'),('vidC000002'),('vidC000003')) v(id),
     (values ('00000000-0000-0000-0000-0000000000aa'),('00000000-0000-0000-0000-0000000000bb')) c(id2),
     lateral (select (public.video_heat_clicks(v.id, current_date-1, current_date+1, null, null, null, c.id2::uuid)->>'sessions')::int s) q
   where q.s between 1 and 4));

-- ---------------- owner-only
set request.jwt.claims = '{"sub":"userB"}';
select t.fails('B cannot filter A video by campaign', $q$select public.video_heat_clicks('vidC000001', current_date-1, current_date+1, null, null, null, '00000000-0000-0000-0000-0000000000aa')$q$, '42501');
select t.fails('B cannot read A campaign options', $q$select public.video_heat_campaign_options('vidC000001')$q$, '42501');
set request.jwt.claims = '{}';
select t.fails('no JWT: denied', $q$select public.video_heat_campaign_options('vidC000001')$q$, '42501');
reset role;
set role anon;
select t.fails('anon cannot execute options', $q$select public.video_heat_campaign_options('vidC000001')$q$);
select t.fails('anon cannot execute the filtered RPC', $q$select public.video_heat_scroll('vidC000001', current_date-1, current_date+1, null, null)$q$);
reset role;
select t.ok('grants: authenticated has execute on new signatures; helpers closed to every API role',
  has_function_privilege('authenticated','public.video_heat_clicks(text,date,date,text,text,integer,uuid)','execute')
  and has_function_privilege('authenticated','public.video_heat_cta_stats(text,date,date,text,uuid)','execute')
  and has_function_privilege('authenticated','public.video_heat_scroll(text,date,date,text,uuid)','execute')
  and has_function_privilege('authenticated','public.video_heat_engagement(text,date,date,text,uuid)','execute')
  and has_function_privilege('authenticated','public.video_heat_campaign_options(text)','execute')
  and not has_function_privilege('anon','public.video_heat_clicks(text,date,date,text,text,integer,uuid)','execute')
  and not has_function_privilege('anon','public.video_heat_campaign_options(text)','execute')
  and not has_function_privilege('authenticated','public._heat_campaign_scope(text,date,date,text,uuid)','execute')
  and not has_function_privilege('authenticated','public._heat_campaign_linked()','execute')
  and not has_function_privilege('service_role','public._heat_campaign_scope(text,date,date,text,uuid)','execute'));
select t.ok('new SECURITY DEFINER functions pin search_path',
  not exists (select 1 from pg_proc p where p.pronamespace='public'::regnamespace and p.prosecdef
     and p.proname in ('_heat_campaign_linked','_heat_campaign_scope','video_heat_campaign_options','video_heat_clicks','video_heat_cta_stats','video_heat_scroll','video_heat_engagement')
     and not coalesce(p.proconfig::text like '%search_path=%', false)));
\echo ALL HEATMAP CAMPAIGN ASSERTIONS PASSED
