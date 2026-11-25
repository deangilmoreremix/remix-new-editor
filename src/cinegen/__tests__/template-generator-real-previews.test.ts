// Every card the Template Generator offers from the editor's libraries must have a REAL still (made by the editor's own renderer),
// and its live preview must be wired to the real layer — not a placeholder.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildGeneratorSources } from '@cinegen/lib/occ/template-generator-sources';
import { hfThumb, mgThumb, tplThumb, thumbSlug } from '@cinegen/lib/occ/template-thumbs';

const root = process.cwd();
// the motion-graphics packs are fetched from /occ-templates/*.json in the app: serve them from public/ here
beforeAll(() => {
  vi.stubGlobal('fetch', async (url: string) => {
    const f = join(root, 'public', String(url));
    return existsSync(f) ? { ok: true, json: async () => JSON.parse(readFileSync(f, 'utf8')) } : { ok: false, json: async () => ({}) };
  });
});
const onDisk = (url: string) => existsSync(join(root, 'public', url)) && statSync(join(root, 'public', url)).size > 300;
/** A still that is one flat colour everywhere is an empty render, not a preview. */
async function isEmpty(url: string): Promise<boolean> {
  const sharp = (await import('sharp')).default;
  const st = await sharp(join(root, 'public', url)).stats();
  const sd = st.channels.slice(0, 3).reduce((a, c) => a + c.stdev, 0) / 3;
  const range = st.channels.slice(0, 3).reduce((a, c) => a + (c.max - c.min), 0) / 3;
  return sd < 1 && range < 12;
}

async function allCards(id: string) {
  const src = buildGeneratorSources().find((s) => s.id === id)!;
  const out = []; let page = 1;
  for (;;) { const r = await src.search({ query: '', filter: 'all', page }); out.push(...r.items); if (!r.hasMore) break; page += 1; }
  return out;
}

describe('thumbnail paths', () => {
  it('use one naming rule shared with the Animations modal', () => {
    expect(hfThumb('bar-chart-race')).toBe('/hyperframes/thumbs/bar-chart-race.jpg');
    expect(hfThumb('rui:aurora-bg')).toBe('/hyperframes/thumbs/rui-aurora-bg.jpg');   // what the Animations modal already requested
    expect(mgThumb('ss-keyword-pop')).toBe('/occ-templates/thumbs/ss-keyword-pop.jpg');
    expect(tplThumb('es-subscribe')).toBe('/overlay-templates/thumbs/es-subscribe.jpg');
    expect(thumbSlug('a b/c:d')).toBe('a-b-c-d');
  });
});

describe('every library card has a real still on disk', () => {
  it('animations (HyperFrames + RemotionUI)', async () => {
    const cards = await allCards('animations');
    expect(cards.length).toBeGreaterThan(200);
    const missing = cards.filter((c) => !c.poster.startsWith('/hyperframes/thumbs/') || !onDisk(c.poster)).map((c) => c.id);
    expect(missing, `missing stills — run: node scripts/generate-template-generator-thumbs.mjs`).toEqual([]);
  });
  it('motion graphics templates', async () => {
    const cards = await allCards('motion');
    expect(cards.length).toBeGreaterThan(200);
    const missing = cards.filter((c) => !c.poster.startsWith('/occ-templates/thumbs/') || !onDisk(c.poster)).map((c) => c.id);
    expect(missing, `missing stills — run: node scripts/generate-template-generator-thumbs.mjs`).toEqual([]);
  });
  it('end screens and lead forms', async () => {
    const cards = await allCards('endscreens');
    expect(cards.length).toBeGreaterThan(5);
    const missing = cards.filter((c) => !c.poster.startsWith('/overlay-templates/thumbs/') || !onDisk(c.poster)).map((c) => c.id);
    expect(missing, `missing stills — run: node scripts/generate-template-generator-thumbs.mjs`).toEqual([]);
  });
});

describe('no still is an empty picture', () => {
  it('every offered animation, motion graphic and end screen shows something', async () => {
    const cards = [...await allCards('animations'), ...await allCards('motion'), ...await allCards('endscreens')];
    const empty: string[] = [];
    for (const c of cards) if (await isEmpty(c.poster)) empty.push(c.id);
    expect(empty).toEqual([]);
  }, 120000);
});

describe('motion graphics the sandbox cannot draw are not offered', () => {
  it('none of the blocked templates appear, and every offered one has a still', async () => {
    const blocked = Object.keys((await import('@cinegen/lib/occ/mg-render-blocklist.json')).default.ids);
    expect(blocked.length).toBeGreaterThan(0);
    const offered = new Set((await allCards('motion')).map((c) => c.id.replace(/^mg:/, '')));
    for (const id of blocked) expect(offered.has(id), id).toBe(false);
  });
});

describe('live previews are wired to the real renderer', () => {
  it('each library offers a live preview', () => {
    for (const s of buildGeneratorSources()) expect(typeof s.mountPreview, s.id).toBe('function');
  });
});
