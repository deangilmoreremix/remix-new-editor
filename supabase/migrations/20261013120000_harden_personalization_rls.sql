-- ===========================================================================
-- harden_personalization_rls.sql
--
-- Replaces the APP-ENFORCED identity workaround installed by
-- 20261013000000_fix_personalization_outputs_rls.sql with CRYPTOGRAPHICALLY
-- VERIFIED Clerk identity, via Supabase's supported "third-party auth"
-- integration for Clerk.
--
-- WHAT CHANGED AND WHY (the vulnerability this closes)
--   20261013000000 made the browser announce its own identity through a
--   public RPC (`set_app_clerk_user_id(p_user_id)`) that wrote a session GUC
--   (`app.clerk_user_id`), and gated RLS on
--       clerk_user_id = public.current_clerk_user_id()
--   which reads that GUC back. Because the GUC value came FROM THE CLIENT,
--   any caller could invoke the RPC with ANOTHER user's id and read/write
--   their rows: the database never verified who the caller was. The Phase 2
--   header documented that limit honestly; this migration removes the
--   client-controllable path entirely.
--
-- WHAT IS GUARANTEED AFTER THIS MIGRATION
--   * Every policy on public.personalization_outputs (and, defensively, on
--     public.personalization_discovery_jobs) compares the row's owner column
--     against `(select auth.jwt() ->> 'sub')` — the `sub` claim of a Clerk
--     session JWT that SUPABASE ITSELF has verified against the Clerk JWKS
--     (signature + issuer). A forged, client-invented, or copied id can no
--     longer satisfy the predicate, because the database no longer trusts
--     any value the client announces: there is no RPC, no GUC, and no
--     client-supplied owner left in the enforcement path.
--   * RLS stays enabled on both tables. There is no `using (true)`, no
--     blanket anon/public grant, and no service-role use from the browser.
--     Policies fail CLOSED.
--
-- PREREQUISITE — EXTERNAL CONFIGURATION A HUMAN MUST APPLY (code alone
-- cannot enable it; without it the tables simply stay closed):
--   1. In the Clerk Dashboard, open the "Connect with Supabase" page
--      (https://dashboard.clerk.com/setup/supabase) and follow it. It
--      configures the Clerk instance for Supabase compatibility, including
--      adding the `role: "authenticated"` claim to session tokens (required:
--      PostgREST maps the JWT `role` claim to a Postgres role, and these
--      policies are granted to `anon, authenticated`).
--      Manual equivalent: customize Clerk session tokens to add the
--      `role` claim with value `authenticated`
--      (https://clerk.com/docs/backend-requests/custom-session-token).
--   2. In the Supabase Dashboard, add Clerk as a third-party auth provider:
--      Authentication > Sign In/Up > Third-Party Auth > Add provider >
--      Clerk, and enter the Clerk Frontend API domain (e.g.
--      `example.clerk.accounts.dev`). Supabase derives the JWKS from that
--      domain:
--          https://<clerk-frontend-api-domain>/.well-known/jwks.json
--      For local/self-hosted (supabase/config.toml):
--          [auth.third_party.clerk]
--          enabled = true
--          domain = "example.clerk.accounts.dev"
--   3. The browser client (src/lib/supabase.js) then sends the Clerk
--      session token on every request via the supabase-js `accessToken`
--      async option.
--   Sources: https://supabase.com/docs/guides/auth/third-party/clerk and
--   https://clerk.com/docs/guides/development/integrations/databases/supabase
--
--   NOTE ON THE DEPRECATED JWT-TEMPLATE PATH: before 2025-04-01 the Clerk
--   integration used a Clerk JWT template (commonly named `supabase`) plus
--   Supabase's configurable JWT secret / JWKS URL. Supabase deprecated it
--   ("a problematic security practice": the project's JWT secret was shared
--   with a third party). The template path still exists for projects on the
--   old integration and src/lib/personalizationAuth.js can mint such a token
--   explicitly (getPersonalizationAccessToken({ template: 'supabase' })),
--   but it is NOT required by — and not used by default in — the flow above.
--
-- FAILURE MODE (fail closed, by design): until the third-party provider is
-- configured, browser requests carry no verified Clerk JWT, so
-- `auth.jwt() ->> 'sub'` is NULL, every predicate below evaluates to NULL,
-- and all four operations match zero rows. That is the safe direction: a
-- misconfigured deployment loses access, it never grants it.
--
-- WHY `auth.jwt() ->> 'sub'` AND NOT `auth.uid()`: Clerk user ids are
-- strings (`user_2...`) while `auth.uid()` returns a uuid — Supabase's own
-- docs state auth.uid() "cannot be used when accessing Supabase data with
-- Clerk" and prescribe `(select auth.jwt() ->> 'sub')` against a text owner
-- column instead. Comparing against a TEXT column is therefore mandatory,
-- not a stylistic choice.
--
-- TWO EXISTING TABLE SHAPES (both safe for this migration):
--   * Shape A — 20260709_intelligence_personalization_tables.sql: uuid `id`,
--     `project_id` FK, NO `clerk_user_id` column, legacy auth.uid()-scoped
--     policies, written by Netlify functions with the service role.
--   * Shape B — 20261012000000_create_personalization_outputs.sql: text
--     `id`, `clerk_user_id text not null`, 20261013000000's GUC policies.
--   This migration runs on EITHER shape: it adds the owner column only when
--   absent, drops whichever policy names exist, and never assumes the
--   ported table exists. It is idempotent (re-runnable).
--
-- NOTE ON THE PHASE 2 FILE: 20261013000000 is left untouched — migrations
-- are append-only history and everything it installed is dropped below.
-- (For the record: 20261012000000 hard-fails on Shape A because it creates
-- an index on `clerk_user_id` before that column exists; that file belongs
-- to the port and is out of scope here, but the column it indexes is added
-- below.)
-- ===========================================================================

-- 1 ── Remove the client-controllable identity path ────────────────────────
-- Policies must be dropped BEFORE the functions they reference: Postgres
-- refuses to drop a function that a policy still depends on. `if exists`
-- makes every statement safe on either shape (and on re-runs).

-- 1a. The GUC-announced-owner policies installed by 20261013000000
--     (20261012000000 had used the same names).
drop policy if exists "Users can view own personalization outputs" on public.personalization_outputs;
drop policy if exists "Users can insert own personalization outputs" on public.personalization_outputs;
drop policy if exists "Users can update own personalization outputs" on public.personalization_outputs;
drop policy if exists "Users can delete own personalization outputs" on public.personalization_outputs;
-- 1b. The legacy Shape-A policy, scoped through personalization_projects.
--     Dropped for two reasons: (i) `auth.uid()` is a uuid cast that ERRORS
--     (rather than returning zero rows) once a Clerk JWT — whose sub is
--     `user_...` — reaches the database, so leaving it installed would turn
--     every browser query into a 500; (ii) service-role writers (Netlify
--     functions) bypass RLS and are unaffected by the drop.
drop policy if exists "Users can view own outputs" on public.personalization_outputs;
-- 1c. The RPC and the helper that read the client-announced GUC. These must
--     not exist in the final schema: they are the impersonation vector.
drop function if exists public.set_app_clerk_user_id(text);
drop function if exists public.current_clerk_user_id();
-- 1d. Left over from 20261012000000 (already dropped by 20261013000000);
--     kept here so the removal is total and re-runnable.
drop function if exists public.current_user_id();

-- 2 ── One owner column, whichever shape is present ────────────────────────
-- Shape B already has `clerk_user_id text not null` (no-op there); Shape A
-- gains it as a nullable text column. No NOT NULL is forced: Shape A may
-- hold legacy rows with no owner, and adding the constraint would abort the
-- migration on them.
alter table public.personalization_outputs add column if not exists clerk_user_id text;

-- Owner-scoped lookups (RLS evaluates this predicate per statement).
create index if not exists personalization_outputs_clerk_user_id_idx
  on public.personalization_outputs (clerk_user_id);

-- Rows inserted WITHOUT an explicit owner still get the VERIFIED sub from
-- the JWT — the value comes from the database-verified token, never from
-- the client, so this default cannot be forged. Explicit values (including
-- a signed-out client's NULL, which no JWT can match) always win, so a
-- forged owner is still rejected by the policies below.
alter table public.personalization_outputs
  alter column clerk_user_id set default ((select auth.jwt() ->> 'sub'));

-- 3 ── Legacy rows: never silently adoptable ───────────────────────────────
-- Owners stamped by the app-enforced era are not verified identities and
-- must not survive as magic strings. Empty stamps are unusable, and the
-- shared 'anonymous' fallback bucket (stamped when nobody was signed in)
-- belonged to EVERY signed-out session — exactly the cross-user exposure
-- this migration removes. NULL-ing them makes them unreachable through the
-- policies below (NULL never equals a sub claim); the service role, which
-- bypasses RLS, still sees them.
update public.personalization_outputs
   set clerk_user_id = null
 where clerk_user_id is not null
   and (btrim(clerk_user_id) = '' or clerk_user_id = 'anonymous');
-- Any other historical stamp (e.g. a MuAPI-key hash) is likewise
-- unreachable: no verified Clerk JWT will ever present an equal `sub`.

-- 4 ── Clerk-verified policies on personalization_outputs ──────────────────
alter table public.personalization_outputs enable row level security;

-- `to anon, authenticated` (rather than `to authenticated` only): the
-- Postgres role PostgREST uses follows the JWT `role` claim, which the
-- Clerk "Connect with Supabase" setup adds. Granting both roles keeps the
-- table usable on either configuration — identity is still verified
-- cryptographically by the sub-claim comparison in every policy.
-- `(select auth.jwt() ->> 'sub')` is wrapped in a subselect so it is
-- evaluated once per statement instead of once per row.

create policy "Clerk-verified users select own personalization outputs"
  on public.personalization_outputs
  for select
  to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Clerk-verified users insert own personalization outputs"
  on public.personalization_outputs
  for insert
  to anon, authenticated
  with check ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Clerk-verified users update own personalization outputs"
  on public.personalization_outputs
  for update
  to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id)
  with check ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Clerk-verified users delete own personalization outputs"
  on public.personalization_outputs
  for delete
  to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

-- 5 ── Same guarantee for the discovery-job table (defence in depth) ───────
-- netlify/functions/personalization-discovery.js is the only writer and
-- uses the SERVICE ROLE (which bypasses RLS), so this table was previously
-- policy-less by design. These owner-scoped policies add the same
-- DB-verified guarantee in case a client is ever granted direct access:
-- a caller can only ever see rows whose owner is their own verified sub.
-- Rows written by internal shared-secret callers (`user_id` IS NULL) stay
-- invisible to end users. The `user_id` column is already text, so the
-- comparison needs no cast.
alter table public.personalization_discovery_jobs enable row level security;

create policy "Clerk-verified users select own discovery jobs"
  on public.personalization_discovery_jobs
  for select
  to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);

create policy "Clerk-verified users insert own discovery jobs"
  on public.personalization_discovery_jobs
  for insert
  to anon, authenticated
  with check ((select auth.jwt() ->> 'sub') = user_id);

create policy "Clerk-verified users update own discovery jobs"
  on public.personalization_discovery_jobs
  for update
  to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);

create policy "Clerk-verified users delete own discovery jobs"
  on public.personalization_discovery_jobs
  for delete
  to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);
