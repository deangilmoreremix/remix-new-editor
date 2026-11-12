/**
 * businessAssetStore.js
 *
 * Supabase-backed, per-business persistent asset library (tables created by
 * 20261112120000_business_asset_library.sql). Discovered/uploaded assets are
 * saved against a business profile so they can be reused by later videos
 * without re-running Asset Finder.
 *
 * Every function takes the Supabase client as its first argument (the
 * Clerk-authenticated client, `supabase.supabase`), so it is testable and has no
 * hidden global state. Nothing here throws on a missing client: callers use
 * `hasClient()` and fall back to the existing local `assetLibraryStore`.
 */

const CATEGORY_MAP = {
  logo: 'logo',
  brand_logo: 'logo',
  product: 'product',
  product_image: 'product',
  service: 'service',
  service_image: 'service',
  team: 'team',
  premises: 'premises',
  storefront: 'premises',
  website: 'website',
};

export function hasClient(client) {
  return Boolean(client && typeof client.from === 'function');
}

/** Dedupe key: website host when present, else lower-cased name. */
export function businessKey({ name, website } = {}) {
  const site = String(website || '').trim();
  if (site) {
    try {
      const u = new URL(/^https?:\/\//i.test(site) ? site : `https://${site}`);
      return u.hostname.replace(/^www\./i, '').toLowerCase();
    } catch { /* fall through to name */ }
  }
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeCategory(value) {
  return CATEGORY_MAP[String(value || '').toLowerCase()] || 'image';
}

/** Durable URLs only: blob:/data: would break published links. */
export function isDurableUrl(url) {
  return /^https?:\/\//i.test(String(url || ''));
}

async function unwrap(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message || 'Business asset library request failed');
  return data;
}

export async function upsertBusiness(client, { name, website, phone, address, source } = {}) {
  if (!hasClient(client)) return null;
  const key = businessKey({ name, website });
  if (!name || !key) throw new Error('A business needs a name or website.');
  const row = {
    name: String(name).slice(0, 200),
    website: website || null,
    phone: phone || null,
    address: address || null,
    business_key: key,
    source: source || 'manual',
  };
  return unwrap(
    client.from('business_profiles')
      .upsert(row, { onConflict: 'clerk_user_id,business_key' })
      .select()
      .single(),
  );
}

export async function listBusinesses(client) {
  if (!hasClient(client)) return [];
  return unwrap(client.from('business_profiles').select('*').order('updated_at', { ascending: false })) || [];
}

/**
 * Save an imported asset for a business. `asset` is the record returned by
 * importDiscoveredAsset (durable `url`, `role`, `sourceUrl`, ...).
 * Re-importing the same durable URL updates the row instead of duplicating it.
 */
export async function saveBusinessAsset(client, businessId, asset, { origin = 'discovered', state = 'imported' } = {}) {
  if (!hasClient(client) || !businessId) return null;
  const url = asset?.uploadedUrl || asset?.url;
  if (!isDurableUrl(url)) throw new Error('Only durable (http/https) asset URLs can be saved to the library.');
  const row = {
    business_id: businessId,
    category: normalizeCategory(asset.sourceCategory || asset.role),
    origin,
    state,
    source_url: isDurableUrl(asset.sourceUrl) ? asset.sourceUrl : null,
    storage_url: url,
    mime: asset.mimeType || null,
    width: asset.width || null,
    height: asset.height || null,
    thumb_url: isDurableUrl(asset.thumbnailUrl) ? asset.thumbnailUrl : null,
    meta: { name: asset.name || null, role: asset.role || null },
  };
  return unwrap(
    client.from('business_assets').upsert(row, { onConflict: 'business_id,storage_url' }).select().single(),
  );
}

export async function listBusinessAssets(client, businessId, { category } = {}) {
  if (!hasClient(client) || !businessId) return [];
  let q = client.from('business_assets').select('*').eq('business_id', businessId);
  if (category) q = q.eq('category', category);
  return (await unwrap(q.order('imported_at', { ascending: false }))) || [];
}

export async function removeBusinessAsset(client, assetId) {
  if (!hasClient(client) || !assetId) return false;
  await unwrap(client.from('business_assets').delete().eq('id', assetId));
  return true;
}

export async function listAssignments(client, projectId, businessId) {
  if (!hasClient(client) || !projectId) return [];
  let q = client.from('asset_assignments').select('*').eq('project_id', projectId);
  if (businessId) q = q.eq('business_id', businessId);
  return (await unwrap(q)) || [];
}

/**
 * Assign an asset (or null to clear) to a slot. An automatic assignment never
 * overwrites a manual one: returns { assigned:false, reason:'manual' } so the UI
 * can ask for permission.
 */
export async function assignAsset(client, { projectId, businessId, slot, assetId, manual = false }) {
  if (!hasClient(client)) return { assigned: false, reason: 'no-client' };
  if (!projectId || !businessId || !slot) throw new Error('projectId, businessId and slot are required.');
  const existing = await unwrap(
    client.from('asset_assignments').select('*')
      .eq('project_id', projectId).eq('business_id', businessId).eq('slot', slot).maybeSingle(),
  );
  if (existing?.manual && !manual && existing.asset_id !== (assetId || null)) {
    return { assigned: false, reason: 'manual', existing };
  }
  const row = await unwrap(
    client.from('asset_assignments')
      .upsert({ project_id: projectId, business_id: businessId, slot, asset_id: assetId || null, manual },
        { onConflict: 'project_id,business_id,slot' })
      .select().single(),
  );
  if (assetId) {
    await unwrap(client.from('business_assets').update({ state: 'assigned' }).eq('id', assetId).eq('state', 'imported'));
  }
  return { assigned: true, assignment: row };
}

/** slot -> durable URL map for one business, ready to merge into a contact profile's token variables. */
export function assignmentsToVariables(assignments, assets) {
  const byId = new Map((assets || []).map((a) => [a.id, a]));
  const out = {};
  for (const a of assignments || []) {
    const asset = a.asset_id ? byId.get(a.asset_id) : null;
    if (asset && isDurableUrl(asset.storage_url)) out[a.slot] = asset.storage_url;
  }
  return out;
}
