/**
 * Catalog: brand-neutral list of generation models with their input contracts.
 * Entry: { key, kind, studios[], id, name, family?, endpoint, hasPrompt?, imageField?, videoField?, inputs{} }
 */
const MEDIA_FIELD = /image|video|audio|frame|url|mask|reference/i;
const httpsOnly = (v) => /^https:\/\//i.test(String(v ?? ''));
const NUMERIC = new Set(['int', 'integer', 'number', 'float']);

export class InputError extends Error {
  constructor(message) { super(message); this.name = 'InputError'; this.code = 'BAD_INPUT'; }
}

export function createCatalog(entries, { endpointFixes = {} } = {}) {
  const byKey = new Map(entries.map((e) => [e.key, e]));

  function search({ studio, kind, query, limit = 25 } = {}) {
    const q = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    const out = [];
    for (const e of entries) {
      if (kind && e.kind !== kind) continue;
      if (studio && !e.studios?.includes(studio)) continue;
      if (q.length) {
        const hay = `${e.id} ${e.name} ${e.family || ''}`.toLowerCase();
        if (!q.every((t) => hay.includes(t))) continue;
      }
      out.push(e);
      if (out.length >= limit) break;
    }
    return out;
  }

  /** Validate user inputs against the model contract and build the backend request. */
  function buildRequest(key, inputs = {}, allowedKinds) {
    const entry = byKey.get(key);
    if (!entry) throw new InputError(`Unknown model "${key}". Use search_models to find a valid model.`);
    if (allowedKinds && !allowedKinds.includes(entry.kind)) {
      throw new InputError(`Model "${key}" is a ${entry.kind} model and cannot be used with this tool.`);
    }
    const spec = entry.inputs || {};
    const allowed = new Set(Object.keys(spec));
    for (const extra of [entry.imageField, entry.videoField, 'prompt']) if (extra) allowed.add(extra);

    const payload = {};
    for (const [name, raw] of Object.entries(inputs)) {
      if (raw === undefined || raw === null || raw === '') continue;
      if (!allowed.has(name)) throw new InputError(`"${name}" is not an input of ${key}. Allowed: ${[...allowed].join(', ')}`);
      const def = spec[name] || {};
      let value = raw;
      // List-typed fields (images_list, video_files, ...) take arrays; accept a single URL for convenience.
      if ((def.type === 'array' || /_list$|_files$/.test(name)) && !Array.isArray(value)) value = [value];
      if (NUMERIC.has(def.type) && typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) value = Number(value);
      if (def.enum && !Array.isArray(value) && !def.enum.map(String).includes(String(value))) {
        throw new InputError(`"${name}" must be one of: ${def.enum.join(', ')}`);
      }
      if (MEDIA_FIELD.test(name) && !def.enum && typeof value !== 'number' && typeof value !== 'boolean') {
        const list = Array.isArray(value) ? value : [value];
        if (!list.every(httpsOnly)) throw new InputError(`"${name}" must be a public https URL (use upload_file for local files)`);
      }
      payload[name] = value;
    }
    for (const [name, def] of Object.entries(spec)) {
      if (def.required && payload[name] === undefined) throw new InputError(`"${name}" is required for ${key}`);
    }
    // Models that take no prompt: drop it rather than send an undeclared field (the studios do the same).
    if (entry.hasPrompt === false && !spec.prompt) delete payload.prompt;
    return { endpoint: `/${endpointFixes[entry.id] || entry.endpoint || entry.id}`, payload, entry };
  }

  const studios = () => {
    const map = new Map();
    for (const e of entries) for (const s of e.studios || []) {
      const row = map.get(s) || { studio: s, kinds: new Set(), models: 0 };
      row.kinds.add(e.kind); row.models += 1; map.set(s, row);
    }
    return [...map.values()].map((r) => ({ ...r, kinds: [...r.kinds] }));
  };

  return { entries, get: (k) => byKey.get(k) || null, search, buildRequest, studios, kinds: () => [...new Set(entries.map((e) => e.kind))] };
}
