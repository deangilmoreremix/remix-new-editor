/**
 * Brand hygiene: the upstream generation provider must never leak to MCP users.
 * Applied to every error message and every string that comes back from the gateway.
 */
const UPSTREAM = /mu-?api(?:\.ai|app)?/gi;

export function sanitizeText(text, brandName) {
  return String(text ?? '').replace(UPSTREAM, brandName);
}

export function sanitizeDeep(value, brandName) {
  if (typeof value === 'string') return sanitizeText(value, brandName);
  if (Array.isArray(value)) return value.map((v) => sanitizeDeep(v, brandName));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeDeep(v, brandName);
    return out;
  }
  return value;
}

/** Pull output URLs out of the several shapes the generation backend returns. */
export function extractOutputs(result) {
  if (!result || typeof result !== 'object') return [];
  const found = [];
  const push = (v) => {
    if (typeof v === 'string' && v) found.push(v);
    else if (v && typeof v === 'object' && typeof v.url === 'string') found.push(v.url);
  };
  if (Array.isArray(result.outputs)) result.outputs.forEach(push);
  push(result.url);
  push(result.video);
  push(result.image);
  push(result.audio);
  push(result.output);
  return [...new Set(found)];
}

export const DONE = new Set(['completed', 'succeeded', 'success']);
export const FAILED = new Set(['failed', 'error', 'cancelled', 'canceled']);
