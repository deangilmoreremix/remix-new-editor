-- ===========================================================================
-- create_template_generator_templates.sql
--
-- Reusable templates made in the timeline editor's Template Generator, synced
-- so they follow a signed-in user across devices (src/components/modals/
-- template-generator/sync.js; the local copy lives in localStorage).
--
--   clerk_user_id owner — the verified Clerk `sub` (same identity model as
--                 20261105120000_create_published_videos.sql)
--   id            client-generated template id ("tpl-…"); unique per owner
--   record        the template recipe (niche, script, clips, transition, text
--                 elements, voice settings) as plain JSON
--   deleted_at    tombstone: set when the owner deletes a template, so their
--                 other devices learn about the delete instead of re-uploading it
--   updated_at    last edit (client clock, last write wins)
--
-- SHARED DATABASE: this project is shared by several applications. This
-- migration only creates one new, app-specific table and its own policies,
-- function and trigger; it touches nothing that exists.
--
-- RLS: signed-in owners (verified JWT, role 'authenticated') manage only their
-- own rows. The anon role gets nothing — a caller without a verified token has
-- a NULL `sub` and cannot read or write any row.
--
-- IDEMPOTENT: safe to re-run.
-- ===========================================================================

create table if not exists public.template_generator_templates (
  clerk_user_id text not null default (auth.jwt() ->> 'sub'),
  id text not null
    check (id ~ '^[A-Za-z0-9_-]{4,64}$'),
  name text not null default 'Untitled template'
    check (char_length(name) <= 120),
  niche text
    check (niche is null or char_length(niche) <= 120),
  record jsonb not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (clerk_user_id, id),
  constraint template_generator_templates_record_is_object check (jsonb_typeof(record) = 'object'),
  constraint template_generator_templates_record_size check (pg_column_size(record) < 262144)
);

create index if not exists template_generator_templates_owner_updated_idx
  on public.template_generator_templates (clerk_user_id, updated_at desc);

alter table public.template_generator_templates enable row level security;

drop policy if exists "Owners read own templates" on public.template_generator_templates;
drop policy if exists "Owners insert own templates" on public.template_generator_templates;
drop policy if exists "Owners update own templates" on public.template_generator_templates;
drop policy if exists "Owners delete own templates" on public.template_generator_templates;

create policy "Owners read own templates"
  on public.template_generator_templates
  for select
  to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Owners insert own templates"
  on public.template_generator_templates
  for insert
  to authenticated
  with check ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Owners update own templates"
  on public.template_generator_templates
  for update
  to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id)
  with check ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Owners delete own templates"
  on public.template_generator_templates
  for delete
  to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

-- Only the privileges the policies are written for (no TRUNCATE, which would
-- bypass RLS, and nothing at all for anon).
revoke all on public.template_generator_templates from anon;
revoke all on public.template_generator_templates from authenticated;
grant select, insert, update, delete on public.template_generator_templates to authenticated;

-- An absurd client clock must not pin a template as "newest forever": cap
-- updated_at at one day ahead. created_at is never changed after insert.
create or replace function public.template_generator_templates_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := least(coalesce(new.updated_at, now()), now() + interval '1 day');
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

revoke execute on function public.template_generator_templates_guard() from public, anon, authenticated;

drop trigger if exists template_generator_templates_guard on public.template_generator_templates;
create trigger template_generator_templates_guard
  before insert or update on public.template_generator_templates
  for each row execute function public.template_generator_templates_guard();
