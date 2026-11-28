import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { WARMUP_PAGES, STUDIO_PATH } from '../warmupPages.js';
import { renderDocument } from '../../components/guides/renderWarmupPages.js';

const pub = path.resolve(__dirname, '../../../public');

describe('SmartWarmupAI feature pages', () => {
  it('has unique URL-safe slugs', () => {
    const slugs = WARMUP_PAGES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    slugs.forEach((s) => expect(s).toMatch(/^[a-z0-9-]+$/));
  });
  it('uses screenshots that exist', () => {
    WARMUP_PAGES.forEach((p) => expect(fs.existsSync(path.join(pub, p.shot))).toBe(true));
  });
  it('every page links to the studio and never names the upstream brand', () => {
    for (const p of [null, ...WARMUP_PAGES]) {
      const html = renderDocument(p, 'https://example.test');
      expect(html).toContain(`href="${STUDIO_PATH}"`);
      expect(html).not.toMatch(/warmbly/i);
    }
  });
});
