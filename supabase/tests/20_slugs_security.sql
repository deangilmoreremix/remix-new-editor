\set ON_ERROR_STOP off
\pset format unaligned
\pset tuples_only on
-- ===== A publishes
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
insert into published_videos(id,title,project,slug) values ('vidA000001','Promo','{"title":"Promo","tracks":[{"items":[{"id":"lf","type":"lead-form","webhookUrl":"https://hook.example/a","notificationEmail":"owner@x.com","fields":[{"id":"email","type":"email"}]},{"id":"cta","type":"click-to-call","callNotifyAddress":"me@x.com","phoneNumber":"+1555"}]}],"listBuilder":{"enabled":true,"webhook":"https://hook.example/b","webhook2":{"value":"https://h2"}}}','sneaky-direct');
select 'direct slug ignored: ' || coalesce(slug,'NULL') from published_videos where id='vidA000001';
select 'claim: ' || claim_business_slug('Acme-Roofing','Acme');
select 'claim reserved: ' ; select claim_business_slug('admin');
select 'set slug: ' || set_video_slug('vidA000001','Spring-Promo');
insert into published_videos(id,title,project) values ('vidA000002','Other','{"tracks":[]}');
select 'dup slug:'; select set_video_slug('vidA000002','spring-promo');
select 'invalid slug:'; select set_video_slug('vidA000002','a');
select 'invalid slug2:'; select set_video_slug('vidA000002','bad_slug!');
-- ===== B cannot touch A's stuff / namespace
set request.jwt.claims = '{"sub":"userB"}';
select 'B claims taken:'; select claim_business_slug('acme-roofing');
select 'B set slug on A video:'; select set_video_slug('vidA000001','stolen');
select 'B sees A rows: ' || count(*) from published_videos;
select 'B sees revisions: ' || count(*) from published_video_revisions;
select 'B claim own: ' || claim_business_slug('bobs-plumbing');
-- ===== A renames slug -> redirect, changes business -> redirect + namespace not reusable
set request.jwt.claims = '{"sub":"userA"}';
select 'rename: ' || set_video_slug('vidA000001','summer-promo');
select 'owner sees revisions: ' || count(*) from published_video_revisions where video_id='vidA000001';
select 'move business: ' || claim_business_slug('acme-two');
set request.jwt.claims = '{"sub":"userB"}';
select 'B grabs released ns:'; select claim_business_slug('acme-roofing');
-- ===== anonymous public read
set role anon; set request.jwt.claims = '{}';
select 'anon table rows: ' || count(*) from published_videos;
select 'by id has clerk id: ' || (get_published_video('vidA000001') ? 'clerk_user_id');
select 'by id project webhook leaked: ' || (get_published_video('vidA000001')::text ~* 'hook\.example|owner@x|me@x|h2');
select 'by id keeps fields: ' || (get_published_video('vidA000001')::text ~ 'click-to-call' and get_published_video('vidA000001')::text ~ '\+1555' and get_published_video('vidA000001')::text ~ '"email"');
select 'by new url: ' || (get_published_video(null,'acme-two','summer-promo')->>'id');
select 'old slug redirect: ' || (get_published_video(null,'acme-two','spring-promo')->'redirect'->>'slug');
select 'old business redirect: ' || (get_published_video(null,'acme-roofing','summer-promo') is not null) || ' ' || coalesce((get_published_video(null,'acme-roofing','spring-promo')->'redirect'->>'business'),'none');
select 'unknown: ' || coalesce(get_published_video(null,'acme-two','nope')::text,'null');
-- views
select record_video_event('vidA000001','view');
select record_video_event('vidA000001','play');
select record_video_event('vidA000001','bogus');
select record_video_event('vidA000002','view');
-- ===== owner checks
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
select 'views: ' || view_count from published_videos where id='vidA000001';
select 'updated_at unchanged by view: ' || (updated_at = (select updated_at from published_videos where id='vidA000001')) from published_videos where id='vidA000001';
update published_videos set project = project || '{"x":1}' where id='vidA000001';
select 'revision now: ' || revision from published_videos where id='vidA000001';
update published_videos set title='Promo 2' where id='vidA000001';
select 'revision after title only: ' || revision from published_videos where id='vidA000001';
update published_videos set privacy='unlisted' where id='vidA000001';
update published_videos set privacy='secret' where id='vidA000001';
select 'privacy: ' || privacy from published_videos where id='vidA000001';
update published_videos set published=false where id='vidA000001';
set role anon; set request.jwt.claims = '{}';
select 'unpublished by id: ' || coalesce(get_published_video('vidA000001')::text,'null');
select 'unpublished by url: ' || coalesce(get_published_video(null,'acme-two','summer-promo')::text,'null');
select 'unpublished old url: ' || coalesce(get_published_video(null,'acme-two','spring-promo')::text,'null');
select 'rate_limit_check by anon:'; select rate_limit_check('x','y',1,60);
