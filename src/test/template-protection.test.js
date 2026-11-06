import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = (rel) => resolve(process.cwd(), 'src', rel);

// Templates are ours, not upstream's: parity work must never shrink them.
// Counts are the floor at the time of the upstream-parity work.
const FLOORS = [
  ['../lib/templates.js', 'allTemplates', 292],
  ['../lib/templates.js', 'TEMPLATE_CATEGORIES', 21],
  ['../lib/cinematicTemplates.js', 'CINEMATIC_TEMPLATES', 46],
  ['../lib/cinematicTemplates.js', 'CINEMATIC_CATEGORIES', 24],
  ['../lib/businessTemplates.js', 'BUSINESS_TEMPLATES', 6],
  ['../lib/minimaxTemplates.js', 'minimaxH3Templates', 253],
  ['../lib/templateSpecs.js', 'TEMPLATE_SPECS', 172],
  ['../lib/templateMatrix.js', 'MATRIX_TEMPLATES', 120],
  ['../lib/matrixTemplateSpecs.js', 'MATRIX_TEMPLATE_SPECS', 120],
  ['../lib/nicheTemplatesIndex.js', 'ALL_NICHE_TEMPLATES', 120],
  ['../lib/nicheTemplateSpecs.js', 'NICHE_TEMPLATE_SPECS', 120],
  ['../lib/thumbnailTemplateRegistry.js', 'THUMBNAIL_TEMPLATES', 40],
];

const loaders = import.meta.glob('../lib/*emplate*.js');

describe('template data is intact', () => {
  it.each(FLOORS)('%s exports %s with at least %i entries', async (file, name, floor) => {
    const mod = await loaders[file]();
    const value = mod[name];
    const size = Array.isArray(value) ? value.length : Object.keys(value || {}).length;
    expect(size).toBeGreaterThanOrEqual(floor);
  });
});

describe('template studios and routes remain wired', () => {
  const router = readFileSync(src('lib/router.js'), 'utf8');
  it('keeps the template routes', () => {
    expect(router).toContain("'cinema-template'");
    expect(router).toMatch(/page === 'templates'/);
    expect(router).toMatch(/startsWith\('template\/'\)/);
  });
  it('keeps the template studio modules', () => {
    for (const f of ['TemplateStudio.js', 'CinemaTemplateStudio.js', 'TemplatesPage.js']) {
      expect(() => readFileSync(src(`components/${f}`), 'utf8')).not.toThrow();
    }
  });
});
