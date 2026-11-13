-- Email suppression list (Stage 9): addresses that must never be emailed again by a given sender.
--
-- Scoped per owner (clerk_user_id): one recipient unsubscribing from one business must not silence another business. Only the SHA-256
-- of the normalised address is stored, so the table cannot be used to harvest addresses.
--
-- Writers: the public one-click unsubscribe function (after it has verified a signed token) and the owner (to remove an entry when a
-- recipient asks to be re-added). Same idiom as recipient_links / saved layouts: RLS own-row, SECURITY DEFINER RPCs with a pinned
-- search_path, executable by service_role only, no direct table access for anon/authenticated.

create table if not exists public.email_suppressions (
  clerk_user_id  text not null,
  email_hash     text not null,
  reason         text not null default 'unsubscribed',
  source         text not null default 'link',
  created_at     timestamptz not null default now(),
  primary key (clerk_user_id, email_hash),
  constraint email_suppressions_hash_check check (email_hash ~ '^[a-f0-9]{64}$'),
  constraint email_suppressions_reason_check check (reason in ('unsubscribed', 'bounced', 'complaint', 'manual')),
  constraint email_suppressions_source_check check (source in ('link', 'one-click', 'owner', 'provider'))
);

alter table public.email_suppressions enable row level security;
drop policy if exists "email_suppressions_select_own" on public.email_suppressions;
create policy "email_suppressions_select_own" on public.email_suppressions for select
  using (clerk_user_id = nullif(coalesce(auth.jwt() ->> 'sub', current_setting('app.clerk_user_id', true)), ''));
revoke all on table public.email_suppressions from anon, authenticated;

-- Idempotent: suppressing twice is fine (the first reason is kept: "unsubscribed" must not be downgraded by a later import).
create or replace function public.email_suppression_add(p_owner text, p_hash text, p_reason text, p_source text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare n integer;
begin
  if p_owner is null or p_owner = '' then raise exception 'email_suppression_add: owner is required' using errcode = '28000'; end if;
  perform set_config('app.clerk_user_id', p_owner, true);
  insert into public.email_suppressions (clerk_user_id, email_hash, reason, source)
  values (p_owner, p_hash, coalesce(p_reason, 'unsubscribed'), coalesce(p_source, 'link'))
  on conflict (clerk_user_id, email_hash) do nothing;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

-- Of these hashes, which are suppressed for this owner. (Used before every send.)
create or replace function public.email_suppression_check(p_owner text, p_hashes text[])
returns text[]
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_owner is null or p_owner = '' then raise exception 'email_suppression_check: owner is required' using errcode = '28000'; end if;
  if coalesce(array_length(p_hashes, 1), 0) > 5000 then raise exception 'email_suppression_check: at most 5000 hashes' using errcode = '22023'; end if;
  return coalesce((select array_agg(s.email_hash) from public.email_suppressions s where s.clerk_user_id = p_owner and s.email_hash = any (p_hashes)), '{}');
end;
$$;

create or replace function public.email_suppression_list(p_owner text)
returns table (email_hash text, reason text, source text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_owner is null or p_owner = '' then raise exception 'email_suppression_list: owner is required' using errcode = '28000'; end if;
  perform set_config('app.clerk_user_id', p_owner, true);
  return query select s.email_hash, s.reason, s.source, s.created_at from public.email_suppressions s where s.clerk_user_id = p_owner order by s.created_at desc limit 10000;
end;
$$;

-- Owner removes an entry (the recipient asked to be re-added). false for "not there" and for "not yours" alike.
create or replace function public.email_suppression_remove(p_owner text, p_hash text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare n integer;
begin
  if p_owner is null or p_owner = '' then raise exception 'email_suppression_remove: owner is required' using errcode = '28000'; end if;
  perform set_config('app.clerk_user_id', p_owner, true);
  delete from public.email_suppressions where clerk_user_id = p_owner and email_hash = p_hash;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.email_suppression_add(text, text, text, text) from public, anon, authenticated;
revoke all on function public.email_suppression_check(text, text[]) from public, anon, authenticated;
revoke all on function public.email_suppression_list(text) from public, anon, authenticated;
revoke all on function public.email_suppression_remove(text, text) from public, anon, authenticated;
grant execute on function public.email_suppression_add(text, text, text, text) to service_role;
grant execute on function public.email_suppression_check(text, text[]) to service_role;
grant execute on function public.email_suppression_list(text) to service_role;
grant execute on function public.email_suppression_remove(text, text) to service_role;
