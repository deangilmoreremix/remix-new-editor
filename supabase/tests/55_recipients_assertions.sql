-- Asserting checks for 20261122000000_video_recipients.sql. Any failed expectation raises and psql exits non-zero.
-- Run through supabase/tests/run-assertions.sh (fresh database with the migrations applied).
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

create schema if not exists t2;
create or replace function t2.ok(label text, cond boolean) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'ASSERTION FAILED: %', label; end if;
  raise notice 'ok - %', label;
end $$;
create or replace function t2.fails(label text, stmt text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then raise notice 'ok - % (%)', label, left(sqlerrm, 60); return; end;
  raise exception 'ASSERTION FAILED (statement succeeded): %', label;
end $$;
grant usage on schema t2 to anon, authenticated, service_role;
grant execute on all functions in schema t2 to anon, authenticated, service_role;

-- owner A publishes a video, owner B publishes another
set role authenticated; set request.jwt.claims = '{"sub":"userR1"}';
insert into published_videos(id,title,project) values ('vidRec0001','Recipients A','{"timelineSeconds":10,"tracks":[]}');
set request.jwt.claims = '{"sub":"userR2"}';
insert into published_videos(id,title,project) values ('vidRec0002','Recipients B','{"timelineSeconds":10,"tracks":[]}');

-- owner A saves recipients: sanitizing drops contact data, odd keys, non-strings; caps value length
set request.jwt.claims = '{"sub":"userR1"}';
select t2.ok('owner saves 2 usable recipients (3rd has nothing safe, 4th has a bad id)',
  public.save_video_recipients('vidRec0001', jsonb_build_array(
    jsonb_build_object('id','abc123','details', jsonb_build_object('firstName','Ann','company','Acme','email','ann@x.test','phone','555','businessPhone','5','mailingAddress','x','bad key','z','obj', jsonb_build_object('a',1),'age',42)),
    jsonb_build_object('id','def456','details', jsonb_build_object('firstName', repeat('x', 500))),
    jsonb_build_object('id','nosafe','details', jsonb_build_object('email','only@x.test')),
    jsonb_build_object('id','bad id!','details', jsonb_build_object('firstName','Z'))
  )) = 2);
select t2.ok('owner can read own recipients', (select count(*) from video_recipients where video_id = 'vidRec0001') = 2);

-- other owner: cannot read, cannot save into, cannot clear
set request.jwt.claims = '{"sub":"userR2"}';
select t2.ok('other owner sees no recipients', (select count(*) from video_recipients) = 0);
select t2.fails('other owner cannot save into someone else''s video', $$select public.save_video_recipients('vidRec0001', '[{"id":"hax","details":{"firstName":"H"}}]'::jsonb)$$);
select t2.fails('other owner cannot clear someone else''s video', $$select public.clear_video_recipients('vidRec0001')$$);
select t2.fails('direct insert is not allowed', $$insert into video_recipients(video_id, recipient_id, details) values ('vidRec0002','a','{}')$$);

-- anon (no jwt): cannot read the table, cannot save, but can look up ONE recipient
reset role; set role anon; set request.jwt.claims = '{}';
select t2.ok('anon sees no recipient rows (RLS filters them)', (select count(*) from video_recipients) = 0);
select t2.fails('anon cannot save', $$select public.save_video_recipients('vidRec0001','[]'::jsonb)$$);
select t2.ok('anon looks up one recipient: only safe name-like keys come back',
  public.video_recipient_values('vidRec0001','abc123') = '{"firstName":"Ann","company":"Acme","age":"42"}'::jsonb);
select t2.ok('value length is capped at 200', length((public.video_recipient_values('vidRec0001','def456') ->> 'firstName')) = 200);
select t2.ok('unknown recipient returns null', public.video_recipient_values('vidRec0001','nobody') is null);
select t2.ok('recipient of another video returns null', public.video_recipient_values('vidRec0002','abc123') is null);
select t2.ok('malformed ids return null (no error)', public.video_recipient_values('x','abc123') is null and public.video_recipient_values('vidRec0001','a b') is null);
select t2.ok('stored details never contain contact keys',
  not exists (select 1 from jsonb_object_keys(public.video_recipient_values('vidRec0001','abc123')) k where k ~* '(mail|phone|address)'));

-- unpublished video: lookup returns null
reset role;
update published_videos set published = false where id = 'vidRec0001';
set role anon; set request.jwt.claims = '{}';
select t2.ok('unpublished video: lookup returns null', public.video_recipient_values('vidRec0001','abc123') is null);
reset role;
update published_videos set published = true where id = 'vidRec0001';

-- replace + clear
set role authenticated; set request.jwt.claims = '{"sub":"userR1"}';
select public.save_video_recipients('vidRec0001','[{"id":"only1","details":{"firstName":"One"}}]'::jsonb, true) as replaced \gset
select t2.ok('replace saved one row', :replaced = 1);
select t2.ok('replace swaps the list', (select count(*) from video_recipients where video_id = 'vidRec0001') = 1);
select t2.fails('more than 2000 rows in one call is rejected', $$select public.save_video_recipients('vidRec0001', (select jsonb_agg(jsonb_build_object('id','r'||g,'details',jsonb_build_object('firstName','N'))) from generate_series(1,2001) g))$$);
select public.clear_video_recipients('vidRec0001');
select t2.ok('owner can clear', (select count(*) from video_recipients where video_id = 'vidRec0001') = 0);

-- deleting the video cascades
reset role;
set role authenticated; set request.jwt.claims = '{"sub":"userR2"}';
select public.save_video_recipients('vidRec0002','[{"id":"c1","details":{"firstName":"C"}}]'::jsonb);
delete from published_videos where id = 'vidRec0002';
reset role;
select t2.ok('deleting the video removes its recipients', (select count(*) from video_recipients where video_id = 'vidRec0002') = 0);
\echo RECIPIENT ASSERTIONS PASSED
