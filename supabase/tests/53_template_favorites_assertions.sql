-- Template favorites + popularity (run after 00_shim_local_postgres.sql and the
-- 20261120090000_template_favorites_and_popularity migration). Every check raises on failure.
\set ON_ERROR_STOP on

do $$ declare n int; begin
  -- owner A favorites two templates, owner B one
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"user_A"}', false);
  insert into public.template_favorites (template_id) values ('tiktok-video'), ('youtube-thumbnail');
  perform set_config('request.jwt.claims', '{"sub":"user_B"}', false);
  insert into public.template_favorites (template_id) values ('tiktok-video');

  -- isolation: B sees only B's row; cannot read or delete A's
  select count(*) into n from public.template_favorites;
  if n <> 1 then raise exception 'B should see 1 favorite, saw %', n; end if;
  delete from public.template_favorites where template_id = 'youtube-thumbnail';
  reset role; select count(*) into n from public.template_favorites;
  if n <> 3 then raise exception 'B must not delete A rows (have %)', n; end if;

  -- forged owner is rejected
  set local role authenticated; perform set_config('request.jwt.claims', '{"sub":"user_B"}', false);
  begin
    insert into public.template_favorites (clerk_user_id, template_id) values ('user_A', 'forged');
    raise exception 'forged owner insert should have failed';
  exception when insufficient_privilege or check_violation then null; end;
  -- bad ids are rejected
  begin
    insert into public.template_favorites (template_id) values ('bad id!');
    raise exception 'bad template id should have failed';
  exception when check_violation then null; end;
  -- anonymous (no sub) cannot insert or read anything
  perform set_config('request.jwt.claims', '', false);
  select count(*) into n from public.template_favorites;
  if n <> 0 then raise exception 'anon should see 0 favorites, saw %', n; end if;
  begin
    insert into public.template_favorites (template_id) values ('x');
    raise exception 'anon insert should have failed';
  exception when others then if sqlerrm like 'anon insert%' then raise; end if; end;
  reset role;
end $$;

do $$ declare n int; r record; begin
  -- events: signed-in only, once per user/template/kind/day
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"user_A"}', false);
  perform public.record_template_event('tiktok-video', 'open');
  perform public.record_template_event('tiktok-video', 'open');            -- duplicate, ignored
  perform public.record_template_event('tiktok-video', 'favorite');
  perform public.record_template_event('youtube-thumbnail', 'open');
  perform set_config('request.jwt.claims', '{"sub":"user_B"}', false);
  perform public.record_template_event('tiktok-video', 'open');
  perform public.record_template_event('nope; drop table x', 'open');      -- invalid id, ignored
  perform public.record_template_event('tiktok-video', 'share');           -- invalid kind, ignored
  perform set_config('request.jwt.claims', '', false);
  perform public.record_template_event('anon-template', 'open');           -- anonymous, ignored
  reset role;
  select count(*) into n from public.template_events;
  if n <> 4 then raise exception 'expected 4 event rows, have %', n; end if;

  -- table is not readable by app roles
  set local role authenticated; perform set_config('request.jwt.claims', '{"sub":"user_A"}', false);
  begin perform 1 from public.template_events; raise exception 'events must not be readable';
  exception when insufficient_privilege then null; end;
  reset role;

  -- popularity: tiktok = 2 openers + 3 * 1 favoriter = 5, then youtube = 1; only aggregates come back
  set local role anon; perform set_config('request.jwt.claims', '', false);
  select * into r from public.template_popularity(30, 5) order by score desc limit 1;
  if r.template_id <> 'tiktok-video' or r.score <> 5 or r.opens <> 2 or r.favorites <> 1 then
    raise exception 'unexpected top row %', r; end if;
  select count(*) into n from public.template_popularity(30, 5);
  if n <> 2 then raise exception 'expected 2 popular templates, got %', n; end if;
  select count(*) into n from public.template_popularity(30, 1);
  if n <> 1 then raise exception 'limit not applied'; end if;
  reset role;
  -- old events fall out of the window
  update public.template_events set created_at = now() - interval '90 days' where template_id = 'youtube-thumbnail';
  select count(*) into n from public.template_popularity(30, 5);
  if n <> 1 then raise exception 'old event should be outside the 30 day window'; end if;
end $$;

select 'template favorites + popularity assertions passed' as result;
