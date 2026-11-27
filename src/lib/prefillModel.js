// The Text to Image / Text to Video marketing pages store the model a visitor clicked under
// localStorage 'prefill_model' (a display NAME such as "Flux Dev"; some names are not real models).
// Studios read it once on open: match by id, then by name (case-insensitive); no match -> null.
export function resolvePrefillModel(models, raw) {
  const k = String(raw ?? '').trim().toLowerCase();
  if (!k) return null;
  return models.find((m) => String(m.id).toLowerCase() === k) || models.find((m) => String(m.name).toLowerCase() === k) || null;
}

/** Read and always clear the key (so a stale value never leaks into a later visit). */
export function takePrefillModelName() {
  try {
    const v = localStorage.getItem('prefill_model');
    if (v !== null) localStorage.removeItem('prefill_model');
    return v;
  } catch { return null; }
}

/**
 * Store a clicked model for the destination studio, only if that studio can select it
 * (models = the list the studio resolves against). Otherwise clear any old value, so an
 * unknown or stale name never carries over to a later visit.
 */
export function storePrefillModel(models, name) {
  try {
    const m = resolvePrefillModel(models || [], name);
    if (m) localStorage.setItem('prefill_model', m.name || m.id);
    else localStorage.removeItem('prefill_model');
  } catch { /* storage unavailable */ }
}
