// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'supabase/migrations');
const FILE = '20261117100000_heatmap_campaign_filter.sql';
const sql = readFileSync(join(dir, FILE), 'utf8');
const stage7 = readFileSync(join(dir, '20261114100000_heatmap_analytics.sql'), 'utf8');

describe('heatmap campaign filter migration (SQL shape; behaviour is asserted by supabase/tests/71_heatmap_campaign_assertions.sql)', () => {
  it('sorts after the Stage 7 migration and leaves it untouched (still defines the 4-arg/6-arg signatures)', () => {
    expect(FILE > '20261114100000_heatmap_analytics.sql').toBe(true);
    expect(readdirSync(dir)).toContain('20261114100000_heatmap_analytics.sql');
    expect(stage7).toMatch(/p_viewport text default null, p_cta text default null, p_page_bucket integer default null\)/);
  });
  it('drops each old signature (no ambiguous overloads) and re-creates it with a trailing defaulted p_campaign', () => {
    for (const sig of ['video_heat_clicks(text, date, date, text, text, integer)', 'video_heat_cta_stats(text, date, date, text)', 'video_heat_scroll(text, date, date, text)', 'video_heat_engagement(text, date, date, text)']) {
      expect(sql).toContain(`drop function if exists public.${sig};`);
    }
    expect(sql.match(/p_campaign uuid default null/g)).toHaveLength(4);
    expect(sql.match(/create function/gi)).toBeNull();
  });
  it('detects the linkage at call time through information_schema and never references campaign_id statically in the RPC bodies', () => {
    expect(sql).toMatch(/information_schema\.columns[\s\S]*table_name = 'video_view_sessions' and column_name = 'campaign_id'/);
    // every mention of the column is inside a dynamic (execute) string or a comment
    const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
    const outsideDynamic = code.replace(/\$q\$[\s\S]*?\$q\$/g, '').replace(/^comment on .*$/gm, '');
    expect(outsideDynamic.match(/\bvs\.campaign_id\b|\.campaign_id\b/g)).toBeNull();
  });
  it('keeps grants as in Stage 7: authenticated only, helpers closed, search_path pinned, ownership asserted first', () => {
    expect(sql).not.toMatch(/grant execute[^;]*\bto\b[^;]*\b(anon|public|service_role)\b/i);
    expect(sql).toMatch(/revoke all on function public\._heat_campaign_scope\(text, date, date, text, uuid\) from public, anon, authenticated, service_role/);
    expect(sql.match(/security definer\nset search_path = ''/g)).toHaveLength(sql.match(/security definer/g).length);
    const owner = sql.match(/perform public\._heat_assert_owner\(p_video_id\);/g) || [];
    expect(owner.length).toBe(5);
  });
  it('encodes the differencing gate (>= K inside the campaign, pooled remainder 0 or >= K)', () => {
    expect(sql).toMatch(/if mine < k or \(small_pool > 0 and small_pool < k\) then return; end if;/);
  });
});
