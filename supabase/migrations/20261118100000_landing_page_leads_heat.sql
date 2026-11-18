-- ===========================================================================
-- landing_page_leads_heat.sql — private lead-delivery settings and heat maps for landing pages (/p/<slug>)
--
-- Adds, without touching any existing table or function:
--   1. landing_page_form_settings  OWNER-ONLY delivery settings for a page's forms, in the List Builder's shape
--      (webhookEnabled/webhook/webhook2/webhook3, emailEnabled/emailAddress/2/3, espProvider/espListId). The page row
--      (landing_pages.config) is publicly readable, so these can never live there. The lead-capture function reads
--      them with the service role and runs the same after-save work as for published videos.
--   2. landing_page_heat           click / scroll-depth / per-second watch samples from the public page.
--      Written only by record_page_heat() (anon may call it; it validates everything and only accepts published pages).
--      Read only through the owner RPCs below. No text, selectors, form values, keystrokes or IPs are stored:
--      clicks are coordinates in permille of the page, scroll is a depth percentage, watch is a second index.
--   3. Owner RPCs: page_heat_clicks / page_heat_scroll / page_heat_watch (aggregated; a cell or second needs 3
--      distinct sessions, so one visitor can't be picked out) and page_heat_by_contact (the owner's own personal links:
--      one row per contact, no suppression, because those visitors are the owner's own recipients).
--
-- Auth convention (same as 20261113120000_create_landing_pages.sql): owner = landing_pages.clerk_user_id = JWT `sub`.
-- RLS enabled; the heat table has no client policy at all. Idempotent: safe to run twice.
-- ===========================================================================

-- ------------------------------------------------------------------ form settings
create table if not exists public.landing_page_form_settings (
  page_id text primary key references public.landing_pages (id) on delete cascade,
  clerk_user_id text not null default (auth.jwt() ->> 'sub'),
  settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) <= 8192),
  updated_at timestamptz not null default now()
);

alter table public.landing_page_form_settings enable row level security;

drop policy if exists "form settings: owner select" on public.landing_page_form_settings;
create policy "form settings: owner select" on public.landing_page_form_settings
  for select to authenticated using (clerk_user_id = (select auth.jwt() ->> 'sub'));

drop policy if exists "form settings: owner insert" on public.landing_page_form_settings;
create policy "form settings: owner insert" on public.landing_page_form_settings
  for insert to authenticated
  with check (
    clerk_user_id = (select auth.jwt() ->> 'sub')
    and exists (select 1 from public.landing_pages p where p.id = page_id and p.clerk_user_id = (select auth.jwt() ->> 'sub'))
  );

drop policy if exists "form settings: owner update" on public.landing_page_form_settings;
create policy "form settings: owner update" on public.landing_page_form_settings
  for update to authenticated
  using (clerk_user_id = (select auth.jwt() ->> 'sub'))
  with check (
    clerk_user_id = (select auth.jwt() ->> 'sub')
    and exists (select 1 from public.landing_pages p where p.id = page_id and p.clerk_user_id = (select auth.jwt() ->> 'sub'))
  );

drop policy if exists "form settings: owner delete" on public.landing_page_form_settings;
create policy "form settings: owner delete" on public.landing_page_form_settings
  for delete to authenticated using (clerk_user_id = (select auth.jwt() ->> 'sub'));

revoke all on public.landing_page_form_settings from public, anon;
grant select, insert, update, delete on public.landing_page_form_settings to authenticated;

-- ------------------------------------------------------------------ heat samples
create table if not exists public.landing_page_heat (
  id bigint generated always as identity primary key,
  page_id text not null references public.landing_pages (id) on delete cascade,
  contact_id text check (contact_id is null or contact_id ~ '^[A-Za-z0-9_-]{1,80}$'),
  session text not null check (session ~ '^[A-Za-z0-9_-]{8,40}$'),
  type text not null check (type in ('click', 'scroll', 'watch')),
  viewport text not null default 'desktop' check (viewport in ('mobile', 'tablet', 'desktop')),
  x smallint check (x is null or x between 0 and 1000),
  y smallint check (y is null or y between 0 and 1000),
  depth smallint check (depth is null or depth between 0 and 100),
  sec integer check (sec is null or sec between 0 and 86400),
  cta text check (cta is null or char_length(cta) <= 80),
  created_at timestamptz not null default now()
);
create index if not exists landing_page_heat_page_time_idx on public.landing_page_heat (page_id, created_at);
create index if not exists landing_page_heat_page_contact_idx on public.landing_page_heat (page_id, contact_id) where contact_id is not null;
create index if not exists landing_page_heat_page_session_idx on public.landing_page_heat (page_id, session);

alter table public.landing_page_heat enable row level security;
revoke all on public.landing_page_heat from public, anon, authenticated;

-- Public writer: validates the page is published, the batch is small and every value is in range.
create or replace function public.record_page_heat(
  p_page_id text,
  p_session text,
  p_events jsonb,
  p_contact_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_session is null or p_session !~ '^[A-Za-z0-9_-]{8,40}$' then return; end if;
  if p_events is null or jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) = 0 or jsonb_array_length(p_events) > 40 then return; end if;
  if p_contact_id is not null and p_contact_id !~ '^[A-Za-z0-9_-]{1,80}$' then p_contact_id := null; end if;
  if not exists (select 1 from public.landing_pages p where p.id = p_page_id and p.published = true) then return; end if;
  -- one visitor can't flood a page's samples
  if (select count(*) from public.landing_page_heat h where h.page_id = p_page_id and h.session = p_session) >= 3000 then return; end if;

  insert into public.landing_page_heat (page_id, contact_id, session, type, viewport, x, y, depth, sec, cta)
  select p_page_id, p_contact_id, p_session, e ->> 't',
         case when e ->> 'vp' in ('mobile', 'tablet', 'desktop') then e ->> 'vp' else 'desktop' end,
         case when e ->> 't' = 'click' and e ->> 'x' ~ '^\d{1,4}$' then least(1000, (e ->> 'x')::int) end,
         case when e ->> 't' = 'click' and e ->> 'y' ~ '^\d{1,4}$' then least(1000, (e ->> 'y')::int) end,
         case when e ->> 't' = 'scroll' and e ->> 'd' ~ '^\d{1,3}$' then least(100, (e ->> 'd')::int) end,
         case when e ->> 't' = 'watch' and e ->> 's' ~ '^\d{1,5}$' then least(86400, (e ->> 's')::int) end,
         case when e ->> 't' = 'click' and e ->> 'c' ~ '^[A-Za-z0-9 _.-]{1,80}$' then e ->> 'c' end
    from jsonb_array_elements(p_events) as e
   where jsonb_typeof(e) = 'object'
     and e ->> 't' in ('click', 'scroll', 'watch')
     and (
       (e ->> 't' = 'click' and e ->> 'x' ~ '^\d{1,4}$' and e ->> 'y' ~ '^\d{1,4}$')
       or (e ->> 't' = 'scroll' and e ->> 'd' ~ '^\d{1,3}$')
       or (e ->> 't' = 'watch' and e ->> 's' ~ '^\d{1,5}$')
     );
end;
$$;

revoke all on function public.record_page_heat(text, text, jsonb, text) from public;
grant execute on function public.record_page_heat(text, text, jsonb, text) to anon, authenticated;

-- ------------------------------------------------------------------ owner reads (aggregated)
-- Click map: 25-permille cells (40 x 40 grid). A cell is returned only when 3 or more distinct sessions clicked in it.
create or replace function public.page_heat_clicks(
  p_page_id text,
  p_from timestamptz default (now() - interval '30 days'),
  p_to timestamptz default now(),
  p_viewport text default null
)
returns table (cx integer, cy integer, clicks bigint, sessions bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select (h.x / 25)::int as cx, (h.y / 25)::int as cy, count(*) as clicks, count(distinct h.session) as sessions
    from public.landing_page_heat h
    join public.landing_pages p on p.id = h.page_id
   where h.page_id = p_page_id
     and p.clerk_user_id = (select auth.jwt() ->> 'sub')
     and h.type = 'click'
     and h.created_at >= p_from and h.created_at <= p_to
     and (p_viewport is null or h.viewport = p_viewport)
   group by 1, 2
  having count(distinct h.session) >= 3
   order by clicks desc
   limit 1600;
$$;

-- Scroll depth: how many sessions reached each 10% step (empty until 3 sessions exist).
create or replace function public.page_heat_scroll(
  p_page_id text,
  p_from timestamptz default (now() - interval '30 days'),
  p_to timestamptz default now(),
  p_viewport text default null
)
returns table (depth integer, sessions bigint, total_sessions bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with m as (
    select h.session, max(h.depth) as d
      from public.landing_page_heat h
      join public.landing_pages p on p.id = h.page_id
     where h.page_id = p_page_id
       and p.clerk_user_id = (select auth.jwt() ->> 'sub')
       and h.type = 'scroll'
       and h.created_at >= p_from and h.created_at <= p_to
       and (p_viewport is null or h.viewport = p_viewport)
     group by h.session
  ), t as (select count(*) as n from m)
  select s.step as depth, count(m.session) filter (where m.d >= s.step) as sessions, (select n from t) as total_sessions
    from generate_series(10, 100, 10) as s(step)
    cross join m
   where (select n from t) >= 3
   group by s.step
   order by s.step;
$$;

-- Watch time: per video second, how many sessions watched it (a second needs 3 sessions).
create or replace function public.page_heat_watch(
  p_page_id text,
  p_from timestamptz default (now() - interval '30 days'),
  p_to timestamptz default now(),
  p_viewport text default null
)
returns table (sec integer, plays bigint, sessions bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select h.sec, count(*) as plays, count(distinct h.session) as sessions
    from public.landing_page_heat h
    join public.landing_pages p on p.id = h.page_id
   where h.page_id = p_page_id
     and p.clerk_user_id = (select auth.jwt() ->> 'sub')
     and h.type = 'watch'
     and h.created_at >= p_from and h.created_at <= p_to
     and (p_viewport is null or h.viewport = p_viewport)
   group by h.sec
  having count(distinct h.session) >= 3
   order by h.sec
   limit 3600;
$$;

-- The owner's own personal links: one row per contact (their recipients), so no suppression.
create or replace function public.page_heat_by_contact(p_page_id text)
returns table (contact_id text, sessions bigint, clicks bigint, max_scroll integer, watched_seconds bigint, last_seen timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select h.contact_id,
         count(distinct h.session) as sessions,
         count(*) filter (where h.type = 'click') as clicks,
         coalesce(max(h.depth), 0)::int as max_scroll,
         count(distinct h.sec) filter (where h.type = 'watch') as watched_seconds,
         max(h.created_at) as last_seen
    from public.landing_page_heat h
    join public.landing_pages p on p.id = h.page_id
   where h.page_id = p_page_id
     and p.clerk_user_id = (select auth.jwt() ->> 'sub')
     and h.contact_id is not null
   group by h.contact_id
   order by max(h.created_at) desc
   limit 1000;
$$;

revoke all on function public.page_heat_clicks(text, timestamptz, timestamptz, text) from public, anon;
revoke all on function public.page_heat_scroll(text, timestamptz, timestamptz, text) from public, anon;
revoke all on function public.page_heat_watch(text, timestamptz, timestamptz, text) from public, anon;
revoke all on function public.page_heat_by_contact(text) from public, anon;
grant execute on function public.page_heat_clicks(text, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.page_heat_scroll(text, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.page_heat_watch(text, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.page_heat_by_contact(text) to authenticated;
