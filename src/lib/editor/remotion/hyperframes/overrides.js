/**
 * Applies a validated HyperFrames OverrideSet (the sparse `{ "<hf-id>.text": "...", "<hf-id>.style.color": "...",
 * "<hf-id>.attr.src": "..." }` map produced by @hyperframes/sdk getOverrides()) to an imported block's DOM.
 * The master HTML is never modified: overrides are applied to the in-memory copy at render time.
 * Every value is re-validated here with validateOverrides(); anything not allow-listed is dropped and reported.
 */
import { validateOverrides } from './security.js';

const findById = (root, id) => {
  const leaf = String(id).split('/').pop(); // scoped ids look like "hf-host/hf-leaf"
  const esc = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(leaf) : leaf.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
  try { return root.querySelector(`[data-hf-id="${esc}"]`); } catch { return null; }
};

/** Upstream catalog HTML carries no data-hf-id (the SDK stamps them). We stamp deterministic ids `hf-<n>` in document order
 *  on the pristine parsed master, so override keys are stable for a pinned (sha256-verified) source. Existing ids are kept. */
export function stampHfIds(root) {
  let n = 0;
  for (const el of root.querySelectorAll('*')) {
    if (['SCRIPT', 'STYLE', 'LINK', 'META'].includes(el.tagName)) continue;
    n++;
    if (!el.hasAttribute('data-hf-id')) el.setAttribute('data-hf-id', `hf-${n}`);
  }
}

export function applyOverrides(root, overrides, { allowHosts = [], onReject } = {}) {
  if (!overrides || typeof overrides !== 'object') return { applied: 0, rejected: [] };
  const { cleaned, rejected } = validateOverrides(overrides, { allowHosts });
  let applied = 0;
  for (const [key, value] of Object.entries(cleaned)) {
    const m = /^(?<id>.+?)\.(?<rest>text|style\.[A-Za-z]+|attr\.(?:src|alt))$/.exec(key);
    if (!m) continue;
    const el = findById(root, m.groups.id); if (!el) { rejected.push({ key, reason: 'element not found in block' }); continue; }
    const { rest } = m.groups;
    if (rest === 'text') {
      for (const n of [...el.childNodes]) if (n.nodeType === 3) n.remove(); // SDK semantics: replace direct text content only
      el.insertBefore(el.ownerDocument.createTextNode(String(value)), el.firstChild);
    } else if (rest.startsWith('style.')) { el.style[rest.slice(6)] = String(value); }
    else { el.setAttribute(rest.slice(5), String(value)); }
    applied++;
  }
  if (rejected.length) onReject?.(rejected);
  return { applied, rejected };
}
