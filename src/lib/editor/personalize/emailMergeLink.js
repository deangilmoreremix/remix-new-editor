/**
 * Email merge-tag links: ONE link per campaign, the email provider fills in
 * each recipient's values when it sends.
 *
 *   https://watch.example/v/abc?firstName=*|FNAME|*&company=*|COMPANY|*
 *
 * This is the "bulk" counterpart of perContact.personalLink() (one link per
 * known contact). The watch page reads the same canonical token names
 * (publishClient.profileFromQuery), so both link styles render the same video.
 *
 * Tag syntax below follows each provider's documented merge-tag format.
 * Providers change these now and then — keep `fields` small and verified.
 * Checked against provider docs (2026-11): Mailchimp, Salesforce MC (emailaddr), Constant Contact (first name only).
 * Still unconfirmed, send a live test before relying on them: Campaign Monitor, GetResponse (`[[ ]]` vs `{{ }}`), Brevo,
 * MailerLite, Kit, Constant Contact last name/email, Salesforce first name (needs the field in the sending data extension).
 */
import { canonicalTokenKey } from '../../../components/personalize/tokenSchema.js';
import { isImageTokenKey } from '../../personalization/imageReadiness.js';

import PROVIDER_DATA from './emailProviders.json';

/**
 * Provider catalogue: DATA lives in emailProviders.json, which is byte-identical in remix-new-editor
 * (src/lib/editor/personalize) and OpenHiggsBolt (src/shared/personalization). Edit it in one repo, copy it to
 * the other, and run `node scripts/check-email-providers-sync.mjs <path-to-other-repo>` to confirm they match.
 *
 * open/close wrap the provider's field name. `fields` maps OUR canonical token keys to that provider's field.
 * A token with no entry becomes a custom field named by `custom` ({ case: 'upper'|'lower'|'as-is', prefix }),
 * and the caller is told via `unmapped` so the UI can say "create this field in <provider>".
 */
const customName = (spec) => (k) => {
  const base = spec?.case === 'upper' ? k.toUpperCase() : spec?.case === 'lower' ? k.toLowerCase() : k;
  return `${spec?.prefix || ''}${base}`;
};

export const EMAIL_PROVIDERS = PROVIDER_DATA.map((p) => ({ ...p, custom: customName(p.custom) }));

export const emailProviderByKey = (key) => EMAIL_PROVIDERS.find((p) => p.key === key) || null;

/** The merge tag a provider uses for one token, and whether it is a built-in field. */
export function mergeTagFor(provider, tokenKey) {
  const key = canonicalTokenKey(tokenKey) || tokenKey;
  const mapped = provider.fields?.[key];
  const field = mapped ?? (provider.custom ? provider.custom(key) : key);
  return { tag: `${provider.open}${field}${provider.close}`, mapped: mapped != null };
}

/**
 * True for a value that is still an unreplaced merge tag from any provider
 * ("*|FNAME|*", "{{ first_name }}", "%FIRSTNAME%"…). Happens when someone
 * opens the link outside an email (preview, forwarded to a non-subscriber,
 * provider that didn't substitute). The player must not print these.
 */
export function isUnreplacedMergeTag(value) {
  const v = String(value ?? '').trim();
  if (v.length < 3) return false;
  return EMAIL_PROVIDERS.some((p) => {
    const open = p.open.trim();
    const close = p.close.trim();
    return open && close && v.length > open.length + close.length && v.startsWith(open) && v.endsWith(close);
  });
}

/**
 * Build the campaign link.
 *   mergeTagLink(url, ['firstName', 'company'], provider, { preload: false })
 * Image tokens can't be merge tags (they're URLs), so they're reported in `skipped`; tokens the provider has no
 * built-in field for are in `unmapped`; email/phone are left out of the URL unless `includePrivate` (they would sit
 * in plain sight and travel with a forwarded link) and are reported in `excluded`.
 * Options:
 *   recipientId  tag for a unique recipient id, sent as ?c= so views can be told apart per recipient
 *                ('' / undefined = none; pass recipientIdTagFor(provider) for the provider's own)
 *   utmCampaign  adds utm_source=email&utm_medium=email&utm_campaign=<value>
 * Tags are appended raw on purpose: encoding them (%2A%7C…) would stop the provider recognising and replacing them.
 */
export function mergeTagLink(baseUrl, tokens = [], provider, { preload = true, recipientId = '', utmCampaign = '', includePrivate = false } = {}) {
  const prov = typeof provider === 'string' ? emailProviderByKey(provider) : provider;
  if (!prov) throw new Error('Unknown email provider');
  const url = new URL(baseUrl);
  const parts = [];
  const unmapped = [];
  const skipped = [];
  const excluded = [];
  const seen = new Set();
  for (const raw of tokens) {
    const key = canonicalTokenKey(raw) || String(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (isImageTokenKey(key)) {
      skipped.push(key);
      continue;
    }
    if (!includePrivate && PRIVATE_KEYS.has(key)) {
      excluded.push(key);
      continue;
    }
    const { tag, mapped } = mergeTagFor(prov, key);
    if (!mapped) unmapped.push(key);
    parts.push(`${encodeURIComponent(key)}=${tag}`);
  }
  if (String(recipientId || '').trim()) parts.unshift(`c=${String(recipientId).trim()}`);
  if (!preload) parts.unshift('preload=none');
  const campaign = String(utmCampaign || '').trim();
  if (campaign) parts.push('utm_source=email', 'utm_medium=email', `utm_campaign=${encodeURIComponent(campaign)}`);
  const base = url.toString();
  if (!parts.length) return { link: base, unmapped, skipped, excluded };
  const sep = url.search ? '&' : '?';
  return { link: `${base}${sep}${parts.join('&')}`, unmapped, skipped, excluded };
}

/** Token names used in a text ({{firstName}}, {{d company "there"}}, {{first name}}), in order, de-duplicated. */
export function tokensInText(text) {
  const out = [];
  for (const m of String(text || '').matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
    const body = m[1].trim().replace(/\s+(["']).*\1$/, '').replace(/^(?:d|up)\s+(?=\S)/, '');
    const key = canonicalTokenKey(body) || body;
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}

const LEAD_TOKEN_SOURCES = {
  firstName: () => '',
  fullName: (b) => b.name,
  company: (b) => b.name,
  email: (b) => b.email,
  phone: (b) => b.phone,
  title: () => '',
  location: (b) => b.city || b.region || b.address,
};

/** The value a saved lead (a business record) gives for one token, or '' when it has none. */
export function leadTokenValue(business, tokenKey) {
  const key = canonicalTokenKey(tokenKey) || tokenKey;
  const pick = LEAD_TOKEN_SOURCES[key];
  return String((pick ? pick(business || {}) : '') ?? '').trim().slice(0, 200);
}

/**
 * One personal link per lead: the base link plus the values that lead has for the video's tokens.
 * Image tokens, tokens the lead has no value for, and (unless includePrivate) email/phone are left out of the URL.
 * Returns [{ name, email, company, link }].
 */
export function leadLinks(baseUrl, tokens = [], leads = [], { includePrivate = false } = {}) {
  return leads.map((lead) => {
    const b = lead?.business || lead || {};
    const url = new URL(baseUrl);
    for (const raw of tokens) {
      const key = canonicalTokenKey(raw) || String(raw);
      if (!key || isImageTokenKey(key)) continue;
      if (!includePrivate && PRIVATE_KEYS.has(key)) continue;
      const v = leadTokenValue(b, key);
      if (v) url.searchParams.set(key, v);
    }
    return { name: b.name || '', email: b.email || '', company: b.name || '', link: url.toString() };
  });
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV of name, email, company, link, for email tools. */
export function leadLinksCsv(rows) {
  const head = ['Name', 'Email', 'Company', 'Link'];
  return [head, ...rows.map((r) => [r.name, r.email, r.company, r.link])].map((r) => r.map(csvCell).join(',')).join('\r\n');
}


/** Personal details that would sit in plain sight in the link; left out unless the sender opts in. */
const PRIVATE_KEYS = new Set(['email', 'phone', 'businessPhone', 'businessEmail']);

/** Sample values used by "Preview as recipient". */
const SAMPLE_VALUES = {
  firstName: 'Alex', lastName: 'Taylor', fullName: 'Alex Taylor', company: 'Acme Co', companyName: 'Acme Co',
  title: 'Founder', location: 'Austin', industry: 'Retail', email: 'alex@example.com', phone: '555 0100',
};

/** The provider's recipient-id merge tag (e.g. Mailchimp's *|UNIQID|*), or '' when none is known. */
export function recipientIdTagFor(provider) {
  return provider?.recipientId ? `${provider.open}${provider.recipientId}${provider.close}` : '';
}

/** Escape text for an HTML attribute or text node. */
const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Copy-and-paste HTML for an email: a poster image (or a button when there is no image) that links to the
 * personalized video. Email can't play video, so the link is what carries the personalization.
 */
export function emailSnippet({ link, posterUrl = '', alt = 'Watch your video', buttonText = 'Watch your video', width = 560 }) {
  const href = escHtml(link);
  const poster = String(posterUrl || '').trim();
  if (/^https?:\/\//i.test(poster)) {
    return `<a href="${href}" target="_blank" style="display:block;text-decoration:none"><img src="${escHtml(poster)}" alt="${escHtml(alt)}" width="${Number(width) || 560}" style="display:block;border:0;max-width:100%;height:auto"></a>`;
  }
  return `<a href="${href}" target="_blank" style="display:inline-block;padding:14px 28px;background:#111111;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;text-decoration:none;border-radius:6px">${escHtml(buttonText)}</a>`;
}

/** Link with sample values filled in, to see what a recipient would see. Image tokens are left out. */
export function previewLink(baseUrl, tokens = []) {
  const url = new URL(baseUrl);
  for (const raw of tokens) {
    const key = canonicalTokenKey(raw) || String(raw);
    if (!key || isImageTokenKey(key)) continue;
    url.searchParams.set(key, SAMPLE_VALUES[key] || `Sample ${key}`);
  }
  return url.toString();
}

/** Tokens a text uses WITHOUT a fallback, so a blank in the recipient list would leave a gap ({{d key "there"}} adds one). */
export function tokensWithoutDefault(text) {
  const out = [];
  for (const m of String(text || '').matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
    const body = m[1].trim();
    if (/^(?:d|default)\s+\S+\s+(["']).*\1$/.test(body)) continue;
    const key = canonicalTokenKey(body.replace(/^(?:up)\s+(?=\S)/, '')) || body.replace(/^(?:up)\s+(?=\S)/, '');
    if (key && !isImageTokenKey(key) && !out.includes(key)) out.push(key);
  }
  return out;
}
