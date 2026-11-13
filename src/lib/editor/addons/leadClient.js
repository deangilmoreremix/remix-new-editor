/**
 * Lead submission client.
 *
 * Upstream's editor never stored leads itself: the published vidcloud player
 * posted them to an external backend as `video_opted_in` events. Here leads
 * go to the `lead-capture` Supabase edge function, which stores them in
 * `public.video_leads` and forwards them to the configured webhooks
 * server-side (no browser CORS limits). If the backend is unreachable, the
 * caller falls back to posting the webhooks directly from the browser.
 */

export const WEBHOOK_REGEX = /^https:\/\/[a-z0-9.-]+(?::\d+)?(\/[^\s]*)?$/i;

export function isValidWebhookUrl(url) {
  return typeof url === 'string' && WEBHOOK_REGEX.test(url.trim());
}

/** Collect the configured, valid webhook URLs from a lead-form/list-builder config. */
export function webhookUrlsFor(config) {
  if (!config) return [];
  const enabled = config.webhookEnabled !== false; // list builder has no toggle
  if (!enabled) return [];
  return [config.webhookUrl, config.webhookUrl2, config.webhookUrl3]
    .map((u) => (typeof u === 'string' ? u.trim() : ''))
    .filter((u) => u && isValidWebhookUrl(u));
}

/**
 * Upstream form field token: the label upper-cased ("Phone number" →
 * "PHONE NUMBER"), used as the submitted answer's key. Duplicate labels get
 * _2, _3 suffixes so no answer overwrites another.
 */
export function leadFieldTokens(fields = []) {
  const seen = new Map();
  return fields.map((f) => {
    const base = String(f?.label || f?.id || 'FIELD').trim().toUpperCase() || 'FIELD';
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}_${n}`;
  });
}

/** Drop empty values and keep only string-able answers, capped in length. */
export function sanitizeLeadData(data) {
  const out = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (!key || key.length > 64) continue;
    if (value === undefined || value === null) continue;
    const str = String(value).trim().slice(0, 2000);
    if (str) out[key] = str;
  }
  return out;
}

/**
 * Submit a lead. Returns { stored, forwarded, failed, error }.
 * `supabase` is the page's hybrid client (functions.invoke).
 */
export async function submitLead(supabase, { projectId, clipId, kind = 'lead-form', data, webhooks = [], notificationEmail = '', preview = true }) {
  const payload = {
    projectId: projectId ? String(projectId) : null,
    clipId: clipId != null ? String(clipId) : null,
    kind,
    data: sanitizeLeadData(data),
    webhooks: webhooks.filter(isValidWebhookUrl),
    notificationEmail: notificationEmail || null,
    preview,
    source: {
      page: typeof location !== 'undefined' ? location.href : null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    },
  };
  try {
    const { data: result, error } = await supabase.functions.invoke('lead-capture', { body: payload });
    if (error || !result || result.ok !== true) {
      return { stored: false, forwarded: 0, failed: 0, error: error?.message || result?.error || 'Lead backend unavailable' };
    }
    return { stored: !!result.stored, forwarded: result.forwarded || 0, failed: result.failed || 0, error: null };
  } catch (err) {
    return { stored: false, forwarded: 0, failed: 0, error: err?.message || String(err) };
  }
}

/** Browser-side fallback: POST the lead straight to each webhook. */
export async function postWebhooksDirect(urls, data, fetchImpl = globalThis.fetch) {
  const results = await Promise.allSettled(urls.map((url) => fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })));
  const failed = results.filter((r) => r.status === 'rejected' || (r.value && r.value.ok === false)).length;
  return { forwarded: urls.length - failed, failed };
}

/**
 * "Test Webhook": POST a sample lead (flagged `test: true`) to each URL from
 * the browser and report how many answered 2xx. Nothing is stored. Receivers
 * that don't send CORS headers can report a false failure here.
 */
export async function testWebhooks(urls, payload, fetchImpl = globalThis.fetch) {
  const results = await Promise.allSettled(urls.map((url) => fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'video_opted_in', test: true, ...payload }),
  })));
  const failed = results.filter((r) => r.status === 'rejected' || (r.value && r.value.ok === false)).length;
  return { total: urls.length, failed };
}

/**
 * Load stored leads for a clip (or a whole project) via the edge function.
 * Returns [] when the backend is unavailable or the caller isn't signed in.
 */
export async function fetchLeads(supabase, { projectId, clipId }) {
  try {
    const { data, error } = await supabase.functions.invoke('lead-capture', {
      body: { action: 'list', projectId: projectId ? String(projectId) : null, clipId: clipId != null ? String(clipId) : null },
    });
    if (error || !data?.ok || !Array.isArray(data.leads)) return [];
    return data.leads.map((l) => ({ ...l.data, submittedAt: l.created_at }));
  } catch {
    return [];
  }
}

/**
 * Every stored lead for a published video as rows the Leads tab can list:
 * { id, kind, clipId, createdAt, data }. [] when the backend is unavailable or the caller isn't signed in.
 */
export async function fetchLeadRows(supabase, { projectId, clipId } = {}) {
  try {
    const { data, error } = await supabase.functions.invoke('lead-capture', {
      body: { action: 'list', projectId: projectId ? String(projectId) : null, clipId: clipId != null ? String(clipId) : null },
    });
    if (error || !data?.ok || !Array.isArray(data.leads)) return { ok: false, rows: [], error: error?.message || data?.error || 'Could not load leads' };
    return {
      ok: true,
      rows: data.leads.map((l) => ({ id: l.id, kind: l.kind || 'lead-form', clipId: l.clip_id ?? null, createdAt: l.created_at, data: l.data && typeof l.data === 'object' ? l.data : {} })),
    };
  } catch (err) {
    return { ok: false, rows: [], error: err?.message || 'Could not load leads' };
  }
}

/** RFC 4180 CSV: every value quoted, quotes doubled, CRLF line endings. */
export function leadsToCsv(leads) {
  if (!Array.isArray(leads) || !leads.length) return '';
  const headers = Array.from(new Set(leads.flatMap((l) => Object.keys(l))));
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.map(cell).join(','), ...leads.map((lead) => headers.map((h) => cell(lead[h])).join(','))].join('\r\n');
}

/**
 * Merge stored leads with this session's local ones. Local leads that the
 * backend already stored (flagged `_stored`) are dropped so they aren't
 * counted twice; the flag itself is stripped from the output.
 */
export function mergeLeads(local = [], stored = []) {
  const strip = ({ _stored, ...rest }) => rest;
  return [...stored.map(strip), ...local.filter((l) => !l._stored).map(strip)];
}
