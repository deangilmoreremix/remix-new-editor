/**
 * Admin e-mail when an owner saves a custom domain (supabase/migrations/20261120120000_custom_domain_admin_alert.sql).
 *
 * The database records an alert row and pings admin-domain-alert; domain-alert-sweep retries any row still unsent.
 * Recipients come from ADMIN_ALERT_EMAIL (comma-separated) - never from a request. The domain, business and owner are
 * re-read from the database with the service role, so the POST body is only an alert id.
 *
 * Failure policy: not configured (no recipients / no e-mail provider) leaves the alert unsent and does not count an
 * attempt, so setting the env var later still delivers it. A real send failure counts an attempt, up to MAX_ATTEMPTS.
 * Nothing here returns or logs an address; results are counts and short codes.
 */
import { createHash } from 'node:crypto';
import { rest, supabaseConfig } from './supabaseRest.js';
import { getEmailAdapter } from './emailAdapter.js';
import { lookupClerkEmail } from './resendAdapter.js';

export const MAX_ATTEMPTS = 8;
export const SWEEP_AFTER_MS = 2 * 60_000; // give the instant path a head start before the sweep retries
const SWEEP_BATCH = 20;
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
export function buildDomainAlertEmail({ domain, business, displayName, ownerEmail }) {
  const d = clean(domain, 253);
  const b = clean(business, 60);
  const approve = `update public.video_owner_profiles set custom_domain_verified = true where custom_domain = ${sqlLit(d)};`;
  const reject = `update public.video_owner_profiles set custom_domain = null where custom_domain = ${sqlLit(d)};`;
  const name = clean(displayName, 120);
  const owner = clean(ownerEmail, 200);
  const subject = `Custom domain requested: ${d} (${b})`;
  const lines = [
    `A business asked to serve its videos from its own domain.`,
    ``,
    `Domain:    ${d}`,
    `Business:  ${b}${name ? ` (${name})` : ''}`,
    ...(owner ? [`Owner:     ${owner}`] : []),
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
export async function sendDomainAlerts({ ids, sweep = false, env = process.env, fetchImpl = globalThis.fetch, adapter, now = new Date() } = {}) {
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
      alerts = await db(`custom_domain_alerts?sent_at=is.null&attempts=lt.${MAX_ATTEMPTS}&requested_at=lt.${encodeURIComponent(before)}&order=requested_at.asc&limit=${SWEEP_BATCH}&select=id,business_slug,domain,attempts,sent_at`);
    } else {
      const list = (ids || []).filter((i) => Number.isSafeInteger(i) && i > 0).slice(0, SWEEP_BATCH);
      alerts = list.length ? await db(`custom_domain_alerts?id=in.(${list.join(',')})&sent_at=is.null&select=id,business_slug,domain,attempts,sent_at`) : [];
    }
  } catch { return { sent: 0, skipped: 0, failed: 0, reason: 'table_unavailable' }; }
  alerts = (alerts || []).filter((a) => !a.sent_at && (a.attempts ?? 0) < MAX_ATTEMPTS);

  let sent = 0; let skipped = 0; let failed = 0;
  const finish = (id, patch) => db(`custom_domain_alerts?id=eq.${id}`, { method: 'PATCH', body: patch });
  for (const alert of alerts) {
    try {
      const [profile] = (await db(`video_owner_profiles?business_slug=eq.${encodeURIComponent(alert.business_slug)}&select=clerk_user_id,business_slug,display_name,custom_domain,custom_domain_verified&limit=1`)) || [];
      if (!profile || profile.custom_domain !== alert.domain || profile.custom_domain_verified) {
        await finish(alert.id, { sent_at: now.toISOString(), last_error: 'superseded' }); // changed again, removed, or already approved
        skipped += 1;
        continue;
      }
      const ownerEmail = await lookupClerkEmail({ ownerId: profile.clerk_user_id, secret: env.CLERK_SECRET_KEY, fetchImpl });
      const email = buildDomainAlertEmail({ domain: alert.domain, business: profile.business_slug, displayName: profile.display_name, ownerEmail });
      const errors = [];
      for (const to of recipients) {
        const res = await mail.send({ to, ...email, idempotencyKey: `domain-alert-${alert.id}-${shortHash(to)}` });
        if (!res.ok) errors.push(res.error || 'send_failed');
      }
      if (!errors.length) { await finish(alert.id, { sent_at: now.toISOString(), last_error: null, attempts: (alert.attempts ?? 0) + 1 }); sent += 1; }
      else { await finish(alert.id, { attempts: (alert.attempts ?? 0) + 1, last_error: codes(errors) }); failed += 1; }
    } catch (err) {
      failed += 1;
      try { await finish(alert.id, { attempts: (alert.attempts ?? 0) + 1, last_error: `error_${err?.status || 'unknown'}` }); } catch { /* the sweep tries again */ }
    }
  }
  return { sent, skipped, failed };
}
