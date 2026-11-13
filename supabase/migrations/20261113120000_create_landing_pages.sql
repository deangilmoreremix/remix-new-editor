-- ===========================================================================
-- create_landing_pages.sql
--
-- Video landing pages (/p/<slug>): any video (AI-generated or uploaded MP4)
-- published as a branded page with a CTA, lead form and analytics, plus
-- per-contact personalized links (/p/<slug>?c=<contactId>).
--
--   landing_pages          one row per page (video URL + design config)
--   landing_page_contacts  recipients of personalized links (owner-only)
--   landing_page_events    viewer events, written only via record_page_event()
--
-- Identity model matches published_videos: the verified Clerk `sub`.
-- Public (anon) viewers can read published pages, resolve ONE contact's
-- display tokens by id (never the email), and record events through RPCs.
-- ===========================================================================

-- ---------------------------------------------------------------- pages
create table if not exists public.landing_pages (
  id text primary key
    check (id ~ '^[A-Za-z0-9_-]{8,32}$'),
  clerk_user_id text not null default (auth.jwt() ->> 'sub'),
  title text not null default 'Untitled page'
    check (char_length(title) <= 200),
  video_url text not null
    check (video_url ~ '^https://' and char_length(video_url) <= 2048),
  poster_url text
    check (poster_url is null or (poster_url ~ '^https://' and char_length(poster_url) <= 2048)),
  duration numeric
    check (duration is null or duration >= 0),
  source jsonb not null default '{}'::jsonb,
  config jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint landing_pages_source_is_object check (jsonb_typeof(source) = 'object'),
  constraint landing_pages_config_is_object check (jsonb_typeof(config) = 'object'),
  constraint landing_pages_config_size check (pg_column_size(config) < 262144)
);

create index if not exists landing_pages_owner_idx
  on public.landing_pages (clerk_user_id, updated_at desc);

alter table public.landing_pages enable row level security;

drop policy if exists "Anyone reads published landing pages" on public.landing_pages;
drop policy if exists "Owners read own landing pages" on public.landing_pages;
drop policy if exists "Owners insert own landing pages" on public.landing_pages;
drop policy if exists "Owners update own landing pages" on public.landing_pages;
drop policy if exists "Owners delete own landing pages" on public.landing_pages;

create policy "Anyone reads published landing pages"
  on public.landing_pages for select to anon, authenticated
  using (published = true);

create policy "Owners read own landing pages"
  on public.landing_pages for select to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Owners insert own landing pages"
  on public.landing_pages for insert to anon, authenticated
  with check ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Owners update own landing pages"
  on public.landing_pages for update to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id)
  with check ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Owners delete own landing pages"
  on public.landing_pages for delete to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

grant select, insert, update, delete on public.landing_pages to anon, authenticated;

create or replace function public.landing_pages_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and current_user in ('anon', 'authenticated') then
    new.view_count := 0;
  end if;
  if tg_op = 'UPDATE' and current_user in ('anon', 'authenticated') then
    new.view_count := old.view_count;
    new.created_at := old.created_at;
    new.clerk_user_id := old.clerk_user_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists landing_pages_guard on public.landing_pages;
create trigger landing_pages_guard
  before insert or update on public.landing_pages
  for each row execute function public.landing_pages_guard();

-- ------------------------------------------------------------- contacts
create table if not exists public.landing_page_contacts (
  id text primary key
    check (id ~ '^[A-Za-z0-9_-]{6,40}$'),
  page_id text not null references public.landing_pages (id) on delete cascade,
  clerk_user_id text not null default (auth.jwt() ->> 'sub'),
  -- Token values for the page (firstname, company, ...) plus private fields
  -- such as email. Only the keys in `public_keys` are ever returned to viewers.
  fields jsonb not null default '{}'::jsonb,
  external jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint landing_page_contacts_fields_is_object check (jsonb_typeof(fields) = 'object'),
  constraint landing_page_contacts_fields_size check (pg_column_size(fields) < 8192),
  constraint landing_page_contacts_external_is_object check (jsonb_typeof(external) = 'object')
);

create index if not exists landing_page_contacts_page_idx
  on public.landing_page_contacts (page_id, created_at desc);
create index if not exists landing_page_contacts_owner_idx
  on public.landing_page_contacts (clerk_user_id);

alter table public.landing_page_contacts enable row level security;

drop policy if exists "Owners manage own page contacts" on public.landing_page_contacts;
create policy "Owners manage own page contacts"
  on public.landing_page_contacts for all to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id)
  with check (
    (select auth.jwt() ->> 'sub') = clerk_user_id
    and exists (
      select 1 from public.landing_pages p
       where p.id = page_id and p.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

grant select, insert, update, delete on public.landing_page_contacts to anon, authenticated;

create or replace function public.landing_page_contacts_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and current_user in ('anon', 'authenticated') then
    new.page_id := old.page_id;
    new.clerk_user_id := old.clerk_user_id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists landing_page_contacts_guard on public.landing_page_contacts;
create trigger landing_page_contacts_guard
  before update on public.landing_page_contacts
  for each row execute function public.landing_page_contacts_guard();

-- A viewer opening /p/<slug>?c=<contactId> needs the contact's display
-- tokens, never their email or other private fields. Only the whitelisted
-- token keys are returned, and only for a published page.
create or replace function public.landing_page_contact_tokens(page_id text, contact_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_object_agg(kv.key, kv.value) filter (
      where kv.key in ('firstname', 'lastname', 'company', 'role', 'city', 'custom1', 'custom2', 'custom3')
    ),
    '{}'::jsonb
  )
    from public.landing_page_contacts c
    join public.landing_pages p on p.id = c.page_id and p.published = true
    cross join lateral jsonb_each(c.fields) as kv
   where c.id = landing_page_contact_tokens.contact_id
     and c.page_id = landing_page_contact_tokens.page_id;
$$;

revoke all on function public.landing_page_contact_tokens(text, text) from public;
grant execute on function public.landing_page_contact_tokens(text, text) to anon, authenticated;

-- --------------------------------------------------------------- events
create table if not exists public.landing_page_events (
  id bigint generated always as identity primary key,
  page_id text not null references public.landing_pages (id) on delete cascade,
  contact_id text
    check (contact_id is null or contact_id ~ '^[A-Za-z0-9_-]{1,80}$'),
  kind text not null
    check (kind in ('view', 'play', 'progress_25', 'progress_50', 'progress_75', 'complete', 'cta_click', 'lead')),
  created_at timestamptz not null default now()
);

create index if not exists landing_page_events_page_idx
  on public.landing_page_events (page_id, contact_id, kind);

alter table public.landing_page_events enable row level security;

drop policy if exists "Owners read their page events" on public.landing_page_events;
create policy "Owners read their page events"
  on public.landing_page_events for select to anon, authenticated
  using (exists (
    select 1 from public.landing_pages p
     where p.id = landing_page_events.page_id
       and p.clerk_user_id = (select auth.jwt() ->> 'sub')
  ));

revoke insert, update, delete on public.landing_page_events from anon, authenticated;
grant select on public.landing_page_events to anon, authenticated;

create or replace function public.record_page_event(
  page_id text,
  kind text,
  contact_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if kind not in ('view', 'play', 'progress_25', 'progress_50', 'progress_75', 'complete', 'cta_click', 'lead') then
    return;
  end if;
  if contact_id is not null and contact_id !~ '^[A-Za-z0-9_-]{1,80}$' then
    contact_id := null;
  end if;
  insert into public.landing_page_events (page_id, contact_id, kind)
  select p.id, record_page_event.contact_id, record_page_event.kind
    from public.landing_pages p
   where p.id = record_page_event.page_id
     and p.published = true;
  if kind = 'view' then
    update public.landing_pages
       set view_count = view_count + 1
     where id = record_page_event.page_id and published = true;
  end if;
end;
$$;

revoke all on function public.record_page_event(text, text, text) from public;
grant execute on function public.record_page_event(text, text, text) to anon, authenticated;

-- Totals for one of the caller's pages (RLS applies: owners only).
create or replace function public.page_stats(page_id text)
returns table (
  views bigint,
  plays bigint,
  completes bigint,
  cta_clicks bigint,
  leads bigint,
  unique_contacts bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*) filter (where e.kind = 'view'),
         count(*) filter (where e.kind = 'play'),
         count(*) filter (where e.kind = 'complete'),
         count(*) filter (where e.kind = 'cta_click'),
         count(*) filter (where e.kind = 'lead'),
         count(distinct e.contact_id)
    from public.landing_page_events e
   where e.page_id = page_stats.page_id;
$$;

revoke all on function public.page_stats(text) from public;
grant execute on function public.page_stats(text) to anon, authenticated;

-- Per-contact totals for one of the caller's pages.
create or replace function public.page_events_by_contact(page_id text)
returns table (
  contact_id text,
  views bigint,
  plays bigint,
  max_progress integer,
  completes bigint,
  cta_clicks bigint,
  leads bigint,
  last_seen timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.contact_id,
         count(*) filter (where e.kind = 'view'),
         count(*) filter (where e.kind = 'play'),
         coalesce(max(case e.kind
           when 'progress_25' then 25
           when 'progress_50' then 50
           when 'progress_75' then 75
           when 'complete' then 100
         end), 0),
         count(*) filter (where e.kind = 'complete'),
         count(*) filter (where e.kind = 'cta_click'),
         count(*) filter (where e.kind = 'lead'),
         max(e.created_at)
    from public.landing_page_events e
   where e.page_id = page_events_by_contact.page_id
     and e.contact_id is not null
   group by e.contact_id
   order by max(e.created_at) desc;
$$;

revoke all on function public.page_events_by_contact(text) from public;
grant execute on function public.page_events_by_contact(text) to anon, authenticated;
