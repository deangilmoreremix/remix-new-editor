// [remix] Publish > Email: the pure parts of "send these contacts and the video link to my email tool". This app does NOT send email. It adds
// contacts (with a "video page url" field holding the link) to the user's own MailerLite account through the existing sync function; the user's
// own campaign there does the sending. Everything here is free of React / network so it is unit-tested.
import { isEmail, normalizeEmail, type PubContact } from './contacts';

export interface PushRow { email: string; firstname: string; lastname: string; company: string; link: string }

/** An https address (a link in an email must open for the reader). Returns the cleaned link, or '' when it is not usable. */
export function cleanLink(v: string): string {
  const s = String(v ?? '').trim();
  if (!/^https:\/\/\S+$/i.test(s) || s.length > 2048) return '';
  try { new URL(s); return s; } catch { return ''; }
}

/** One row per distinct valid email, name split into first / last, the same video link on every row. */
export function toPushRows(contacts: PubContact[], link: string): PushRow[] {
  const seen = new Set<string>();
  const rows: PushRow[] = [];
  for (const c of contacts) {
    const email = normalizeEmail(c.email);
    if (!email || !isEmail(email) || seen.has(email)) continue;
    seen.add(email);
    const [first = '', ...rest] = c.name.trim().split(/\s+/).filter(Boolean);
    rows.push({ email, firstname: first, lastname: rest.join(' '), company: c.company, link: cleanLink(link) });
  }
  return rows;
}

export type SendBlock = 'no-key' | 'no-contacts' | 'no-link';
/** Why the Send button is disabled (first reason only), or null when it can go. */
export function sendBlocker(o: { hasKey: boolean; connected: boolean; rows: number; link: string }): SendBlock | null {
  if (!o.hasKey || !o.connected) return 'no-key';
  if (!o.rows) return 'no-contacts';
  if (!cleanLink(o.link)) return 'no-link';
  return null;
}
export const BLOCK_TEXT: Record<SendBlock, string> = {
  'no-key': 'Connect your MailerLite account first.',
  'no-contacts': 'Choose at least one contact that has an email address.',
  'no-link': 'Add the video link (it must start with https://). Publish your video in Share & Leads to get one.',
};

export interface PushResult { pushed: number; failed: Array<{ index: number; reason: string }>; rateLimited: boolean; retryAfter: number | null }
/** Plain words for what happened, never claiming an email was sent. */
export function describePush(r: PushResult, total: number, groupName: string | null): string {
  const where = groupName ? `to the “${groupName}” group in MailerLite` : 'to MailerLite';
  const parts = [`${r.pushed} of ${total} contact${total === 1 ? '' : 's'} added ${where}, each with the video link in their “video page url” field.`];
  if (r.failed.length) {
    const why = [...new Set(r.failed.map((f) => f.reason))].slice(0, 3).join('; ');
    parts.push(`${r.failed.length} not added (${why}).`);
  }
  if (r.rateLimited) parts.push(`MailerLite asked us to slow down${r.retryAfter ? `, try again in about ${r.retryAfter} seconds` : ''}; the rest were not attempted.`);
  parts.push('Nothing has been emailed yet: create your campaign in MailerLite and send it to this group.');
  return parts.join(' ');
}
