// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { TEMPLATES } from '../lib/landingPages/templates.js';
import { contentShare } from '../../scripts/template-thumbs/compose.mjs';

// The design pickers (the studio's New page screen and the Template Generator's Add to Video Pages window) show a real picture of every design.
// Made by scripts/generate-landing-design-previews.mjs; the studio's picker no longer offers the older fixed-layout (site) designs.
const offered = TEMPLATES.filter((t) => !t.site);

describe('Video Pages design previews', () => {
  it('every design the pickers offer has a picture', () => {
    expect(offered.length).toBeGreaterThan(60);
    const missing = offered.filter((t) => !existsSync(join(process.cwd(), 'public/landing-previews', `${t.id}.jpg`))).map((t) => t.id);
    expect(missing).toEqual([]);
  });

  it('none of the pictures is one flat tone', async () => {
    const flat = [];
    for (const t of offered) if ((await contentShare(join(process.cwd(), 'public/landing-previews', `${t.id}.jpg`))) < 0.01) flat.push(t.id);
    expect(flat).toEqual([]);
  }, 60000);
});
