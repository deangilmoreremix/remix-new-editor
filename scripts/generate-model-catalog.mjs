/**
 * generate-model-catalog.mjs
 *
 * Generates public/api/model-catalog.json from:
 *   - src/lib/models.js   (the canonical model registry)
 *   - src/lib/modelDescriptions.js  (human-readable descriptions)
 *
 * Run this script before `npm run build` and before starting the backend.
 * It is also invoked automatically by the vite build plugin (enforce: 'post')
 * so the file is always up to date after `vite build`.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

function load(modPath) {
  // Dynamic import handles ESM named exports correctly.
  return import(modPath).then(m => (m.default && typeof m.default === 'object') ? m.default : m).catch(() => ({}));
}

async function main() {
  const [{ t2iModels: t2i = [], i2iModels: i2i = [], i2vModels: i2v = [] } = {}, {}] = await Promise.all([
    load(join(PROJECT_ROOT, 'src/lib/models.js')),
    load(join(PROJECT_ROOT, 'src/lib/modelDescriptions.js')),
  ]);
  const DESCRIPTIONS = (await load(join(PROJECT_ROOT, 'src/lib/modelDescriptions.js'))).DESCRIPTIONS || {};

  const seen = new Set();
  const unique = (list, type) => {
    const out = [];
    for (const m of list) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      const desc = (DESCRIPTIONS[type] || {})[m.id] || null;
      out.push({ id: m.id, name: m.name, ...(desc ? { description: desc } : {}) });
    }
    return out;
  };

  const catalog = {
    t2i: unique(t2i, 't2i'),
    i2i: unique(i2i, 'i2i'),
    i2v: unique(i2v, 'i2v'),
  };

  const outDir  = join(PROJECT_ROOT, 'public', 'api');
  const outFile = join(outDir, 'model-catalog.json');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, JSON.stringify(catalog, null, 2), 'utf-8');

  const total = catalog.t2i.length + catalog.i2i.length + catalog.i2v.length;
  console.log(`[generate-model-catalog] Wrote ${outFile} (${total} unique models)`);
}

main().catch(e => {
  console.error('[generate-model-catalog] FAILED:', e.message);
  process.exit(1);
});
