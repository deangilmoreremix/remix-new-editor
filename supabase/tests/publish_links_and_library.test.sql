\set ON_ERROR_STOP on
create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  if u = 'anon' then perform set_config('request.jwt.claims','',false); execute 'set role anon';
  else perform set_config('request.jwt.claims', json_build_object('sub',u)::text, false); execute 'set role authenticated'; end if;
end $$;
-- allow pg_temp function use across role switches
reset role;

-- A publishes a video
select pg_temp.as_user('userA');
insert into published_videos(id,title,project) values ('vidAAAA1111','A video','{"version":1,"tracks":[]}');
update published_videos set slug='smith-roofing' where id='vidAAAA1111';
insert into video_recipients(video_id,label,variables) values
  ('vidAAAA1111','Smith','{"FIRSTNAME":"John","COMPANY":"Smith Roofing","logoUrl":"https://cdn.test/smith.png"}'),
  ('vidAAAA1111','Wilson','{"FIRSTNAME":"Will","COMPANY":"Wilson Plumbing","logoUrl":"https://cdn.test/wilson.png"}');
create temp table tok as select label, token from video_recipients;
grant all on tok to anon, authenticated;
do $$ begin assert (select count(*) from tok)=2, 'two recipients'; assert (select min(length(token)) from tok)>=64, 'token length >=64'; end $$;

-- anon: resolves exactly its own recipient, nothing else
reset role; select pg_temp.as_user('anon');
do $$ declare s text; w text; begin
  select token into s from tok where label='Smith'; select token into w from tok where label='Wilson';
  assert (public.resolve_recipient('vidAAAA1111', s)->>'COMPANY')='Smith Roofing', 'smith resolves';
  assert (public.resolve_recipient('smith-roofing', w)->>'COMPANY')='Wilson Plumbing', 'resolve by slug';
  assert public.resolve_recipient('vidAAAA1111','nope') is null, 'bad token null';
  assert public.resolve_recipient('vidOTHER9999', s) is null, 'token wrong video null';
  assert not (public.resolve_recipient('vidAAAA1111', s) ? 'label'), 'no label leak';
end $$;
-- anon cannot read recipients, revisions, library
do $$ begin
  begin perform 1 from video_recipients; assert false, 'anon read recipients'; exception when insufficient_privilege then null; end;
  begin perform 1 from business_profiles; assert false, 'anon read business'; exception when insufficient_privilege then null; end;
end $$;

-- user B cannot see or touch A's data
reset role; select pg_temp.as_user('userB');
do $$ begin
  assert (select count(*) from video_recipients)=0, 'B sees no recipients';
  assert (select count(*) from published_video_revisions)=0, 'B sees no revisions';
  begin insert into video_recipients(video_id,variables) values ('vidAAAA1111','{}'); assert false,'B inserted recipient for A'; exception when others then if sqlerrm like 'B inserted%' then raise; end if; end;
  update published_videos set slug='stolen-slug' where id='vidAAAA1111';
end $$;
reset role; select slug from published_videos where id='vidAAAA1111';   -- must still be smith-roofing

-- A: revoke is permanent, slug rename keeps old link alive, reserved slug rejected
select pg_temp.as_user('userA');
update video_recipients set status='revoked' where label='Wilson';
update video_recipients set status='active' where label='Wilson';  -- attempt to un-revoke
do $$ begin assert (select status from video_recipients where label='Wilson')='revoked','revocation permanent'; end $$;
update published_videos set slug='smith-roofing-co' where id='vidAAAA1111';
do $$ begin begin update published_videos set slug='watch' where id='vidAAAA1111'; assert false,'reserved accepted'; exception when check_violation then null; end; end $$;
reset role; select pg_temp.as_user('anon');
do $$ declare w text; begin
  select token into w from tok where label='Wilson';
  assert public.resolve_recipient('vidAAAA1111', w) is null, 'revoked token null';
  assert (public.get_published_video('smith-roofing')->>'id')='vidAAAA1111', 'old slug alias resolves';
  assert (public.get_published_video('smith-roofing-co')->>'canonical')='smith-roofing-co', 'new slug canonical';
  assert (public.get_published_video('vidAAAA1111')->>'id')='vidAAAA1111', 'legacy id resolves';
end $$;

-- draft -> live promote (owner only)
reset role; select pg_temp.as_user('userA');
insert into published_video_revisions(video_id,revision,kind,project) values ('vidAAAA1111',2,'draft','{"version":1,"title":"v2","tracks":[]}');
select public.promote_video_revision('vidAAAA1111',2);
do $$ begin assert (select project->>'title' from published_videos where id='vidAAAA1111')='v2','promoted'; assert (select live_revision from published_videos where id='vidAAAA1111')=2,'rev'; end $$;
reset role; select pg_temp.as_user('userB');
do $$ begin begin perform public.promote_video_revision('vidAAAA1111',2); assert false,'B promoted'; exception when others then if sqlerrm like 'B promoted%' then raise; end if; end; end $$;

-- business library isolation
reset role; select pg_temp.as_user('userA');
insert into business_profiles(name,website,business_key) values ('Smith Roofing','smithroofing.com','smithroofing.com');
create temp table bz as select id from business_profiles; grant all on bz to authenticated;
insert into business_assets(business_id,storage_url,category) select id,'https://cdn.test/smith.png','logo' from bz;
reset role; select pg_temp.as_user('userB');
do $$ begin
  assert (select count(*) from business_profiles)=0,'B sees no businesses';
  assert (select count(*) from business_assets)=0,'B sees no assets';
  begin insert into business_assets(business_id,storage_url) select id,'https://x.test/y.png' from bz; assert false,'B attached asset to A business'; exception when others then if sqlerrm like 'B attached%' then raise; end if; end;
  begin insert into business_assets(business_id,storage_url) select id,'blob:nope' from bz; assert false,'blob accepted'; exception when others then if sqlerrm like 'blob%' then raise; end if; end;
end $$;
reset role;
\echo ALL SQL SECURITY CHECKS PASSED

-- contact_ref: one ACTIVE link per contact per video, revoked links free the contact up, never exposed to viewers
reset role; select pg_temp.as_user('userA');
insert into video_recipients(video_id,label,contact_ref,variables) values ('vidAAAA1111','Ann','contact-1','{"FIRSTNAME":"Ann"}');
do $$ begin
  begin insert into video_recipients(video_id,label,contact_ref) values ('vidAAAA1111','Ann again','contact-1'); assert false,'duplicate active link accepted';
  exception when unique_violation then null; end;
  begin insert into video_recipients(video_id,contact_ref) values ('vidAAAA1111','bad ref!'); assert false,'bad contact_ref accepted';
  exception when check_violation then null; end;
end $$;
update video_recipients set status='revoked' where contact_ref='contact-1';
insert into video_recipients(video_id,label,contact_ref) values ('vidAAAA1111','Ann relinked','contact-1');   -- allowed after revoke
reset role; select pg_temp.as_user('anon');
do $$ declare t text; begin
  select token into t from tok limit 1;
  assert not (public.resolve_recipient('vidAAAA1111', t) ? 'contact_ref'), 'contact_ref leaked';
end $$;
reset role;
\echo CONTACT_REF CHECKS PASSED
