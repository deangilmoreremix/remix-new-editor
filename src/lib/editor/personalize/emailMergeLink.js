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

/**
 * open/close wrap the provider's field name. `fields` maps OUR canonical token
 * keys to that provider's field. A token with no entry is sent as a custom
 * field named by `custom(key)` (default: the key itself); the caller is told
 * via `unmapped` so the UI can say "create this field in <provider>".
 */
export const EMAIL_PROVIDERS = [
  {
    key: 'mailchimp', label: 'Mailchimp', open: '*|', close: '|*',
    fields: { firstName: 'FNAME', lastName: 'LNAME', email: 'EMAIL', phone: 'PHONE' },
    custom: (k) => k.toUpperCase(),
  },
  {
    key: 'activecampaign', label: 'ActiveCampaign', open: '%', close: '%',
    fields: { firstName: 'FIRSTNAME', lastName: 'LASTNAME', email: 'EMAIL', fullName: 'FULLNAME', company: 'ORGNAME' },
    custom: (k) => k.toUpperCase(),
  },
  {
    key: 'klaviyo', label: 'Klaviyo', open: '{{ ', close: ' }}',
    fields: { firstName: 'first_name', lastName: 'last_name', email: 'email', company: 'organization', title: 'title' },
    custom: (k) => `person.${k}`,
  },
  {
    key: 'hubspot', label: 'HubSpot', open: '{{', close: '}}',
    fields: { firstName: 'contact.firstname', lastName: 'contact.lastname', email: 'contact.email', company: 'contact.company', title: 'contact.jobtitle' },
    custom: (k) => `contact.${k.toLowerCase()}`,
  },
  {
    key: 'constantcontact', label: 'Constant Contact', open: '[[', close: ']]',
    fields: { firstName: 'FirstName' },
  },
  {
    key: 'brevo', label: 'Brevo (Sendinblue)', open: '{{ contact.', close: ' }}',
    fields: { firstName: 'FIRSTNAME', lastName: 'LASTNAME', email: 'EMAIL' },
    custom: (k) => k.toUpperCase(),
  },
  {
    key: 'mailerlite', label: 'MailerLite', open: '{$', close: '}',
    fields: { firstName: 'name', lastName: 'last_name', email: 'email', company: 'company', phone: 'phone' },
    custom: (k) => k.toLowerCase(),
  },
  {
    key: 'kit', label: 'Kit (ConvertKit)', open: '{{ subscriber.', close: ' }}',
    fields: { firstName: 'first_name', email: 'email_address' },
    custom: (k) => k,
  },
  {
    key: 'getresponse', label: 'GetResponse', open: '[[', close: ']]',
    fields: { firstName: 'firstname', lastName: 'lastname', email: 'email', fullName: 'name' },
    custom: (k) => k.toLowerCase(),
  },
  {
    key: 'campaignmonitor', label: 'Campaign Monitor', open: '[', close: ',fallback=]',
    fields: { firstName: 'firstname', lastName: 'lastname', email: 'email', fullName: 'fullname' },
    custom: (k) => k.toLowerCase(),
  },
  {
    key: 'salesforcemc', label: 'Salesforce Marketing Cloud', open: '%%', close: '%%',
    fields: { firstName: 'FirstName', lastName: 'LastName', email: 'emailaddr' },
  },
  {
    // Generic: {{token}} with our own canonical names, for tools that map by name.
    key: 'custom', label: 'Custom ({{token}})', open: '{{', close: '}}',
    fields: {},
    custom: (k) => k,
  },
];

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
 * Image tokens can't be merge tags (they're URLs), so they're reported in
 * `skipped`; tokens the provider has no built-in field for are in `unmapped`.
 * Tags are appended raw on purpose: encoding them (%2A%7C…) would stop the
 * provider recognising and replacing them.
 */
export function mergeTagLink(baseUrl, tokens = [], provider, { preload = true } = {}) {
  const prov = typeof provider === 'string' ? emailProviderByKey(provider) : provider;
  if (!prov) throw new Error('Unknown email provider');
  const url = new URL(baseUrl);
  const parts = [];
  const unmapped = [];
  const skipped = [];
  const seen = new Set();
  for (const raw of tokens) {
    const key = canonicalTokenKey(raw) || String(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (isImageTokenKey(key)) {
      skipped.push(key);
      continue;
    }
    const { tag, mapped } = mergeTagFor(prov, key);
    if (!mapped) unmapped.push(key);
    parts.push(`${encodeURIComponent(key)}=${tag}`);
  }
  if (!preload) parts.unshift('preload=none');
  const base = url.toString();
  if (!parts.length) return { link: base, unmapped, skipped };
  const sep = url.search ? '&' : '?';
  return { link: `${base}${sep}${parts.join('&')}`, unmapped, skipped };
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
