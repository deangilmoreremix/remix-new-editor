-- ===========================================================================
-- webhook_deliveries.sql
--
-- Delivery log for lead webhooks forwarded by the `lead-capture` edge function
-- (one row per webhook per lead, after retries). Lets owners see why a webhook
-- failed. Only the HOST of the webhook is stored, never the full URL, because
-- URLs often embed secrets (Zapier/Make hook ids, tokens).
--
-- Same identity model as create_video_leads.sql: rows written in the editor
-- preview use the caller's Clerk JWT (RLS-enforced); rows for published videos
-- are written by the function with the service role, naming the video's owner.
-- Owners can read and delete their own rows; nobody can update them.
-- ===========================================================================

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null default (auth.jwt() ->> 'sub'),
  delivery_id uuid not null,
  project_id text,
  clip_id text,
  kind text not null default 'lead-form',
  url_host text not null,
  ok boolean not null,
  http_status integer,
  attempts smallint not null default 1,
  error text,
  created_at timestamptz not null default now(),
  constraint webhook_deliveries_host_len check (char_length(url_host) <= 255),
  constraint webhook_deliveries_error_len check (error is null or char_length(error) <= 300)
);

create index if not exists webhook_deliveries_owner_idx
  on public.webhook_deliveries (clerk_user_id, created_at desc);

alter table public.webhook_deliveries enable row level security;

drop policy if exists "Clerk-verified users select own webhook deliveries" on public.webhook_deliveries;
drop policy if exists "Clerk-verified users insert own webhook deliveries" on public.webhook_deliveries;
drop policy if exists "Clerk-verified users delete own webhook deliveries" on public.webhook_deliveries;

create policy "Clerk-verified users select own webhook deliveries"
  on public.webhook_deliveries
  for select
  to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Clerk-verified users insert own webhook deliveries"
  on public.webhook_deliveries
  for insert
  to anon, authenticated
  with check ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Clerk-verified users delete own webhook deliveries"
  on public.webhook_deliveries
  for delete
  to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

grant select, insert, delete on public.webhook_deliveries to anon, authenticated;

-- The verified Clerk user id of the caller ('' when nobody is signed in).
-- PostgREST validates the JWT before this runs, so lead-capture can use it to
-- derive a per-owner webhook signing secret without trusting an unverified token.
create or replace function public.current_clerk_sub()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'sub', '')
$$;

grant execute on function public.current_clerk_sub() to anon, authenticated;
