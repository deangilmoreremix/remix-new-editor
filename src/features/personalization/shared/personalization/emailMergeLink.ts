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
// OpenHiggsBolt has no tokenSchema; this small map covers the names that matter for email.
const ALIASES: Record<string, string> = {
  firstname: 'firstName', lastname: 'lastName', fullname: 'fullName', name: 'fullName',
  email: 'email', company: 'company', companyname: 'company', title: 'title', jobtitle: 'title',
  role: 'title', phone: 'phone', location: 'location', city: 'location',
};
export function canonicalTokenKey(name: string): string | null {
  const norm = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  return ALIASES[norm] || null;
}
export const isImageTokenKey = (key: string) => /(url|image|logo|photo|avatar|picture)$/i.test(key);

import PROVIDER_DATA from './emailProviders.json'

/**
 * Providers marked `unverified` were imported from the upstream editor's email-providers list (strategic-limited/remix-new-editor,
 * package.json license: ISC; see THIRD_PARTY_NOTICES) and have not been checked against vendor docs. The rest were checked against vendor docs.
 *
 * Provider catalogue: DATA lives in emailProviders.json, which is byte-identical in remix-new-editor
 * (src/lib/editor/personalize) and OpenHiggsBolt (src/shared/personalization). Edit it in one repo, copy it to
 * the other, and run `node scripts/check-email-providers-sync.mjs <path-to-other-repo>` to confirm they match.
 *
 * open/close wrap the provider's field name. `fields` maps OUR canonical token keys to that provider's field.
 * A token with no entry becomes a custom field named by `custom` ({ case: 'upper'|'lower'|'as-is', prefix }),
 * and the caller is told via `unmapped` so the UI can say "create this field in <provider>".
 */
type CustomSpec = { case?: 'upper' | 'lower' | 'snake' | 'as-is'; prefix?: string; suffix?: string }
const customName = (spec?: CustomSpec) => (k: string) => {
  const snake = (x: string) => x.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  const base = spec?.case === 'upper' ? k.toUpperCase() : spec?.case === 'lower' ? k.toLowerCase() : spec?.case === 'snake' ? snake(k) : k;
  return `${spec?.prefix || ''}${base}${spec?.suffix || ''}`;
};

export const EMAIL_PROVIDERS: EmailProvider[] = (PROVIDER_DATA as Array<Omit<EmailProvider, 'custom'> & { custom?: CustomSpec }>).map((p) => ({ ...p, custom: customName(p.custom) }));

export interface EmailProvider {
  key: string; label: string; open: string; close: string
  fields: Record<string, string>
  recipientId?: string
  recipientUnverified?: boolean
  unverified?: boolean
  source?: string
  tags?: Record<string, string>
  custom?: (k: string) => string
}


export const emailProviderByKey = (key: string): EmailProvider | null => EMAIL_PROVIDERS.find((p) => p.key === key) || null;

/** The merge tag a provider uses for one token, and whether it is a built-in field. */
export function mergeTagFor(provider: EmailProvider, tokenKey: string) {
  const key = canonicalTokenKey(tokenKey) || tokenKey;
  const literal = provider.tags?.[key];
  if (literal) return { tag: literal, mapped: true };
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
export function isUnreplacedMergeTag(value: unknown): boolean {
  const v = String(value ?? '').trim();
  if (v.length < 3) return false;
  return EMAIL_PROVIDERS.some((p) => {
    const open = p.open.trim();
    const close = p.close.trim();
    // Providers we haven't checked with short wrappers (e.g. %x%, $x$) would also match ordinary values: skip those.
    if (p.unverified && open.length + close.length < 3) return false;
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
export function mergeTagLink(
  baseUrl: string,
  tokens: string[] = [],
  provider: EmailProvider | string,
  { preload = true, recipientId = '', utmCampaign = '', includePrivate = false }: { preload?: boolean; recipientId?: string; utmCampaign?: string; includePrivate?: boolean } = {},
): { link: string; unmapped: string[]; skipped: string[]; excluded: string[] } {
  const prov = typeof provider === 'string' ? emailProviderByKey(provider) : provider;
  if (!prov) throw new Error('Unknown email provider');
  const url = new URL(baseUrl);
  const parts: string[] = [];
  const unmapped: string[] = [];
  const skipped: string[] = [];
  const excluded: string[] = [];
  const seen = new Set<string>();
  for (const raw of tokens) {
    const key = canonicalTokenKey(String(raw)) || String(raw);
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
export function tokensInText(text: string): string[] {
  const out: string[] = [];
  for (const m of String(text || '').matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
    const body = m[1].trim().replace(/\s+(["']).*\1$/, '').replace(/^(?:d|up)\s+(?=\S)/, '');
    const key = canonicalTokenKey(body) || body;
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}

type LeadBusiness = { name?: string; email?: string; phone?: string; city?: string; region?: string; address?: string }
const LEAD_TOKEN_SOURCES: Record<string, (b: LeadBusiness) => string | undefined> = {
  firstName: () => '',
  fullName: (b: LeadBusiness) => b.name,
  company: (b: LeadBusiness) => b.name,
  email: (b: LeadBusiness) => b.email,
  phone: (b: LeadBusiness) => b.phone,
  title: () => '',
  location: (b: LeadBusiness) => b.city || b.region || b.address,
};

/** The value a saved lead (a business record) gives for one token, or '' when it has none. */
export function leadTokenValue(business: LeadBusiness | null | undefined, tokenKey: string): string {
  const key = canonicalTokenKey(tokenKey) || tokenKey;
  const pick = LEAD_TOKEN_SOURCES[key];
  return String((pick ? pick(business || {}) : '') ?? '').trim().slice(0, 200);
}

/**
 * One personal link per lead: the base link plus the values that lead has for the video's tokens.
 * Image tokens and tokens the lead has no value for are left out (the video shows its fallback).
 * Returns [{ name, email, company, link }].
 */
export function leadLinks(
  baseUrl: string,
  tokens: string[] = [],
  leads: Array<{ business?: LeadBusiness } | LeadBusiness> = [],
  { includePrivate = false }: { includePrivate?: boolean } = {},
): Array<{ name: string; email: string; company: string; link: string }> {
  return leads.map((lead) => {
    const b: LeadBusiness = (lead as { business?: LeadBusiness })?.business || (lead as LeadBusiness) || {};
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

const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV of name, email, company, link, for email tools. */
export function leadLinksCsv(rows: Array<{ name: string; email: string; company: string; link: string }>): string {
  const head = ['Name', 'Email', 'Company', 'Link'];
  return [head, ...rows.map((r) => [r.name, r.email, r.company, r.link])].map((r) => r.map(csvCell).join(',')).join('\r\n');
}


/** Personal details that would sit in plain sight in the link; left out unless the sender opts in. */
const PRIVATE_KEYS = new Set(['email', 'phone', 'businessPhone', 'businessEmail']);

/** Sample values used by "Preview as recipient". */
const SAMPLE_VALUES: Record<string, string> = {
  firstName: 'Alex', lastName: 'Taylor', fullName: 'Alex Taylor', company: 'Acme Co', companyName: 'Acme Co',
  title: 'Founder', location: 'Austin', industry: 'Retail', email: 'alex@example.com', phone: '555 0100',
};

/** The provider's recipient-id merge tag (e.g. Mailchimp's *|UNIQID|*), or '' when none is known. */
export function recipientIdTagFor(provider: { recipientId?: string; open: string; close: string } | null | undefined): string {
  return provider?.recipientId ? `${provider.open}${provider.recipientId}${provider.close}` : '';
}

/** Escape text for an HTML attribute or text node. */
const escHtml = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Copy-and-paste HTML for an email: a poster image (or a button when there is no image) that links to the
 * personalized video. Email can't play video, so the link is what carries the personalization.
 */
export function emailSnippet({ link, posterUrl = '', alt = 'Watch your video', buttonText = 'Watch your video', width = 560 }: { link: string; posterUrl?: string; alt?: string; buttonText?: string; width?: number }): string {
  const href = escHtml(link);
  const poster = String(posterUrl || '').trim();
  if (/^https?:\/\//i.test(poster)) {
    return `<a href="${href}" target="_blank" style="display:block;text-decoration:none"><img src="${escHtml(poster)}" alt="${escHtml(alt)}" width="${Number(width) || 560}" style="display:block;border:0;max-width:100%;height:auto"></a>`;
  }
  return `<a href="${href}" target="_blank" style="display:inline-block;padding:14px 28px;background:#111111;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;text-decoration:none;border-radius:6px">${escHtml(buttonText)}</a>`;
}

/** Link with sample values filled in, to see what a recipient would see. Image tokens are left out. */
export function previewLink(baseUrl: string, tokens: string[] = []): string {
  const url = new URL(baseUrl);
  for (const raw of tokens) {
    const key = canonicalTokenKey(raw) || String(raw);
    if (!key || isImageTokenKey(key)) continue;
    url.searchParams.set(key, SAMPLE_VALUES[key] || `Sample ${key}`);
  }
  return url.toString();
}

/** Tokens a text uses WITHOUT a fallback, so a blank in the recipient list would leave a gap ({{d key "there"}} adds one). */
export function tokensWithoutDefault(text: string): string[] {
  const out: string[] = [];
  for (const m of String(text || '').matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
    const body = m[1].trim();
    if (/^(?:d|default)\s+\S+\s+(["']).*\1$/.test(body)) continue;
    const key = canonicalTokenKey(body.replace(/^(?:up)\s+(?=\S)/, '')) || body.replace(/^(?:up)\s+(?=\S)/, '');
    if (key && !isImageTokenKey(key) && !out.includes(key)) out.push(key);
  }
  return out;
}
