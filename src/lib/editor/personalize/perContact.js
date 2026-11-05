/**
 * One video per contact. Contacts come from the Personalization Studio
 * (src/lib/contactStore.js: the Personalize window, including business
 * details saved from its Find a Business search). The same resolver the
 * studios use (resolveToken via resolveOverlayText) fills {{tokens}}.
 *
 *   - Smart Speech voices a personalized line once per contact; the audio
 *     variants live on one Voiceover clip: clip.tts.variants[contactId].
 *   - The composition plays the variant for the contact being rendered
 *     (editor preview: the selected contact; export: each contact; shared
 *     link: ?c=<contactId>), and the fallback audio otherwise.
 *   - Personal share links carry ?c=<contactId> plus the contact's values for
 *     the tokens the video uses.
 */
import { resolveOverlayText } from '../addons/overlayRender.js';
import { TOKEN_PATTERN, resolveToken, canonicalTokenKey } from '../../../components/personalize/tokenSchema.js';
import { isImageTokenKey, shareableImageValue } from '../../personalization/imageReadiness.js';
import { assetForUrl } from '../../personalization/imageStyle.js';

export const CONTACT_PARAM = 'c';
// Link params that carry an image's crop focus and brightness: `<token>__f=x,y`, `<token>__l=0.9`.
export const FOCUS_SUFFIX = '__f';
export const LUMINANCE_SUFFIX = '__l';
const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

/** Display name for a contact profile. */
export function contactName(profile) {
  const c = profile?.contact || {};
  return String(profile?.name || c.name || [c.firstName, c.lastName].filter(Boolean).join(' ') || profile?.variables?.fullName
    || profile?.personalization?.business?.businessName || profile?.id || 'Contact').trim();
}

export function contactEmail(profile) {
  return String(profile?.contact?.email || profile?.variables?.email || '').trim();
}

/** Contacts from the Personalization Studio (newest first, as stored). */
export function listContactProfiles(store) {
  const list = typeof store?.listProfiles === 'function' ? store.listProfiles() : [];
  return (Array.isArray(list) ? list : []).filter((p) => p && ID_RE.test(String(p.id || '')));
}

/** A line with this contact's details, or null when one of its tokens has no value. */
export function resolveLineFor(text, profile) {
  const out = resolveOverlayText(String(text || ''), profile);
  return /\{\{[^}]*\}\}/.test(out) ? null : out.replace(/\s{2,}/g, ' ').trim();
}

/** Token names a project uses anywhere in its text (canonical keys). */
export function projectTokens(project) {
  const keys = new Set();
  const visit = (v) => {
    if (typeof v === 'string') {
      for (const m of v.matchAll(TOKEN_PATTERN)) {
        // {{d key "default"}} / {{up key}} → key; names may contain spaces ({{first name}}).
        const body = m[1].trim().replace(/\s+(["']).*\1$/, '').replace(/^(?:d|up)\s+(?=\S)/, '');
        const key = canonicalTokenKey(body) || body;
        if (key) keys.add(key);
      }
    } else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') Object.values(v).forEach(visit);
  };
  visit(project?.tracks || project || []);
  return [...keys];
}

/**
 * Personal share link for a contact. Text values are cut at 200 characters;
 * image URLs ({{logoUrl}}, …) are kept whole (a cut URL is a broken image)
 * and only http(s) ones are added — data:/blob: images only exist in this
 * browser, so they can't travel in a link (personalLinkIssues reports them).
 */
export function personalLink(baseUrl, profile, tokens = []) {
  const url = new URL(baseUrl);
  url.searchParams.set(CONTACT_PARAM, String(profile.id));
  tokens.forEach((key) => {
    const value = resolveToken(profile, key);
    if (value == null || !String(value).trim()) return;
    if (isImageTokenKey(key)) {
      const href = shareableImageValue(value);
      if (href) {
        url.searchParams.set(key, href);
        // The viewer has no saved assets, so carry what shapes the image:
        // its crop focus and (for logos) its measured brightness.
        const asset = assetForUrl(profile, value) || assetForUrl(profile, href);
        const fx = Number(asset?.focus?.x);
        const fy = Number(asset?.focus?.y);
        if (Number.isFinite(fx) && Number.isFinite(fy)) {
          url.searchParams.set(`${key}${FOCUS_SUFFIX}`, `${Math.round(fx * 10) / 10},${Math.round(fy * 10) / 10}`);
        }
        const lum = Number(asset?.luminance);
        if (asset?.luminance != null && Number.isFinite(lum)) {
          url.searchParams.set(`${key}${LUMINANCE_SUFFIX}`, String(Math.round(lum * 1000) / 1000));
        }
      }
      return;
    }
    url.searchParams.set(key, String(value).slice(0, 200));
  });
  return url.toString();
}

/** Image tokens whose value can't go in this contact's link (local or too long). */
export function personalLinkIssues(profile, tokens = []) {
  return tokens.filter((key) => {
    if (!isImageTokenKey(key)) return false;
    const value = resolveToken(profile, key);
    return value != null && String(value).trim() && !shareableImageValue(value);
  });
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV of name, email, company, link (for email tools). */
export function linksCsv(rows) {
  const head = ['Name', 'Email', 'Company', 'Link'];
  return [head, ...rows.map((r) => [r.name, r.email, r.company, r.link])].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** The audio a clip plays for this contact (its variant, else the fallback src). */
export function voiceSrcFor(clip, profile) {
  const v = profile?.id != null ? clip?.tts?.variants?.[String(profile.id)] : null;
  return v?.url || clip?.src || '';
}

/** Has this personalized clip been voiced for this contact? */
export const hasVariantFor = (clip, contactId) => !!(contactId != null && clip?.tts?.variants?.[String(contactId)]?.url);

/**
 * Voice a personalized line for each contact (sequential, deduplicated by
 * resolved text, cancellable). generate(text) → Promise<{ url, duration }>.
 * Returns { variants, skipped } where skipped lists contacts missing a value.
 */
export async function voiceForContacts({ text, contacts, generate, onProgress, signal }) {
  const variants = {};
  const skipped = [];
  const byText = new Map();
  let done = 0;
  for (const profile of contacts) {
    if (signal?.aborted) throw Object.assign(new Error('Stopped'), { name: 'AbortError' });
    const line = resolveLineFor(text, profile);
    if (!line) {
      skipped.push({ id: profile.id, name: contactName(profile) });
    } else {
      let audio = byText.get(line);
      if (!audio) {
        audio = await generate(line);
        byText.set(line, audio);
      }
      variants[String(profile.id)] = { url: audio.url, duration: audio.duration, text: line, name: contactName(profile) };
    }
    done += 1;
    onProgress?.({ done, total: contacts.length, name: contactName(profile) });
  }
  return { variants, skipped };
}

/** Contact id from a shared link (?c=…). */
export function contactIdFromQuery(search = globalThis.location?.search || '') {
  const id = new URLSearchParams(search).get(CONTACT_PARAM);
  return id && ID_RE.test(id) ? id : null;
}
