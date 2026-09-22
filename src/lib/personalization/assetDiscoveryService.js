import { createPersonalizationAsset } from './personalizationProfile.js';

async function getSession() {
  try {
    const { createClient } = await import('../supabase.js');
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
  } catch {
    return null;
  }
}

async function post(path, body) {
  const session = await getSession();
  if (!session?.access_token) throw new Error('Sign in to use business asset discovery.');

  const response = await fetch(`/api/personalizer/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status})`);
  return payload;
}

export function defaultRoleForDiscoveredCategory(category) {
  if (category === 'person' || category === 'team') return 'presenter_identity';
  if (category === 'logo') return 'logo';
  if (category === 'product') return 'product_reference';
  if ([
    'service', 'completed_work', 'storefront', 'office',
    'branded_vehicle', 'brand',
  ].includes(category)) return 'brand_reference';
  return 'saved_reference';
}

export async function discoverBusinessAssets({
  websiteUrl,
  maxPages = 6,
  maxImages = 60,
} = {}) {
  const payload = await post('discover-assets', { websiteUrl, maxPages, maxImages });
  const assets = Array.isArray(payload?.discoveredAssets) ? payload.discoveredAssets : [];
  return {
    ...payload,
    discoveredAssets: assets.map((asset) => {
      const hadAssignedRole = Boolean(asset.assignedRole);
      return {
        ...asset,
        selected: asset.selected !== false,
        rejected: Boolean(asset.rejected),
        assignedRole: asset.assignedRole || defaultRoleForDiscoveredCategory(asset.category),
        autoAssigned: hadAssignedRole ? Boolean(asset.autoAssigned) : true,
      };
    }),
  };
}

export async function persistPersonalizationAssetVersion({
  sourceUrl,
  role,
  name,
} = {}) {
  if (!sourceUrl) throw new Error('Edited asset source is required.');
  if (!role) throw new Error('Edited asset role is required.');

  const payload = await post('import-asset', {
    sourceUrl,
    role,
    name: name || role,
  });
  if (!payload?.asset?.url) throw new Error('Edited asset persistence returned no durable URL.');
  return payload.asset;
}

export async function importDiscoveredAsset(asset, { role, name } = {}) {
  const assignedRole = role || asset?.assignedRole || defaultRoleForDiscoveredCategory(asset?.category);
  const sourceUrl = asset?.editedUrl || asset?.previewUrl || asset?.sourceUrl;
  if (!sourceUrl) throw new Error('Discovered asset has no image URL.');

  let imported;
  if (asset?.stagedDurableUrl && asset?.stagedRole === assignedRole && asset.stagedDurableUrl === sourceUrl) {
    imported = {
      url: asset.stagedDurableUrl,
      name: name || asset.altText || asset.category || assignedRole,
      mimeType: asset.stagedMimeType || asset.mimeType || null,
    };
  } else {
    const payload = await post('import-asset', {
      sourceUrl,
      role: assignedRole,
      name: name || asset.altText || asset.category || assignedRole,
    });
    imported = payload?.asset;
  }
  if (!imported?.url) throw new Error('Import did not return a durable asset URL.');

  return createPersonalizationAsset({
    role: assignedRole,
    name: imported.name,
    url: imported.url,
    originalUrl: imported.url,
    sourceType: asset.sourceType || 'WEBSITE',
    sourceUrl: asset.sourceUrl || asset.previewUrl,
    sourceCategory: asset.category,
    mimeType: imported.mimeType,
    videoReady: Boolean(asset.videoReady),
    edited: Boolean(asset.editedUrl),
    visionAnalysis: asset.visionAnalysis || null,
    visionValidation: asset.visionValidation || null,
    editMetadata: asset.editMetadata || null,
  });
}
