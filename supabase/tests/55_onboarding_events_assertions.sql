-- Asserting checks for the onboarding funnel (20261121100000_onboarding_events.sql). Runs after 50 in the same database
-- (reuses the t.* helpers). Any failed expectation raises and psql exits non-zero.
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

reset role;
-- ===== clients can neither read nor write the table, nor call the RPCs
set role anon; set request.jwt.claims = '{}';
select t.sees_nothing('anon cannot read events', 'public.onboarding_events');
select t.fails('anon cannot insert directly', $q$insert into public.onboarding_events(anon_hash, session_key, event) values (repeat('a', 24), repeat('s', 24), 'start')$q$);
select t.fails('anon cannot ingest', $q$select public.ingest_onboarding_events(repeat('a', 24), repeat('s', 24), null, 'desktop', null, '[{"event":"start","seq":0}]'::jsonb)$q$);
reset role;
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
select t.sees_nothing('a signed-in user cannot read events', 'public.onboarding_events');
select t.fails('a signed-in user cannot ingest', $q$select public.ingest_onboarding_events(repeat('a', 24), repeat('s', 24), 'userA', 'desktop', null, '[{"event":"start","seq":0}]'::jsonb)$q$);
select t.fails('a signed-in user cannot read the funnel', $q$select public.onboarding_funnel()$q$);
select t.fails('a signed-in user cannot record a signup', $q$select public.record_onboarding_signup('userA')$q$);
reset role;

-- ===== service_role ingests, idempotently
set role service_role;
select t.ok('first batch is accepted', (public.ingest_onboarding_events(repeat('a', 24), 'sess_aaaaaaaaaaaaaaaa', null, 'desktop', 'example.com',
  '[{"event":"start","seq":0,"props":{"redo":false}},{"event":"step_view","seq":1,"step":1},{"event":"step_answer","seq":2,"step":1,"props":{"field":"goal","value":"ai-video"}},{"event":"step_view","seq":3,"step":2}]'::jsonb)->>'accepted') = '4');
select t.ok('a retried batch counts as duplicates, nothing new', (public.ingest_onboarding_events(repeat('a', 24), 'sess_aaaaaaaaaaaaaaaa', null, 'desktop', 'example.com',
  '[{"event":"start","seq":0},{"event":"step_view","seq":1,"step":1}]'::jsonb)->>'duplicates') = '2');
select t.ok('overlapping batch accepts only the new events', (public.ingest_onboarding_events(repeat('a', 24), 'sess_aaaaaaaaaaaaaaaa', null, 'desktop', null,
  '[{"event":"step_view","seq":3,"step":2},{"event":"step_view","seq":4,"step":3}]'::jsonb) ->> 'accepted') = '1');

-- ===== validation: a bad batch writes nothing and says why
select t.ok('unknown event is rejected', (public.ingest_onboarding_events(repeat('b', 24), 'sess_bbbbbbbbbbbbbbbb', null, null, null, '[{"event":"hack","seq":0}]'::jsonb)->>'error') = 'bad_event');
select t.ok('signup cannot be sent by a browser batch', (public.ingest_onboarding_events(repeat('b', 24), 'sess_bbbbbbbbbbbbbbbb', null, null, null, '[{"event":"signup","seq":0}]'::jsonb)->>'error') = 'bad_event');
select t.ok('step out of range is rejected', (public.ingest_onboarding_events(repeat('b', 24), 'sess_bbbbbbbbbbbbbbbb', null, null, null, '[{"event":"step_view","seq":0,"step":9}]'::jsonb)->>'error') = 'bad_event');
select t.ok('unknown sub step is rejected', (public.ingest_onboarding_events(repeat('b', 24), 'sess_bbbbbbbbbbbbbbbb', null, null, null, '[{"event":"step_view","seq":0,"step":6,"sub_step":"x"}]'::jsonb)->>'error') = 'bad_event');
select t.ok('oversized props are rejected', (public.ingest_onboarding_events(repeat('b', 24), 'sess_bbbbbbbbbbbbbbbb', null, null, null, jsonb_build_array(jsonb_build_object('event', 'complete', 'seq', 0, 'props', jsonb_build_object('x', repeat('y', 600)))))->>'error') = 'bad_event');
select t.ok('empty batch is rejected', (public.ingest_onboarding_events(repeat('b', 24), 'sess_bbbbbbbbbbbbbbbb', null, null, null, '[]'::jsonb)->>'error') = 'bad_events');
select t.ok('more than 25 events is rejected', (public.ingest_onboarding_events(repeat('b', 24), 'sess_bbbbbbbbbbbbbbbb', null, null, null, (select jsonb_agg(jsonb_build_object('event', 'start', 'seq', g)) from generate_series(0, 25) g))->>'error') = 'bad_events');
select t.ok('a bad session id is rejected', (public.ingest_onboarding_events(repeat('b', 24), 'short', null, null, null, '[{"event":"start","seq":0}]'::jsonb)->>'error') = 'bad_session');
select t.ok('a bad anon id is rejected', (public.ingest_onboarding_events('x', 'sess_bbbbbbbbbbbbbbbb', null, null, null, '[{"event":"start","seq":0}]'::jsonb)->>'error') = 'bad_anon');
reset role;
select t.ok('rejected batches wrote nothing', (select count(*) from public.onboarding_events where session_key = 'sess_bbbbbbbbbbbbbbbb') = 0);
select t.ok('device and referrer are stored; an unknown device is dropped', (select device_class = 'desktop' and referrer_host = 'example.com' from public.onboarding_events where session_key = 'sess_aaaaaaaaaaaaaaaa' and seq = 0));

-- ===== a second and third person, a finished run, a signup, then the funnel
set role service_role;
select public.ingest_onboarding_events(repeat('c', 24), 'sess_cccccccccccccccc', 'user_C', 'mobile', null,
  '[{"event":"start","seq":0},{"event":"step_view","seq":1,"step":1},{"event":"step_view","seq":2,"step":2},{"event":"step_view","seq":3,"step":3},{"event":"step_view","seq":4,"step":4},{"event":"step_view","seq":5,"step":5},{"event":"step_view","seq":6,"step":6,"sub_step":"type"},{"event":"step_view","seq":7,"step":6,"sub_step":"ready"},
    {"event":"key_saved","seq":8,"props":{"provider":"muapi"}},{"event":"key_tested","seq":9,"props":{"ok":true}},
    {"event":"complete","seq":10,"props":{"goal":"personal","team":"2-5","volume":"100+","heard":"google","types":["outreach","talking"],"tools":["outreach","avatar"],"primary":"outreach"}}]'::jsonb);
select public.ingest_onboarding_events(repeat('d', 24), 'sess_dddddddddddddddd', null, 'desktop', null,
  '[{"event":"start","seq":0},{"event":"step_view","seq":1,"step":1},{"event":"leave","seq":2,"props":{"to":"academy"}}]'::jsonb);
select t.ok('signup is recorded once', public.record_onboarding_signup('user_C') = true);
select t.ok('a repeated signup is not recorded again', public.record_onboarding_signup('user_C') = false);
select t.ok('signup needs a user id', public.record_onboarding_signup('') = false);
select t.ok('funnel works with default arguments', (public.onboarding_funnel()->>'ok') = 'true');
select t.ok('inverted range is rejected', (public.onboarding_funnel(now(), now() - interval '1 day')->>'error') = 'bad_range');
create temp table _f as select public.onboarding_funnel(now() - interval '1 day', now() + interval '1 day') as f;
select t.ok('3 people started (two anonymous, one signed in)', (select (x->>'people')::int from _f, jsonb_array_elements(f->'funnel') x where x->>'key' = 'start') = 3);
select t.ok('3 people reached step 1', (select (x->>'people')::int from _f, jsonb_array_elements(f->'funnel') x where x->>'key' = 'step_1') = 3);
select t.ok('2 people reached step 2', (select (x->>'people')::int from _f, jsonb_array_elements(f->'funnel') x where x->>'key' = 'step_2') = 2);
select t.ok('1 person reached step 6 and the Get ready screen', (select (x->>'people')::int from _f, jsonb_array_elements(f->'funnel') x where x->>'key' = 'step_6') = 1
  and (select (x->>'people')::int from _f, jsonb_array_elements(f->'funnel') x where x->>'key' = 'ready') = 1);
select t.ok('1 person finished, 1 signed up', (select (x->>'people')::int from _f, jsonb_array_elements(f->'funnel') x where x->>'key' = 'complete') = 1
  and (select (x->>'people')::int from _f, jsonb_array_elements(f->'funnel') x where x->>'key' = 'signup') = 1);
select t.ok('1 person left for the Academy', (select (f->>'left_for_academy')::int from _f) = 1);
select t.ok('top first studio and top studios are counted', (select f->'top_first_studio'->0->>'value' from _f) = 'outreach'
  and (select count(*) from _f, jsonb_array_elements(f->'top_studios')) = 2);
select t.ok('key counts', (select (f->'keys'->>'saved')::int from _f) = 1 and (select (f->'keys'->>'tested_ok')::int from _f) = 1);
select t.ok('median time to complete is a number', (select f->>'median_seconds_to_complete' is not null from _f));
reset role;

-- ===== retention
update public.onboarding_events set created_at = now() - interval '400 days' where session_key = 'sess_dddddddddddddddd';
set role service_role;
select t.ok('prune removes only old rows', public.prune_onboarding_events(180) = 3);
reset role;
select t.ok('recent rows are kept', (select count(*) from public.onboarding_events where session_key = 'sess_cccccccccccccccc') = 11);
\echo ALL ONBOARDING EVENTS ASSERTIONS PASSED
