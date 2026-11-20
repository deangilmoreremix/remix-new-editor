import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GUIDES, GUIDES_BY_CATEGORY, getGuide } from '../data/studioGuides.js';
import { renderGuideHtml, renderHubHtml, guideHead } from '../components/guides/renderGuide.js';
import GUIDE_INDEX from '../data/studioGuideIndex.json';
import { UNLISTED_GUIDES } from '../data/studioGuides.core.js';

const kbCount = fs.readdirSync('src/data/askKb').filter((f) => f.endsWith('.json') && !f.startsWith('_') && !UNLISTED_GUIDES.has(f.slice(0, -5))).length;

describe('studio feature guides', () => {
  it('has one guide per listed studio knowledge file, with unique URL-safe slugs', () => {
    expect(GUIDES.length).toBe(kbCount);
    const slugs = GUIDES.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('every guide has defined features and SEO metadata', () => {
    for (const g of GUIDES) {
      expect(g.features.length, g.slug).toBeGreaterThan(0);
      for (const f of g.features) expect(f.definition, `${g.slug}/${f.id}`).not.toBe('');
      expect(g.seo.description.length, g.slug).toBeLessThanOrEqual(160);
      expect(new Set(g.features.map((f) => f.id)).size, g.slug).toBe(g.features.length);
    }
  });

  it('every screenshot and thumbnail exists in public/', () => {
    for (const g of GUIDES) {
      for (const src of [g.overview, g.thumbnail, ...g.features.map((f) => f.screenshot)]) {
        expect(fs.existsSync(path.join('public', src)), `${g.slug}: ${src}`).toBe(true);
      }
    }
  });

  it('related links point at real guides', () => {
    for (const g of GUIDES) for (const r of g.related) expect(getGuide(r.slug), `${g.slug} -> ${r.slug}`).not.toBeNull();
  });

  it('the landing page index is in sync (run: node scripts/build-studio-guides.mjs --index-only)', () => {
    expect(GUIDE_INDEX.map((c) => c.guides.map((g) => [g.slug, g.features]))).toEqual(
      GUIDES_BY_CATEGORY.map((c) => c.guides.map((g) => [g.slug, g.features.length])),
    );
  });

  it('renders every feature, its JSON-LD and a canonical URL for every guide', () => {
    for (const g of GUIDES) {
      const html = renderGuideHtml(g, GUIDES.length);
      for (const f of g.features) expect(html, `${g.slug}/${f.id}`).toContain(`id="feature-${f.id}"`);
      const head = guideHead(g, 'https://example.com', GUIDES_BY_CATEGORY);
      expect(head.canonical, g.slug).toBe(`https://example.com/studios/${g.slug}/`);
      const types = head.jsonLd.map((j) => j['@type']);
      expect(types, g.slug).toEqual(expect.arrayContaining(['SoftwareApplication', 'BreadcrumbList']));
      if (g.faqs.length) expect(types, g.slug).toContain('FAQPage');
    }
    const hub = renderHubHtml(GUIDES_BY_CATEGORY, GUIDES.length);
    for (const x of GUIDES) expect(hub).toContain(`href="/studios/${x.slug}/"`);
  });

  it('escapes content', () => {
    const g = { ...getGuide('image-studio'), name: '<script>x</script>' };
    expect(renderGuideHtml(g, 1)).not.toContain('<script>x</script>');
  });
});
