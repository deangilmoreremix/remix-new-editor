-- ===========================================================================
-- scheduled_social_posts.sql
--
-- Scheduled publishing for the Social Publish modal and Smart Video Scheduler.
-- Muapi's publish endpoints are immediate-only (no publish_at), so a post
-- scheduled here is stored and replayed at run_at by the social-schedule-worker
-- edge function, which pg_cron wakes every minute.
--
-- Muapi keys are per user and normally only live in the browser. A scheduled
-- post runs with nobody online, so the user's key is stored encrypted in
-- Supabase Vault for as long as they have posts in flight and is deleted once
-- they have none (see delete_schedule_key_if_idle).
--
--   clerk_user_id owner: the verified Clerk `sub` (same identity model as
--                 20261105120000_create_published_videos.sql)
--   status        scheduled -> publishing -> processing -> published
--                 scheduled -> cancelled;  any step -> failed
--
-- RLS: owners can only READ their rows. Creating and cancelling goes through
-- the social-schedule edge function (service role), so a client can never set
-- status, request_id or run_at checks itself.
--
-- MANUAL STEP after applying (once per project):
--   select vault.create_secret('<long random string>', 'social_schedule_cron_secret');
--   and set the same string as the SOCIAL_SCHEDULE_CRON_SECRET edge-function
--   secret. Until both exist the cron job does nothing.
-- ===========================================================================

create extension if not exists supabase_vault;
create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  platform text not null check (platform in ('youtube', 'tiktok', 'instagram')),
  account_id bigint not null check (account_id > 0),
  media_url text not null check (char_length(media_url) <= 2048),
  thumbnail_url text check (thumbnail_url is null or char_length(thumbnail_url) <= 2048),
  payload jsonb not null default '{}'::jsonb,
  run_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'publishing', 'processing', 'published', 'failed', 'cancelled')),
  attempts integer not null default 0,
  request_id text,
  result jsonb,
  error text check (error is null or char_length(error) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scheduled_posts_payload_is_object check (jsonb_typeof(payload) = 'object'),
  constraint scheduled_posts_payload_size check (pg_column_size(payload) < 32768)
);

create index if not exists scheduled_posts_owner_idx
  on public.scheduled_posts (clerk_user_id, run_at desc);
create index if not exists scheduled_posts_due_idx
  on public.scheduled_posts (run_at) where status = 'scheduled';
create index if not exists scheduled_posts_inflight_idx
  on public.scheduled_posts (updated_at) where status in ('publishing', 'processing');

alter table public.scheduled_posts enable row level security;

drop policy if exists "Owners read own scheduled posts" on public.scheduled_posts;
create policy "Owners read own scheduled posts"
  on public.scheduled_posts
  for select
  to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

revoke all on public.scheduled_posts from anon, authenticated;
grant select on public.scheduled_posts to authenticated;

-- ---------------------------------------------------------------------------
-- Per-user Muapi key (Vault). No policies and no grants: service role only.
-- ---------------------------------------------------------------------------
create table if not exists public.social_schedule_keys (
  clerk_user_id text primary key,
  vault_secret_id uuid not null,
  updated_at timestamptz not null default now()
);

alter table public.social_schedule_keys enable row level security;
revoke all on public.social_schedule_keys from anon, authenticated;

create or replace function public.save_schedule_key(p_user text, p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing uuid;
begin
  select vault_secret_id into existing from public.social_schedule_keys where clerk_user_id = p_user;
  if existing is not null then
    perform vault.update_secret(existing, p_key);
    update public.social_schedule_keys set updated_at = now() where clerk_user_id = p_user;
  else
    insert into public.social_schedule_keys (clerk_user_id, vault_secret_id)
    values (p_user, vault.create_secret(p_key, 'muapi_schedule_' || p_user, 'Muapi key for scheduled posts'));
  end if;
end;
$$;

create or replace function public.read_schedule_key(p_user text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.decrypted_secret
    from public.social_schedule_keys k
    join vault.decrypted_secrets s on s.id = k.vault_secret_id
   where k.clerk_user_id = p_user;
$$;

-- Deletes the stored key when the user has nothing scheduled or in flight.
-- Returns true when the key was deleted (or there was none to delete).
create or replace function public.delete_schedule_key_if_idle(p_user text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret_id uuid;
begin
  if exists (
    select 1 from public.scheduled_posts
     where clerk_user_id = p_user and status in ('scheduled', 'publishing', 'processing')
  ) then
    return false;
  end if;
  select vault_secret_id into secret_id from public.social_schedule_keys where clerk_user_id = p_user;
  if secret_id is not null then
    delete from public.social_schedule_keys where clerk_user_id = p_user;
    delete from vault.secrets where id = secret_id;
  end if;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Worker support
-- ---------------------------------------------------------------------------

-- Atomically claim due posts so two overlapping worker runs never publish the
-- same post. Rows stay 'publishing' until the worker records a request_id.
create or replace function public.claim_due_scheduled_posts(p_limit integer default 10)
returns setof public.scheduled_posts
language sql
security definer
set search_path = ''
as $$
  update public.scheduled_posts p
     set status = 'publishing', attempts = p.attempts + 1, updated_at = now()
   where p.id in (
     select id from public.scheduled_posts
      where status = 'scheduled' and run_at <= now()
      order by run_at
      limit greatest(1, least(p_limit, 50))
      for update skip locked
   )
  returning p.*;
$$;

-- A row stuck in 'publishing' means the worker died around the publish call.
-- It is NOT retried (the platform may already have the post, and a duplicate
-- public post is worse than a failed one); the owner sees the error and can
-- check the platform before rescheduling.
create or replace function public.fail_stuck_scheduled_posts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.scheduled_posts
     set status = 'failed',
         error = 'Publishing was interrupted. Check the platform before scheduling this post again.',
         updated_at = now()
   where status = 'publishing' and updated_at < now() - interval '10 minutes';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.save_schedule_key(text, text) from public, anon, authenticated;
revoke all on function public.read_schedule_key(text) from public, anon, authenticated;
revoke all on function public.delete_schedule_key_if_idle(text) from public, anon, authenticated;
revoke all on function public.claim_due_scheduled_posts(integer) from public, anon, authenticated;
revoke all on function public.fail_stuck_scheduled_posts() from public, anon, authenticated;
grant execute on function public.save_schedule_key(text, text) to service_role;
grant execute on function public.read_schedule_key(text) to service_role;
grant execute on function public.delete_schedule_key_if_idle(text) to service_role;
grant execute on function public.claim_due_scheduled_posts(integer) to service_role;
grant execute on function public.fail_stuck_scheduled_posts() to service_role;

-- ---------------------------------------------------------------------------
-- Cron: wake the worker every minute, but only when there is work, and only
-- once the shared secret exists in Vault (see MANUAL STEP above).
-- ---------------------------------------------------------------------------
create or replace function public.run_social_schedule_worker()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cron_secret text;
begin
  select decrypted_secret into cron_secret
    from vault.decrypted_secrets where name = 'social_schedule_cron_secret';
  if cron_secret is null then return; end if;

  if not exists (
    select 1 from public.scheduled_posts
     where status in ('processing', 'publishing')
        or (status = 'scheduled' and run_at <= now())
  ) then
    return;
  end if;

  perform net.http_post(
    url := 'https://bzxohkrxcwodllketcpz.supabase.co/functions/v1/social-schedule-worker',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', cron_secret)
  );
exception when others then
  -- The next minute's run retries; a failed wake-up must never raise.
  return;
end;
$$;

revoke all on function public.run_social_schedule_worker() from public, anon, authenticated;

select cron.schedule(
  'social-schedule-worker',
  '* * * * *',
  'select public.run_social_schedule_worker();'
);
