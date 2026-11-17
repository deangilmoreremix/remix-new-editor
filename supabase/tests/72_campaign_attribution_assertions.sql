-- Stage 11 (Fix P) assertions for 20261117200000_video_session_campaign_attribution.sql (run by run-heatmap-assertions.sh on a
-- database that has every migration, including that one applied twice, and NO shim from 71).
-- Phase A runs only when public.video_campaigns does not exist (our branch alone): attribution must be a silent no-op.
-- Phase B uses the real campaigns tables when present (trial run with the campaigns branch migration), otherwise a minimal
-- TEST-ONLY stand-in with the same columns the writer reads (id, clerk_user_id, campaign_id, public_token, status).
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
  ('vidP000001','A main','{"timelineSeconds":20,"tracks":[]}'),
  ('vidP000002','A second','{"timelineSeconds":20,"tracks":[]}');
set request.jwt.claims = '{"sub":"userB"}';
insert into published_videos(id,title,project) values ('vidP000003','B video','{"timelineSeconds":20,"tracks":[]}');
reset role;

-- one session through the real ingest path (service_role), optionally carrying a recipient token, as video-events.js does
create or replace function t.view(p_video text, p_key text, p_token text, p_x numeric, p_y numeric, p_last int) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform public.ingest_video_events(p_video, p_key, null, null, 'desktop', null, '[{"type":"page_open","seq":0}]');
  perform public.ingest_video_heat_events(p_video, p_key, jsonb_build_array(
    jsonb_build_object('type','cta_impression','seq',1,'props',jsonb_build_object('vp','desktop','cta','c1','kind','book_call','label','Book')),
    jsonb_build_object('type','heat_click','seq',2,'props',jsonb_build_object('vp','desktop','x',p_x,'y',p_y,'pb',3)),
    jsonb_build_object('type','watch_buckets','seq',3,'props',jsonb_build_object('vp','desktop','r',jsonb_build_array(jsonb_build_array(0,p_last))))));
  if p_token is not null then r := public.attribute_video_session_campaign(p_video, p_key, p_token); end if;
  return r;
end $$;
grant execute on function t.view(text,text,text,numeric,numeric,int) to public;
create or replace function t.camp(p_video text, p_key text) returns uuid language sql security definer as $$
  select campaign_id from public.video_view_sessions where video_id = p_video and session_key = p_key $$;

grant execute on function t.camp(text,text) to public;
select to_regclass('public.video_campaigns') is null as nocamp \gset
-- ================================================================ phase A: no campaign tables
\if :nocamp
select t.ok('PHASE A: no campaign tables (our branch alone)', to_regclass('public.campaign_recipients') is null);
select t.ok('column exists, nullable uuid, no foreign key (no table to point at)',
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='video_view_sessions' and column_name='campaign_id' and data_type='uuid' and is_nullable='YES')
  and not exists (select 1 from pg_constraint where conname='video_view_sessions_campaign_id_fkey'));
set role service_role;
select t.ok('ingest + attribution call succeed without campaign tables and record NULL',
  (select t.view('vidP000001','sess_nocampaign_000001','tok_0123456789abcdefghij',0.5,0.5,2)) = '{"ok": true, "attributed": false}'::jsonb
  and t.camp('vidP000001','sess_nocampaign_000001') is null);
select t.ok('garbage / null / SQL-looking tokens never raise',
  public.attribute_video_session_campaign('vidP000001','sess_nocampaign_000001',null) = '{"ok": true, "attributed": false}'::jsonb
  and public.attribute_video_session_campaign('vidP000001','sess_nocampaign_000001',E'x'';drop table a;--') ->> 'ok' = 'true'
  and public.attribute_video_session_campaign(null,null,null) ->> 'ok' = 'true');
reset role;
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
select t.ok('heatmap options: available but no campaigns listed (control stays hidden in the UI)',
  public.video_heat_campaign_options('vidP000001') = '{"available": true, "campaigns": []}'::jsonb);
reset role;
-- now stand in for the campaigns branch
create table public.video_campaigns (id uuid primary key default gen_random_uuid(), clerk_user_id text not null, name text not null default 'c');
create table public.campaign_recipients (id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.video_campaigns(id) on delete cascade, clerk_user_id text not null,
  public_token text not null unique, status text not null default 'pending');
\else
select t.ok('PHASE A skipped: real campaign tables present (trial run)', true);
\endif

-- ================================================================ phase B: campaigns exist
insert into public.video_campaigns(id, clerk_user_id, name) values
  ('00000000-0000-0000-0000-0000000000a1','userA','A one'),
  ('00000000-0000-0000-0000-0000000000a2','userA','A two'),
  ('00000000-0000-0000-0000-0000000000b1','userB','B one');
insert into public.campaign_recipients(campaign_id, clerk_user_id, public_token, status) values
  ('00000000-0000-0000-0000-0000000000a1','userA','tokA1_aaaaaaaaaaaaaaaaaaaaaa','ready'),
  ('00000000-0000-0000-0000-0000000000a2','userA','tokA2_aaaaaaaaaaaaaaaaaaaaaa','ready'),
  ('00000000-0000-0000-0000-0000000000b1','userB','tokB1_bbbbbbbbbbbbbbbbbbbbbb','ready'),
  ('00000000-0000-0000-0000-0000000000a1','userA','tokA1_pending_aaaaaaaaaaaaa','pending'),
  ('00000000-0000-0000-0000-0000000000a1','userB','tokA1_forged_owner_bbbbbbbb','ready'),  -- recipient row owned by B under A's campaign
  ('00000000-0000-0000-0000-0000000000b1','userA','tokB1_forged_owner_aaaaaaaa','ready'); -- recipient row owned by A under B's campaign

set role service_role;
-- vidP000001 (owner A): A1 x6 (valid), A2 x5 (valid), spoof attempts x6 (must stay unattributed)
select t.view('vidP000001','sess_a1_'||lpad(i::text,8,'0'),'tokA1_aaaaaaaaaaaaaaaaaaaaaa',0.5,0.25,3) from generate_series(1,6) i;
select t.view('vidP000001','sess_a2_'||lpad(i::text,8,'0'),'tokA2_aaaaaaaaaaaaaaaaaaaaaa',0.1,0.9,1) from generate_series(1,5) i;
select t.view('vidP000001','sess_spB_'||lpad(i::text,8,'0'),'tokB1_bbbbbbbbbbbbbbbbbbbbbb',0.8,0.8,2) from generate_series(1,2) i;      -- another owner's campaign
select t.view('vidP000001','sess_gar_'||lpad(i::text,8,'0'),'not-a-real-token-at-all-123',0.8,0.8,2) from generate_series(1,2) i;       -- garbage, right shape
select t.view('vidP000001','sess_pen_'||lpad(i::text,8,'0'),'tokA1_pending_aaaaaaaaaaaaa',0.8,0.8,2) from generate_series(1,1) i;       -- recipient not ready
select t.view('vidP000001','sess_fo1_'||lpad(i::text,8,'0'),'tokA1_forged_owner_bbbbbbbb',0.8,0.8,2) from generate_series(1,1) i;       -- recipient owner differs from video owner
-- vidP000002 (owner A): only 3 valid A1 sessions and 3 plain ones (small cohort)
select t.view('vidP000002','sess_s1_'||lpad(i::text,8,'0'),'tokA1_aaaaaaaaaaaaaaaaaaaaaa',0.5,0.5,3) from generate_series(1,3) i;
select t.view('vidP000002','sess_s0_'||lpad(i::text,8,'0'),null,0.2,0.2,2) from generate_series(1,3) i;
-- vidP000003 (owner B): own token attributes; A's token must not
select t.view('vidP000003','sess_b1_'||lpad(i::text,8,'0'),'tokB1_bbbbbbbbbbbbbbbbbbbbbb',0.3,0.3,2) from generate_series(1,5) i;
select t.view('vidP000003','sess_ba_'||lpad(i::text,8,'0'),'tokA1_aaaaaaaaaaaaaaaaaaaaaa',0.3,0.3,2) from generate_series(1,5) i;       -- A's token on B's video
reset role;

select t.ok('valid token attributes the session to its campaign (A1 x6, A2 x5)',
  (select count(*) from public.video_view_sessions where video_id='vidP000001' and campaign_id='00000000-0000-0000-0000-0000000000a1') = 6
  and (select count(*) from public.video_view_sessions where video_id='vidP000001' and campaign_id='00000000-0000-0000-0000-0000000000a2') = 5);
select t.ok('SPOOF: another owner''s campaign token on my video attributes nothing',
  (select count(*) from public.video_view_sessions where video_id='vidP000001' and session_key like 'sess_spB_%' and campaign_id is not null) = 0);
select t.ok('garbage token (valid shape), pending recipient, recipient/campaign owner mismatch: nothing attributed',
  (select count(*) from public.video_view_sessions where video_id='vidP000001' and (session_key like 'sess_gar_%' or session_key like 'sess_pen_%' or session_key like 'sess_fo1_%') and campaign_id is not null) = 0);
select t.ok('SPOOF: owner A''s token on owner B''s video attributes nothing; B''s own token does',
  (select count(*) from public.video_view_sessions where video_id='vidP000003' and session_key like 'sess_ba_%' and campaign_id is not null) = 0
  and (select count(*) from public.video_view_sessions where video_id='vidP000003' and session_key like 'sess_b1_%' and campaign_id='00000000-0000-0000-0000-0000000000b1') = 5);
select t.ok('forged recipient owned by A under B''s campaign does not attribute A''s video to B''s campaign',
  (select attributed from (select (public.attribute_video_session_campaign('vidP000001','sess_gar_00000001','tokB1_forged_owner_aaaaaaaa') ->> 'attributed')::boolean as attributed) q) = false);  -- runs as owner of the function call (postgres)
select t.ok('every outcome has the same response shape (no existence oracle: bad token == other owner == unknown)',
  (select count(distinct (public.attribute_video_session_campaign('vidP000001','sess_gar_00000001', tk) - 'attributed')::text) = 1
     from (values ('tokB1_bbbbbbbbbbbbbbbbbbbbbb'),('zzzzzzzzzzzzzzzzzzzzzzzz'),('x'),(null::text)) v(tk)));
select t.ok('first valid attribution wins; replay and a different valid token do not move the session',
  public.attribute_video_session_campaign('vidP000001','sess_a1_00000001','tokA2_aaaaaaaaaaaaaaaaaaaaaa') ->> 'attributed' = 'false'
  and t.camp('vidP000001','sess_a1_00000001') = '00000000-0000-0000-0000-0000000000a1');
select t.ok('late valid token on a still-unattributed session attributes it once (retry after a failed first batch), then is idempotent',
  public.attribute_video_session_campaign('vidP000001','sess_gar_00000001','tokA1_aaaaaaaaaaaaaaaaaaaaaa') ->> 'attributed' = 'true'
  and public.attribute_video_session_campaign('vidP000001','sess_gar_00000001','tokA1_aaaaaaaaaaaaaaaaaaaaaa') ->> 'attributed' = 'false');
update public.video_view_sessions set campaign_id = null where session_key = 'sess_gar_00000001'; -- restore the spoof fixture
select t.ok('unknown session key / unpublished video: silent no-op',
  public.attribute_video_session_campaign('vidP000001','sess_does_not_exist_001','tokA1_aaaaaaaaaaaaaaaaaaaaaa') = '{"ok": true, "attributed": false}'::jsonb);
update public.published_videos set published = false where id = 'vidP000002';
select t.ok('unpublished video: not attributed',
  public.attribute_video_session_campaign('vidP000002','sess_s0_00000001','tokA1_aaaaaaaaaaaaaaaaaaaaaa') ->> 'attributed' = 'false');
update public.published_videos set published = true where id = 'vidP000002';

-- ---- grants: service_role only, helpers unchanged
select t.ok('grants: attribute_video_session_campaign executable by service_role only',
  has_function_privilege('service_role','public.attribute_video_session_campaign(text,text,text)','execute')
  and not has_function_privilege('anon','public.attribute_video_session_campaign(text,text,text)','execute')
  and not has_function_privilege('authenticated','public.attribute_video_session_campaign(text,text,text)','execute')
  and not has_function_privilege('public','public.attribute_video_session_campaign(text,text,text)','execute'));
select t.ok('ingest_video_events grants and signature are unchanged (one overload, service_role only)',
  (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='ingest_video_events') = 1
  and has_function_privilege('service_role','public.ingest_video_events(text,text,text,text,text,text,jsonb)','execute')
  and not has_function_privilege('anon','public.ingest_video_events(text,text,text,text,text,text,jsonb)','execute')
  and not has_function_privilege('authenticated','public.ingest_video_events(text,text,text,text,text,text,jsonb)','execute'));
select t.ok('function is security definer with a pinned search_path',
  (select prosecdef and proconfig = array['search_path=""'] from pg_proc where proname='attribute_video_session_campaign' and pronamespace='public'::regnamespace));
select t.fails('anon cannot call it', $q$set local role anon; select public.attribute_video_session_campaign('vidP000001','sess_a1_00000001','tokA1_aaaaaaaaaaaaaaaaaaaaaa')$q$);
select t.fails('authenticated cannot call it', $q$set local role authenticated; select public.attribute_video_session_campaign('vidP000001','sess_a1_00000001','tokA1_aaaaaaaaaaaaaaaaaaaaaa')$q$);
select t.ok('stores only the campaign id: no token anywhere in the sessions table',
  not exists (select 1 from public.video_view_sessions s where s::text like '%tokA1_%' or s::text like '%tokB1_%'));

-- ================================================================ heatmaps with p_campaign (end to end with Fix O RPCs)
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
select t.ok('options: available, exactly the two valid campaigns with sessions on this video (no spoofed B campaign)',
  (public.video_heat_campaign_options('vidP000001')->>'available')::boolean
  and jsonb_array_length(public.video_heat_campaign_options('vidP000001')->'campaigns') = 2
  and (public.video_heat_campaign_options('vidP000001')::text like '%a1%')
  and (public.video_heat_campaign_options('vidP000001')::text not like '%0b1%'));
select t.ok('click heatmap A1: exactly its 6 sessions, one cell at the A1 position; spoofed/garbage sessions are not in it',
  (select (j->>'sessions')::int = 6 and (j->>'clicks')::int = 6 and j->'cells' = '[[25, 12, 6]]'::jsonb and not (j->>'suppressed')::boolean
     from (select public.video_heat_clicks('vidP000001', current_date-1, current_date+1, null, null, null, '00000000-0000-0000-0000-0000000000a1') j) q));
select t.ok('click heatmap A2: exactly K=5 sessions at the A2 position',
  (select (j->>'sessions')::int = 5 and j->'cells' = '[[5, 45, 5]]'::jsonb
     from (select public.video_heat_clicks('vidP000001', current_date-1, current_date+1, null, null, null, '00000000-0000-0000-0000-0000000000a2') j) q));
select t.ok('unfiltered view still contains every session of the video, attributed or not',
  (public.video_heat_clicks('vidP000001', current_date-1, current_date+1)->>'sessions')::int
    = (select count(*) from public.video_view_sessions where video_id = 'vidP000001'));
select t.ok('cta/scroll/engagement for A1 count only A1 sessions',
  (select (j->'ctas'->0->>'impressions')::int = 6 from (select public.video_heat_cta_stats('vidP000001', current_date-1, current_date+1, null, '00000000-0000-0000-0000-0000000000a1') j) q)
  and (select (j->>'sessions')::int = 6 from (select public.video_heat_scroll('vidP000001', current_date-1, current_date+1, null, '00000000-0000-0000-0000-0000000000a1') j) q)
  and (select j->'seconds'->'viewers' = '[6, 6, 6, 6]'::jsonb from (select public.video_heat_engagement('vidP000001', current_date-1, current_date+1, null, '00000000-0000-0000-0000-0000000000a1') j) q));
select t.ok('small cohort: A1 on vidP000002 has only 3 sessions -> withheld (suppressed, 0 sessions)',
  (select (j->>'suppressed')::boolean and (j->>'sessions')::int = 0
     from (select public.video_heat_clicks('vidP000002', current_date-1, current_date+1, null, null, null, '00000000-0000-0000-0000-0000000000a1') j) q));
select t.ok('B''s campaign id on A''s video: nothing leaks (suppressed, 0 sessions)',
  (select (j->>'suppressed')::boolean and (j->>'sessions')::int = 0
     from (select public.video_heat_clicks('vidP000001', current_date-1, current_date+1, null, null, null, '00000000-0000-0000-0000-0000000000b1') j) q));
set request.jwt.claims = '{"sub":"userB"}';
select t.fails('owner isolation: B cannot read A''s heatmap or options', $q$select public.video_heat_clicks('vidP000001', current_date-1, current_date+1, null, null, null, '00000000-0000-0000-0000-0000000000a1')$q$, '42501');
select t.fails('... options', $q$select public.video_heat_campaign_options('vidP000001')$q$, '42501');
select t.ok('B sees its own campaign on its own video (5 sessions attributed by its own token, A''s token excluded)',
  (select (j->>'sessions')::int = 5 from (select public.video_heat_clicks('vidP000003', current_date-1, current_date+1, null, null, null, '00000000-0000-0000-0000-0000000000b1') j) q)
  and (public.video_heat_campaign_options('vidP000003')::text like '%0b1%'));
reset role;
\if :nocamp
-- the FK is only created when the campaigns table exists at migration time; here it did not
select t.ok('PHASE A database: no foreign key (the stand-in tables were created after the migration), column behaves as a plain uuid',
  not exists (select 1 from pg_constraint where conname='video_view_sessions_campaign_id_fkey'));
\else
select t.ok('real campaign tables were present at migration time: foreign key exists with on delete set null',
  exists (select 1 from pg_constraint where conname='video_view_sessions_campaign_id_fkey' and confdeltype='n'));
delete from public.video_campaigns where id='00000000-0000-0000-0000-0000000000a2';
select t.ok('deleting a campaign nulls the attribution of its sessions (no dangling ids)',
  (select count(*) from public.video_view_sessions where campaign_id='00000000-0000-0000-0000-0000000000a2') = 0
  and (select count(*) from public.video_view_sessions where video_id='vidP000001' and session_key like 'sess_a2_%') = 5);
\endif
select 'ALL HEATMAP CAMPAIGN ATTRIBUTION ASSERTIONS PASSED' as result;
