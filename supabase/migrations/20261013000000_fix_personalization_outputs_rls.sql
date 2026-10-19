-- ===========================================================================
-- fix_personalization_outputs_rls.sql
--
-- Makes personalization_outputs usable and correctly isolated under the
-- remix-new-editor identity model (Clerk in the browser + anon-key Supabase
-- access). Supersedes the RLS approach taken by the OpenHiggsBolt port in
-- 20261012000000_create_personalization_outputs.sql.
--
-- ROOT CAUSE OF THE MISMATCH
--   20261012000000 declared the RLS predicate
--       clerk_user_id = current_setting('app.clerk_user_id', true)
--   which is the OpenHiggsBolt handshake: every Supabase statement there is
--   preceded by supabase.rpc('set_config', {setting:'app.clerk_user_id'}).
--   The migration header then *claimed* remix-new-editor uses Supabase Auth
--   and switched the predicate to auth.uid()::text. Both are false here:
--     * No code in this repo ever calls set_config (grep: zero hits in src/),
--       so current_setting('app.clerk_user_id', true) is always NULL.
--     * This app does NOT use Supabase Auth in the browser. It uses Clerk
--       (@clerk/clerk-js, see src/lib/clerkInit.js); the browser talks to
--       Supabase with the ANON key and there is no Clerk JWT integration,
--       so auth.uid() / auth.jwt() are always NULL.
--   `NULL = <anything>` evaluates to NULL, so every SELECT/INSERT/UPDATE/
--   DELETE matched zero rows: the table was locked out for every real user,
--   and an unset GUC would also have locked it even for the app itself.
--
-- IDENTITY MODEL (what is authoritative, what the app writes)
--   The authoritative client identity is
--       src/lib/personalizationAuth.js -> getPersonalizationUserId()
--       -> src/lib/userKey.js -> getUserKey(), which resolves in order:
--         1. offlineStorage.getCurrentUserId()   (localStorage key
--            'offline_user_id' — the slot the Clerk sign-in flow writes the
--            Clerk user id into)
--         2. a stable hash of the MuAPI key ('user_<hash>')
--         3. 'anonymous'
--   On INSERT the app stamps personalization_outputs.clerk_user_id with that
--   value via withPersonalizationOwner() in the store layer; the caller can
--   never supply the owner (the stamp is overwritten, never trusted).
--   On SELECT/UPDATE/DELETE the app sends the same value, two ways:
--     a. request-scoped handshake: rpc('set_app_clerk_user_id', ...) defined
--        below sets the GUC app.clerk_user_id that the policies read;
--     b. an explicit .eq('clerk_user_id', <uid>) filter on every statement
--        (the authoritative, pool-safe channel), plus canAccess() filtering
--        in the UI as defence in depth.
--
-- WHAT THESE POLICIES GUARANTEE
--   * RLS is enabled on the table and NO policy grants access without an
--     owner predicate — there is no using(true) and no blanket anon/public
--     grant anywhere in this file.
--   * SELECT / UPDATE / DELETE only match rows whose clerk_user_id equals
--     the owner value the session presents; INSERT only accepts rows stamped
--     with the presented owner. A session presenting no owner (or a
--     different one) sees zero rows and cannot create rows for another
--     owner. Policies fail CLOSED.
--   * No service-role key is used by the browser; only the anon key.
--
-- WHAT THESE POLICIES DO *NOT* GUARANTEE (honest limits)
--   * The database cannot verify who the caller is: the browser presents
--     only the anon key, Clerk is not wired as a Supabase JWT/third-auth
--     provider, so auth.uid() is NULL and the owner value is supplied by
--     the cooperating client. Enforcement is therefore APP-ENFORCED
--     (defence in depth), not cryptographic. A malicious client can present
--     any clerk_user_id it wants. If stronger isolation is ever required,
--     the fix is server-side: Clerk JWT -> Supabase third-party auth, or a
--     Netlify/Edge function that signs the owner server-side.
--   * PostgREST runs each statement in its own transaction and Supabase may
--     pool connections, so a session-level GUC can be lost between
--     statements. That is why the client also filters explicitly
--     (.eq('clerk_user_id', uid)) on every statement and why the UI filters
--     via canAccess(); a lost GUC fails closed (zero rows), never open.
--   * 'anonymous' is a shared fallback identity: rows stamped 'anonymous'
--     are readable/writable by any session that falls back to it.
--     Signed-in rows are never exposed to anonymous sessions, and vice
--     versa: identities never cross because both the stamp and the filters
--     use the exact same getPersonalizationUserId() value.
--   * The pre-existing legacy personalization_outputs table created by
--     20260709_intelligence_personalization_tables.sql has a different
--     shape (uuid id + project_id FK, no clerk_user_id column) written by
--     Netlify functions via the service role. If that shape is present,
--     20261012000000's `create table if not exists` was a no-op and its
--     index creation already failed, so this migration guards the
--     owner-scoped policies behind a column-exists check and raises a
--     NOTICE instead of erroring; the legacy policy ("Users can view own
--     outputs", scoped through personalization_projects.user_id =
--     auth.uid()) is left untouched.
-- ===========================================================================

-- 1. Request-scoped owner handshake (public wrapper so the browser anon
--    client can call it via PostgREST; set_config itself lives in
--    pg_catalog and is not RPC-reachable). Session-level (is_local = false)
--    so it survives for subsequent statements on the same connection; the
--    client re-announces before every personalization statement to cover
--    pooled connections. SECURITY DEFINER is safe: the function only sets a
--    GUC and touches no table.
create or replace function public.set_app_clerk_user_id(p_user_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if p_user_id is null or btrim(p_user_id) = '' then
    raise exception 'set_app_clerk_user_id: owner id must be a non-empty string';
  end if;
  perform set_config('app.clerk_user_id', p_user_id, false);
end $$;

revoke all on function public.set_app_clerk_user_id(text) from public;
grant execute on function public.set_app_clerk_user_id(text) to anon, authenticated;

-- 2. The value the policies compare against. NULL when the session has not
--    announced an owner -> every predicate below evaluates to NULL -> zero
--    rows (fail closed).
create or replace function public.current_clerk_user_id()
returns text
language sql
stable
as $$
  select nullif(current_setting('app.clerk_user_id', true), '')::text;
$$;

-- 3. Remove the trap left by the ported migration: current_user_id()
--    returns auth.uid()::text, which is always NULL for Clerk browser
--    users, so any policy still using it would keep the table locked.
drop function if exists public.current_user_id();

-- 4. RLS stays enabled. Never relax it below.
alter table public.personalization_outputs enable row level security;

-- 5. Owner-scoped policies. Guarded on the ported column shape so an
--    instance still running the legacy 20260709 shape fails loudly with a
--    NOTICE instead of erroring mid-migration.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'personalization_outputs'
      and column_name = 'clerk_user_id'
  ) then
    -- Supersede the ported policies (and any earlier attempt of ours).
    drop policy if exists "Users can view own personalization outputs" on public.personalization_outputs;
    drop policy if exists "Users can insert own personalization outputs" on public.personalization_outputs;
    drop policy if exists "Users can update own personalization outputs" on public.personalization_outputs;
    drop policy if exists "Users can delete own personalization outputs" on public.personalization_outputs;

    create policy "Users can view own personalization outputs"
      on public.personalization_outputs
      for select
      to anon, authenticated
      using (clerk_user_id = public.current_clerk_user_id());

    create policy "Users can insert own personalization outputs"
      on public.personalization_outputs
      for insert
      to anon, authenticated
      with check (clerk_user_id = public.current_clerk_user_id());

    create policy "Users can update own personalization outputs"
      on public.personalization_outputs
      for update
      to anon, authenticated
      using (clerk_user_id = public.current_clerk_user_id())
      with check (clerk_user_id = public.current_clerk_user_id());

    create policy "Users can delete own personalization outputs"
      on public.personalization_outputs
      for delete
      to anon, authenticated
      using (clerk_user_id = public.current_clerk_user_id());
  else
    raise notice 'personalization_outputs has no clerk_user_id column (legacy 20260709 shape): owner-scoped policies skipped — reconcile the table shape first';
  end if;
end $$;
