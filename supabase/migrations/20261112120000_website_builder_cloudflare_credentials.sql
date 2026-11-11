-- Smart Website Builder: each user's own Cloudflare account for publishing.
--
-- The API token is stored encrypted (AES-256-GCM, per-user key derived from the
-- server secret KEY_ENCRYPTION_SECRET) and is only ever read by the Netlify
-- function website-builder-api with the service role. Row level security is on
-- with NO policies and every right is revoked from the browser roles, so a
-- signed-in user cannot read it back, not even their own row.
create table if not exists public.wb_cloudflare_credentials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  account_id text not null,
  token_enc text not null,
  token_last4 text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wb_cloudflare_credentials enable row level security;
revoke all on public.wb_cloudflare_credentials from public, anon, authenticated;
grant all on public.wb_cloudflare_credentials to service_role;

-- "Delete Website Builder data" (Settings → Danger Zone) also removes the saved
-- hosting credentials and Supabase connection. The auth account is untouched.
create or replace function public.wb_delete_user()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.wb_projects where user_id = auth.uid();
  delete from public.wb_provider_keys where user_id = auth.uid();
  delete from public.wb_community_posts where user_id = auth.uid();
  delete from public.wb_cloudflare_credentials where user_id = auth.uid();
  delete from public.wb_supabase_connections where user_id = auth.uid();
  delete from public.wb_profiles where id = auth.uid();
end;
$$;
revoke all on function public.wb_delete_user() from public, anon;
grant execute on function public.wb_delete_user() to authenticated;
