/**
 * Server-side publisher for public.scheduled_posts jobs (auto_publish = true). Runs from the
 * `scheduled-publish` Netlify scheduled function every minute, with no browser open.
 *
 * Guarantees
 *  - One job is claimed by exactly one tick (claim_due_scheduled_posts uses SKIP LOCKED).
 *  - A destination is submitted AT MOST once per attempt: it is saved as 'submitting' BEFORE the call and
 *    as 'processing' (with MuAPI's request id) right after. A tick that dies in between leaves 'submitting',
 *    which the next tick marks failed ("outcome unknown") instead of posting again: a missed post is
 *    recoverable by the owner, a duplicate post is not.
 *  - Published destinations are never re-sent (retries only touch failed ones).
 *  - The owner's MuAPI key is decrypted only here, in memory, and goes only to api.muapi.ai.
 *  - Netlify scheduled functions are short-lived: polling is time-boxed and unfinished jobs resume next tick.
 */
import { decryptKey } from './socialKeyCrypto.js';

export const MUAPI_BASE = 'https://api.muapi.ai';
/** Only these MuAPI publish endpoints can ever be called with a stored job. */
export const PUBLISH_ENDPOINTS = Object.freeze({
  youtube: 'youtube-publish', instagram: 'instagram-publish', tiktok: 'tiktok-publish', facebook: 'facebook-publish',
  linkedin: 'linkedin-publish', pinterest: 'pinterest-publish', threads: 'threads-publish', x: 'x-publish',
});
export const destKey = (j) => `${j.platform}:${j.account_id}`;
const DONE = new Set(['completed', 'succeeded', 'success']);
const FAIL = new Set(['failed', 'error']);
const clip = (s, n = 300) => String(s ?? '').slice(0, n);
const resultUrl = (o) => (o && typeof o === 'object' ? o.url || o.link || o.permalink || null : null);

/** Backoff before the next automatic attempt: 2, 4, 8 minutes. */
export const backoffMs = (attempt) => Math.min(30, 2 ** Math.max(1, attempt)) * 60_000;

function describeHttp(status, detail) {
  if (status === 401) return 'MuAPI rejected the stored API key. Turn automatic publishing on again with a valid key.';
  if (status === 402) return 'Your MuAPI balance is too low to publish.';
  if (status === 403) return 'MuAPI did not allow this publish (check access and balance).';
  if (status === 404 || status === 409) return 'This account is not connected any more. Reconnect it and retry.';
  if (status === 429) return 'MuAPI is rate limiting requests.';
  return `MuAPI returned ${status}${detail ? `: ${clip(detail, 120)}` : ''}.`;
}
/** Retryable = might work next time without the owner changing anything. */
export const isTransient = (status) => status === undefined || status === 429 || status >= 500;

async function muapi(fetchImpl, key, path, { method = 'GET', body } = {}) {
  const res = await fetchImpl(`${MUAPI_BASE}/api/v1/${path}`, {
    method,
    headers: { 'x-api-key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON body */ }
  return { status: res.status, ok: res.ok, data };
}

/** Process ONE claimed job. Returns the patch to store (status, results, …) and a notification, if final. */
export async function processJob(row, { key, fetchImpl, now = () => Date.now(), deadline, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), save }) {
  const results = Array.isArray(row.results) ? row.results.map((r) => ({ ...r })) : [];
  const jobs = Array.isArray(row.jobs) ? row.jobs : [];
  // A manual retry (the owner pressed Retry) arrives as attempts === 0 with EVERY destination already finished: a job only
  // reaches `failed` once all destinations are terminal, and finishing sets attempts >= 1. A job that is merely resuming (a tick ran
  // out of time) always has at least one destination unfinished, so it never looks like a retry. The owner's explicit choice
  // re-sends destinations that were cleanly rejected, but never one whose outcome is unknown (ambiguous): those may already be live.
  const finished = (r) => r && (r.status === 'published' || r.status === 'failed');
  if ((row.attempts || 0) === 0 && results.length > 0 && results.length >= jobs.length && jobs.every((j) => finished(results.find((r) => r.platform === j.platform && String(r.account_id) === String(j.account_id))))) {
    for (const r of results) {
      if (r.status === 'failed' && !r.ambiguous) { r.status = 'pending'; delete r.request_id; delete r.permanent; delete r.retryable; delete r.error; }
    }
  }
  const find = (j) => results.find((r) => r.platform === j.platform && String(r.account_id) === String(j.account_id));
  const persist = async () => { await save({ results }); };
  const rec = (j) => {
    let r = find(j);
    if (!r) { r = { platform: j.platform, account_id: j.account_id, status: 'pending' }; results.push(r); }
    return r;
  };

  for (const j of jobs) {
    if (now() > deadline) break;
    const r = rec(j);
    if (r.status === 'published' || r.permanent) continue;
    const endpoint = PUBLISH_ENDPOINTS[j.platform];
    if (!endpoint || !j.payload || typeof j.payload !== 'object') { Object.assign(r, { status: 'failed', permanent: true, error: 'This destination is not a supported publish target.' }); await persist(); continue; }

    // An earlier tick died between "submitting" and the response: we cannot know whether MuAPI accepted it.
    if (r.status === 'submitting') {
      Object.assign(r, { status: 'failed', permanent: true, ambiguous: true, error: 'The result of this post is unknown (the publisher was interrupted). Check the platform before posting it again.' });
      await persist(); continue;
    }

    if (!r.request_id) {
      if (r.status === 'failed' && !r.retryable) continue; // not eligible for an automatic re-send
      Object.assign(r, { status: 'submitting', error: undefined, retryable: undefined, started_at: new Date(now()).toISOString() });
      await persist(); // written BEFORE the request: this is the duplicate guard
      let resp;
      try { resp = await muapi(fetchImpl, key, endpoint, { method: 'POST', body: j.payload }); }
      catch (e) {
        // Network failure/timeout: MuAPI may or may not have the request. Never re-send automatically.
        Object.assign(r, { status: 'failed', permanent: true, ambiguous: true, error: 'The request to MuAPI did not finish, so it is unknown whether the post went out. Check the platform before posting it again.' });
        await persist(); continue;
      }
      const reqId = String(resp.data?.request_id || resp.data?.id || '');
      if (!resp.ok) {
        const transient = isTransient(resp.status);
        // A 5xx/429 means MuAPI did not accept the post, so a later attempt is safe.
        Object.assign(r, { status: 'failed', retryable: transient, permanent: !transient, error: describeHttp(resp.status, resp.data?.detail || resp.data?.error) });
        await persist(); continue;
      }
      if (!reqId) {
        const out = resp.data?.output ?? resp.data?.data?.output;
        if (String(resp.data?.status || '').toLowerCase() === 'completed' && out) { Object.assign(r, { status: 'published', url: resultUrl(out), published_at: new Date(now()).toISOString() }); }
        else Object.assign(r, { status: 'failed', permanent: true, ambiguous: true, error: 'MuAPI sent an unexpected reply. Check the platform before posting it again.' });
        await persist(); continue;
      }
      Object.assign(r, { status: 'processing', request_id: reqId });
      await persist();
    }

    // Poll (resume) until done or out of time; unfinished work continues next tick with the same request id.
    while (now() < deadline && r.status === 'processing') {
      await sleep(2000);
      let p;
      try { p = await muapi(fetchImpl, key, `predictions/${encodeURIComponent(r.request_id)}/result`); } catch { continue; }
      if (!p.ok) {
        // MuAPI already accepted this post. A failed LOOKUP (401/403/404…) does not mean it was rejected: keep the request id and
        // mark the outcome unknown so no retry can send it again. Transient errors just try again.
        if (!isTransient(p.status)) Object.assign(r, { status: 'failed', permanent: true, ambiguous: true, error: `${describeHttp(p.status)} The post was already sent, so it may still go live. Check the platform before posting it again.` });
        continue;
      }
      const st = String(p.data?.status || '').toLowerCase();
      if (DONE.has(st)) Object.assign(r, { status: 'published', url: resultUrl(p.data?.output ?? p.data), published_at: new Date(now()).toISOString() });
      else if (FAIL.has(st)) Object.assign(r, { status: 'failed', permanent: true, error: clip(typeof p.data?.error === 'string' ? p.data.error : p.data?.error?.message || 'The platform rejected the post.') });
    }
    await persist();
  }
  return summarize(row, jobs, results, now());
}

/** Decide the job's next state from its per-destination results. */
export function summarize(row, jobs, results, nowMs) {
  const state = jobs.map((j) => results.find((r) => r.platform === j.platform && String(r.account_id) === String(j.account_id)));
  const unfinished = state.some((r) => !r || r.status === 'pending' || r.status === 'processing' || r.status === 'submitting');
  const published = state.filter((r) => r?.status === 'published');
  const failed = state.filter((r) => r?.status === 'failed');
  if (unfinished) return { final: false, patch: { status: 'publishing', locked_until: new Date(nowMs).toISOString() } };
  if (published.length === jobs.length) {
    return { final: true, outcome: 'published', patch: { status: 'posted', published_at: new Date(nowMs).toISOString(), last_error: null, locked_until: null }, published: published.length, total: jobs.length };
  }
  const attempts = (row.attempts || 0) + 1;
  const retryable = failed.some((r) => r.retryable);
  if (retryable && attempts < (row.max_attempts || 3)) {
    return { final: false, patch: { status: 'scheduled', attempts, next_attempt_at: new Date(nowMs + backoffMs(attempts)).toISOString(), last_error: clip(failed.find((r) => r.retryable)?.error, 500), locked_until: null } };
  }
  const err = failed.map((r) => `${r.platform}: ${r.error}`).join(' ');
  return { final: true, outcome: 'failed', patch: { status: 'failed', attempts, last_error: clip(err, 500), locked_until: null }, published: published.length, total: jobs.length };
}

export const notificationFor = (row, s) => ({
  clerk_user_id: row.clerk_user_id,
  type: s.outcome === 'published' ? 'post_published' : 'post_failed',
  title: s.outcome === 'published' ? 'Your scheduled post is live' : 'A scheduled post needs attention',
  summary: clip(s.outcome === 'published'
    ? `Published to ${s.total} destination${s.total === 1 ? '' : 's'}.`
    : `${s.published} of ${s.total} destinations published. ${s.patch.last_error || ''}`, 600),
  metrics: { job_key: row.job_key, published: s.published, total: s.total },
  dedupe_key: `post:${row.job_key}:${s.outcome}`,
});

/**
 * One scheduler tick. `call` = PostgREST client (service role). Never throws; returns counts.
 */
export async function runTick({ call, fetchImpl = fetch, env = process.env, now = () => Date.now(), budgetMs = 22_000, sleep } = {}) {
  const deadline = now() + budgetMs;
  const summary = { claimed: 0, posted: 0, failed: 0, retrying: 0, waiting: 0, no_key: 0 };
  let rows;
  try { rows = await call('rpc/claim_due_scheduled_posts', { method: 'POST', body: { p_limit: 10, p_lock_seconds: 90 } }); }
  catch (e) { return { ...summary, error: e?.status ? `claim_failed_${e.status}` : 'claim_failed' }; }
  const keys = new Map();
  for (const row of rows || []) {
    summary.claimed++;
    const patchRow = (patch) => call(`scheduled_posts?id=eq.${row.id}`, { method: 'PATCH', body: patch, prefer: 'return=minimal' });
    try {
      if (!keys.has(row.clerk_user_id)) {
        const c = await call(`social_publish_credentials?select=key_ciphertext&clerk_user_id=eq.${encodeURIComponent(row.clerk_user_id)}&limit=1`);
        keys.set(row.clerk_user_id, c?.[0] ? decryptKey(c[0].key_ciphertext, row.clerk_user_id, env) : null);
      }
      const key = keys.get(row.clerk_user_id);
      if (!key) {
        summary.no_key++;
        const s = { final: true, outcome: 'failed', published: 0, total: (row.jobs || []).length, patch: { status: 'failed', last_error: 'Automatic publishing is off or its key could not be read. Turn it on again, then retry.', locked_until: null } };
        await patchRow(s.patch); await notify(call, row, s); continue;
      }
      // Each job gets its own slice of the tick (at least 5 s, enough to submit and check once), so a slow job can never use up the
      // whole budget and starve the ones behind it. An unfinished job is saved with locked_until = now and rotates to the back of the
      // claim order (see claim_due_scheduled_posts), so next tick the others go first.
      const left = Math.max(1, rows.length - summary.claimed + 1);
      const slice = Math.max(5000, Math.floor((deadline - now()) / left));
      const s = await processJob(row, { key, fetchImpl, now, deadline: Math.min(deadline + 5000, now() + slice), sleep, save: (p) => patchRow(p) });
      await patchRow(s.patch);
      if (s.final) { s.outcome === 'published' ? summary.posted++ : summary.failed++; await notify(call, row, s); }
      else if (s.patch.status === 'scheduled') summary.retrying++; else summary.waiting++;
    } catch {
      // Leave the lock to expire: the job resumes from its saved results next tick.
      summary.waiting++;
    }
  }
  return summary;
}

async function notify(call, row, s) {
  try { await call('owner_notifications', { method: 'POST', body: notificationFor(row, s), prefer: 'resolution=ignore-duplicates,return=minimal' }); }
  catch (e) { console.error('[scheduled-publish] could not write the owner notification', e?.status || 'error'); /* the job result is already stored; a missing alert must never undo it */ }
}
