/**
 * MuAPI's live model catalog (api.muapi.ai/api/v1/models: ~800 models). The bundled src/lib/models.js is a
 * smaller snapshot, so the generic `generate` tool falls back to this for models it does not know
 * (ElevenLabs voices, Whisper, Suno sound effects, ...).
 */
const URL_MODELS = 'https://api.muapi.ai/api/v1/models';
const TTL_MS = 10 * 60_000;
let cache = { t: 0, map: null };

export async function liveModel(name, { fetchImpl = fetch } = {}) {
  if (!cache.map || Date.now() - cache.t > TTL_MS) {
    const res = await fetchImpl(URL_MODELS);
    if (!res.ok) throw Object.assign(new Error('Could not read the MuAPI model list.'), { code: 'PROVIDER' });
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.models || data.data || [];
    cache = { t: Date.now(), map: new Map(list.filter((m) => m && m.name && m.is_enabled !== false).map((m) => [m.name, m])) };
  }
  return cache.map.get(name) || null;
}

export function resetLiveCatalogCache() { cache = { t: 0, map: null }; }

const MEDIA_FIELD = /image|video|audio|frame|url|mask|reference/i;
const httpsOnly = (v) => /^https:\/\//i.test(String(v || ''));

/** Build the request for a live-catalog model: only declared fields are forwarded, media must be https. */
export function buildLivePayload(model, inputs = {}) {
  const allowed = new Set(Array.isArray(model.input_fields) ? model.input_fields : []);
  const payload = {};
  for (const [name, value] of Object.entries(inputs || {})) {
    if (!allowed.has(name) || value === undefined || value === null || value === '') continue;
    const values = Array.isArray(value) ? value : [value];
    if (MEDIA_FIELD.test(name) && typeof value !== 'number' && typeof value !== 'boolean' && !values.every(httpsOnly)) {
      throw Object.assign(new Error(`${name} must be a public https URL`), { code: 'BAD_INPUT' });
    }
    payload[name] = value;
  }
  for (const field of model.required_fields || []) {
    if (payload[field] === undefined) throw Object.assign(new Error(`${field} is required`), { code: 'BAD_INPUT' });
  }
  return { endpoint: `/${model.endpoint_url || model.name}`, payload, model: model.name };
}
