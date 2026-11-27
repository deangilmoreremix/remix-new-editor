/**
 * Admin e-mail when an owner saves a custom domain (supabase/migrations/20261120120000_custom_domain_admin_alert.sql).
 *
 * The database records an alert row and pings admin-domain-alert; domain-alert-sweep retries any row still unsent.
 * Recipients come from ADMIN_ALERT_EMAIL (comma-separated) - never from a request. The domain, business and owner are
 * re-read from the database with the service role, so the POST body is only an alert id.
 *
 * Failure policy: not configured (no recipients / no e-mail provider) leaves the alert unsent and does not count an
 * attempt, so setting the env var later still delivers it. An attempt is counted BEFORE sending, up to MAX_ATTEMPTS; the
 * last failure is recorded as `gave_up:<code>` and logged (id and code only). The owner is found by id, so renaming the
 * business does not lose the alert. A sweep handles at most 10 alerts, stops starting new ones after 20 seconds, and
 * deletes alerts sent more than 90 days ago.
 * Nothing here returns or logs an address; results are counts and short codes.
 */
import { createHash } from 'node:crypto';
import { rest, supabaseConfig } from './supabaseRest.js';
import { getEmailAdapter } from './emailAdapter.js';
import { lookupClerkEmail } from './resendAdapter.js';

export const MAX_ATTEMPTS = 8;
export const SWEEP_AFTER_MS = 2 * 60_000; // give the instant path a head start before the sweep retries
export const SENT_RETENTION_MS = 90 * 24 * 3600_000; // sent alerts are deleted after this
export const SWEEP_DEADLINE_MS = 20_000; // stop starting new alerts after this, so one slow provider cannot eat the whole run
const SWEEP_BATCH = 10;
const MAX_RECIPIENTS = 10;
const EMAIL_SHAPE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

/** ADMIN_ALERT_EMAIL -> unique, valid, lower-cased addresses (comma, semicolon or whitespace separated), at most 10. */
export function parseRecipients(raw) {
  const out = [];
  for (const part of String(raw || '').split(/[\s,;]+/)) {
    const a = part.trim().toLowerCase();
    if (a && EMAIL_SHAPE.test(a) && !out.includes(a)) out.push(a);
    if (out.length >= MAX_RECIPIENTS) break;
  }
  return out;
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
// eslint-disable-next-line no-control-regex
const clean = (s, n = 120) => String(s ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const sqlLit = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** Subject, plain text and HTML for one alert. Every dynamic value is escaped or stripped of control characters. */
export function buildDomainAlertEmail({ domain, business, displayName, ownerEmail, claimants = 1 }) {
  const d = clean(domain, 253);
  const b = clean(business, 60);
  const who = `custom_domain = ${sqlLit(d)} and business_slug = ${sqlLit(b)}`; // names the business: several may claim one hostname
  const approve = `update public.video_owner_profiles set custom_domain_verified = true where ${who};`;
  const reject = `update public.video_owner_profiles set custom_domain = null where ${who};`;
  const many = Number.isSafeInteger(claimants) && claimants > 1 ? `${claimants} businesses have asked for this domain. Approve only the one that really controls it.` : '';
  const name = clean(displayName, 120);
  const owner = clean(ownerEmail, 200);
  const subject = `Custom domain requested: ${d} (${b})`;
  const lines = [
    `A business asked to serve its videos from its own domain.`,
    ``,
    `Domain:    ${d}`,
    `Business:  ${b}${name ? ` (${name})` : ''}`,
    ...(owner ? [`Owner:     ${owner}`] : []),
    ...(many ? [``, many] : []),
    ``,
    `The domain stays OFF until you approve it:`,
    `1. Confirm the owner really controls ${d}.`,
    `2. In Netlify, open the smartvideo2 site, Domain management, and add ${d} as a domain alias; set the DNS records Netlify shows.`,
    `3. In the Supabase SQL editor, run:`,
    `   ${approve}`,
    ``,
    `To refuse it instead, run:`,
    `   ${reject}`,
  ];
  const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#111">
<p><b>A business asked to serve its videos from its own domain.</b></p>
<table style="border-collapse:collapse"><tr><td style="padding:2px 12px 2px 0">Domain</td><td><code>${esc(d)}</code></td></tr>
<tr><td style="padding:2px 12px 2px 0">Business</td><td>${esc(b)}${name ? ` (${esc(name)})` : ''}</td></tr>
${owner ? `<tr><td style="padding:2px 12px 2px 0">Owner</td><td>${esc(owner)}</td></tr>` : ''}</table>
${many ? `<p><b>${esc(many)}</b></p>` : ''}
<p>The domain stays <b>off</b> until you approve it:</p>
<ol><li>Confirm the owner really controls <code>${esc(d)}</code>.</li>
<li>In Netlify, open the <code>smartvideo2</code> site, Domain management, and add it as a domain alias; set the DNS records Netlify shows.</li>
<li>In the Supabase SQL editor, run:<pre style="background:#f4f4f5;padding:8px;white-space:pre-wrap">${esc(approve)}</pre></li></ol>
<p>To refuse it instead:</p><pre style="background:#f4f4f5;padding:8px;white-space:pre-wrap">${esc(reject)}</pre></div>`;
  return { subject, text: lines.join('\n'), html };
}

const shortHash = (s) => createHash('sha256').update(String(s)).digest('hex').slice(0, 12);
const codes = (errs) => [...new Set(errs)].join(',').slice(0, 200);

/**
 * Send the alert for `ids`, or (sweep) every unsent alert older than SWEEP_AFTER_MS with attempts left.
 * Never throws; returns { sent, skipped, failed, reason? } counts only.
 */
export async function sendDomainAlerts({ ids, sweep = false, env = process.env, fetchImpl = globalThis.fetch, adapter, now = new Date(), deadlineMs = SWEEP_DEADLINE_MS } = {}) {
  const cfg = supabaseConfig(env);
  if (!cfg.url || !cfg.key) return { sent: 0, skipped: 0, failed: 0, reason: 'not_configured' };
  const recipients = parseRecipients(env.ADMIN_ALERT_EMAIL);
  const mail = adapter || getEmailAdapter(env, { fetchImpl });
  if (!recipients.length || !mail.configured) return { sent: 0, skipped: 0, failed: 0, reason: 'not_configured' };

  const db = rest(cfg, fetchImpl);
  let alerts;
  try {
    if (sweep) {
      const before = new Date(now.getTime() - SWEEP_AFTER_MS).toISOString();
      alerts = await db(`custom_domain_alerts?sent_at=is.null&attempts=lt.${MAX_ATTEMPTS}&requested_at=lt.${encodeURIComponent(before)}&order=requested_at.asc&limit=${SWEEP_BATCH}&select=id,business_slug,domain,owner_id,attempts,sent_at`);
    } else {
      const list = (ids || []).filter((i) => Number.isSafeInteger(i) && i > 0).slice(0, SWEEP_BATCH);
      alerts = list.length ? await db(`custom_domain_alerts?id=in.(${list.join(',')})&sent_at=is.null&select=id,business_slug,domain,owner_id,attempts,sent_at`) : [];
    }
  } catch { return { sent: 0, skipped: 0, failed: 0, reason: 'table_unavailable' }; }
  alerts = (alerts || []).filter((a) => !a.sent_at && (a.attempts ?? 0) < MAX_ATTEMPTS);

  let sent = 0; let skipped = 0; let failed = 0; let gaveUp = 0;
  const finish = (id, patch) => db(`custom_domain_alerts?id=eq.${id}`, { method: 'PATCH', body: patch });
  const deadline = Date.now() + deadlineMs;
  for (const alert of alerts) {
    if (Date.now() > deadline) break; // the rest is picked up by the next sweep
    const attempt = (alert.attempts ?? 0) + 1;
    try {
      // By owner id when the alert has one (survives a business rename); older rows fall back to the business name.
      const lookup = alert.owner_id ? `clerk_user_id=eq.${encodeURIComponent(alert.owner_id)}` : `business_slug=eq.${encodeURIComponent(alert.business_slug)}`;
      const [profile] = (await db(`video_owner_profiles?${lookup}&select=clerk_user_id,business_slug,display_name,custom_domain,custom_domain_verified&limit=1`)) || [];
      if (!profile || profile.custom_domain !== alert.domain || profile.custom_domain_verified) {
        await finish(alert.id, { sent_at: now.toISOString(), last_error: 'superseded' }); // changed again, removed, or already approved
        skipped += 1;
        continue;
      }
      let claimants = 1;
      try {
        const rows = await db(`video_owner_profiles?custom_domain=eq.${encodeURIComponent(alert.domain)}&custom_domain_verified=eq.false&select=business_slug&limit=50`);
        if (Array.isArray(rows) && rows.length > 1) claimants = rows.length;
      } catch { /* the count is a hint only */ }
      const looked = await lookupClerkEmail({ ownerId: profile.clerk_user_id, secret: env.CLERK_SECRET_KEY, fetchImpl });
      const ownerEmail = typeof looked === 'string' ? looked : ''; // null or "try later": the e-mail simply has no owner line
      const email = buildDomainAlertEmail({ domain: alert.domain, business: profile.business_slug, displayName: profile.display_name, ownerEmail, claimants });
      await finish(alert.id, { attempts: attempt }); // counted BEFORE sending: a crash mid-send cannot cause endless retries
      const results = await Promise.all(recipients.map((to) => mail.send({ to, ...email, idempotencyKey: `domain-alert-${alert.id}-${shortHash(to)}` })));
      const errors = results.filter((r) => !r.ok).map((r) => r.error || 'send_failed');
      if (!errors.length) { await finish(alert.id, { sent_at: now.toISOString(), last_error: null }); sent += 1; }
      else { await giveUpOrRecord(alert, attempt, codes(errors)); failed += 1; if (attempt >= MAX_ATTEMPTS) gaveUp += 1; }
    } catch (err) {
      failed += 1;
      if (attempt >= MAX_ATTEMPTS) gaveUp += 1;
      try { await giveUpOrRecord(alert, attempt, `error_${err?.status || 'unknown'}`); } catch { /* the sweep tries again */ }
    }
  }
  if (sweep) {
    try { await db(`custom_domain_alerts?sent_at=lt.${encodeURIComponent(new Date(now.getTime() - SENT_RETENTION_MS).toISOString())}`, { method: 'DELETE' }); } catch { /* retention is best effort */ }
  }
  return { sent, skipped, failed, ...(gaveUp ? { gaveUp } : {}) };

  async function giveUpOrRecord(alert, attempt, code) {
    if (attempt >= MAX_ATTEMPTS) {
      console.error(`[domain-alert] alert ${alert.id} gave up after ${attempt} attempts: ${code}`); // an id and a short code, never an address
      return finish(alert.id, { attempts: attempt, last_error: `gave_up:${code}`.slice(0, 200) });
    }
    return finish(alert.id, { attempts: attempt, last_error: code });
  }
}
