-- Asserting checks for the custom-domain admin alert (20261120120000_custom_domain_admin_alert.sql, with the two
-- custom-domain migrations before it). Runs after 50_assertions.sql in the same database (it reuses the t.* helpers).
-- Any failed expectation raises and psql exits non-zero.
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

reset role;
-- ===== owner D claims a business and saves a domain
set role authenticated; set request.jwt.claims = '{"sub":"userD"}';
select claim_business_slug('delta-dental', 'Delta Dental');
reset role;
select t.ok('claiming a business does not alert', (select count(*) from public.custom_domain_alerts) = 0);

set role authenticated; set request.jwt.claims = '{"sub":"userD"}';
select set_custom_domain('Videos.Delta.com');
reset role;
select t.ok('saving a domain queues exactly one alert', (select count(*) from public.custom_domain_alerts) = 1);
select t.ok('the alert holds the normalised domain and the business', (select domain = 'videos.delta.com' and business_slug = 'delta-dental' and sent_at is null and attempts = 0 from public.custom_domain_alerts));

-- ===== no alert when nothing changed, or when the domain is cleared, or when only the flag changes
set role authenticated; set request.jwt.claims = '{"sub":"userD"}';
select set_custom_domain('videos.delta.com');
reset role;
select t.ok('re-saving the same domain does not queue another alert', (select count(*) from public.custom_domain_alerts) = 1);

update public.video_owner_profiles set custom_domain_verified = true where business_slug = 'delta-dental';
select t.ok('approving a domain does not alert', (select count(*) from public.custom_domain_alerts) = 1);
update public.video_owner_profiles set custom_domain_verified = false where business_slug = 'delta-dental';

-- ===== changing the domain queues a new alert; the old open one stays until it is processed
set role authenticated; set request.jwt.claims = '{"sub":"userD"}';
select set_custom_domain('videos2.delta.com');
reset role;
select t.ok('a different domain queues its own alert', (select count(*) from public.custom_domain_alerts) = 2);
select t.ok('changing the domain reset the verified flag', (select custom_domain_verified is false from public.video_owner_profiles where business_slug = 'delta-dental'));

update public.custom_domain_alerts set sent_at = now() where domain = 'videos2.delta.com';
set role authenticated; set request.jwt.claims = '{"sub":"userD"}';
select set_custom_domain(null);
reset role;
select t.ok('clearing the domain does not alert', (select count(*) from public.custom_domain_alerts) = 2);
set role authenticated; set request.jwt.claims = '{"sub":"userD"}';
select set_custom_domain('videos2.delta.com');
reset role;
select t.ok('asking for a domain again after its alert was sent queues a new one', (select count(*) from public.custom_domain_alerts where domain = 'videos2.delta.com') = 2);
select t.ok('only one open alert per domain', (select count(*) from public.custom_domain_alerts where domain = 'videos2.delta.com' and sent_at is null) = 1);

-- ===== API roles cannot read, write or call anything behind it
set role authenticated; set request.jwt.claims = '{"sub":"userD"}';
select t.sees_nothing('authenticated cannot read alerts', 'public.custom_domain_alerts');
select t.fails('authenticated cannot insert alerts', $q$insert into public.custom_domain_alerts(business_slug, domain) values ('delta-dental', 'x.delta.com')$q$);
select t.fails('authenticated cannot mark an alert sent', $q$update public.custom_domain_alerts set sent_at = now()$q$);
select t.fails('authenticated cannot call the trigger function', $q$select public.custom_domain_notify_admin()$q$);
select t.fails('authenticated cannot approve their own domain', $q$update public.video_owner_profiles set custom_domain_verified = true$q$);
reset role; set role anon; set request.jwt.claims = '{}';
select t.sees_nothing('anon cannot read alerts', 'public.custom_domain_alerts');
select t.fails('anon cannot save a domain', $q$select set_custom_domain('anon.example.com')$q$);
reset role;

-- (domain_claims_hardening allows 5 changes per business per hour: this script changes the domain more often than
-- that on purpose, so the counter is reset here; supabase/tests/54 tests the limit itself)
delete from public.custom_domain_changes;

-- ===== the database call: made with the alert id and the shared secret; a failing call never blocks saving
create schema if not exists net;
create table t.http_calls (url text, body jsonb, headers jsonb);
create or replace function net.http_post(url text, body jsonb, headers jsonb) returns bigint language plpgsql as $$
begin
  insert into t.http_calls values (url, body, headers);
  return 1;
end $$;
insert into public.push_dispatch_config (id, url, secret, admin_alert_url) values (1, 'https://example.test/push-dispatch', 's3cret', 'https://example.test/admin-domain-alert')
  on conflict (id) do update set secret = excluded.secret, admin_alert_url = excluded.admin_alert_url;

set role authenticated; set request.jwt.claims = '{"sub":"userD"}';
select set_custom_domain('videos3.delta.com');
reset role;
select t.ok('the trigger posts to the admin alert url', (select count(*) from t.http_calls where url = 'https://example.test/admin-domain-alert') = 1);
select t.ok('the post carries the alert id', (select (body->>'alert_id')::bigint = (select id from public.custom_domain_alerts where domain = 'videos3.delta.com') from t.http_calls));
select t.ok('the post carries the shared secret and no domain', (select headers->>'x-push-secret' = 's3cret' and body::text !~ 'delta' from t.http_calls));

-- no admin_alert_url: the alert row is still recorded (the sweep delivers it), nothing is posted
update public.push_dispatch_config set admin_alert_url = null where id = 1;
set role authenticated; set request.jwt.claims = '{"sub":"userD"}';
select set_custom_domain('videos4.delta.com');
reset role;
select t.ok('without a url the alert row is still recorded', (select count(*) from public.custom_domain_alerts where domain = 'videos4.delta.com' and sent_at is null) = 1);
select t.ok('without a url nothing is posted', (select count(*) from t.http_calls) = 1);

-- a failing http call must not block the save or lose the alert
update public.push_dispatch_config set admin_alert_url = 'https://example.test/admin-domain-alert' where id = 1;
create or replace function net.http_post(url text, body jsonb, headers jsonb) returns bigint language plpgsql as $$
begin raise exception 'network down'; end $$;
set role authenticated; set request.jwt.claims = '{"sub":"userD"}';
select set_custom_domain('videos5.delta.com');
reset role;
select t.ok('a failing http call does not block saving the domain', (select custom_domain = 'videos5.delta.com' from public.video_owner_profiles where business_slug = 'delta-dental'));
select t.ok('a failing http call still leaves the alert for the sweep', (select count(*) from public.custom_domain_alerts where domain = 'videos5.delta.com' and sent_at is null) = 1);

\echo ALL CUSTOM DOMAIN ALERT ASSERTIONS PASSED
