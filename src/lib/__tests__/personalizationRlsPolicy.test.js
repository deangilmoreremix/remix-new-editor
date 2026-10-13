/**
 * personalizationRlsPolicy.test.js (src/lib/__tests__)
 *
 * Static verification of the DB-enforced RLS contract. This is the
 * successor/extension of
 * src/components/personalize/__tests__/personalizationRlsPolicy.test.js
 * (which asserts the superseded APP-ENFORCED phase-2 migration and is left
 * untouched). No live Supabase credentials exist in this environment, so
 * the migration SQL text itself is asserted — every assertion parses the
 * committed .sql file, nothing is fabricated.
 *
 * Asserts about supabase/migrations/20261013120000_harden_personalization_rls.sql:
 *   - The client-controllable identity path is REMOVED: the
 *     `set_app_clerk_user_id` RPC and the `current_clerk_user_id` helper
 *     are dropped, and so is every policy that depended on them (plus the
 *     legacy auth.uid()-scoped policy that would ERROR on Clerk JWTs).
 *   - The owner column is added with IF NOT EXISTS (either table shape).
 *   - SELECT / INSERT / UPDATE / DELETE policies exist on
 *     personalization_outputs and personalization_discovery_jobs, each
 *     gated on the DB-verified identity: the owner column equals the
 *     verified `sub` claim of the Clerk JWT (`auth.jwt() ->> 'sub'`),
 *     never auth.uid() (Clerk ids are strings, not UUIDs).
 *   - RLS stays enabled; there is no `using ( true )`, no blanket
 *     anon/public grant, and no service-role use from the browser path.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const MIGRATION_PATH = path.resolve(
  process.cwd(),
  'supabase/migrations/20261013120000_harden_personalization_rls.sql',
);

const PHASE2_PATH = path.resolve(
  process.cwd(),
  'supabase/migrations/20261013000000_fix_personalization_outputs_rls.sql',
);

const sql = readFileSync(MIGRATION_PATH, 'utf8');
const phase2Sql = readFileSync(PHASE2_PATH, 'utf8');

/** Normalized whitespace copy for multi-line predicate matching. */
const flat = sql.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ');

/** Every `create policy ...;` statement in the file, as raw text. */
function extractPolicies() {
  const matches = sql.match(/create policy\b[\s\S]*?;/gi) || [];
  return matches.map((s) => s.replace(/\s+/g, ' ').trim());
}

/** Policies declared on one table. */
function policiesOn(table) {
  return extractPolicies().filter((s) => s.toLowerCase().includes(`on public.${table.toLowerCase()}`));
}

/** Extract the statement that defines one named policy. */
function policyNamed(name) {
  return extractPolicies().find((s) => s.toLowerCase().includes(`"${name.toLowerCase()}"`)) || '';
}

/** The DB-verified identity predicate every policy must use. */
const VERIFIED_SUB = "(select auth.jwt() ->> 'sub')";

describe('harden_personalization_rls — client-controllable identity removed', () => {
  it('drops the set_app_clerk_user_id RPC', () => {
    expect(sql).toMatch(/drop function if exists public\.set_app_clerk_user_id\(text\);/i);
    // ...and does not re-create it anywhere.
    expect(sql).not.toMatch(/create (or replace )?function public\.set_app_clerk_user_id/i);
  });

  it('drops the current_clerk_user_id helper', () => {
    expect(sql).toMatch(/drop function if exists public\.current_clerk_user_id\(\);/i);
    expect(sql).not.toMatch(/create (or replace )?function public\.current_clerk_user_id/i);
  });

  it('drops the auth.uid()-based helper left by the ported migration', () => {
    expect(sql).toMatch(/drop function if exists public\.current_user_id\(\);/i);
  });

  it('never reads a client-announced GUC again', () => {
    expect(sql).not.toMatch(/current_setting\(\s*'app\.clerk_user_id'/i);
    expect(sql).not.toMatch(/set_config/i);
  });

  it('drops every policy that depended on the dropped helpers', () => {
    // The four GUC-owner policies installed by 20261013000000...
    for (const name of [
      'Users can view own personalization outputs',
      'Users can insert own personalization outputs',
      'Users can update own personalization outputs',
      'Users can delete own personalization outputs',
    ]) {
      expect(sql, `expected drop policy for ${name}`).toMatch(
        new RegExp(`drop policy if exists "${name}" on public\\.personalization_outputs;`, 'i'),
      );
    }
    // ...and the legacy 20260709 auth.uid()-scoped policy.
    expect(sql).toMatch(/drop policy if exists "Users can view own outputs" on public\.personalization_outputs;/i);
    // Phase 2 actually created those policies — the drop list is not hypothetical.
    expect(phase2Sql).toMatch(/set_app_clerk_user_id/i);
    expect(phase2Sql).toMatch(/current_clerk_user_id/i);
  });

  it('drops the policies BEFORE the functions they reference', () => {
    // Postgres refuses to drop a function a policy still depends on.
    const firstDropPolicy = sql.search(/drop policy if exists/i);
    const firstDropFunction = sql.search(/drop function if exists public\.(set_app_clerk_user_id|current_clerk_user_id)/i);
    expect(firstDropPolicy).toBeGreaterThanOrEqual(0);
    expect(firstDropFunction).toBeGreaterThan(firstDropPolicy);
  });
});

describe('harden_personalization_rls — owner column, both table shapes', () => {
  it('adds the owner column with IF NOT EXISTS (no assumption about the ported shape)', () => {
    expect(sql).toMatch(/alter table public\.personalization_outputs add column if not exists clerk_user_id text;/i);
    // The legacy shape (20260709) has no clerk_user_id; the ported shape
    // (20261012) has clerk_user_id text not null. The statement above is a
    // no-op there, so the migration is safe on either shape.
    expect(sql).toMatch(/create index if not exists personalization_outputs_clerk_user_id_idx/i);
  });

  it('explicitly NULLs-out unverifiable legacy owner stamps', () => {
    expect(sql).toMatch(/update public\.personalization_outputs[\s\S]*?set clerk_user_id = null/i);
    expect(sql).toMatch(/btrim\(clerk_user_id\) = '' or clerk_user_id = 'anonymous'/i);
  });
});

describe('harden_personalization_rls — DB-verified policies on personalization_outputs', () => {
  it('keeps RLS enabled', () => {
    expect(sql).toMatch(/alter table public\.personalization_outputs enable row level security;/i);
  });

  it('defines SELECT / INSERT / UPDATE / DELETE policies keyed on the verified sub claim', () => {
    expect(policyNamed('Clerk-verified users select own personalization outputs')).toMatch(/for select/i);
    expect(policyNamed('Clerk-verified users insert own personalization outputs')).toMatch(/for insert/i);
    expect(policyNamed('Clerk-verified users update own personalization outputs')).toMatch(/for update/i);
    expect(policyNamed('Clerk-verified users delete own personalization outputs')).toMatch(/for delete/i);

    for (const name of [
      'Clerk-verified users select own personalization outputs',
      'Clerk-verified users insert own personalization outputs',
      'Clerk-verified users update own personalization outputs',
      'Clerk-verified users delete own personalization outputs',
    ]) {
      const policy = policyNamed(name);
      expect(policy, `${name} must gate on the verified Clerk sub`).toContain(VERIFIED_SUB);
      expect(policy.toLowerCase()).toContain('personalization_outputs');
    }
  });

  it('compares the owner column, never auth.uid() (Clerk ids are not UUIDs)', () => {
    const outputsPolicies = policiesOn('personalization_outputs');
    expect(outputsPolicies.length).toBe(4);
    for (const policy of outputsPolicies) {
      expect(policy).toContain('= clerk_user_id');
      expect(policy).not.toMatch(/auth\.uid\(\)/);
    }
  });

  it('update and insert policies carry a WITH CHECK as well', () => {
    expect(policyNamed('Clerk-verified users update own personalization outputs')).toMatch(/with check/i);
    expect(policyNamed('Clerk-verified users insert own personalization outputs')).toMatch(/with check/i);
  });
});

describe('harden_personalization_rls — same guarantee for the discovery-job table', () => {
  it('keeps RLS enabled on personalization_discovery_jobs', () => {
    expect(sql).toMatch(/alter table public\.personalization_discovery_jobs enable row level security;/i);
  });

  it('adds owner-scoped SELECT / INSERT / UPDATE / DELETE policies', () => {
    for (const [name, cmd] of [
      ['Clerk-verified users select own discovery jobs', /for select/i],
      ['Clerk-verified users insert own discovery jobs', /for insert/i],
      ['Clerk-verified users update own discovery jobs', /for update/i],
      ['Clerk-verified users delete own discovery jobs', /for delete/i],
    ]) {
      const policy = policyNamed(name);
      expect(policy, `${name} must gate on the verified Clerk sub`).toContain(VERIFIED_SUB);
      expect(policy).toMatch(cmd);
      expect(policy).toContain('= user_id');
    }
  });
});

describe('harden_personalization_rls — no blanket access anywhere', () => {
  it('contains no using ( true )', () => {
    expect(flat).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(flat).not.toMatch(/with check\s*\(\s*true\s*\)/i);
  });

  it('contains no blanket anon/public grant and no service-role browser path', () => {
    expect(flat).not.toMatch(/\bgrant\b[^;]*\bto\s+(anon|public)\b/i);
    expect(flat).not.toMatch(/\bto\s+public\b/i);
    expect(flat).not.toMatch(/service_role/i);
  });

  it('documents the external prerequisite and the fail-closed behaviour', () => {
    expect(sql).toMatch(/Third-Party Auth/i);
    expect(sql).toMatch(/jwks/i);
    expect(sql).toMatch(/fail[s]? closed/i);
  });
});
