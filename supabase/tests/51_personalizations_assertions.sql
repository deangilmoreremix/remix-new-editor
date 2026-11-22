-- Asserting checks for personal links (20261115000000_video_personalizations.sql). Runs after 50_assertions.sql in the
-- same database (it reuses the t.* helpers). Any failed expectation raises and psql exits non-zero.
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

reset role;
-- ===== owner A: a published video and two personal links
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
insert into published_videos(id,title,project) values ('vidP000001','Promo','{"timelineSeconds":10,"tracks":[]}');
insert into video_personalizations(id,video_id,contact_id,name,variables) values
  ('linkAnn0000000001','vidP000001','c-ann','Ann Lee','{"firstName":"Ann","businessName":"Acme"}'),
  ('linkBob0000000001','vidP000001','c-bob','Bob Ray','{"firstName":"Bob"}');
select t.ok('owner id comes from the token', (select count(*) from video_personalizations where clerk_user_id='userA') = 2);
select t.fails('one link per contact per video', $q$insert into video_personalizations(id,video_id,contact_id) values ('linkAnn0000000002','vidP000001','c-ann')$q$);
select t.fails('link id must be unguessable length', $q$insert into video_personalizations(id,video_id,contact_id) values ('short','vidP000001','c-zed')$q$);
select t.fails('variables must be an object', $q$insert into video_personalizations(id,video_id,contact_id,variables) values ('linkZed0000000001','vidP000001','c-zed','[1]')$q$);
select t.fails('forged owner is rejected', $q$insert into video_personalizations(id,video_id,clerk_user_id) values ('linkZed0000000002','vidP000001','userB')$q$);

-- ===== owner B cannot see, change, or attach to A's links
set request.jwt.claims = '{"sub":"userB"}';
select t.ok('B sees none of A''s links', (select count(*) from video_personalizations) = 0);
update video_personalizations set overrides='{"firstName":"HACKED"}' where id='linkAnn0000000001';
delete from video_personalizations where id='linkAnn0000000001';
select t.fails('B cannot attach a link to A''s video', $q$insert into video_personalizations(id,video_id) values ('linkEvil000000001','vidP000001')$q$);
set request.jwt.claims = '{"sub":"userA"}';
select t.ok('A''s link untouched by B', (select count(*) from video_personalizations where id='linkAnn0000000001' and overrides = '{}') = 1);

-- ===== viewer (anon): reads one link through the RPC only
reset role; set role anon; set request.jwt.claims = '{}';
select t.sees_nothing('anon cannot read the table', 'public.video_personalizations');
select t.fails('anon cannot insert', $q$insert into video_personalizations(id,video_id) values ('linkAnon000000001','vidP000001')$q$);
select t.ok('anon resolves a link', get_personalization('linkAnn0000000001')->>'contactId' = 'c-ann');
select t.ok('variables returned', get_personalization('linkAnn0000000001')->'variables'->>'businessName' = 'Acme');
select t.ok('payload has no owner id or name', not (get_personalization('linkAnn0000000001')::text ~* 'userA|Ann Lee|clerk'));
select t.ok('unknown link is null', get_personalization('linkNope000000001') is null);
select t.ok('malformed id is null', get_personalization('x') is null and get_personalization(null) is null);

-- ===== owner A changes a link: overrides win, survive a re-sync; revoke; new id
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
update video_personalizations set overrides='{"firstName":"Annie","offer":"10% off"}' where id='linkAnn0000000001';
reset role; set role anon; set request.jwt.claims = '{}';
select t.ok('override wins over synced value', get_personalization('linkAnn0000000001')->'variables'->>'firstName' = 'Annie');
select t.ok('unedited synced values still present', get_personalization('linkAnn0000000001')->'variables'->>'businessName' = 'Acme');
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
update video_personalizations set variables='{"firstName":"Ann","businessName":"Acme Roofing"}' where id='linkAnn0000000001';
reset role; set role anon; set request.jwt.claims = '{}';
select t.ok('re-sync keeps the owner''s override', get_personalization('linkAnn0000000001')->'variables'->>'firstName' = 'Annie');
select t.ok('re-sync updates the rest', get_personalization('linkAnn0000000001')->'variables'->>'businessName' = 'Acme Roofing');
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
update video_personalizations set revoked = true where id='linkBob0000000001';
reset role; set role anon; set request.jwt.claims = '{}';
select t.ok('revoked link stops working', get_personalization('linkBob0000000001') is null);
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
update video_personalizations set id = 'linkAnn0000000099' where id='linkAnn0000000001';
reset role; set role anon; set request.jwt.claims = '{}';
select t.ok('old URL stops after the link is changed', get_personalization('linkAnn0000000001') is null);
select t.ok('new URL works with the same values', get_personalization('linkAnn0000000099')->'variables'->>'firstName' = 'Annie');

-- ===== unpublishing the video turns its links off
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
update published_videos set published = false where id='vidP000001';
reset role; set role anon; set request.jwt.claims = '{}';
select t.ok('links of an unpublished video return null', get_personalization('linkAnn0000000099') is null);
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
update published_videos set published = true where id='vidP000001';
select t.ok('owner updated_at moves on edit', (select updated_at > created_at from video_personalizations where id='linkAnn0000000099'));

-- ===== deleting the video removes its links
delete from published_videos where id='vidP000001';
select t.ok('links are deleted with the video', (select count(*) from video_personalizations) = 0);
reset role;
\echo ALL PERSONALIZATION ASSERTIONS PASSED
