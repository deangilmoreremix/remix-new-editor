/**
 * Content of an owner alert e-mail: short, plain, escaped HTML plus a text twin.
 * Only the notification's own title, summary and suggestion appear (never anything about viewers beyond that).
 */
import { CATEGORY_BY_TYPE } from './alertTypes.js';

export const DEFAULT_APP_URL = 'https://smartvid.app';
export const FOOTER = 'You get this because Email alerts is on in Notifications > Preferences.';

const clip = (s, n) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** `${APP_URL or https://smartvid.app}/#/timeline`; APP_URL must be http(s), anything else falls back to the default. */
export function alertsUrl(env = process.env) {
  const raw = String(env?.APP_URL || '').trim().replace(/\/+$/, '');
  return `${/^https?:\/\/[^\s"'<>]+$/i.test(raw) ? raw : DEFAULT_APP_URL}/#/timeline`;
}

export function buildAlertEmail(note, { url = alertsUrl() } = {}) {
  const category = CATEGORY_BY_TYPE[note?.type] || (note?.type === 'daily_digest' ? 'Digest' : '');
  const title = clip(note?.title, 140) || 'New alert';
  const summary = clip(note?.summary, 600);
  const suggestion = clip(note?.suggestion, 600);
  const subject = category ? `${category}: ${title}` : title;
  const text = [title, summary, suggestion, `Open alerts: ${url}`, FOOTER].filter(Boolean).join('\n\n');
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:16px;color:#111">`
    + (category ? `<p style="margin:0 0 4px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#555">${esc(category)}</p>` : '')
    + `<h1 style="margin:0 0 12px;font-size:18px">${esc(title)}</h1>`
    + (summary ? `<p style="margin:0 0 12px">${esc(summary)}</p>` : '')
    + (suggestion ? `<p style="margin:0 0 12px">${esc(suggestion)}</p>` : '')
    + `<p style="margin:16px 0"><a href="${esc(url)}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:6px">Open alerts</a></p>`
    + `<p style="margin:16px 0 0;font-size:12px;color:#666">${esc(FOOTER)}</p></div>`;
  return { subject, text, html };
}
