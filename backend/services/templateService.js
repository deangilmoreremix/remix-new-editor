/**
 * templateService.js
 *
 * Express router mounted at /api/templates.
 *
 * POST /from-demo
 *   Body:  { slug: string }
 *   Auth:  optionalAuth (req.user?.id for ownership; anonymous → ephemeral draft)
 *   → 200 { styleTemplate: StyleTemplate, draftId: string, owned: boolean }
 *   → 404 { error: "unknown_slug" }
 *
 * If a Supabase client were configured in the backend we would seed a `projects`
 * row here; none is configured today, so we construct the draft object, log it,
 * and return it with a generated `draftId` (we deliberately do NOT invent a new
 * DB client).
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';
import crypto from 'crypto';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const PRESETS_PATH = join(PROJECT_ROOT, 'public', 'media', 'minimax-h3', 'presets.json');

// In-memory cache of the parsed preset array (refreshed by loadPresets()).
let presetsCache = null;

function loadPresets() {
  if (presetsCache) return presetsCache;
  if (!existsSync(PRESETS_PATH)) {
    console.warn('[templateService] presets.json not found at', PRESETS_PATH);
    presetsCache = [];
    return presetsCache;
  }
  try {
    const raw = readFileSync(PRESETS_PATH, 'utf-8');
    presetsCache = JSON.parse(raw);
  } catch (e) {
    console.error('[templateService] failed to parse presets.json:', e.message);
    presetsCache = [];
  }
  return presetsCache;
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/** True when a rightsNote signals the source media may not be redistributed. */
function indicatesNoRedistribution(rightsNote = '') {
  return /not relicensed|no redistribution|do not redistribute/i.test(rightsNote);
}

/**
 * Build a StyleTemplate draft from a curated preset.
 *
 * @param {{slug:string, userId?:string}} args
 * @returns {{styleTemplate:object, draftId:string, owned:boolean} | {error:string}}
 */
export function createTemplateFromDemo({ slug, userId } = {}) {
  const presets = loadPresets();
  const preset = presets.find((p) => p.slug === slug);
  if (!preset) {
    return { error: 'unknown_slug' };
  }

  // Deep-clone so callers can mutate freely without touching the cache.
  const styleTemplate = deepClone(preset);

  // Always echo the rights note (it already lives on the preset, but we
  // guarantee it survives the clone and is surfaced to the caller).
  styleTemplate.rightsNote = preset.rightsNote;

  const draftId = crypto.randomUUID();
  const owned = Boolean(userId);

  // Anonymous users get a client-scoped draft only. When the source media has
  // no redistribution permission we flag the derivative so any export must
  // carry source credit (watermark) rather than ship the clip itself.
  if (!userId) {
    const noRedist = indicatesNoRedistribution(preset.rightsNote);
    styleTemplate.derivativeOnly = noRedist;
    styleTemplate.metadata = { derivativeOnly: noRedist };
    console.log(
      `[templateService] anonymous draft ${draftId} for "${slug}" (derivativeOnly=${noRedist})`
    );
    return { styleTemplate, draftId, owned: false };
  }

  // Authenticated user: seed a draft row. No Supabase client is configured in
  // the backend, so we construct and log the object instead of writing to a DB.
  const draft = {
    id: draftId,
    created_by: userId,
    name: preset.title,
    status: 'draft',
    tags: preset.styleTags || [],
    metadata: {
      styleTemplate,
      derivativeOnly: indicatesNoRedistribution(preset.rightsNote),
    },
  };
  console.log(`[templateService] seeded draft ${draftId} for user ${userId} (slug="${slug}")`);

  return { styleTemplate, draftId, owned: true };
}

router.post('/from-demo', (req, res) => {
  const { slug } = req.body || {};
  const userId = req.user && req.user.id;

  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'missing_slug' });
  }

  try {
    const result = createTemplateFromDemo({ slug, userId });
    if (result && result.error) {
      return res.status(404).json({ error: result.error });
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error('[templateService] /from-demo failed:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
