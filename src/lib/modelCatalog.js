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
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore storage errors
  }
}

export async function getEnrichedModels(modelType) {
  const cached = getCached();
  if (cached && cached[modelType]) {
    return cached[modelType];
  }

  try {
    const res = await fetch(`${CATALOG_ENDPOINT}?modelType=${encodeURIComponent(modelType)}`);
    if (!res.ok) throw new Error(`Catalog request failed: ${res.status} ${res.statusText}`);
    const data = await res.json();
    const models = Array.isArray(data.models) ? data.models : [];
    const catalog = cached || {};
    catalog[modelType] = models;
    setCache(catalog);
    return models;
  } catch (err) {
    clearModelCatalogCache();
    throw err;
  }
}
