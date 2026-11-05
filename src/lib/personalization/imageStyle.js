// src/lib/personalization/imageStyle.js
//
// How a Personalized Image looks for one contact, shared by the in-page
// overlay (overlayRender.js) and the Remotion composition
// (timelineToComposition.js) so the preview matches the export:
//
//   - focus: where to crop when the image fills its box. Each contact's image
//     can carry its own focus point (set by clicking the image in the
//     Personalized Image settings); presenter photos default to the upper
//     third, where faces usually are.
//   - plate: a backing behind logos so they stay visible on any footage.
//     'auto' picks a light plate for dark logos and a dark plate for light
//     ones, from the logo's measured brightness.
//
// Pure: everything comes from the contact profile's saved image assets.

const PERSON_ROLES = new Set(['presenter_identity', 'face_identity', 'character_identity']);

export const PLATE_COLORS = Object.freeze({ light: '#ffffff', dark: '#111111' });

/** Every saved image asset on a profile. */
function savedAssets(profile) {
  const a = profile?.personalization?.assets || {};
  return [
    ...(Array.isArray(a.identities) ? a.identities : []),
    ...(Array.isArray(a.logos) ? a.logos : []),
    ...(Array.isArray(a.products) ? a.products : []),
    ...(Array.isArray(a.brandReferences) ? a.brandReferences : []),
    a.firstFrame, a.lastFrame, a.ctaGraphic,
    ...(Array.isArray(a.savedReferences) ? a.savedReferences : []),
  ].filter(Boolean);
}

/** The saved asset behind an image URL (by current or original URL). */
export function assetForUrl(profile, url) {
  const u = String(url || '').trim();
  if (!u) return null;
  return savedAssets(profile).find((asset) => asset.url === u || asset.originalUrl === u) || null;
}

const clampPct = (n, fallback) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : fallback;
};

/** Crop focus for an asset, as percentages ({ x, y }). */
export function focusFor(asset) {
  if (asset?.focus && typeof asset.focus === 'object') {
    return { x: clampPct(asset.focus.x, 50), y: clampPct(asset.focus.y, 50) };
  }
  if (PERSON_ROLES.has(asset?.role)) return { x: 50, y: 30 };
  return { x: 50, y: 50 };
}

/** Backing color for a logo, or null for none. */
export function plateColorFor(plate, asset) {
  if (plate === 'light' || plate === 'dark') return PLATE_COLORS[plate];
  if (plate !== 'auto') return null;
  const lum = Number(asset?.luminance);
  // Light logos (white text) need a dark plate; everything else a light one.
  return Number.isFinite(lum) && lum > 0.6 ? PLATE_COLORS.dark : PLATE_COLORS.light;
}

/**
 * Look of a resolved Personalized Image for a contact.
 * @param {object} opts   the overlay's options (fit, fill, plate)
 * @param {string} src    the resolved image URL
 * @param {object} profile
 * @returns {{ objectFit: 'cover'|'contain', objectPosition: string, plateColor: string|null }}
 */
export function personalizedImageLook(opts = {}, src, profile) {
  const asset = assetForUrl(profile, src);
  const objectFit = opts.fit === 'contain' ? 'contain' : 'cover';
  const { x, y } = focusFor(asset);
  return {
    objectFit,
    objectPosition: `${x}% ${y}%`,
    plateColor: plateColorFor(opts.plate, asset),
  };
}

/**
 * Average brightness (0 dark – 1 light) of an image's visible pixels, from
 * RGBA data. Transparent pixels are ignored, so a white logo on a
 * transparent background measures light.
 */
export function luminanceFromPixels(data) {
  let sum = 0;
  let weight = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    if (alpha < 0.1) continue;
    const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    sum += lum * alpha;
    weight += alpha;
  }
  return weight ? Math.round((sum / weight) * 1000) / 1000 : null;
}

/** Browser: measure an image URL's brightness (null when it can't be read, e.g. CORS). */
export function measureImageLuminance(url, { timeoutMs = 8000 } = {}) {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined' || typeof document === 'undefined') { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(null), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const size = 48;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        resolve(luminanceFromPixels(ctx.getImageData(0, 0, size, size).data));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = url;
  });
}
