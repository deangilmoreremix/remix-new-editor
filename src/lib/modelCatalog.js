const CATALOG_ENDPOINT = '/api/model-catalog';

const CACHE_KEY = 'muapi_model_catalog';
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function setCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // ignore storage errors
  }
}

export function clearModelCatalogCache() {
  try {
    const key = CACHE_KEY;
    const ls = typeof localStorage !== 'undefined' ? localStorage : null;
    if (ls && typeof ls.removeItem === 'function') {
      ls.removeItem(key);
    } else {
      console.warn('[modelCatalog] clearModelCatalogCache: localStorage unavailable, key=' + key, 'ls=', !!ls);
    }
  } catch {
    // ignore storage errors
  }
}

/**
 * Fetches the model catalog for the given modelType.
 *
 * Runtime behaviour depends on the environment:
 *
 *   Dev (Vite proxy → Express on :3001)
 *     GET /api/model-catalog?modelType=t2i  →  { models: [...] }
 *
 *   Production (Netlify static file rewrite)
 *     GET /api/model-catalog                →  { t2i: [...], i2i: [...], i2v: [...] }
 *     (the query string is stripped by the Netlify rewrite; the full
 *      multi-type catalog is returned and filtered client-side)
 *
 * The response shape is detected automatically.
 */
export async function getEnrichedModels(modelType) {
  // 1. Check localStorage cache first (keyed by modelType).
  const cached = getCached();
  if (cached && Array.isArray(cached[modelType])) {
    return cached[modelType];
  }

  // 2. Fetch the endpoint.  In dev the Express server returns
  //    { models: [...] } (filtered server-side by modelType).
  //    In production the Netlify rewrite returns the full catalog
  //    { t2i: [...], i2i: [...], i2v: [...] } and we filter client-side.
  let models = [];
  try {
    const res = await fetch(CATALOG_ENDPOINT);
    if (!res.ok) {
      clearModelCatalogCache();
      throw new Error(`Catalog request failed: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();

    if (Array.isArray(data.models)) {
      // Dev path — Express already filtered by modelType.
      models = data.models;
    } else if (data[modelType] && Array.isArray(data[modelType])) {
      // Production path — static file returned the full catalog.
      models = data[modelType];
    }
  } catch (err) {
    // Network error or non-ok response — clear stale cache and re-throw.
    clearModelCatalogCache();
    throw err;
  }

  // 3. Update the multi-type cache so subsequent calls for other modelTypes
  //    hit localStorage without another fetch.
  const catalog = cached || {};
  catalog[modelType] = models;
  setCache(catalog);

  return models;
}
