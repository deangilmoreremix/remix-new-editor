// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { contentShare } from '../../scripts/template-thumbs/compose.mjs';

// The real stills shown on the Template Generator's Animations / Motion graphics / End screens tiles. A tile that is one flat tone shows
// nothing, so only a small share (ambient backgrounds, starfields, gradients are sparse by nature) may be that empty.
const SETS = [
  ['Animations', 'public/hyperframes/thumbs', 0.16],
  ['Motion graphics', 'public/occ-templates/thumbs', 0.05],
  ['End screens and forms', 'public/overlay-templates/thumbs', 0],
];

describe('template stills are not empty pictures', () => {
  for (const [name, dir, allowed] of SETS) {
    it(`${name}: at most ${Math.round(allowed * 100)}% look empty`, async () => {
      const files = readdirSync(join(process.cwd(), dir)).filter((f) => f.endsWith('.jpg'));
      expect(files.length).toBeGreaterThan(8);
      const empty = [];
      for (const f of files) if ((await contentShare(join(process.cwd(), dir, f))) < 0.01) empty.push(f.replace('.jpg', ''));
      expect(empty.length / files.length, `empty-looking: ${empty.slice(0, 15).join(', ')}`).toBeLessThanOrEqual(allowed);
    }, 60000);
  }
});
