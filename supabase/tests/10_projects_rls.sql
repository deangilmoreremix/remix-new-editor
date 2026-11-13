\set ON_ERROR_STOP off
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
insert into timeline_projects(name,data) values ('A proj','{"x":1}') returning id, clerk_user_id \gset
\echo inserted as :clerk_user_id
select count(*) as a_sees from timeline_projects;
-- forged owner must be rejected
insert into timeline_projects(clerk_user_id,name) values ('userB','forged');
set request.jwt.claims = '{"sub":"userB"}';
select count(*) as b_sees from timeline_projects;
update timeline_projects set name='hijack' where id = :'id';
select 'b_update_rows' , count(*) from timeline_projects where name='hijack';
delete from timeline_projects where id = :'id';
-- B tries to attach a video to A's project
insert into published_videos(id,title,project,project_id) values ('abcdefgh12','t','{}',:'id');
set request.jwt.claims = '{"sub":"userA"}';
insert into published_videos(id,title,project,project_id) values ('abcdefgh34','t','{}',:'id');
select count(*) as a_still_has from timeline_projects;
-- owner immutable
update timeline_projects set clerk_user_id='userB' where id = :'id';
select clerk_user_id as owner_after from timeline_projects where id = :'id';
-- anon sees nothing / cannot write
set role anon; set request.jwt.claims = '{}';
select count(*) from timeline_projects;
