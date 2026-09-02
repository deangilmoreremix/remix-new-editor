/**
 * Universal cross-studio personalizer handoff.
 *
 * This module defines the serializable contract for sending content from a
 * SmartVideo studio into the existing Personalizer. It is intentionally
 * small, dependency-free, and safe to import from any studio or modal.
 *
 * Storage:
 *   - sessionStorage key: remix_personalizer_handoff
 *   - only survives navigation within the same tab
 *   - never stores DOM nodes, functions, classes, blobs, or binaries
 */

const STORAGE_KEY = 'remix_personalizer_handoff';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} PersonalizableField
 * @property {string} id
 * @property {string} label
 * @property {'text'|'url'|'image'|'video'|'audio'|'color'|'number'|'boolean'|'metadata'} type
 * @property {unknown} value
 * @property {string} [path]
 * @property {boolean} supportsPersonalization
 * @property {boolean} [readonly]
 */

/**
 * @typedef {Object} PersonalizableAsset
 * @property {string} [id]
 * @property {'image'|'video'|'audio'|'template'|'timeline'|'storyboard'|'composition'|'prompt'|'other'} type
 * @property {string} [title]
 * @property {string} [previewUrl]
 * @property {string} [thumbnailUrl]
 * @property {PersonalizableField[]} fields
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} PersonalizerHandoff
 * @property {number} version
 * @property {{ studioId: string, studioName?: string, route?: string }} source
 * @property {{ id?: string, title?: string }} [project]
 * @property {PersonalizableAsset} [asset]
 * @property {string} [selectedProfileId]
 * @property {string} [returnRoute]
 * @property {string} createdAt
 */

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validateHandoff(raw) {
  if (!isPlainObject(raw)) return null;
  if (raw.version !== 1) return null;

  const source = raw.source;
  if (!isPlainObject(source) || typeof source.studioId !== 'string' || !source.studioId.trim()) {
    return null;
  }

  const asset = raw.asset;
  if (asset && !isPlainObject(asset)) return null;

  return {
    version: 1,
    source: {
      studioId: String(source.studioId).trim(),
      studioName: source.studioName ? String(source.studioName).trim() : undefined,
      route: source.route ? String(source.route).trim() : undefined,
    },
    project: isPlainObject(raw.project) ? {
      id: raw.project.id ? String(raw.project.id).trim() : undefined,
      title: raw.project.title ? String(raw.project.title).trim() : undefined,
    } : undefined,
    asset: asset ? validateAsset(asset) : undefined,
    selectedProfileId: raw.selectedProfileId ? String(raw.selectedProfileId).trim() : undefined,
    returnRoute: raw.returnRoute ? String(raw.returnRoute).trim() : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
  };
}

function validateAsset(asset) {
  if (!isPlainObject(asset)) return null;

  const allowedTypes = new Set([
    'image', 'video', 'audio', 'template', 'timeline', 'storyboard', 'composition', 'prompt', 'other'
  ]);
  const type = asset.type && allowedTypes.has(asset.type) ? asset.type : 'other';

  const fields = Array.isArray(asset.fields)
    ? asset.fields.map((f) => validateField(f)).filter(Boolean)
    : [];

  return {
    id: asset.id ? String(asset.id).trim() : undefined,
    type,
    title: asset.title ? String(asset.title).trim() : undefined,
    previewUrl: asset.previewUrl ? String(asset.previewUrl).trim() : undefined,
    thumbnailUrl: asset.thumbnailUrl ? String(asset.thumbnailUrl).trim() : undefined,
    fields,
    metadata: isPlainObject(asset.metadata) ? asset.metadata : undefined,
  };
}

function validateField(field) {
  if (!isPlainObject(field)) return null;
  if (typeof field.id !== 'string' || !field.id.trim()) return null;
  if (typeof field.label !== 'string' || !field.label.trim()) return null;

  const allowedFieldTypes = new Set([
    'text', 'url', 'image', 'video', 'audio', 'color', 'number', 'boolean', 'metadata'
  ]);
  const type = field.type && allowedFieldTypes.has(field.type) ? field.type : 'text';

  return {
    id: String(field.id).trim(),
    label: String(field.label).trim(),
    type,
    value: field.value !== undefined ? field.value : null,
    path: field.path ? String(field.path).trim() : undefined,
    supportsPersonalization: Boolean(field.supportsPersonalization),
    readonly: Boolean(field.readonly),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new handoff object. Does not persist it.
 *
 * @param {Object} opts
 * @param {string} opts.studioId
 * @param {string} [opts.studioName]
 * @param {string} [opts.route]
 * @param {{ id?: string, title?: string }} [opts.project]
 * @param {PersonalizableAsset} [opts.asset]
 * @param {string} [opts.selectedProfileId]
 * @param {string} [opts.returnRoute]
 * @returns {PersonalizerHandoff}
 */
export function createPersonalizerHandoff({
  studioId,
  studioName,
  route,
  project,
  asset,
  selectedProfileId,
  returnRoute,
}) {
  return validateHandoff({
    version: 1,
    source: { studioId, studioName, route },
    project,
    asset,
    selectedProfileId,
    returnRoute,
    createdAt: new Date().toISOString(),
  }) || {
    version: 1,
    source: { studioId: String(studioId || 'unknown').trim() },
    createdAt: new Date().toISOString(),
  };
}

/**
 * Persist a handoff to sessionStorage.
 *
 * @param {PersonalizerHandoff} handoff
 * @returns {boolean}
 */
export function savePersonalizerHandoff(handoff) {
  try {
    const validated = validateHandoff(handoff);
    if (!validated) return false;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
    return true;
  } catch {
    return false;
  }
}

/**
 * Load the current handoff from sessionStorage without consuming it.
 *
 * @returns {PersonalizerHandoff|null}
 */
export function getPersonalizerHandoff() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return validateHandoff(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Load and remove the handoff from sessionStorage.
 *
 * @returns {PersonalizerHandoff|null}
 */
export function consumePersonalizerHandoff() {
  const handoff = getPersonalizerHandoff();
  if (!handoff) return null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
  return handoff;
}

/**
 * Remove any persisted handoff.
 */
export function clearPersonalizerHandoff() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

/**
 * Storage key used for the handoff.
 */
export const HANDOFF_STORAGE_KEY = STORAGE_KEY;
