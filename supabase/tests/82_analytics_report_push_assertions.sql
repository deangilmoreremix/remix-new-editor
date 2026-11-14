-- Asserting checks for 20261117000000_analytics_report_push.sql (owner-checked report, push subscriptions, claiming alerts).
-- Run with supabase/tests/run-analytics-report-push-assertions.sh (throwaway local Postgres + the Supabase shim + the analytics chain).
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

create schema if not exists t;
create or replace function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'ASSERTION FAILED: %', label; end if; raise notice 'ok - %', label; end $$;
create or replace function t.fails_with(label text, code text, stmt text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then
    if sqlstate = code then raise notice 'ok - % (%)', label, sqlstate; return; end if;
    raise exception 'ASSERTION FAILED (wrong error % <> %): % — %', sqlstate, code, label, sqlerrm;
  end;
  raise exception 'ASSERTION FAILED (statement succeeded): %', label;
end $$;
grant usage on schema t to anon, authenticated, service_role;
grant execute on all functions in schema t to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;

-- Owner A has a video with a pricing button and a call button; owner B has a video of their own.
insert into public.published_videos (id, clerk_user_id, title, project, published, revision) values
  ('vidAAAAAAAA', 'userA', 'A video', '{"timelineSeconds":30,"tracks":[{"items":[{"id":"cta1","buttonText":"Get a quote"},{"id":"call1","buttonText":"Call us"},{"id":"form1","heading":"Contact form"}]}]}', true, 1),
  ('vidBBBBBBBB', 'userB', 'B video', '{"timelineSeconds":30,"tracks":[]}', true, 1);

-- One recipient link on A's video (the server would make the hash; the plain token never reaches the database).
select set_config('t.link', (select id::text from recipient_links_issue('userA', 'vidAAAAAAAA', array['Acme Roofing'], array[encode(sha256('tokenAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1'::bytea), 'hex')], null)), false);

-- Session 1 comes through the recipient link; session 2 is anonymous.
select ingest_video_events('vidAAAAAAAA', 'sessionAAAAAAAAAAAA1', 'a1a1a1a1a1a1a1a1a1a1', current_setting('t.link'), 'desktop', null,
  '[{"type":"page_open","seq":0},{"type":"play","seq":1,"t":0},{"type":"watch","seq":2,"t0":0,"t1":10},{"type":"cta_click","seq":3,"clip":"cta1","t":10,"props":{"label":"Get a quote"}},{"type":"lead_submit","seq":4,"clip":"form1","t":11},{"type":"complete","seq":5,"t":30}]'::jsonb);
select ingest_video_events('vidAAAAAAAA', 'sessionAAAAAAAAAAAA2', 'b2b2b2b2b2b2b2b2b2b2', null, 'mobile', null, '[{"type":"page_open","seq":0},{"type":"play","seq":1,"t":0}]'::jsonb);
-- A different owner's video gets traffic too: it must never appear in A's report.
select ingest_video_events('vidBBBBBBBB', 'sessionBBBBBBBBBBBB1', null, null, 'desktop', null, '[{"type":"page_open","seq":0},{"type":"play","seq":1,"t":0},{"type":"complete","seq":2,"t":30}]'::jsonb);

-- ===== the report ======================================================================================================
select t.ok('a video that is not yours reads exactly like one that does not exist (null)', (select analytics_report('userB', 'vidAAAAAAAA', null, null) is null and analytics_report('userA', 'vidNOPENOPE', null, null) is null));
select t.fails_with('a user id is required', '28000', $$select analytics_report(null, 'vidAAAAAAAA', null, null)$$);
select t.fails_with('a backwards period is refused', '22023', $$select analytics_report('userA', 'vidAAAAAAAA', current_date, current_date - 5)$$);
select t.fails_with('more than 366 days is refused', '22023', $$select analytics_report('userA', 'vidAAAAAAAA', current_date - 400, current_date)$$);
select set_config('t.r', analytics_report('userA', 'vidAAAAAAAA', null, null)::text, false);
select t.ok('the report names the video and its default 30-day period', (current_setting('t.r')::jsonb #>> '{video,title}') = 'A video' and ((current_setting('t.r')::jsonb #>> '{period,to}')::date - (current_setting('t.r')::jsonb #>> '{period,from}')::date) = 29);
select t.ok('summary counts are exactly what was sent: 2 visits, 2 plays, 1 completed, 1 CTA click, 1 lead',
  (current_setting('t.r')::jsonb #>> '{summary,page_visits}')::int = 2 and (current_setting('t.r')::jsonb #>> '{summary,plays}')::int = 2 and (current_setting('t.r')::jsonb #>> '{summary,completed_sessions}')::int = 1
  and (current_setting('t.r')::jsonb #>> '{summary,cta_clicks}')::int = 1 and (current_setting('t.r')::jsonb #>> '{summary,leads}')::int = 1);
select t.ok('the other owner''s traffic is not counted', (current_setting('t.r')::jsonb #>> '{summary,completed_sessions}')::int = 1 and (select (analytics_report('userB', 'vidBBBBBBBB', null, null) #>> '{summary,page_visits}')::int = 1));
select t.ok('the daily series has today with the same totals', (select (d ->> 'plays')::int = 2 and (d ->> 'leads')::int = 1 from jsonb_array_elements(current_setting('t.r')::jsonb -> 'daily') d where (d ->> 'day')::date = (now() at time zone 'utc')::date));
select t.ok('the recipient list shows the link with ITS counts (one view, one lead) and never a hash or token',
  (current_setting('t.r')::jsonb #>> '{recipients,0,label}') = 'Acme Roofing' and (current_setting('t.r')::jsonb #>> '{recipients,0,views}')::int = 1 and (current_setting('t.r')::jsonb #>> '{recipients,0,leads}')::int = 1
  and (current_setting('t.r')::jsonb #>> '{recipients,0,status}') = 'live' and current_setting('t.r') !~* '(token|hash)');
select t.ok('CTA performance lists the pricing button', exists (select 1 from jsonb_array_elements(current_setting('t.r')::jsonb -> 'cta') c where c ->> 'label' = 'Get a quote'));
select t.ok('a period with no traffic is all zeros, not an error', (select (analytics_report('userA', 'vidAAAAAAAA', current_date - 200, current_date - 190) #>> '{summary,page_visits}')::int = 0));

-- ===== who may call what ===============================================================================================
select t.ok('anon and authenticated cannot run any of the new functions', not (
  has_function_privilege('anon', 'public.analytics_report(text,text,date,date)', 'execute') or has_function_privilege('authenticated', 'public.analytics_report(text,text,date,date)', 'execute')
  or has_function_privilege('anon', 'public.push_claim_for_video(text,integer)', 'execute') or has_function_privilege('authenticated', 'public.push_claim_for_video(text,integer)', 'execute')
  or has_function_privilege('authenticated', 'public.push_subscription_save(text,text,text,text,text)', 'execute') or has_function_privilege('authenticated', 'public.push_subscription_report(text[],text[])', 'execute')
  or has_function_privilege('authenticated', 'public.push_subscriptions_for_owner(text)', 'execute')));
select t.ok('service_role can', has_function_privilege('service_role', 'public.analytics_report(text,text,date,date)', 'execute') and has_function_privilege('service_role', 'public.push_claim_for_video(text,integer)', 'execute'));
select t.ok('a browser role cannot read the subscription table (keys) at all', not has_table_privilege('authenticated', 'public.push_subscriptions', 'select') and not has_table_privilege('anon', 'public.push_subscriptions', 'select'));

-- ===== alerts exist (the existing trigger) but NOTHING is claimed while the owner has no subscription ==================
select t.ok('the existing trigger made alerts for the lead and the pricing click', (select count(*) from owner_notifications where clerk_user_id = 'userA' and type in ('new_lead', 'pricing_cta')) = 2);
select t.ok('no subscription → nothing claimed, and nothing marked pushed (a device added later is not flooded)', (push_claim_for_video('vidAAAAAAAA') ->> 'notifications') = '[]' and (select count(*) from owner_notifications where pushed_at is not null) = 0);

-- ===== subscriptions ===================================================================================================
select set_config('t.k', repeat('B', 87), false); select set_config('t.a', repeat('a', 22), false);
select t.fails_with('only https endpoints', '23514', format($f$select push_subscription_save('userA', 'http://push.example/x', %L, %L, 'x')$f$, current_setting('t.k'), current_setting('t.a')));
select t.fails_with('a short public key is refused', '23514', format($f$select push_subscription_save('userA', 'https://push.example/x', 'short', %L, 'x')$f$, current_setting('t.a')));
select t.fails_with('a short auth secret is refused', '23514', format($f$select push_subscription_save('userA', 'https://push.example/x', %L, 'short', 'x')$f$, current_setting('t.k')));
select t.fails_with('a user id is required to save', '28000', format($f$select push_subscription_save(null, 'https://push.example/x', %L, %L, 'x')$f$, current_setting('t.k'), current_setting('t.a')));
select t.ok('saving returns the device count; saving the same browser again does not duplicate', push_subscription_save('userA', 'https://push.example/devA1', current_setting('t.k'), current_setting('t.a'), 'Laptop') = 1 and push_subscription_save('userA', 'https://push.example/devA1', current_setting('t.k'), current_setting('t.a'), 'Laptop') = 1);
select t.ok('the owner can list their devices, without keys', (select count(*) from push_subscriptions_list('userA')) = 1 and (select to_jsonb(l)::text !~* '(p256dh|auth|endpoint)' from push_subscriptions_list('userA') l limit 1));
select t.ok('another owner sees none of them', (select count(*) from push_subscriptions_list('userB')) = 0 and push_subscriptions_for_owner('userB') = '[]'::jsonb);
select t.ok('the same browser signing in as someone else moves to that user', push_subscription_save('userB', 'https://push.example/devA1', current_setting('t.k'), current_setting('t.a'), 'Laptop') = 1 and (select count(*) from push_subscriptions_list('userA')) = 0);
select t.ok('moving it back for the rest of the checks', push_subscription_save('userA', 'https://push.example/devA1', current_setting('t.k'), current_setting('t.a'), 'Laptop') = 1);
select t.ok('at most 10 devices per owner: the oldest are dropped', (select max(push_subscription_save('userA', 'https://push.example/dev' || g, current_setting('t.k'), current_setting('t.a'), null)) from generate_series(1, 12) g) = 10 and (select count(*) from push_subscriptions_list('userA')) = 10);
select t.ok('removing is owner-only', not push_subscription_remove('userB', 'https://push.example/dev12') and push_subscription_remove('userA', 'https://push.example/dev12') and not push_subscription_remove('userA', 'https://push.example/dev12'));
select push_subscription_report(array['https://push.example/dev11'], array['https://push.example/dev10']);
select t.ok('a gone endpoint is forgotten and a success is recorded', not exists (select 1 from push_subscriptions where endpoint = 'https://push.example/dev11') and (select last_success_at is not null from push_subscriptions where endpoint = 'https://push.example/dev10'));

-- ===== claiming ========================================================================================================
select set_config('t.c1', push_claim_for_video('vidAAAAAAAA')::text, false);
select t.ok('the owner''s two alerts are claimed with the owner''s devices', jsonb_array_length(current_setting('t.c1')::jsonb -> 'notifications') = 2 and jsonb_array_length(current_setting('t.c1')::jsonb -> 'subscriptions') >= 1
  and (select array_agg(n ->> 'type' order by n ->> 'type') from jsonb_array_elements(current_setting('t.c1')::jsonb -> 'notifications') n) = array['new_lead', 'pricing_cta']);
select t.ok('claimed alerts are marked pushed', (select count(*) from owner_notifications where pushed_at is not null) = 2);
select t.ok('a second claim returns nothing: no alert is ever pushed twice', (push_claim_for_video('vidAAAAAAAA') ->> 'notifications') = '[]');
select t.ok('claims are per video and per owner: B''s video yields nothing of A''s', (push_claim_for_video('vidBBBBBBBB') ->> 'notifications') = '[]' and (push_claim_for_video('vidNOPENOPE') ->> 'notifications') = '[]');
-- new alerts after the first claim are picked up on the next one, within the limit
select ingest_video_events('vidAAAAAAAA', 'sessionAAAAAAAAAAAA3', null, null, 'desktop', null, '[{"type":"page_open","seq":0},{"type":"call_click","seq":1,"clip":"call1"},{"type":"lead_submit","seq":2,"clip":"form1"}]'::jsonb);
select t.ok('a later alert is claimed on its own, and p_limit is respected', jsonb_array_length(push_claim_for_video('vidAAAAAAAA', 1) -> 'notifications') = 1 and jsonb_array_length(push_claim_for_video('vidAAAAAAAA', 5) -> 'notifications') = 1 and jsonb_array_length(push_claim_for_video('vidAAAAAAAA', 5) -> 'notifications') = 0);
-- staleness, read state and type
select ingest_video_events('vidAAAAAAAA', 'sessionAAAAAAAAAAAA4', null, null, 'desktop', null, '[{"type":"page_open","seq":0},{"type":"lead_submit","seq":1,"clip":"form1"}]'::jsonb);
update owner_notifications set created_at = now() - interval '11 minutes' where pushed_at is null;
select t.ok('alerts older than 10 minutes are not announced', jsonb_array_length(push_claim_for_video('vidAAAAAAAA') -> 'notifications') = 0);
select ingest_video_events('vidAAAAAAAA', 'sessionAAAAAAAAAAAA5', null, null, 'desktop', null, '[{"type":"page_open","seq":0},{"type":"lead_submit","seq":1,"clip":"form1"}]'::jsonb);
update owner_notifications set read_at = now() where pushed_at is null;
select t.ok('alerts the owner has already read are not pushed', jsonb_array_length(push_claim_for_video('vidAAAAAAAA') -> 'notifications') = 0);
insert into owner_notifications (clerk_user_id, video_id, type, title, summary, dedupe_key) values ('userA', 'vidAAAAAAAA', 'daily_digest', 'Digest', 'x', 'digest:1'), ('userA', 'vidAAAAAAAA', 'milestone', 'Milestone', 'x', 'ms:1');
select t.ok('digests and milestones are never pushed', jsonb_array_length(push_claim_for_video('vidAAAAAAAA') -> 'notifications') = 0);

-- ===== deleting a video removes what hangs off it =======================================================================
delete from published_videos where id = 'vidBBBBBBBB';
select t.ok('deleting a video leaves no report for it', analytics_report('userB', 'vidBBBBBBBB', null, null) is null);

do $$ begin raise notice 'ALL ASSERTIONS PASSED'; end $$;
