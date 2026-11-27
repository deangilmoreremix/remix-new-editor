-- Asserting checks for 20261127120000_domain_claims_hardening.sql. Runs after 53 in the same database (t.* helpers).
-- Any failed expectation raises and psql exits non-zero.
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

-- a failing statement must fail WITH the expected message (t.fails alone accepts any error)
create or replace function t.fails_with(label text, stmt text, expected text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then
    if sqlerrm like '%' || expected || '%' then raise notice 'ok - % (%)', label, sqlerrm; return; end if;
    raise exception 'ASSERTION FAILED (wrong error "%"): %', sqlerrm, label;
  end;
  raise exception 'ASSERTION FAILED (statement succeeded): %', label;
end $$;
grant execute on function t.fails_with(text, text, text) to anon, authenticated, service_role;

reset role;
set role authenticated; set request.jwt.claims = '{"sub":"userE"}';
select claim_business_slug('echo-dental', 'Echo Dental');
reset role;
set role authenticated; set request.jwt.claims = '{"sub":"userF"}';
select claim_business_slug('foxtrot-dental', 'Foxtrot Dental');
reset role;
set role authenticated; set request.jwt.claims = '{"sub":"userG"}';
select claim_business_slug('golf-dental', 'Golf Dental');
reset role;
set role authenticated; set request.jwt.claims = '{"sub":"userH"}';
select claim_business_slug('hotel-dental', 'Hotel Dental');
reset role;

-- ===== an unapproved claim does not lock the hostname
set role authenticated; set request.jwt.claims = '{"sub":"userE"}';
select set_custom_domain('videos.shared.com');
reset role;
set role authenticated; set request.jwt.claims = '{"sub":"userF"}';
select set_custom_domain('videos.shared.com');
reset role;
select t.ok('two businesses can both ask for the same hostname', (select count(*) from public.video_owner_profiles where custom_domain = 'videos.shared.com') = 2);
select t.ok('an unapproved hostname resolves to nobody', public.resolve_custom_domain('videos.shared.com') is null);
select t.ok('each claim has its own alert, with the owner id', (select count(*) from public.custom_domain_alerts where domain = 'videos.shared.com' and sent_at is null and owner_id in ('userE', 'userF')) = 2);

-- ===== approving one claim makes it exclusive
update public.video_owner_profiles set custom_domain_verified = true where custom_domain = 'videos.shared.com' and business_slug = 'echo-dental';
select t.ok('an approved hostname resolves to its business', public.resolve_custom_domain('videos.shared.com') = 'echo-dental');
select t.fails_with('a second approval of the same hostname is refused by the database', $q$update public.video_owner_profiles set custom_domain_verified = true where custom_domain = 'videos.shared.com' and business_slug = 'foxtrot-dental'$q$, 'duplicate key');
select t.ok('the other claim is untouched and still unapproved', (select custom_domain = 'videos.shared.com' and not custom_domain_verified from public.video_owner_profiles where business_slug = 'foxtrot-dental'));

set role authenticated; set request.jwt.claims = '{"sub":"userG"}';
select t.fails_with('a business cannot take a hostname that another business has approved', $q$select set_custom_domain('videos.shared.com')$q$, 'domain_taken');
reset role;
select t.ok('the refused attempt left no claim and no alert', (select custom_domain is null from public.video_owner_profiles where business_slug = 'golf-dental')
  and (select count(*) from public.custom_domain_alerts where business_slug = 'golf-dental') = 0);

-- ===== the owner of an approved domain can keep saving it, and changing it resets the approval
set role authenticated; set request.jwt.claims = '{"sub":"userE"}';
select set_custom_domain('videos.shared.com');
reset role;
select t.ok('saving the same approved domain again keeps the approval', (select custom_domain_verified from public.video_owner_profiles where business_slug = 'echo-dental'));
set role authenticated; set request.jwt.claims = '{"sub":"userE"}';
select set_custom_domain('videos.other.com');
reset role;
select t.ok('changing the domain resets the approval', (select not custom_domain_verified from public.video_owner_profiles where business_slug = 'echo-dental'));
select t.ok('...and the old hostname resolves to nobody again', public.resolve_custom_domain('videos.shared.com') is null);

-- ===== rate limit: 5 changes per business per hour
delete from public.custom_domain_changes;
set role authenticated; set request.jwt.claims = '{"sub":"userH"}';
select set_custom_domain('h1.flood.com'); select set_custom_domain('h2.flood.com'); select set_custom_domain('h3.flood.com');
select set_custom_domain('h4.flood.com'); select set_custom_domain('h5.flood.com');
select t.fails_with('the sixth change within an hour is refused', $q$select set_custom_domain('h6.flood.com')$q$, 'rate_limited');
select t.ok('saving the domain it already has is still allowed when limited', set_custom_domain('h5.flood.com') = 'h5.flood.com');
select t.fails_with('clearing is limited too', $q$select set_custom_domain(null)$q$, 'rate_limited');
reset role;
select t.ok('the refused attempts left no alert and kept the last good domain', (select custom_domain = 'h5.flood.com' from public.video_owner_profiles where business_slug = 'hotel-dental')
  and (select count(*) from public.custom_domain_alerts where business_slug = 'hotel-dental') = 5);
select t.ok('only the five counted changes are recorded', (select count(*) from public.custom_domain_changes where clerk_user_id = 'userH') = 5);
set role authenticated; set request.jwt.claims = '{"sub":"userF"}';
select t.ok('another business is not affected by it', set_custom_domain('f1.flood.com') = 'f1.flood.com');
reset role;
update public.custom_domain_changes set changed_at = now() - interval '2 hours' where clerk_user_id = 'userH';
set role authenticated; set request.jwt.claims = '{"sub":"userH"}';
select t.ok('after an hour the business can change it again', set_custom_domain('h6.flood.com') = 'h6.flood.com');
reset role;

-- ===== one open alert per (business, domain)
select t.ok('the open-alert index is per business and domain', exists (select 1 from pg_indexes where indexname = 'custom_domain_alerts_open_key' and indexdef like '%business_slug, domain%'));

-- ===== API roles cannot read the counter table or write the approval flag
set role authenticated; set request.jwt.claims = '{"sub":"userH"}';
select t.sees_nothing('authenticated cannot read the change counter', 'public.custom_domain_changes');
select t.fails('authenticated cannot write the change counter', $q$insert into public.custom_domain_changes(clerk_user_id) values ('userH')$q$);
reset role;
select t.ok('no API role has any UPDATE right on the approval flag', not has_column_privilege('authenticated', 'public.video_owner_profiles', 'custom_domain_verified', 'UPDATE')
  and not has_column_privilege('anon', 'public.video_owner_profiles', 'custom_domain_verified', 'UPDATE'));

\echo ALL DOMAIN CLAIMS ASSERTIONS PASSED
