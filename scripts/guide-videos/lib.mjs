// Shared loader for the studio tour videos: guide data + narration scripts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGuides } from '../../src/data/studioGuides.core.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const NARRATION_DIR = path.join(ROOT, 'scripts/guide-videos/narration');

export function loadGuides() {
  const kbDir = path.join(ROOT, 'src/data/askKb');
  const kb = Object.fromEntries(
    fs.readdirSync(kbDir).filter((f) => f.endsWith('.json') && !f.startsWith('_'))
      .map((f) => [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(kbDir, f), 'utf8'))]),
  );
  return buildGuides(kb);
}

export function loadNarration(slug) {
  const file = path.join(NARRATION_DIR, `${slug}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

export const wordCount = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;
