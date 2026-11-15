// src/lib/personalization/assetUrl.js
//
// The one place that decides which URL a personalization image asset uses.
// Saved assets keep the cutout in `url` (old image in `originalUrl`);
// discovered assets carry `editedUrl`. An edit that is not uploaded yet has a
// `blob:` url that dies on reload and is useless to an export, so a durable
// `uploadedUrl` wins over it. Pure: no DOM, no imports.

// Only blob: urls die with the tab. A data: url is self-contained and survives a reload.
const isTemporary = (u) => /^blob:/i.test(String(u || ''));

/** The URL to display or render: the edited/cutout image, durable when possible. */
export function resolveAssetUrl(asset) {
  if (!asset) return '';
  if (typeof asset === 'string') return asset;
  const candidates = [asset.editedUrl, asset.url, asset.uploadedUrl, asset.previewUrl, asset.sourceUrl, asset.originalUrl].filter(Boolean);
  if (isTemporary(asset.url) && asset.uploadedUrl) return asset.uploadedUrl;
  return candidates.find((u) => !isTemporary(u)) || candidates[0] || '';
}

/** The image before any edit (the image editor's source, "show original"). */
export function resolveOriginalAssetUrl(asset) {
  if (!asset) return '';
  if (typeof asset === 'string') return asset;
  return asset.originalUrl || asset.sourceUrl || asset.previewUrl || asset.url || asset.editedUrl || '';
}

/** True when the asset was edited (e.g. background removed). */
export const isCutoutAsset = (asset) => Boolean(asset && typeof asset === 'object' && (asset.hasTransparency || asset.edited));
