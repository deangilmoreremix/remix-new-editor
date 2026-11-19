// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { TEMPLATES } from '../lib/landingPages/templates.js';
import { contentShare } from '../../scripts/template-thumbs/compose.mjs';

// The studio's New page screen shows a real picture of every design that cannot be drawn live (the editable designs are drawn live from their page
// data, so they need none). Made by scripts/generate-landing-design-previews.mjs; the picker no longer offers the older fixed-layout (site) designs.
const offered = TEMPLATES.filter((t) => !t.site && !t.editable);

describe('Video Pages design previews', () => {
  it('every design the pickers offer has a picture', () => {
    expect(offered.length).toBeGreaterThan(20);
    const missing = offered.filter((t) => !existsSync(join(process.cwd(), 'public/landing-previews', `${t.id}.jpg`))).map((t) => t.id);
    expect(missing).toEqual([]);
  });

  it('none of the pictures is one flat tone', async () => {
    const flat = [];
    for (const t of offered) if ((await contentShare(join(process.cwd(), 'public/landing-previews', `${t.id}.jpg`))) < 0.01) flat.push(t.id);
    expect(flat).toEqual([]);
  }, 60000);
});
