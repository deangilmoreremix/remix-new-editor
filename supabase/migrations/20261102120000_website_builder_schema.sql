-- Smart Website Builder (apps/openthorn) schema.
--
-- The embedded builder shares this Supabase project with the main SmartVideo
-- app. Upstream OpenThorn uses generic table/function names (projects,
-- profiles, templates, notifications, handle_new_user, is_admin, ...) that
-- already exist here with different shapes, so every builder object is
-- namespaced with a `wb_` prefix. The builder code reads table names from
-- apps/openthorn/src/lib/tables.ts.
--
-- Builder users are ordinary auth.users rows, created on demand by
-- netlify/functions/website-builder-session.js for signed-in SmartVideo
-- (Clerk) users. No trigger is added to auth.users: that function upserts the
-- wb_profiles row itself, and the main app's handle_new_user is untouched.
--
-- Additive and idempotent: creates only wb_* objects and one storage bucket.

-- ─── Profiles ──────────────────────────────────────────────────────────────
create table if not exists public.wb_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  avatar_url text,
  clerk_user_id text unique,
  custom_instructions text,
  has_seen_quickstart boolean not null default true, -- the embedded studio never shows the first-visit tour
  is_admin boolean not null default false,
  suspended boolean not null default false,
  publish_banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.wb_profiles enable row level security;

create or replace function public.wb_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.wb_is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.wb_profiles where id = auth.uid()), false)
$$;
revoke all on function public.wb_is_admin() from public, anon;
grant execute on function public.wb_is_admin() to authenticated;

create or replace function public.wb_is_publish_banned()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select publish_banned from public.wb_profiles where id = auth.uid()), false)
$$;
revoke all on function public.wb_is_publish_banned() from public, anon;
grant execute on function public.wb_is_publish_banned() to authenticated;

-- Users may edit their own name/instructions, never their privileges.
create or replace function public.wb_protect_privileged_profile_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.is_admin is distinct from old.is_admin
      or new.suspended is distinct from old.suspended
      or new.publish_banned is distinct from old.publish_banned
      or new.email is distinct from old.email
      or new.clerk_user_id is distinct from old.clerk_user_id) then
    if auth.uid() is not null and not public.wb_is_admin() then
      raise exception 'changing privileged profile columns is not allowed';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists wb_profiles_protect on public.wb_profiles;
create trigger wb_profiles_protect before update on public.wb_profiles
  for each row execute procedure public.wb_protect_privileged_profile_columns();
drop trigger if exists wb_profiles_updated_at on public.wb_profiles;
create trigger wb_profiles_updated_at before update on public.wb_profiles
  for each row execute procedure public.wb_set_updated_at();

drop policy if exists wb_profiles_select_own on public.wb_profiles;
create policy wb_profiles_select_own on public.wb_profiles
  for select to authenticated using (auth.uid() = id or public.wb_is_admin());
drop policy if exists wb_profiles_update_own on public.wb_profiles;
create policy wb_profiles_update_own on public.wb_profiles
  for update to authenticated using (auth.uid() = id or public.wb_is_admin());
grant select, update on table public.wb_profiles to authenticated;

-- ─── Projects + collaborators ──────────────────────────────────────────────
create table if not exists public.wb_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled project',
  files jsonb,
  chat_history jsonb,
  agent_history jsonb,
  selected_model jsonb,
  preview_url text,
  cf_pages_project_name text,
  starred boolean not null default false,
  generating boolean not null default false,
  generating_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wb_projects_user_id_idx on public.wb_projects (user_id, updated_at desc);
alter table public.wb_projects enable row level security;
drop trigger if exists wb_projects_updated_at on public.wb_projects;
create trigger wb_projects_updated_at before update on public.wb_projects
  for each row execute procedure public.wb_set_updated_at();

create table if not exists public.wb_project_collaborators (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.wb_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  permission text not null default 'view' check (permission in ('view', 'edit')),
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  unique (project_id, user_id)
);
create index if not exists wb_project_collaborators_user_idx on public.wb_project_collaborators (user_id);
alter table public.wb_project_collaborators enable row level security;

-- security definer helpers avoid RLS recursion between the two tables.
create or replace function public.wb_current_user_is_collaborator(project_uuid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.wb_project_collaborators
                 where project_id = project_uuid and user_id = auth.uid());
$$;
create or replace function public.wb_current_user_has_edit_permission(project_uuid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.wb_project_collaborators
                 where project_id = project_uuid and user_id = auth.uid() and permission = 'edit');
$$;
create or replace function public.wb_current_user_is_owner(project_uuid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.wb_projects where id = project_uuid and user_id = auth.uid());
$$;
revoke all on function public.wb_current_user_is_collaborator(uuid) from public, anon;
revoke all on function public.wb_current_user_has_edit_permission(uuid) from public, anon;
revoke all on function public.wb_current_user_is_owner(uuid) from public, anon;
grant execute on function public.wb_current_user_is_collaborator(uuid) to authenticated;
grant execute on function public.wb_current_user_has_edit_permission(uuid) to authenticated;
grant execute on function public.wb_current_user_is_owner(uuid) to authenticated;

drop policy if exists wb_projects_owner_all on public.wb_projects;
create policy wb_projects_owner_all on public.wb_projects
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists wb_projects_collab_select on public.wb_projects;
create policy wb_projects_collab_select on public.wb_projects
  for select to authenticated using (public.wb_current_user_is_collaborator(id));
drop policy if exists wb_projects_collab_update on public.wb_projects;
create policy wb_projects_collab_update on public.wb_projects
  for update to authenticated using (public.wb_current_user_has_edit_permission(id));
grant select, insert, update, delete on table public.wb_projects to authenticated;

drop policy if exists wb_collab_owner_all on public.wb_project_collaborators;
create policy wb_collab_owner_all on public.wb_project_collaborators
  for all to authenticated
  using (public.wb_current_user_is_owner(project_id))
  with check (public.wb_current_user_is_owner(project_id));
drop policy if exists wb_collab_select_own on public.wb_project_collaborators;
create policy wb_collab_select_own on public.wb_project_collaborators
  for select to authenticated using (user_id = auth.uid());
grant select, insert, update, delete on table public.wb_project_collaborators to authenticated;

-- Invite lookup: returns only id + name for an exact email match.
create or replace function public.wb_find_account_by_email(lookup_email text)
returns table (id uuid, full_name text)
language sql security definer stable set search_path = public as $$
  select p.id, p.full_name from public.wb_profiles p
  where lower(p.email) = lower(trim(lookup_email)) limit 1;
$$;
revoke all on function public.wb_find_account_by_email(text) from public, anon;
grant execute on function public.wb_find_account_by_email(text) to authenticated;

-- ─── Provider keys (BYOK; values are encrypted before they are stored) ─────
create table if not exists public.wb_provider_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_id text not null,
  provider_name text not null default '',
  api_key text not null default '',
  base_url text not null default '',
  models text not null default '',
  enabled boolean not null default true,
  is_custom boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wb_provider_keys_user_idx on public.wb_provider_keys (user_id, created_at);
alter table public.wb_provider_keys enable row level security;
drop policy if exists wb_provider_keys_own on public.wb_provider_keys;
create policy wb_provider_keys_own on public.wb_provider_keys
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on table public.wb_provider_keys to authenticated;

-- ─── Admin-managed catalog / config ────────────────────────────────────────
create table if not exists public.wb_app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.wb_default_models (
  provider_id text primary key,
  models text not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.wb_notifications (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  time_label text not null default 'New',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.wb_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text unique not null,
  name text not null,
  description text not null default '',
  category text not null default 'SaaS',
  accent_color text not null default '#2563eb',
  highlights jsonb not null default '[]'::jsonb,
  files jsonb not null default '[]'::jsonb,
  featured boolean not null default false,
  sort_order int not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.wb_blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text not null default '',
  content text not null default '',
  date date not null default current_date,
  date_modified date,
  cover_youtube text,
  cover_image text,
  og_image text,
  tldr text,
  how_to jsonb,
  item_list jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wb_app_config enable row level security;
alter table public.wb_default_models enable row level security;
alter table public.wb_notifications enable row level security;
alter table public.wb_templates enable row level security;
alter table public.wb_blog_posts enable row level security;

drop policy if exists wb_app_config_read on public.wb_app_config;
create policy wb_app_config_read on public.wb_app_config for select to anon, authenticated using (true);
drop policy if exists wb_app_config_admin on public.wb_app_config;
create policy wb_app_config_admin on public.wb_app_config for all to authenticated
  using (public.wb_is_admin()) with check (public.wb_is_admin());

drop policy if exists wb_default_models_read on public.wb_default_models;
create policy wb_default_models_read on public.wb_default_models for select to anon, authenticated using (true);
drop policy if exists wb_default_models_admin on public.wb_default_models;
create policy wb_default_models_admin on public.wb_default_models for all to authenticated
  using (public.wb_is_admin()) with check (public.wb_is_admin());

drop policy if exists wb_notifications_read on public.wb_notifications;
create policy wb_notifications_read on public.wb_notifications for select to authenticated
  using (is_active or public.wb_is_admin());
drop policy if exists wb_notifications_admin on public.wb_notifications;
create policy wb_notifications_admin on public.wb_notifications for all to authenticated
  using (public.wb_is_admin()) with check (public.wb_is_admin());

drop policy if exists wb_templates_read on public.wb_templates;
create policy wb_templates_read on public.wb_templates for select to authenticated
  using (status = 'published' or public.wb_is_admin());
drop policy if exists wb_templates_admin on public.wb_templates;
create policy wb_templates_admin on public.wb_templates for all to authenticated
  using (public.wb_is_admin()) with check (public.wb_is_admin());

drop policy if exists wb_blog_posts_read on public.wb_blog_posts;
create policy wb_blog_posts_read on public.wb_blog_posts for select to anon, authenticated
  using (status = 'published' or public.wb_is_admin());
drop policy if exists wb_blog_posts_admin on public.wb_blog_posts;
create policy wb_blog_posts_admin on public.wb_blog_posts for all to authenticated
  using (public.wb_is_admin()) with check (public.wb_is_admin());

grant select on table public.wb_app_config, public.wb_default_models, public.wb_blog_posts to anon;
grant select, insert, update, delete on table
  public.wb_app_config, public.wb_default_models, public.wb_notifications,
  public.wb_templates, public.wb_blog_posts to authenticated;

-- ─── Community sharing ─────────────────────────────────────────────────────
create table if not exists public.wb_community_posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.wb_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  preview_url text,
  author_name text not null default '',
  files_snapshot jsonb not null default '[]'::jsonb,
  likes_count integer not null default 0,
  hidden boolean not null default false,
  featured boolean not null default false,
  published_at timestamptz not null default now()
);
create table if not exists public.wb_community_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.wb_community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);
alter table public.wb_community_posts enable row level security;
alter table public.wb_community_likes enable row level security;

drop policy if exists wb_community_posts_select on public.wb_community_posts;
create policy wb_community_posts_select on public.wb_community_posts for select to authenticated
  using (hidden = false or user_id = auth.uid() or public.wb_is_admin());
drop policy if exists wb_community_posts_insert on public.wb_community_posts;
create policy wb_community_posts_insert on public.wb_community_posts for insert to authenticated
  with check (user_id = auth.uid() and not public.wb_is_publish_banned());
drop policy if exists wb_community_posts_update on public.wb_community_posts;
create policy wb_community_posts_update on public.wb_community_posts for update to authenticated
  using (user_id = auth.uid() or public.wb_is_admin());
drop policy if exists wb_community_posts_delete on public.wb_community_posts;
create policy wb_community_posts_delete on public.wb_community_posts for delete to authenticated
  using (user_id = auth.uid() or public.wb_is_admin());

drop policy if exists wb_community_likes_select on public.wb_community_likes;
create policy wb_community_likes_select on public.wb_community_likes for select to authenticated using (true);
drop policy if exists wb_community_likes_insert on public.wb_community_likes;
create policy wb_community_likes_insert on public.wb_community_likes for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists wb_community_likes_delete on public.wb_community_likes;
create policy wb_community_likes_delete on public.wb_community_likes for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.wb_update_community_likes_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.wb_community_posts set likes_count = likes_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.wb_community_posts set likes_count = greatest(likes_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;
drop trigger if exists wb_community_likes_count on public.wb_community_likes;
create trigger wb_community_likes_count after insert or delete on public.wb_community_likes
  for each row execute procedure public.wb_update_community_likes_count();

grant select, insert, update, delete on table public.wb_community_posts to authenticated;
grant select, insert, delete on table public.wb_community_likes to authenticated;

-- ─── Bring-your-own Supabase backends (read-only from the browser) ─────────
create table if not exists public.wb_supabase_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  org_id text not null,
  access_token_enc text not null,
  refresh_token_enc text not null,
  expires_at timestamptz not null,
  scopes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.wb_project_backends (
  project_id uuid primary key references public.wb_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_ref text not null,
  supabase_url text not null,
  supabase_anon_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.wb_project_migrations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.wb_projects(id) on delete cascade,
  version bigint not null,
  name text not null,
  sql text not null,
  checksum text not null,
  applied_at timestamptz not null default now(),
  unique (project_id, version)
);
alter table public.wb_supabase_connections enable row level security;
alter table public.wb_project_backends enable row level security;
alter table public.wb_project_migrations enable row level security;

-- Encrypted tokens are never selectable from the browser; only this view's
-- non-secret columns are.
drop policy if exists wb_project_backends_own on public.wb_project_backends;
create policy wb_project_backends_own on public.wb_project_backends for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists wb_project_migrations_own on public.wb_project_migrations;
create policy wb_project_migrations_own on public.wb_project_migrations for select to authenticated
  using (auth.uid() = (select b.user_id from public.wb_project_backends b
                       where b.project_id = wb_project_migrations.project_id));
grant select on table public.wb_project_backends, public.wb_project_migrations to authenticated;
revoke all on table public.wb_supabase_connections from anon, authenticated;

create or replace view public.wb_supabase_connection_status with (security_invoker = true) as
  select user_id, org_id, scopes, expires_at, updated_at from public.wb_supabase_connections;

-- ─── Admin helpers ─────────────────────────────────────────────────────────
create or replace function public.wb_admin_list_users()
returns table (id uuid, email text, full_name text, avatar_url text, is_admin boolean,
               suspended boolean, publish_banned boolean, project_count bigint, post_count bigint)
language sql security definer stable set search_path = public as $$
  select p.id, p.email, p.full_name, p.avatar_url, p.is_admin, p.suspended, p.publish_banned,
         (select count(*) from public.wb_projects pr where pr.user_id = p.id),
         (select count(*) from public.wb_community_posts cp where cp.user_id = p.id)
  from public.wb_profiles p
  where public.wb_is_admin()
  order by p.email
$$;
revoke all on function public.wb_admin_list_users() from public, anon;
grant execute on function public.wb_admin_list_users() to authenticated;

-- "Delete my Website Builder data". Builder accounts are SmartVideo accounts,
-- so this removes builder rows only and never deletes the auth user.
create or replace function public.wb_delete_user()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.wb_projects where user_id = auth.uid();
  delete from public.wb_provider_keys where user_id = auth.uid();
  delete from public.wb_community_posts where user_id = auth.uid();
  delete from public.wb_profiles where id = auth.uid();
end;
$$;
revoke all on function public.wb_delete_user() from public, anon;
grant execute on function public.wb_delete_user() to authenticated;

-- ─── Realtime (dashboard live updates, collaborator presence) ──────────────
do $$
declare t text;
begin
  foreach t in array array['wb_projects', 'wb_project_collaborators', 'wb_provider_keys', 'wb_notifications'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- ─── Storage: preview thumbnails ───────────────────────────────────────────
-- Paths are previews/<project_id>/<timestamp>/thumbnail.png. Public bucket so
-- thumbnail URLs work in <img>; writes are limited to the project's owner
-- or edit-collaborators.
insert into storage.buckets (id, name, public)
values ('wb-deployments', 'wb-deployments', true)
on conflict (id) do nothing;

drop policy if exists wb_deployments_insert on storage.objects;
create policy wb_deployments_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'wb-deployments'
    and (storage.foldername(name))[1] = 'previews'
    and (public.wb_current_user_is_owner(((storage.foldername(name))[2])::uuid)
         or public.wb_current_user_has_edit_permission(((storage.foldername(name))[2])::uuid))
  );
