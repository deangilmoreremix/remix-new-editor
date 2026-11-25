-- ===========================================================================
-- template_favorites_and_popularity.sql
--
-- Explore / Templates pages:
--   template_favorites  one row per (signed-in user, template): favorites that
--                       follow the account instead of living in one browser.
--   template_events     one row per (user, template, kind, day): "open" and
--                       "favorite" signals used to rank Trending templates.
--                       Written only via record_template_event(); never readable.
--   template_popularity returns the top templates for the last N days as
--                       aggregate counts only (no user ids).
--
-- Identity model matches landing_pages: the verified Clerk `sub`.
-- Hardening-safe: explicit RLS, GRANT and REVOKE (see supabase/tests/README.md).
-- ===========================================================================

-- ------------------------------------------------------------- favorites
create table if not exists public.template_favorites (
  clerk_user_id text not null default (auth.jwt() ->> 'sub'),
  template_id text not null
    check (template_id ~ '^[A-Za-z0-9_.:-]{1,100}$'),
  created_at timestamptz not null default now(),
  primary key (clerk_user_id, template_id)
);

create index if not exists template_favorites_owner_idx
  on public.template_favorites (clerk_user_id, created_at desc);

alter table public.template_favorites enable row level security;

drop policy if exists "Owners read own template favorites" on public.template_favorites;
drop policy if exists "Owners insert own template favorites" on public.template_favorites;
drop policy if exists "Owners delete own template favorites" on public.template_favorites;

create policy "Owners read own template favorites"
  on public.template_favorites for select to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Owners insert own template favorites"
  on public.template_favorites for insert to anon, authenticated
  with check ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Owners delete own template favorites"
  on public.template_favorites for delete to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

revoke all on public.template_favorites from public, anon, authenticated;
grant select, insert, delete on public.template_favorites to anon, authenticated;

-- ---------------------------------------------------------------- events
create table if not exists public.template_events (
  id bigint generated always as identity primary key,
  clerk_user_id text not null,
  template_id text not null
    check (template_id ~ '^[A-Za-z0-9_.:-]{1,100}$'),
  kind text not null check (kind in ('open', 'favorite')),
  created_day date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now()
);

-- One signal per user, template, kind and day: opening a template twice, or
-- toggling its star repeatedly, cannot inflate the ranking.
create unique index if not exists template_events_once_per_day_idx
  on public.template_events (clerk_user_id, template_id, kind, created_day);

create index if not exists template_events_window_idx
  on public.template_events (created_at desc, template_id);

alter table public.template_events enable row level security;
revoke all on public.template_events from public, anon, authenticated;

create or replace function public.record_template_event(p_template_id text, p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user text := auth.jwt() ->> 'sub';
begin
  -- Only signed-in people count, so anonymous traffic cannot move the ranking.
  if v_user is null or v_user = '' then
    return;
  end if;
  if p_kind is null or p_kind not in ('open', 'favorite') then
    return;
  end if;
  if p_template_id is null or p_template_id !~ '^[A-Za-z0-9_.:-]{1,100}$' then
    return;
  end if;
  insert into public.template_events (clerk_user_id, template_id, kind)
  values (v_user, p_template_id, p_kind)
  on conflict do nothing;
end;
$$;

revoke all on function public.record_template_event(text, text) from public, anon, authenticated;
grant execute on function public.record_template_event(text, text) to anon, authenticated;

-- ------------------------------------------------------------ popularity
create or replace function public.template_popularity(p_days integer default 30, p_limit integer default 16)
returns table (template_id text, score bigint, opens bigint, favorites bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select e.template_id,
         (count(distinct e.clerk_user_id) filter (where e.kind = 'open')
          + 3 * count(distinct e.clerk_user_id) filter (where e.kind = 'favorite'))::bigint as score,
         count(distinct e.clerk_user_id) filter (where e.kind = 'open')::bigint as opens,
         count(distinct e.clerk_user_id) filter (where e.kind = 'favorite')::bigint as favorites
    from public.template_events e
   where e.created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365))
   group by e.template_id
   order by score desc, e.template_id
   limit least(greatest(coalesce(p_limit, 16), 1), 50);
$$;

revoke all on function public.template_popularity(integer, integer) from public, anon, authenticated;
grant execute on function public.template_popularity(integer, integer) to anon, authenticated;
