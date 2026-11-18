-- ===========================================================================
-- web_push_notifications.sql — browser push for owner alerts
--
-- Every row inserted into public.owner_notifications (new_lead, the retarget
-- types, video activity) can raise a Web Push. The database only *pokes* the
-- Netlify function push-dispatch with the notification id (pg_net); the
-- function applies the owner's preferences/quiet hours and sends the push.
-- daily_digest never pushes. A push problem can never block or roll back the
-- notification insert (the trigger never raises and is a no-op without pg_net
-- or without a configured dispatch URL).
-- ===========================================================================

-- ---------------------------------------------------------------- subscriptions
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null default (auth.jwt() ->> 'sub'),
  endpoint text not null unique check (char_length(endpoint) <= 2048 and endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) <= 512),
  auth text not null check (char_length(auth) <= 512),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count integer not null default 0
);
create index if not exists push_subscriptions_owner_idx on public.push_subscriptions (clerk_user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Owners read own push subscriptions" on public.push_subscriptions;
drop policy if exists "Owners add own push subscriptions" on public.push_subscriptions;
drop policy if exists "Owners delete own push subscriptions" on public.push_subscriptions;
create policy "Owners read own push subscriptions" on public.push_subscriptions for select to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);
create policy "Owners add own push subscriptions" on public.push_subscriptions for insert to authenticated
  with check ((select auth.jwt() ->> 'sub') = clerk_user_id);
create policy "Owners delete own push subscriptions" on public.push_subscriptions for delete to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated; -- no update; service role bypasses

-- ---------------------------------------------------------------- owner opt-in
-- The existing "Owners manage own settings" policy and the table-level
-- select/insert/update grants already cover new columns, so the owner can set it.
alter table public.retarget_preferences add column if not exists push boolean not null default false;

-- ---------------------------------------------------------------- dispatch config
create table if not exists public.push_dispatch_config (
  id integer primary key check (id = 1),
  url text,
  secret text
);
alter table public.push_dispatch_config enable row level security; -- no policies: service role only
revoke all on public.push_dispatch_config from anon, authenticated;
grant select, insert, update, delete on public.push_dispatch_config to service_role;

-- ---------------------------------------------------------------- trigger
create or replace function public.push_notify_owner_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg record;
begin
  if NEW.type = 'daily_digest' then return NEW; end if;
  begin
    if to_regnamespace('net') is null then return NEW; end if;
    select url, secret into cfg from public.push_dispatch_config where id = 1;
    if not found or coalesce(cfg.url, '') = '' then return NEW; end if;
    perform net.http_post(
      url := cfg.url,
      body := jsonb_build_object('notification_id', NEW.id),
      headers := jsonb_build_object('x-push-secret', coalesce(cfg.secret, ''), 'content-type', 'application/json')
    );
  exception when others then
    null; -- a push problem must never block the notification insert
  end;
  return NEW;
end;
$$;
revoke all on function public.push_notify_owner_notification() from public, anon, authenticated;

drop trigger if exists owner_notifications_push on public.owner_notifications;
create trigger owner_notifications_push
  after insert on public.owner_notifications
  for each row execute function public.push_notify_owner_notification();

-- ---------------------------------------------------------------- realtime
-- The in-app bell subscribes with postgres_changes; RLS already limits rows to their owner.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'owner_notifications') then
    alter publication supabase_realtime add table public.owner_notifications;
  end if;
end $$;
