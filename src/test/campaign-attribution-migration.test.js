// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'supabase/migrations');
const FILE = '20261117200000_video_session_campaign_attribution.sql';
const sql = readFileSync(join(dir, FILE), 'utf8');
const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');

describe('campaign attribution migration (SQL shape; behaviour is asserted by supabase/tests/72_campaign_attribution_assertions.sql)', () => {
  it('sorts after the heatmap campaign filter migration', () => {
    expect(readdirSync(dir)).toContain('20261117100000_heatmap_campaign_filter.sql');
    expect(FILE > '20261117100000_heatmap_campaign_filter.sql').toBe(true);
  });
  it('adds the nullable column only if absent, with no unconditional foreign key', () => {
    expect(code).toMatch(/add column if not exists campaign_id uuid;/);
    const outsideDo = code.replace(/do \$\$[\s\S]*?end \$\$;/, '');
    expect(outsideDo).not.toMatch(/references public\.video_campaigns/);
    expect(code).toMatch(/to_regclass\('public\.video_campaigns'\) is not null/);
  });
  it('references the campaign tables only through dynamic SQL guarded by to_regclass', () => {
    expect(code).toMatch(/to_regclass\('public\.campaign_recipients'\) is null/);
    const outsideDynamic = code.replace(/\$q\$[\s\S]*?\$q\$/g, '');
    expect(outsideDynamic).not.toMatch(/from public\.(campaign_recipients|video_campaigns)|join public\.(campaign_recipients|video_campaigns)/);
  });
  it('validates ownership server-side: ready recipient, campaign and recipient owner equal the video owner', () => {
    expect(code).toMatch(/r\.public_token = \$2/);
    expect(code).toMatch(/r\.status = 'ready'/);
    expect(code).toMatch(/c\.clerk_user_id = pv\.clerk_user_id/);
    expect(code).toMatch(/r\.clerk_user_id = pv\.clerk_user_id/);
    expect(code).toMatch(/pv\.published = true/);
    expect(code).toMatch(/campaign_id is null/); // first valid attribution wins
  });
  it('never raises and is service_role-only with a pinned search_path', () => {
    expect(code).toMatch(/exception when others then/);
    expect(code).toMatch(/security definer\nset search_path = ''/);
    expect(code).toMatch(/revoke all on function public\.attribute_video_session_campaign\(text, text, text\) from public, anon, authenticated;/);
    expect(code).toMatch(/grant execute on function public\.attribute_video_session_campaign\(text, text, text\) to service_role;/);
    expect(code).not.toMatch(/grant execute[^;]*\bto\b[^;]*\b(anon|public|authenticated)\b/i);
  });
  it('leaves ingest_video_events untouched', () => {
    expect(code).not.toMatch(/ingest_video_events/);
  });
});
