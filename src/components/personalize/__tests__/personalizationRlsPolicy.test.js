/**
 * personalizationRlsPolicy.test.js
 *
 * Static verification of the personalization_outputs RLS migration. No live
 * Supabase credentials are available in this environment (no VITE_SUPABASE_URL
 * / SUPABASE_URL + service-role key in the repo or env — see .env.example,
 * which documents placeholders only), so the migration SQL text itself is
 * asserted instead of its runtime behaviour. Nothing here is fabricated:
 * every assertion parses the committed .sql file.
 *
 * Asserts:
 *   - RLS is enabled on personalization_outputs.
 *   - The broken ported policies (and the auth.uid()-based current_user_id()
 *     helper) are dropped.
 *   - SELECT / INSERT / UPDATE / DELETE policies exist and each is gated on
 *     an owner predicate (clerk_user_id = the announced owner).
 *   - No policy grants access to anon/public WITHOUT an owner predicate, and
 *     no policy uses `using (true)` / `to public`-style blanket grants.
 *   - No service-role usage is introduced for the browser path.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const MIGRATION_PATH = path.resolve(
  process.cwd(),
  'supabase/migrations/20261013000000_fix_personalization_outputs_rls.sql',
);

const sql = readFileSync(MIGRATION_PATH, 'utf8');

/** Every `create policy ...;` statement in the file, as raw text. */
function extractPolicies() {
  const matches = sql.match(/create policy\b[\s\S]*?;/gi) || [];
  return matches.map((s) => s.replace(/\s+/g, ' ').trim());
}

/** Extract the statement that defines one named policy. */
function policyNamed(name) {
  return extractPolicies().find((p) => p.includes(`"${name}"`)) || null;
}

describe('personalization_outputs RLS migration text', () => {
  it('reads the migration file', () => {
    expect(sql.length).toBeGreaterThan(500);
  });

  it('enables row level security on personalization_outputs', () => {
    expect(sql).toMatch(
      /alter table public\.personalization_outputs enable row level security/i,
    );
  });

  it('supersedes the ported policies and the auth.uid()-based helper', () => {
    expect(sql).toMatch(
      /drop policy if exists "Users can view own personalization outputs" on public\.personalization_outputs/i,
    );
    expect(sql).toMatch(
      /drop policy if exists "Users can insert own personalization outputs" on public\.personalization_outputs/i,
    );
    expect(sql).toMatch(/drop function if exists public\.current_user_id\(\)/i);
  });

  it('defines SELECT, INSERT, UPDATE and DELETE policies for the owner', () => {
    const select = policyNamed('Users can view own personalization outputs');
    const insert = policyNamed('Users can insert own personalization outputs');
    const update = policyNamed('Users can update own personalization outputs');
    const del = policyNamed('Users can delete own personalization outputs');

    expect(select).toBeTruthy();
    expect(insert).toBeTruthy();
    expect(update).toBeTruthy();
    expect(del).toBeTruthy();

    // SELECT: owner predicate on USING
    expect(select).toMatch(/for select/i);
    expect(select).toMatch(
      /using \(clerk_user_id = public\.current_clerk_user_id\(\)\)/i,
    );

    // INSERT: owner predicate on WITH CHECK (cannot stamp another user's row)
    expect(insert).toMatch(/for insert/i);
    expect(insert).toMatch(
      /with check \(clerk_user_id = public\.current_clerk_user_id\(\)\)/i,
    );

    // UPDATE / DELETE: owner predicates
    expect(update).toMatch(/for update/i);
    expect(update).toMatch(/using \(clerk_user_id = public\.current_clerk_user_id\(\)\)/i);
    expect(update).toMatch(/with check \(clerk_user_id = public\.current_clerk_user_id\(\)\)/i);
    expect(del).toMatch(/for delete/i);
    expect(del).toMatch(/using \(clerk_user_id = public\.current_clerk_user_id\(\)\)/i);
  });

  it('never grants access without an owner predicate (no blanket policies)', () => {
    const policies = extractPolicies();
    expect(policies.length).toBeGreaterThanOrEqual(4);
    for (const policy of policies) {
      const target = policy.match(/\bto\s+(anon|authenticated|public)\b/i);
      expect(target).toBeTruthy(); // every policy names at least one role
      // ...and every policy carries the owner predicate.
      expect(policy).toMatch(/clerk_user_id = public\.current_clerk_user_id\(\)/i);
      expect(policy).not.toMatch(/using \(true\)/i);
      expect(policy).not.toMatch(/with check \(true\)/i);
      expect(policy).not.toMatch(/to\s+public\s+using \(true\)/i);
    }
  });

  it('does not rely on service-role access from the browser client', () => {
    expect(sql).not.toMatch(/service_role/i);
    // auth.uid() cannot identify Clerk browser users, so no policy may use it.
    const policies = extractPolicies();
    for (const policy of policies) {
      expect(policy).not.toMatch(/auth\.uid\(\)/i);
    }
  });

  it('documents the identity model and its limits in the header comment', () => {
    expect(sql).toMatch(/identity model/i);
    expect(sql).toMatch(/do \*not\* guarantee|do not guarantee/i);
    expect(sql).toMatch(/app-enforced/i);
  });
});
