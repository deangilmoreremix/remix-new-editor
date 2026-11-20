import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { searchGuides, guideForStudio, guideUrl } from '../askGuides.js';
import { pickChips } from '../askCore.js';
import INDEX from '../../../data/askIndex.json';

const ROOT = path.resolve(__dirname, '../../../..');
const kbIds = fs.readdirSync(path.join(ROOT, 'src/data/askKb')).filter((f) => f.endsWith('.json') && !f.startsWith('_')).map((f) => f.slice(0, -5));

describe('studio guides in Ask SmartVideo', () => {
  it('has a guide for every studio knowledge file', async () => {
    for (const id of kbIds) expect(await guideForStudio(id), id).not.toBeNull();
  });

  it('indexes every guide feature, linked to its section on the guide page', async () => {
    const chunks = INDEX.chunks.filter((c) => c.id.includes(':feature:'));
    for (const id of kbIds) {
      const g = await guideForStudio(id);
      for (const f of g.features) {
        const c = chunks.find((x) => x.studioId === id && x.guideUrl === guideUrl(g, f));
        expect(c, `${id}/${f.id}`).toBeTruthy();
      }
    }
  });

  it('finds features without an OpenAI key, preferring the active studio', async () => {
    const hits = await searchGuides('upscale to 4K resolution', { studioId: 'upscale' });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].guide.route).toBe('upscale');
    expect(await searchGuides('the and how')).toEqual([]);
  });

  it('adds a feature-guide chip for studio sources', () => {
    const { chips } = pickChips('see [S1]', [{ kind: 'studio', studioId: 'edit', title: 'Edit Studio — Crop', url: '#/edit', guideUrl: '/studios/edit-studio#feature-crop' }]);
    expect(chips.find((c) => c.guide)).toMatchObject({ label: 'Feature guide', url: '/studios/edit-studio#feature-crop' });
  });
});
