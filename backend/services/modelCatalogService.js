/**
 * modelCatalogService.js
 *
 * Express router mounted at /api/model-catalog.
 *
 * GET /?modelType=<t2i|i2i|i2v|t2v|v2v>
 *
 * Reads the pre-generated public/api/model-catalog.json (produced by the
 * vite build plugin or scripts/generate-model-catalog.mjs) and returns
 * the requested pool: { models: [...] }.
 *
 * If the file is absent (e.g. backend started before the first build),
 * an empty array is returned for each pool and a warning is logged.
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const CATALOG_PATH = join(PROJECT_ROOT, 'public', 'api', 'model-catalog.json');

let catalogCache = null; // lazily loaded, in-memory

function loadCatalog() {
  if (catalogCache) return catalogCache;
  try {
    if (!existsSync(CATALOG_PATH)) {
       console.warn('[modelCatalog] public/api/model-catalog.json not found — serving empty catalogs.');
       catalogCache = { t2i: [], i2i: [], i2v: [], t2v: [], v2v: [] };
      return catalogCache;
    }
    const raw = readFileSync(CATALOG_PATH, 'utf-8');
    catalogCache = JSON.parse(raw);
  } catch (e) {
   console.warn('[modelCatalog] Failed to load catalog file:', e.message);
      catalogCache = { t2i: [], i2i: [], i2v: [], t2v: [], v2v: [] };
  }
  return catalogCache;
}

// Force reload (used by tests or admin endpoints).
router.get('/_reload', (_req, res) => {
  catalogCache = null;
  loadCatalog();
  res.json({ ok: true, pools: Object.keys(catalogCache || {}) });
});

router.get('/', (req, res) => {
  const { modelType } = req.query;

   const VALID = ['t2i', 'i2i', 'i2v', 't2v', 'v2v'];
   const catalog = loadCatalog();

   // If no modelType is provided, return the full multi-pool catalog so
   // the frontend can filter client-side (mirrors the Netlify rewrite and
   // the dev-plugin behaviour).
   if (!modelType) {
     res.json(catalog);
     return;
   }

   if (!VALID.includes(String(modelType))) {
     return res.status(400).json({
       error: 'Bad Request',
       message: 'modelType query parameter is required. Use one of: t2i, i2i, i2v, t2v, v2v.',
       validTypes: VALID,
   });
   }
  const models = Array.isArray(catalog[modelType]) ? catalog[modelType] : [];
  // Return enriched v2v models from the catalog, falling back to the
  // static v2vModels list from models.js if catalog doesn't have v2v data.
  if (modelType === 'v2v' && models.length === 0) {
    res.setHeader('X-Fallback', 'true');
  }
  res.json({ models });
});

export default router;
