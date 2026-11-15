/**
 * Where a viewer came from: campaign tags (?utm_source=…&utm_campaign=…) and the referring site.
 * Captured once when the /watch page loads (first touch) and sent with every lead, so the owner can
 * see which ad, email or post produced it.
 *
 * Respects the same consent signals as the first-party analytics: nothing is captured when the viewer
 * has Do-Not-Track / Global Privacy Control on or the link says ?consent=off. Only the referrer's
 * origin + path is kept (never its query string, which can carry personal data), and links from the
 * video's own site are ignored.
 */
import { consentMode } from './analyticsClient.js';

const UTM_KEYS = ['source', 'medium', 'campaign', 'term', 'content'];
// eslint-disable-next-line no-control-regex
const clean = (v, max = 100) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);

/** { utm?: {source, medium, campaign, term, content}, referrer?: string } — {} when there is nothing to record. */
export function captureAttribution(
  search = globalThis.location?.search || '',
  referrer = globalThis.document?.referrer || '',
  { mode = consentMode(), ownOrigin = globalThis.location?.origin || '' } = {},
) {
  if (mode === 'off') return {};
  const params = new URLSearchParams(search);
  const utm = {};
  for (const k of UTM_KEYS) {
    const v = clean(params.get(`utm_${k}`));
    if (v) utm[k] = v;
  }
  let ref = '';
  try {
    const u = new URL(referrer);
    if ((u.protocol === 'https:' || u.protocol === 'http:') && u.origin !== ownOrigin) ref = clean(u.origin + u.pathname, 300);
  } catch { /* no referrer */ }
  const out = {};
  if (Object.keys(utm).length) out.utm = utm;
  if (ref) out.referrer = ref;
  return out;
}

/** "google / spring-sale", else the referring host, else "" — a short label for a lead's source. */
export function sourceLabel(source) {
  const utm = source?.utm;
  if (utm && (utm.source || utm.campaign)) return [utm.source, utm.campaign].filter(Boolean).join(' / ');
  try { return source?.referrer ? new URL(source.referrer).hostname : ''; } catch { return ''; }
}
