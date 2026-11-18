/**
 * A/B test of a form's caption and button text. The viewer is assigned a version once (kept in this browser so a returning
 * viewer sees the same one); the version travels with the lead so the Leads tab can compare them. Plain functions, no UI.
 */

/** 'A' or 'B', remembered per video in localStorage (random each visit when storage is blocked). */
export function pickVariant(key, { storage = globalThis.localStorage, rand = Math.random } = {}) {
  const k = `remix-ab:${key || 'default'}`;
  try { const v = storage?.getItem(k); if (v === 'A' || v === 'B') return v; } catch { /* storage blocked */ }
  const v = rand() < 0.5 ? 'A' : 'B';
  try { storage?.setItem(k, v); } catch { /* storage blocked */ }
  return v;
}

/** The test is on and the owner wrote a different caption or button text for version B. */
export const hasVariantB = (config) => !!config?.abTest && !!(String(config.variantBCaption || '').trim() || String(config.variantBBtnText || '').trim());

/** The config to show: unchanged for version A (or when the test is off); version B swaps in its caption / button text. Never mutates. */
export function applyVariant(config, variant) {
  if (!config || variant !== 'B' || !hasVariantB(config)) return config;
  return {
    ...config,
    ...(String(config.variantBCaption || '').trim() ? { caption: config.variantBCaption } : {}),
    ...(String(config.variantBBtnText || '').trim() ? { btnText: config.variantBBtnText } : {}),
  };
}

/** What to record with a lead: the version the viewer saw, or '' when this form is not being tested. */
export const variantFor = (config, variant) => (hasVariantB(config) && (variant === 'A' || variant === 'B') ? variant : '');
