\set ON_ERROR_STOP on
-- Behavior tests for 20261112120000_business_asset_library + 20261112150000_recipients_and_drafts,
-- run on top of live_replica.sql. Roles are simulated with request.jwt.claims like Supabase does.
create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  reset role;
  if u = 'anon' then perform set_config('request.jwt.claims','',false); execute 'set role anon';
  else perform set_config('request.jwt.claims', json_build_object('sub',u)::text, false); execute 'set role authenticated'; end if;
end $$;
create temp table tok(label text, token text); grant all on tok to anon, authenticated;

-- ---- live publishing flow (unchanged by my migrations): claim business, publish, slug -------------------
select pg_temp.as_user('userA');
select claim_business_slug('smith-roofing','Smith Roofing');
insert into published_videos(id,title,project) values ('vidAAAA1111','Spring','{"version":1,"title":"Spring","tracks":[{"items":[{"id":"t","webhookUrl":"https://secret.test/h"}]}]}');
select set_video_slug('vidAAAA1111','spring-offer');
select pg_temp.as_user('anon');
do $$ begin
  assert (get_published_video(p_business=>'smith-roofing', p_slug=>'spring-offer')->>'id')='vidAAAA1111','slug resolves';
  assert (get_published_video(p_id=>'vidAAAA1111')::text) not like '%secret.test%','webhook stripped';
end $$;

-- ---- recipients ----------------------------------------------------------------------------------
select pg_temp.as_user('userA');
insert into business_profiles(name,website,business_key) values ('Smith Roofing','smithroofing.com','smithroofing.com'),('Wilson Plumbing','wilson.com','wilson.com');
insert into video_recipients(video_id,label,contact_ref,business_id,variables)
  select 'vidAAAA1111','Smith','c1',id,'{"FIRSTNAME":"John","COMPANY":"Smith Roofing","logoUrl":"https://cdn.test/smith.png"}' from business_profiles where business_key='smithroofing.com';
insert into video_recipients(video_id,label,contact_ref,variables) values ('vidAAAA1111','Wilson','c2','{"FIRSTNAME":"Will","COMPANY":"Wilson Plumbing","logoUrl":"https://cdn.test/wilson.png"}');
insert into tok select label, token from video_recipients;
do $$ begin assert (select count(*) from tok)=2,'two recipients'; assert (select min(length(token)) from tok)>=64,'token >= 64 chars'; end $$;

select pg_temp.as_user('anon');
do $$ declare s text; w text; begin
  select token into s from tok where label='Smith'; select token into w from tok where label='Wilson';
  assert (resolve_recipient('vidAAAA1111', s)->>'COMPANY')='Smith Roofing','smith resolves';
  assert (resolve_recipient('vidAAAA1111', w)->>'COMPANY')='Wilson Plumbing','wilson resolves';
  assert resolve_recipient('vidAAAA1111','nope') is null,'bad token';
  assert resolve_recipient('vidOTHER9999', s) is null,'token for another video';
  assert not (resolve_recipient('vidAAAA1111', s) ? 'label') and not (resolve_recipient('vidAAAA1111', s) ? 'contact_ref'),'no owner-only data leaked';
  begin perform 1 from video_recipients; assert false,'anon read recipients'; exception when insufficient_privilege then null; end;
  begin perform 1 from published_video_drafts; assert false,'anon read drafts'; exception when insufficient_privilege then null; end;
  begin perform 1 from business_profiles; assert false,'anon read business'; exception when insufficient_privilege then null; end;
end $$;

-- another user can neither see nor create recipients for A's video
select pg_temp.as_user('userB');
do $$ begin
  assert (select count(*) from video_recipients)=0,'B sees none';
  begin insert into video_recipients(video_id,variables) values ('vidAAAA1111','{}'); assert false,'B inserted for A';
  exception when others then if sqlerrm like 'B inserted%' then raise; end if; end;
  begin insert into video_recipients(video_id,variables) values ('vidAAAA1111','{}'); exception when others then null; end;
  update video_recipients set status='revoked';   -- RLS: touches nothing
end $$;
select pg_temp.as_user('userA');
do $$ begin assert (select count(*) from video_recipients where status='active')=2,'B did not revoke A links'; end $$;

-- one active link per contact; bad refs rejected; revoke is permanent and frees the contact
do $$ begin
  begin insert into video_recipients(video_id,contact_ref) values ('vidAAAA1111','c1'); assert false,'duplicate active contact link';
  exception when unique_violation then null; end;
  begin insert into video_recipients(video_id,contact_ref) values ('vidAAAA1111','bad ref!'); assert false,'bad ref accepted';
  exception when check_violation then null; end;
end $$;
update video_recipients set status='revoked' where label='Wilson';
update video_recipients set status='active' where label='Wilson';
do $$ begin assert (select status from video_recipients where label='Wilson')='revoked','revocation permanent'; end $$;
insert into video_recipients(video_id,label,contact_ref) values ('vidAAAA1111','Wilson again','c2');
select pg_temp.as_user('anon');
do $$ declare w text; begin select token into w from tok where label='Wilson'; assert resolve_recipient('vidAAAA1111', w) is null,'revoked token dead'; end $$;

-- unpublished video: nothing resolves
select pg_temp.as_user('userA'); update published_videos set published=false where id='vidAAAA1111';
select pg_temp.as_user('anon');
do $$ declare s text; begin select token into s from tok where label='Smith'; assert resolve_recipient('vidAAAA1111', s) is null,'unpublished'; end $$;
select pg_temp.as_user('userA'); update published_videos set published=true where id='vidAAAA1111';

-- expired token
update video_recipients set expires_at = now() - interval '1 minute' where label='Smith';
select pg_temp.as_user('anon');
do $$ declare s text; begin select token into s from tok where label='Smith'; assert resolve_recipient('vidAAAA1111', s) is null,'expired'; end $$;
select pg_temp.as_user('userA'); update video_recipients set expires_at = null where label='Smith';

-- ---- drafts + promote ---------------------------------------------------------------------------
insert into published_video_drafts(video_id,title,project) values ('vidAAAA1111','Spring v2','{"version":1,"title":"Spring v2","tracks":[]}');
create temp table dr as select id from published_video_drafts; grant all on dr to authenticated;
do $$ declare r1 int; r2 int; begin
  assert (select revision from published_videos where id='vidAAAA1111')=1,'live revision 1 before promote';
  assert (select project->>'title' from published_videos where id='vidAAAA1111')='Spring','live unchanged by a draft';
end $$;
select pg_temp.as_user('userB');
do $$ begin
  assert (select count(*) from published_video_drafts)=0,'B sees no drafts';
  begin perform promote_video_draft((select id from dr)); assert false,'B promoted A draft'; exception when others then if sqlerrm like 'B promoted%' then raise; end if; end;
end $$;
select pg_temp.as_user('userA');
do $$ begin assert (select project->>'title' from published_videos where id='vidAAAA1111')='Spring','still live v1 after B attempt'; end $$;
select promote_video_draft((select id from dr));
do $$ begin
  assert (select project->>'title' from published_videos where id='vidAAAA1111')='Spring v2','promoted';
  assert (select revision from published_videos where id='vidAAAA1111')=2,'revision bumped by live guard';
  assert (select count(*) from published_video_revisions where video_id='vidAAAA1111')=2,'live snapshot trigger recorded the revision';
  assert (select count(*) from published_video_drafts)=0,'draft consumed';
  assert (select slug from published_videos where id='vidAAAA1111')='spring-offer','slug untouched';
  assert (select count(*) from video_recipients where status='active')=2,'recipient links survive the promotion';
end $$;
-- identical project: no new revision
insert into published_video_drafts(video_id,title,project) select 'vidAAAA1111','Spring v2',project from published_videos where id='vidAAAA1111';
select promote_video_draft(id) from published_video_drafts;
do $$ begin assert (select revision from published_videos where id='vidAAAA1111')=2,'no change, no revision'; end $$;
-- prune keeps the newest 20 drafts
do $$ begin for i in 1..25 loop insert into published_video_drafts(video_id,title,project) values ('vidAAAA1111','d'||i,'{"v":1}'); end loop; end $$;
do $$ begin assert (select count(*) from published_video_drafts)=20,'drafts capped at 20'; end $$;
reset role;

-- ---- business library isolation -------------------------------------------------------------------
select pg_temp.as_user('userA');
insert into business_assets(business_id,storage_url,category) select id,'https://cdn.test/smith.png','logo' from business_profiles where business_key='smithroofing.com';
select pg_temp.as_user('userB');
do $$ begin
  assert (select count(*) from business_profiles)=0,'B sees no businesses';
  assert (select count(*) from business_assets)=0,'B sees no assets';
  begin insert into business_assets(business_id,storage_url) select id,'https://x.test/y.png' from public.business_profiles; exception when others then null; end;
end $$;
select pg_temp.as_user('userA');
do $$ begin
  begin insert into business_assets(business_id,storage_url) select id,'blob:nope' from business_profiles limit 1; assert false,'blob accepted';
  exception when check_violation then null; end;
end $$;
reset role;
\echo ALL LIVE-SCHEMA CHECKS PASSED
