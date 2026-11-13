-- Saved personalization layouts (Stage 1): a user's reusable arrangements of layers.
--
-- A layout is GEOMETRY ONLY (position, size, rotation, opacity, visibility, lock, grouping, footage transform). It never
-- contains text, pictures, URLs or custom-field values, so a layout cannot carry one prospect's content to another.
-- The server route (netlify/functions/_personalization/app/api/personalization/layouts/route.ts) is the only writer; it
-- validates the payload and calls the RPCs below with the Clerk user id from the verified session.
--
-- Same ownership idiom as personalization_saved_projects / lead_finder_leads:
--   * rows are owned by clerk_user_id, RLS is own-row on auth.jwt()->>'sub' (or the app.clerk_user_id GUC the RPCs set);
--   * a browser calling PostgREST directly has neither, so every row is invisible (fail closed);
--   * the RPCs are SECURITY DEFINER with a pinned search_path and are executable by service_role only.

create table if not exists public.personalization_saved_layouts (
  id             uuid primary key default gen_random_uuid(),
  clerk_user_id  text not null,
  name           text not null,
  layout         jsonb not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint personalization_saved_layouts_name_check
    check (char_length(btrim(name)) between 1 and 60),
  constraint personalization_saved_layouts_layout_object_check
    check (jsonb_typeof(layout) = 'object'),
  -- Geometry for a handful of layers is a few KB; 32 KB is generous and stops the table being used as a file store.
  constraint personalization_saved_layouts_layout_size_check
    check (octet_length(layout::text) <= 32768)
);

comment on table public.personalization_saved_layouts is
  'Reusable layer arrangements (geometry only), owned by a Clerk user id. See app/api/personalization/layouts/route.ts.';

-- One layout per (user, case-insensitive name): saving under an existing name replaces it.
create unique index if not exists personalization_saved_layouts_user_name_uidx
  on public.personalization_saved_layouts (clerk_user_id, lower(btrim(name)));
create index if not exists personalization_saved_layouts_user_updated_idx
  on public.personalization_saved_layouts (clerk_user_id, updated_at desc);

alter table public.personalization_saved_layouts enable row level security;

drop policy if exists "personalization_saved_layouts_select_own" on public.personalization_saved_layouts;
create policy "personalization_saved_layouts_select_own"
  on public.personalization_saved_layouts for select
  using (clerk_user_id = nullif(coalesce(auth.jwt() ->> 'sub', current_setting('app.clerk_user_id', true)), ''));

drop policy if exists "personalization_saved_layouts_insert_own" on public.personalization_saved_layouts;
create policy "personalization_saved_layouts_insert_own"
  on public.personalization_saved_layouts for insert
  with check (clerk_user_id = nullif(coalesce(auth.jwt() ->> 'sub', current_setting('app.clerk_user_id', true)), ''));

drop policy if exists "personalization_saved_layouts_update_own" on public.personalization_saved_layouts;
create policy "personalization_saved_layouts_update_own"
  on public.personalization_saved_layouts for update
  using (clerk_user_id = nullif(coalesce(auth.jwt() ->> 'sub', current_setting('app.clerk_user_id', true)), ''))
  with check (clerk_user_id = nullif(coalesce(auth.jwt() ->> 'sub', current_setting('app.clerk_user_id', true)), ''));

drop policy if exists "personalization_saved_layouts_delete_own" on public.personalization_saved_layouts;
create policy "personalization_saved_layouts_delete_own"
  on public.personalization_saved_layouts for delete
  using (clerk_user_id = nullif(coalesce(auth.jwt() ->> 'sub', current_setting('app.clerk_user_id', true)), ''));

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.personalization_saved_layouts_list(p_clerk_user_id text)
returns setof public.personalization_saved_layouts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_clerk_user_id is null or p_clerk_user_id = '' then
    raise exception 'personalization_saved_layouts_list: clerk_user_id is required' using errcode = '28000';
  end if;
  perform set_config('app.clerk_user_id', p_clerk_user_id, true);
  return query
    select * from public.personalization_saved_layouts
    where clerk_user_id = p_clerk_user_id
    order by updated_at desc
    limit 30;
end;
$$;

-- Upsert by (user, name). A NEW name is refused (errcode 53400) once the user already has 30 layouts.
create or replace function public.personalization_saved_layouts_save(
  p_clerk_user_id text,
  p_name text,
  p_layout jsonb
)
returns public.personalization_saved_layouts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.personalization_saved_layouts;
  v_count integer;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if p_clerk_user_id is null or p_clerk_user_id = '' then
    raise exception 'personalization_saved_layouts_save: clerk_user_id is required' using errcode = '28000';
  end if;
  perform set_config('app.clerk_user_id', p_clerk_user_id, true);

  update public.personalization_saved_layouts
     set name = v_name, layout = p_layout, updated_at = now()
   where clerk_user_id = p_clerk_user_id and lower(btrim(name)) = lower(v_name)
  returning * into v_row;
  if found then
    return v_row;
  end if;

  select count(*) into v_count from public.personalization_saved_layouts where clerk_user_id = p_clerk_user_id;
  if v_count >= 30 then
    raise exception 'personalization_saved_layouts_save: layout limit (30) reached' using errcode = '53400';
  end if;

  insert into public.personalization_saved_layouts (clerk_user_id, name, layout)
  values (p_clerk_user_id, v_name, p_layout)
  returning * into v_row;
  return v_row;
end;
$$;

-- Returns true when a row owned by the caller was deleted, false otherwise (including "not yours": no existence leak).
create or replace function public.personalization_saved_layouts_delete(p_id uuid, p_clerk_user_id text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
begin
  if p_clerk_user_id is null or p_clerk_user_id = '' then
    raise exception 'personalization_saved_layouts_delete: clerk_user_id is required' using errcode = '28000';
  end if;
  perform set_config('app.clerk_user_id', p_clerk_user_id, true);
  delete from public.personalization_saved_layouts where id = p_id and clerk_user_id = p_clerk_user_id;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

revoke all on function public.personalization_saved_layouts_list(text) from public, anon, authenticated;
revoke all on function public.personalization_saved_layouts_save(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.personalization_saved_layouts_delete(uuid, text) from public, anon, authenticated;
grant execute on function public.personalization_saved_layouts_list(text) to service_role;
grant execute on function public.personalization_saved_layouts_save(text, text, jsonb) to service_role;
grant execute on function public.personalization_saved_layouts_delete(uuid, text) to service_role;

-- The browser never reads or writes the table directly.
revoke all on table public.personalization_saved_layouts from anon, authenticated;
