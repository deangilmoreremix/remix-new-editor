-- Asserting checks for guests (20261115120000_guest_limits.sql). Runs after 51 in the same database (reuses t.* helpers).
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

reset role;
-- ===== guest A publishes and creates links; a signed-in user exists too
set role authenticated; set request.jwt.claims = '{"sub":"guest_AAAAAAAAAAAAAAAAAAAAAA","role":"authenticated","guest":true}';
insert into published_videos(id,title,project,privacy) values ('vidGA00001','Guest promo','{"timelineSeconds":10,"tracks":[]}','public');
select t.ok('guest owns the row', (select clerk_user_id from published_videos where id='vidGA00001') = 'guest_AAAAAAAAAAAAAAAAAAAAAA');
select t.ok('guest video is forced unlisted', (select privacy from published_videos where id='vidGA00001') = 'unlisted');
select t.fails('guest cannot set a readable slug', $q$update published_videos set slug='my-promo' where id='vidGA00001'$q$);
select t.fails('guest cannot claim a business name', $q$select claim_business_slug('guest-biz','Guest Biz')$q$);
select t.fails('guest cannot save cloud projects', $q$insert into timeline_projects(name,data) values ('p','{}')$q$);
insert into video_personalizations(id,video_id,contact_id,variables) values ('linkGA0000000001','vidGA00001','c1','{"firstName":"Ann"}');
update published_videos set title='Guest promo v2' where id='vidGA00001'; -- re-publish is not blocked
select t.ok('guest can edit own video', (select title from published_videos where id='vidGA00001') = 'Guest promo v2');
insert into video_leads(project_id,data) values ('p1','{"email":"a@b.co"}');
select t.ok('guest sees own lead', (select count(*) from video_leads) = 1);

-- ===== guest B sees nothing of A
set request.jwt.claims = '{"sub":"guest_BBBBBBBBBBBBBBBBBBBBBB","role":"authenticated","guest":true}';
select t.ok('B sees no videos', (select count(*) from published_videos) = 0);
select t.ok('B sees no links', (select count(*) from video_personalizations) = 0);
select t.ok('B sees no leads', (select count(*) from video_leads) = 0);
select t.fails('B cannot link to A''s video', $q$insert into video_personalizations(id,video_id) values ('linkGB0000000001','vidGA00001')$q$);

-- ===== quotas: 10 videos (re-publish still allowed at the cap), 200 links
set request.jwt.claims = '{"sub":"guest_BBBBBBBBBBBBBBBBBBBBBB","role":"authenticated","guest":true}';
insert into published_videos(id,title,project)
  select 'vidGB' || lpad(g::text,5,'0'), 'v', '{"timelineSeconds":1,"tracks":[]}' from generate_series(1,10) g;
select t.ok('guest reaches 10 videos', (select count(*) from published_videos) = 10);
select t.fails('11th video is refused', $q$insert into published_videos(id,title,project) values ('vidGB99999','v','{"timelineSeconds":1,"tracks":[]}')$q$);
insert into published_videos(id,title,project) values ('vidGB00001','again','{"timelineSeconds":1,"tracks":[]}')
  on conflict (id) do update set title = excluded.title;
select t.ok('upsert of an existing video at the cap works', (select title from published_videos where id='vidGB00001') = 'again');
insert into video_personalizations(id,video_id,contact_id)
  select 'linkGB' || lpad(g::text,11,'0'), 'vidGB00001', 'c' || g from generate_series(1,200) g;
select t.fails('201st link is refused', $q$insert into video_personalizations(id,video_id,contact_id) values ('linkGB99999999999','vidGB00001','c999')$q$);

-- ===== a signed-in user is not limited
set request.jwt.claims = '{"sub":"user_signedin"}';
insert into published_videos(id,title,project,privacy) select 'vidUS' || lpad(g::text,5,'0'), 'v', '{"timelineSeconds":1,"tracks":[]}', 'public' from generate_series(1,12) g;
select t.ok('signed-in user keeps 12 videos and public privacy', (select count(*) from published_videos where privacy='public') = 12);
select t.ok('signed-in user can claim a business', claim_business_slug('signed-biz','Signed Biz') is not null);

-- ===== expiry removes only old guest content
reset role;
set session_replication_role = replica; -- backdate rows without the updated_at touch triggers
update published_videos set updated_at = now() - interval '40 days' where id in ('vidGA00001','vidUS00001');
update video_personalizations set updated_at = now() - interval '40 days' where video_id = 'vidGA00001';
update video_leads set created_at = now() - interval '40 days';
set session_replication_role = origin;
select t.ok('anon cannot prune', not has_function_privilege('anon','public.prune_guest_content(integer)','execute'));
select t.ok('signed-in users cannot prune', not has_function_privilege('authenticated','public.prune_guest_content(integer)','execute'));
create temp table pr as select public.prune_guest_content(30) as r;
select t.ok('prune removes one expired guest video and its lead', (select r->>'videos' from pr) = '1' and (select r->>'leads' from pr) = '1');
select t.ok('expired guest video is gone with its links', (select count(*) from published_videos where id='vidGA00001') = 0 and (select count(*) from video_personalizations where video_id='vidGA00001') = 0);
select t.ok('old signed-in video is untouched', (select count(*) from published_videos where id='vidUS00001') = 1);
select t.ok('guest B (recently used) keeps its content', (select count(*) from published_videos where clerk_user_id='guest_BBBBBBBBBBBBBBBBBBBBBB') = 10);
-- a video whose links were used recently survives even if the video row is old
set role authenticated; set request.jwt.claims = '{"sub":"guest_BBBBBBBBBBBBBBBBBBBBBB"}';
reset role;
set session_replication_role = replica;
update published_videos set updated_at = now() - interval '40 days' where id in ('vidGB00002','vidGB00001');
update video_personalizations set updated_at = now() where video_id = 'vidGB00001';
set session_replication_role = origin;
create temp table pr2 as select public.prune_guest_content(30) as r;
select t.ok('unused old guest video is removed, one with recent link activity stays', (select r->>'videos' from pr2) = '1'
  and (select count(*) from published_videos where id='vidGB00001') = 1 and (select count(*) from published_videos where id='vidGB00002') = 0);

-- ===== claiming moves a guest's content to an account
select t.ok('anon cannot claim', not has_function_privilege('anon','public.claim_guest_content(text,text)','execute'));
select t.fails('claim needs a guest source', $q$select claim_guest_content('user_x','user_y')$q$);
select t.fails('claim cannot target a guest', $q$select claim_guest_content('guest_BBBBBBBBBBBBBBBBBBBBBB','guest_CCCCCCCCCCCCCCCCCCCCCC')$q$);
select t.ok('claim moves videos and links', (claim_guest_content('guest_BBBBBBBBBBBBBBBBBBBBBB','user_claimed')->>'videos') = '9');
select t.ok('claimed rows now belong to the account', (select count(*) from published_videos where clerk_user_id='user_claimed') = 9
  and (select count(*) from video_personalizations where clerk_user_id='user_claimed') = 200
  and (select count(*) from published_videos where clerk_user_id like 'guest\_%') = 0);
select t.ok('claimed content is no longer pruned as guest content', (public.prune_guest_content(30)->>'videos') = '0');
\echo ALL GUEST ASSERTIONS PASSED
