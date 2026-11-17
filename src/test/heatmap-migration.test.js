// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'supabase/migrations');
const FILE = '20261114100000_heatmap_analytics.sql';
const sql = readFileSync(join(dir, FILE), 'utf8');

describe('heatmap analytics migration (SQL shape; behaviour is asserted by supabase/tests/70_heatmap_assertions.sql)', () => {
  it('sorts after the latest pre-existing migration and is not out of order', () => {
    const names = readdirSync(dir).filter((f) => /^\d{14}_/.test(f)).sort();
    expect(FILE > '20261114000000').toBe(true);
    expect(names[names.length - 1] >= FILE).toBe(true);
  });
  it('is idempotent: every table/index is create-if-not-exists, every function create-or-replace, policies dropped first', () => {
    expect(sql.match(/create table\s+(?!if not exists)/gi)).toBeNull();
    expect(sql.match(/create (unique )?index\s+(?!if not exists)/gi)).toBeNull();
    expect(sql.match(/create function/gi)).toBeNull();
    expect(sql).toMatch(/drop policy if exists "Owners read own video analytics"/);
  });
  it('enables RLS on every new table with NO client policy or grant (deny by default; owners read through the RPCs only)', () => {
    for (const t of ['video_heat_sessions', 'video_heat_events', 'video_watch_seconds']) {
      expect(sql).toMatch(new RegExp(`create table if not exists public\\.${t}`));
      expect(sql).toContain(`'${t}'`);
    }
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/revoke all on public\.%I from public, anon, authenticated/);
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).not.toMatch(/grant (select|insert|update|delete)/i);
  });
  it('the ingest writer is service_role only and the owner RPCs are security definer with an ownership check', () => {
    expect(sql).toMatch(/revoke all on function public\.ingest_video_heat_events\(text, text, jsonb\) from public, anon, authenticated/);
    expect(sql).toMatch(/grant execute on function public\.ingest_video_heat_events\(text, text, jsonb\) to service_role/);
    for (const fn of ['video_heat_clicks', 'video_heat_cta_stats', 'video_heat_scroll', 'video_heat_engagement']) {
      const body = sql.slice(sql.indexOf(`function public.${fn}(`));
      expect(body.slice(0, 900)).toMatch(/security definer\s+set search_path = ''/);
      expect(body.slice(0, 1800)).toMatch(/_heat_assert_owner\(p_video_id\)/);
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${fn}\\(`));
    }
    expect(sql).toMatch(/where id = p_video_id and clerk_user_id = me/);
    expect(sql).toMatch(/errcode = '42501'/);
  });
  it('every definer function pins search_path', () => {
    const defs = sql.match(/security definer/g) || [];
    const pinned = sql.match(/security definer\s+set search_path = ''/g) || [];
    expect(defs.length).toBeGreaterThan(5);
    expect(pinned.length).toBe(defs.length);
  });
  it('enforces a minimum cohort in the owner RPCs', () => {
    expect(sql).toMatch(/_heat_min_cohort\(\) returns integer[\s\S]*select 5/);
    expect((sql.match(/select 5\b/g) || []).length).toBe(1); // the threshold is defined once
    expect(sql).not.toMatch(/(<|>=)\s*5\b/); // no literal threshold anywhere else
    expect((sql.match(/_heat_min_cohort\(\)/g) || []).length).toBeGreaterThanOrEqual(5);
    expect(sql).toMatch(/_heat_ok\(/);
  });
  it('hardening-safe: owner RPCs to authenticated only, anon/public revoked on every function, no reliance on default privileges', () => {
    for (const fn of ['video_heat_clicks', 'video_heat_cta_stats', 'video_heat_scroll', 'video_heat_engagement']) {
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated, service_role`));
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to authenticated;`));
    }
    expect(sql).not.toMatch(/grant [^;]* to [^;]*\banon\b/i);
    expect(sql).toMatch(/grant execute on function public\.delete_video_analytics\(text\) to authenticated;/);
    expect(sql).toMatch(/revoke all on function public\.prune_video_analytics\(integer\) from public, anon, authenticated;/);
    expect(sql).not.toMatch(/alter default privileges/i);
  });
  it('stores no free text from the page: only normalized coords, CTA id/kind/label, scroll milestone', () => {
    const t = sql.slice(sql.indexOf('create table if not exists public.video_heat_events'), sql.indexOf('create table if not exists public.video_watch_seconds'));
    for (const col of ['x smallint', 'y smallint', 'cta_key text', 'cta_kind text', 'scroll_pct smallint']) expect(t).toContain(col);
    expect(t).not.toMatch(/\b(text_content|selector|value|ip|user_agent|key_pressed)\b/);
  });
  it('extends the 90-day prune and the owner delete to the new tables', () => {
    expect(sql).toMatch(/create or replace function public\.prune_video_analytics/);
    expect(sql).toMatch(/delete from public\.video_watch_seconds\s+where day </);
    expect(sql).toMatch(/create or replace function public\.delete_video_analytics/);
    expect(sql).toMatch(/delete from public\.video_watch_seconds where video_id = p_video_id/);
    expect(sql).toMatch(/video_view_sessions \(id\) on delete cascade/);
  });
  it('bounds per-session writes (click cap, raw-row cap, wall-clock watch bound)', () => {
    expect(sql).toMatch(/clicks >= 30/);
    expect(sql).toMatch(/events_n >= 100/);
    expect(sql).toMatch(/total > 600/);
    expect(sql).toMatch(/elapsed \* 1\.1 \+ 10/);
  });
});
