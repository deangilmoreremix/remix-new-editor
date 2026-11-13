-- Asserting checks for 20261115000000_recipient_links.sql (and its interplay with the existing analytics tables).
-- Run with supabase/tests/run-recipient-links-assertions.sh (throwaway local Postgres + the Supabase shim + the publishing chain).
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
create or replace function t.fails(label text, stmt text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then raise notice 'ok - % (%)', label, left(sqlerrm, 70); return; end;
  raise exception 'ASSERTION FAILED (statement succeeded): %', label;
end $$;
create or replace function t.affected(stmt text) returns bigint language plpgsql as $$
declare n bigint; begin execute stmt; get diagnostics n = row_count; return n; end $$;
grant usage on schema t to anon, authenticated, service_role;
grant execute on all functions in schema t to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
-- Emulate Supabase's default grants on what the migration did NOT revoke is unnecessary: anon/authenticated must have nothing of their own.

-- Two owners, one published video each, plus a third video that belongs to A but is unpublished.
insert into public.published_videos (id, clerk_user_id, title, project, published, revision)
values ('vidAAAAAAAA', 'userA', 'A video', '{"timelineSeconds": 30}', true, 1),
       ('vidBBBBBBBB', 'userB', 'B video', '{"timelineSeconds": 30}', true, 1);

-- Hashes as the server would make them (sha256 hex of a token the DB never sees).
select set_config('t.h1', encode(sha256('tokenAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1'::bytea), 'hex'), false);
select set_config('t.h2', encode(sha256('tokenAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA2'::bytea), 'hex'), false);
select set_config('t.h3', encode(sha256('tokenBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB3'::bytea), 'hex'), false);

-- ===== issuing =========================================================================================================
set role service_role;
select t.ok('A issues two links for their own video', (select count(*) from recipient_links_issue('userA', 'vidAAAAAAAA', array['Acme Roofing','Bright Plumbing'], array[current_setting('t.h1'), current_setting('t.h2')], null)) = 2);
select t.ok('B issues one for theirs', (select count(*) from recipient_links_issue('userB', 'vidBBBBBBBB', array['Other'], array[current_setting('t.h3')], null)) = 1);
select t.fails_with('A cannot issue for B''s video (looks like "not found")', 'P0002', $q$select * from recipient_links_issue('userA', 'vidBBBBBBBB', array['x'], array[repeat('a', 64)], null)$q$);
select t.fails_with('nobody can issue for a video that does not exist', 'P0002', $q$select * from recipient_links_issue('userA', 'nope00000000', array['x'], array[repeat('b', 64)], null)$q$);
select t.fails_with('a missing user id is refused', '28000', $q$select * from recipient_links_issue('', 'vidAAAAAAAA', array['x'], array[repeat('c', 64)], null)$q$);
select t.fails_with('labels and hashes must pair up', '22023', $q$select * from recipient_links_issue('userA', 'vidAAAAAAAA', array['x','y'], array[repeat('d', 64)], null)$q$);
select t.fails_with('more than 200 at once is refused', '22023', $q$select * from recipient_links_issue('userA', 'vidAAAAAAAA', (select array_agg('l' || g) from generate_series(1, 201) g), (select array_agg(repeat('e', 64)) from generate_series(1, 201)), null)$q$);
select t.fails('a hash that is not sha-256 hex is refused by the table', $q$select * from recipient_links_issue('userA', 'vidAAAAAAAA', array['bad'], array['not-a-hash'], null)$q$);
select t.fails('the same token hash cannot be issued twice (even to another recipient)', format($q$select * from recipient_links_issue('userA', 'vidAAAAAAAA', array['Dup'], array[%L], null)$q$, current_setting('t.h1')));
select t.fails('the same live label cannot be issued twice for one video', $q$select * from recipient_links_issue('userA', 'vidAAAAAAAA', array['  acme roofing '], array[repeat('f', 64)], null)$q$);
select t.fails_with('an expiry in the past is refused', '22023', $q$select * from recipient_links_issue('userA', 'vidAAAAAAAA', array['past'], array[repeat('1', 64)], now() - interval '1 day')$q$);
select t.fails_with('an expiry beyond 2 years is refused', '22023', $q$select * from recipient_links_issue('userA', 'vidAAAAAAAA', array['far'], array[repeat('2', 64)], now() + interval '3 years')$q$);
select t.ok('the plain token is nowhere in the table (only hashes)', not exists (select 1 from recipient_links where token_hash like 'token%'));

-- ===== resolving (the public path) ======================================================================================
select t.ok('a valid token resolves to its link id for ITS video', (select recipient_link_resolve('vidAAAAAAAA', current_setting('t.h1'))) is not null);
select t.ok('the same token does NOT resolve for another video', (select recipient_link_resolve('vidBBBBBBBB', current_setting('t.h1'))) is null);
select t.ok('a made-up hash resolves to nothing', (select recipient_link_resolve('vidAAAAAAAA', repeat('0', 64))) is null);
select t.ok('malformed input resolves to nothing (no error, no injection)', (select recipient_link_resolve('vidAAAAAAAA', $$' or 1=1 --$$)) is null and (select recipient_link_resolve(null, null)) is null);
select t.ok('a token is unusable with its plain text instead of the hash', (select recipient_link_resolve('vidAAAAAAAA', 'tokenAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1')) is null);

-- ===== listing and ownership ============================================================================================
select t.ok('A lists exactly their two links', (select count(*) from recipient_links_list('userA', 'vidAAAAAAAA')) = 2);
select t.ok('A sees nothing for B''s video', (select count(*) from recipient_links_list('userA', 'vidBBBBBBBB')) = 0);
select t.ok('B sees nothing for A''s video', (select count(*) from recipient_links_list('userB', 'vidAAAAAAAA')) = 0);
select t.ok('list result columns do not include token_hash', (select not exists (select 1 from pg_proc p, unnest(p.proargnames) n where p.proname = 'recipient_links_list' and n = 'token_hash')));

-- ===== attribution through the REAL analytics ingest ====================================================================
select set_config('t.link', (select recipient_link_resolve('vidAAAAAAAA', current_setting('t.h1'))::text), false);
select t.ok('events recorded for the resolved link id are attributed to it', (select (ingest_video_events('vidAAAAAAAA', 'sessionAAAAAAAAAAAA1', null, current_setting('t.link'), 'desktop', null,
  '[{"type":"page_open","seq":0},{"type":"play","seq":1,"t":0},{"type":"cta_click","seq":2,"props":{"label":"Book"}},{"type":"lead_submit","seq":3}]'::jsonb) ->> 'ok')::boolean));
select t.ok('the owner list now shows 1 view, 1 play, 1 CTA click, 1 lead for that recipient and nothing for the other',
  (select views = 1 and plays = 1 and cta_clicks = 1 and leads = 1 from recipient_links_list('userA', 'vidAAAAAAAA') where label = 'Acme Roofing')
  and (select views = 0 and leads = 0 from recipient_links_list('userA', 'vidAAAAAAAA') where label = 'Bright Plumbing'));
select t.ok('retrying the same batch does not double count (idempotent by session+seq)', (select (ingest_video_events('vidAAAAAAAA', 'sessionAAAAAAAAAAAA1', null, current_setting('t.link'), 'desktop', null,
  '[{"type":"page_open","seq":0},{"type":"play","seq":1,"t":0},{"type":"cta_click","seq":2},{"type":"lead_submit","seq":3}]'::jsonb) ->> 'duplicates')::int) = 4);
select t.ok('still 1 view and 1 lead after the retry', (select views = 1 and leads = 1 from recipient_links_list('userA', 'vidAAAAAAAA') where label = 'Acme Roofing'));
select t.ok('events with NO token are not attributed to any recipient', (select (ingest_video_events('vidAAAAAAAA', 'sessionAAAAAAAAAAAA2', null, null, 'mobile', null, '[{"type":"page_open","seq":0}]'::jsonb) ->> 'ok')::boolean)
  and (select sum(views) from recipient_links_list('userA', 'vidAAAAAAAA')) = 1);

-- ===== revoking and expiry ==============================================================================================
select t.ok('B cannot revoke A''s link', not recipient_links_revoke((select recipient_link_resolve('vidAAAAAAAA', current_setting('t.h2'))), 'userB'));
select t.ok('the link still works after B''s attempt', (select recipient_link_resolve('vidAAAAAAAA', current_setting('t.h2'))) is not null);
select t.ok('A revokes their own link', recipient_links_revoke((select recipient_link_resolve('vidAAAAAAAA', current_setting('t.h2'))), 'userA'));
select t.ok('a revoked token resolves to nothing', (select recipient_link_resolve('vidAAAAAAAA', current_setting('t.h2'))) is null);
select t.ok('revoking twice reports false, and an unknown id reports false', not recipient_links_revoke((select id from recipient_links where label = 'Bright Plumbing'), 'userA') and not recipient_links_revoke(gen_random_uuid(), 'userA'));
select t.ok('the revoked link is still listed (so the owner can see it), marked revoked', (select revoked_at is not null from recipient_links_list('userA', 'vidAAAAAAAA') where label = 'Bright Plumbing'));
select t.ok('a revoked label can be issued again (new token)', (select count(*) from recipient_links_issue('userA', 'vidAAAAAAAA', array['Bright Plumbing'], array[repeat('9', 64)], null)) = 1);
select t.ok('an expired link stops resolving (clock moved past expiry)', (select count(*) from recipient_links_issue('userA', 'vidAAAAAAAA', array['Short'], array[repeat('7', 64)], now() + interval '1 hour')) = 1);
reset role;
update public.recipient_links set expires_at = now() - interval '1 minute', created_at = now() - interval '2 hours' where label = 'Short';
set role service_role;
select t.ok('after its expiry the token resolves to nothing', (select recipient_link_resolve('vidAAAAAAAA', repeat('7', 64))) is null);

-- ===== the browser roles can do nothing ===================================================================================
reset role; set role anon;
select t.fails('anon cannot read the table', 'select * from public.recipient_links');
select t.fails('anon cannot call resolve (so a visitor cannot probe tokens)', $q$select recipient_link_resolve('vidAAAAAAAA', repeat('0', 64))$q$);
select t.fails('anon cannot issue', $q$select * from recipient_links_issue('userA', 'vidAAAAAAAA', array['z'], array[repeat('8', 64)], null)$q$);
reset role; set role authenticated;
select set_config('request.jwt.claims', '{"sub":"userB"}', false);
select t.fails('a signed-in user cannot read the table directly', 'select * from public.recipient_links');
select t.fails('a signed-in user cannot call list for someone else', $q$select * from recipient_links_list('userA', 'vidAAAAAAAA')$q$);
select t.fails('a signed-in user cannot insert directly', $q$insert into public.recipient_links (clerk_user_id, video_id, token_hash, label) values ('userB', 'vidBBBBBBBB', repeat('a', 64), 'x')$q$);
reset role;

-- ===== deleting the video removes its links ==============================================================================
do $$ declare n integer; begin
  delete from public.published_videos where id = 'vidBBBBBBBB';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'ASSERTION FAILED: expected to delete 1 published video, deleted % (a trigger may block the delete)', n; end if;
  if exists (select 1 from public.recipient_links where video_id = 'vidBBBBBBBB') then raise exception 'ASSERTION FAILED: links survived their video'; end if;
  raise notice 'ok - deleting a published video deletes its recipient links';
end $$;

do $$ begin raise notice 'ALL ASSERTIONS PASSED'; end $$;
