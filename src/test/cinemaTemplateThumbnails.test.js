import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getTemplateRegistry } from '../lib/cinematicTemplates.js';
import { getTemplateThumbnailCandidates } from '../lib/thumbnails.js';

// Regression guard: a merge once deleted the per-template thumbnail images, so
// every Cinema Template Studio card fell through its candidate chain and showed
// the emoji icon instead. Each cinematic template must ship its own image.
const PUBLIC_DIR = path.resolve(__dirname, '../../public');
const existsInPublic = (urlPath) =>
  typeof urlPath === 'string' && urlPath.startsWith('/') && fs.existsSync(path.join(PUBLIC_DIR, urlPath));

describe('Cinema Template Studio thumbnails', () => {
  const templates = getTemplateRegistry().getAll().filter((t) => !t.isCustom);

  it('has templates to check', () => {
    expect(templates.length).toBeGreaterThan(0);
  });

  it.each(templates.map((t) => [t.id, t]))('%s has its own thumbnail on disk', (_id, template) => {
    // Candidates 0/1 are the per-template `.webp` / `.webp.png` files.
    const own = getTemplateThumbnailCandidates(template)
      .filter((p) => p.startsWith('/thumbnails/templates/'))
      .slice(0, 2);
    expect(own.some(existsInPublic)).toBe(true);
  });

  it('ships the generic placeholder used as the last fallback', () => {
    expect(existsInPublic('/thumbnails/pages/placeholder.webp')).toBe(true);
  });
});
