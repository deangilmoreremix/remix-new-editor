// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { GOAL_CARDS } from '../lib/onboarding/toolCatalog.js';

const dir = join(process.cwd(), 'supabase/migrations');
const FILE = '20261119100000_app_onboarding.sql';
const sql = readFileSync(join(dir, FILE), 'utf8');

describe('app_onboarding migration (SQL shape)', () => {
  it('sorts after the Outreach welcome migration and leaves it alone', () => {
    expect(FILE > '20261116120000_user_onboarding.sql').toBe(true);
    expect(readdirSync(dir)).toContain('20261116120000_user_onboarding.sql');
    expect(sql).not.toMatch(/alter table public\.user_onboarding/i);
  });
  it('is keyed by the Clerk user id and locked to that user with RLS (select, insert, update)', () => {
    expect(sql).toMatch(/clerk_user_id text primary key default \(auth\.jwt\(\) ->> 'sub'\)/);
    expect(sql).toMatch(/enable row level security/);
    for (const op of ['for select', 'for insert', 'for update']) expect(sql).toContain(op);
    expect(sql.match(/\(select auth\.jwt\(\) ->> 'sub'\) = clerk_user_id/g).length).toBeGreaterThanOrEqual(4);
    expect(sql).not.toMatch(/for delete/i);
  });
  it('allows exactly the goals the UI offers and 6 steps', () => {
    for (const g of GOAL_CARDS) expect(sql).toContain(`'${g.id}'`);
    expect(sql).toMatch(/step between 1 and 6/);
  });
});
