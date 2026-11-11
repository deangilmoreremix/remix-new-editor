/**
 * Call-to-action links for overlays (upstream image/text "URL / PHONE"
 * switch): a web link, or a phone number with a country code that becomes a
 * tap-to-call `tel:` link, plus an optional email to notify when a viewer
 * tries to call ("Email to notify about call attempt").
 */
import { safeHref } from './overlayRender.js';

// [calling code, label] — common countries first, then alphabetical.
export const COUNTRY_CODES = [
  ['1', 'United States / Canada (+1)'], ['44', 'United Kingdom (+44)'], ['61', 'Australia (+61)'], ['64', 'New Zealand (+64)'],
  ['353', 'Ireland (+353)'], ['27', 'South Africa (+27)'], ['91', 'India (+91)'], ['49', 'Germany (+49)'], ['33', 'France (+33)'],
  ['34', 'Spain (+34)'], ['39', 'Italy (+39)'], ['31', 'Netherlands (+31)'], ['52', 'Mexico (+52)'], ['55', 'Brazil (+55)'],
  ['54', 'Argentina (+54)'], ['56', 'Chile (+56)'], ['57', 'Colombia (+57)'], ['51', 'Peru (+51)'], ['58', 'Venezuela (+58)'],
  ['43', 'Austria (+43)'], ['32', 'Belgium (+32)'], ['359', 'Bulgaria (+359)'], ['86', 'China (+86)'], ['385', 'Croatia (+385)'],
  ['357', 'Cyprus (+357)'], ['420', 'Czechia (+420)'], ['45', 'Denmark (+45)'], ['20', 'Egypt (+20)'], ['372', 'Estonia (+372)'],
  ['358', 'Finland (+358)'], ['30', 'Greece (+30)'], ['852', 'Hong Kong (+852)'], ['36', 'Hungary (+36)'], ['354', 'Iceland (+354)'],
  ['62', 'Indonesia (+62)'], ['972', 'Israel (+972)'], ['81', 'Japan (+81)'], ['254', 'Kenya (+254)'], ['82', 'South Korea (+82)'],
  ['371', 'Latvia (+371)'], ['370', 'Lithuania (+370)'], ['352', 'Luxembourg (+352)'], ['60', 'Malaysia (+60)'], ['356', 'Malta (+356)'],
  ['212', 'Morocco (+212)'], ['234', 'Nigeria (+234)'], ['47', 'Norway (+47)'], ['92', 'Pakistan (+92)'], ['63', 'Philippines (+63)'],
  ['48', 'Poland (+48)'], ['351', 'Portugal (+351)'], ['974', 'Qatar (+974)'], ['40', 'Romania (+40)'], ['966', 'Saudi Arabia (+966)'],
  ['381', 'Serbia (+381)'], ['65', 'Singapore (+65)'], ['421', 'Slovakia (+421)'], ['386', 'Slovenia (+386)'], ['46', 'Sweden (+46)'],
  ['41', 'Switzerland (+41)'], ['886', 'Taiwan (+886)'], ['66', 'Thailand (+66)'], ['90', 'Turkey (+90)'], ['380', 'Ukraine (+380)'],
  ['971', 'United Arab Emirates (+971)'], ['84', 'Vietnam (+84)'],
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Schema fields: URL/PHONE switch, link or country code + number, call alert email. */
export const CTA_LINK_FIELDS = (tab) => [
  { key: 'linkMode', label: 'Call-to-action', type: 'select', options: [['url', 'URL (open a link)'], ['phone', 'PHONE (click-to-call)']], tab },
  { key: 'linkUrl', label: 'URL (Call-to-action)', type: 'text', placeholder: 'https://example.com', tab, showIf: (o) => o.linkMode !== 'phone' },
  { key: 'linkTarget', label: 'Open Link In', type: 'select', options: [['_blank', 'New Tab'], ['_parent', 'Current tab']], tab, showIf: (o) => o.linkMode !== 'phone' && !!o.linkUrl },
  { key: 'phoneCountry', label: 'Country code', type: 'select', options: COUNTRY_CODES, tab, showIf: (o) => o.linkMode === 'phone' },
  { key: 'phoneNumber', label: 'Phone Number (Click-to-call)', type: 'text', placeholder: '234 567 8900', tab, showIf: (o) => o.linkMode === 'phone' },
  { key: 'callNotifyAddress', label: 'Email to notify about call attempt', type: 'text', placeholder: 'you@example.com', tab, showIf: (o) => o.linkMode === 'phone' },
];

export const CTA_LINK_DEFAULTS = { linkMode: 'url', linkUrl: '', linkTarget: '_blank', phoneCountry: '1', phoneNumber: '', callNotifyAddress: '' };

/** E.164-ish number for a country code + local number (null when invalid). */
export function phoneE164(country, number) {
  const raw = String(number || '').trim();
  if (!raw) return null;
  // A number typed with its own +country code wins.
  const digits = raw.startsWith('+') ? raw.replace(/[^0-9]/g, '') : `${String(country || '').replace(/[^0-9]/g, '')}${raw.replace(/[^0-9]/g, '').replace(/^0+/, '')}`;
  return digits.length >= 7 && digits.length <= 15 ? `+${digits}` : null;
}

/**
 * Where an overlay's call-to-action goes: { href, kind: 'url' | 'phone', phone? } or null.
 * Older projects stored a phone number or tel: link in linkUrl; those still work.
 */
export function ctaTarget(opts = {}) {
  if (opts.linkMode === 'phone') {
    const phone = phoneE164(opts.phoneCountry, opts.phoneNumber);
    return phone ? { href: `tel:${phone}`, kind: 'phone', phone } : null;
  }
  const href = safeHref(opts.linkUrl);
  if (!href) return null;
  return href.startsWith('tel:') ? { href, kind: 'phone', phone: href.slice(4) } : { href, kind: 'url' };
}

export const isValidNotifyEmail = (v) => EMAIL_RE.test(String(v || '').trim());
