// Brand Studio local stores (src/lib/brandStore.js). Brand data only; the store holds no API keys and none are returned.
const obj = (properties = {}, required = []) => ({ type: 'object', properties, ...(required.length ? { required } : {}) });
const SECRET_KEY = /(key|token|secret|password|authorization)/i;
const clean = (v, depth = 0) => {
  if (depth > 6 || v == null) return v;
  if (Array.isArray(v)) return v.slice(0, 100).map((x) => clean(x, depth + 1));
  if (typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([k]) => !SECRET_KEY.test(k)).map(([k, x]) => [k, clean(x, depth + 1)]));
  return typeof v === 'string' ? v.slice(0, 2000) : v;
};

/** @param {typeof import('../../brandStore.js')} store */
export function createBrandTools(store) {
  return [
    { name: 'brand_list', risk: 'read', description: 'Brands saved in this browser (Brand DNA).', schema: obj(), run: () => ({ brands: store.listBrands().map((b) => ({ id: b.id, name: b.name || b.brandName, updatedAt: b.updatedAt })) }) },
    { name: 'brand_get', risk: 'read', description: 'One brand\'s DNA with its campaigns.', schema: obj({ id: { type: 'string' } }, ['id']), run: (a) => { const b = store.getBrand(a.id); if (!b) throw new Error('No such brand.'); return { brand: clean(b), campaigns: store.listCampaigns(a.id).map((c) => clean(c)) }; } },
    { name: 'brand_save', risk: 'write', description: 'Create or update a brand. Pass the brand object; without an id a new one is created.', schema: obj({ brand: { type: 'object' } }, ['brand']), run: (a) => { const b = a.brand && typeof a.brand === 'object' ? clean(a.brand) : null; if (!b) throw new Error('Pass a brand object.'); const saved = store.saveBrand({ ...b, id: typeof b.id === 'string' && b.id ? b.id : store.generateId() }); return { id: saved.id }; } },
    { name: 'brand_campaigns_list', risk: 'read', description: 'Campaigns for a brand.', schema: obj({ brand_id: { type: 'string' } }, ['brand_id']), run: (a) => ({ campaigns: store.listCampaigns(a.brand_id).map((c) => clean(c)) }) },
    { name: 'brand_assets_list', risk: 'read', description: 'Generated assets for a campaign.', schema: obj({ campaign_id: { type: 'string' } }, ['campaign_id']), run: (a) => ({ assets: store.listAssets(a.campaign_id).map((x) => clean(x)) }) },
  ];
}
export const BRAND_NOT_EXPOSED = {
  personalizer_stores: 'Personalizer contacts and profiles live in the personalization feature\'s own server-backed tables: use leads_* and video_pages_contacts instead. The one-shot personalizer handoff is not a stored profile.',
  brand_delete: 'The store has no delete.',
  api_keys: 'Saving or reading API keys is a human-only action.',
};
