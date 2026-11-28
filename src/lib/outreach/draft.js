/**
 * Video Outreach studio (route: #/outreach): the campaign draft behind its
 * steps, the contact list, and the published campaign. Pure logic, no DOM,
 * so it is tested on its own (src/lib/outreach/__tests__/draft.test.js).
 *
 *   Record    → draft.video    { url, duration, hasAudio, type }
 *   Voice     → draft.voice    { mode: 'clone' | 'stock', cloneVoiceId?, stockVoice?, consent?, fallbackUrl?, fallbackDuration? }
 *   Customize → draft.header, draft.message, draft.fallbacks, draft.cta
 *   Contacts  → draft.contacts [{ id, firstName, lastName, email, company, website }]
 *   Generate  → draft.campaign { id, url, publishedAt, links: [{ contactId, link, voiced }] }
 *
 * A campaign is one published video (public.published_videos, played by the
 * public page /watch/<id>). buildCampaignProject() makes that project: the
 * recording, the greeting as a personalized Smart Speech clip with one voiced
 * variant per contact (clip.tts.variants[contactId], played by the watch page
 * for ?c=<contactId>), and `landing` (header, message, booking button) which
 * the watch page shows around the video. Each contact's personal link carries
 * ?c=<contactId> plus their token values, so no contact data is stored on a
 * server.
 */

import { cardDetails, cardKey, cardSideFor } from './profileCard.js';

export const DRAFT_KEY = 'outreach-draft-v1';
// Sendspark-style: record, the AI intro (voice + greeting), the page, prospects, then generate and
// share; Videos is the library of dynamic videos (campaigns).
export const STEPS = ['Record', 'AI intro', 'Page', 'Prospects', 'Generate & share', 'Videos'];
/** Steps that must be complete before a campaign can be generated. */
export const SETUP_STEPS = 4;
export const MAX_CONTACTS = 500;

// Mirrors smartSpeech.PERSONAL_LIMIT: a personalized spoken line may be up to 70 characters.
export const GREETING_LIMIT = 70;
export const HEADER_LIMIT = 120;
export const MESSAGE_LIMIT = 500;
export const CTA_LIMIT = 40;
// Same rule as agent-audio's CLONE_VOICE_ID.
export const CLONE_VOICE_ID = /^[A-Za-z][A-Za-z0-9_-]{7,63}$/;
export const STOCK_VOICES = ['Wise_Woman', 'Calm_Woman', 'Friendly_Person', 'Casual_Guy', 'Deep_Voice_Man', 'Elegant_Man'];
export const FIRST_NAME_FALLBACKS = ['there', 'friend'];

const TOKEN_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

// The email sent with each link (src/lib/outreach/email.js): {{link}} is the contact's page.
export const DEFAULT_EMAIL = {
  subject: 'A quick video for {{firstname}}',
  body: 'Hi {{firstname}},\n\nI recorded a short video for {{company}}. It takes two minutes:\n\n{{link}}\n\nThanks!',
  thumbText: 'Hi {{firstname}}, this is for you',
  // Thumbnail look (src/lib/outreach/thumbnail.js thumbSettings): animated GIF or still,
  // where the preview starts, the prospect's logo, and the play button.
  thumb: { type: 'gif', start: 1, logo: true, play: { show: true, style: 'solid', color: '#4f46e5', opacity: 1 } },
};

export function defaultDraft() {
  return {
    version: 1,
    video: null,
    voice: { mode: 'clone', cloneVoiceId: '', stockVoice: 'Wise_Woman', consent: null, fallbackUrl: '', fallbackDuration: 0 },
    greeting: 'Hi {{firstname}}!',
    header: 'Hi {{firstname}}, I made this for you',
    message: 'Excited to show how we can help {{company}}.',
    fallbacks: { firstname: 'there', company: 'your company' },
    // live: "Talk live" on the landing page (src/lib/outreach/liveCall.js) while you're available in the studio.
    cta: { enabled: true, label: 'Schedule a demo', url: '', live: false },
    // Who sent it (Customize step): shown on the landing page and in the page's menu bar.
    sender: { name: '', title: '', company: '', logo: '', photo: '' },
    // The landing page of this dynamic video (like Sendspark, the page belongs to the video): null = the plain
    // video page, else { template: <design id>, editor: <your edited page> | null (the design as it comes) }.
    page: null,
    // Kind of dynamic video (Create Dynamic Videos): 'variables' (the greeting says several details, e.g. name and
    // company), 'greeting' (an AI "Hi {{firstname}}!"), 'same' (everyone hears the recording as is, no AI voice).
    kind: 'greeting',
    // Show the transcript (captions) on the prospect's page (the editor's Transcript switch).
    showTranscript: true,
    contacts: [],
    campaign: null,
    name: '',
    // 'recording': the video as recorded. 'website': each contact's website behind the camera bubble.
    // 'recording': the video as recorded. 'website' | 'image' | 'map': a per-contact picture behind a
    // round camera bubble: their website, an image (theirs or yours), or a map of their address.
    // bubble: where your camera sits over the background ('fixed' in a corner, or 'spotlight': larger, bottom centre).
    // scroll / scrollBack: a website background scrolls down (and back up); cursor: a pointer moves over it.
    background: { mode: 'recording', fallbackSite: '', image: '', bubble: { mode: 'fixed', corner: 'bottom-left' }, scroll: true, scrollBack: false, onMissing: 'fallback' },
    // Map captures during Generate: { [normalized address]: image URL }.
    mapShots: {},
    // Profile cards drawn during Generate (src/lib/outreach/profileCard.js): { [card key]: image URL }.
    profileShots: {},
    // Screenshots captured during Generate: { [site home page]: image URL }.
    siteShots: {},
    // Websites that could not be captured: { [site home page]: message }.
    siteErrors: {},
    // Company logos found while capturing websites: { [site home page]: image URL }.
    siteLogos: {},
    email: { ...DEFAULT_EMAIL },
    // The recording script (Script card, AI writer), shown in the recorder's teleprompter.
    script: '',
    // Output language of the greeting voice and texts (Voice step).
    language: 'English',
    // Captions of the recording (src/lib/outreach/transcript.js): { lang, lines, translations }.
    captions: null,
    // Lip-synced greetings already made (src/lib/outreach/lipsync.js): { [key]: our stored URL }, so Generate
    // doesn't pay again for the same recording and greeting.
    lipsyncCache: {},
    // The editor's recipe (src/lib/outreach/editTools.js normalizeEdit) and chapters made from the captions.
    edit: null,
    chapters: [],
    // Editing is always done from the original recording (sourceVideo: url, duration, width, height); video is the
    // campaign video (the original, or the last applied edit). videoSegs maps the original's timeline (captions,
    // chapters) onto it; appliedKey is the recipe it was rendered from; bgCache the background pass.
    sourceVideo: null,
    videoSegs: null,
    appliedKey: null,
    bgCache: null,
  };
}

/** The saved draft merged over defaults, so older or partial drafts still load. */
export function loadDraft(storage = globalThis.localStorage) {
  const base = defaultDraft();
  try {
    const saved = JSON.parse(storage?.getItem(DRAFT_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return base;
    return {
      ...base,
      ...saved,
      voice: { ...base.voice, ...(saved.voice || {}) },
      fallbacks: { ...base.fallbacks, ...(saved.fallbacks || {}) },
      cta: { ...base.cta, ...(saved.cta || {}) },
      sender: { ...base.sender, ...(saved.sender || {}) },
      contacts: Array.isArray(saved.contacts) ? saved.contacts : [],
      background: { ...base.background, ...(saved.background || {}), bubble: { ...base.background.bubble, ...(saved.background?.bubble || {}) } },
      siteShots: saved.siteShots && typeof saved.siteShots === 'object' ? saved.siteShots : {},
      siteErrors: saved.siteErrors && typeof saved.siteErrors === 'object' ? saved.siteErrors : {},
      mapShots: saved.mapShots && typeof saved.mapShots === 'object' ? saved.mapShots : {},
      profileShots: saved.profileShots && typeof saved.profileShots === 'object' ? saved.profileShots : {},
      siteLogos: saved.siteLogos && typeof saved.siteLogos === 'object' ? saved.siteLogos : {},
      lipsyncCache: saved.lipsyncCache && typeof saved.lipsyncCache === 'object' ? saved.lipsyncCache : {},
      voiceCache: saved.voiceCache && typeof saved.voiceCache === 'object' ? saved.voiceCache : {},
      chapters: Array.isArray(saved.chapters) ? saved.chapters : [],
      email: { ...base.email, ...(saved.email || {}), thumb: { ...base.email.thumb, ...(saved.email?.thumb || {}) } },
      ...pageOf(saved),
    };
  } catch {
    return base;
  }
}

/**
 * A greeting that was already voiced is reused, not paid for again. The key is the exact request sent to the voice
 * service (voice, language, speed, text), so changing any of those makes a new greeting. Because the audio keeps
 * the same URL, the lip-sync cache (keyed by that URL) also hits on the next run.
 * `make(line)` generates and uploads one greeting -> { url, duration }; the caller saves the draft afterwards.
 */
export async function voiceFromCache(draft, line, make, { max = MAX_CONTACTS + 100 } = {}) { // room for every greeting of the largest campaign
  const key = JSON.stringify(speakRequest(draft, line));
  const hit = draft.voiceCache?.[key];
  if (hit && typeof hit.url === 'string' && hit.url && !hit.url.startsWith('blob:')) return { url: hit.url, duration: hit.duration, reused: true };
  const made = await make(line);
  const entries = Object.entries(draft.voiceCache && typeof draft.voiceCache === 'object' ? draft.voiceCache : {}).slice(-(max - 1));
  draft.voiceCache = { ...Object.fromEntries(entries), [key]: { url: made.url, duration: made.duration } };
  return { ...made, reused: false };
}

/** The three kinds of dynamic video (Create Dynamic Videos), with the greeting each starts with. */
export const DYNAMIC_KINDS = Object.freeze([
  { id: 'variables', title: 'Multiple variables', text: 'The greeting says several details, like their name and company.', greeting: 'Hi {{firstname}}, I made this for {{company}}!' },
  { id: 'greeting', title: 'AI greeting', text: 'Each video starts with “Hi Name” in your voice. Many languages supported.', greeting: 'Hi {{firstname}}!' },
  { id: 'same', title: 'Same audio', text: 'Everyone hears your recording as it is, without an AI voice.', greeting: '' },
]);

/** A valid { template, editor } page, or null. */
export function cleanPage(page) {
  if (!page || typeof page !== 'object' || typeof page.template !== 'string' || !/^editable-[a-z0-9-]+$/.test(page.template)) return null;
  return { template: page.template, editor: page.editor && typeof page.editor === 'object' ? page.editor : null };
}

// Drafts from before the page belonged to the video chose it by id: 'design:<id>' is that design as it comes;
// an id of a page saved in Video Pages is kept in `pageId` until the studio loads that page's content.
function pageOf(saved) {
  if (saved.page !== undefined) return { page: cleanPage(saved.page), pageId: undefined };
  const id = typeof saved.pageId === 'string' ? saved.pageId : '';
  if (id.startsWith('design:')) return { page: cleanPage({ template: id.slice(7), editor: null }), pageId: undefined };
  return { page: null, pageId: id || undefined };
}

export function saveDraft(draft, storage = globalThis.localStorage) {
  try { storage?.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* storage full or blocked: the draft stays in memory */ }
}

export function clearDraft(storage = globalThis.localStorage) {
  try { storage?.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

/** Token keys used in a template, lower-cased: 'Hi {{firstName}}' → ['firstname']. */
export function tokensIn(template) {
  return [...new Set([...String(template || '').matchAll(TOKEN_RE)].map((m) => m[1].toLowerCase()))];
}

/** Fill {{tokens}} from a contact, then from the fallbacks; unknown tokens become ''. */
export function fillTemplate(template, contact = {}, fallbacks = {}) {
  const values = {};
  for (const [k, v] of Object.entries(contact || {})) values[k.toLowerCase()] = v;
  const fb = {};
  for (const [k, v] of Object.entries(fallbacks || {})) fb[k.toLowerCase()] = v;
  return String(template || '').replace(TOKEN_RE, (_, key) => {
    const k = key.toLowerCase();
    const value = String(values[k] ?? '').trim();
    return value || String(fb[k] ?? '').trim();
  }).replace(/\s{2,}/g, ' ').trim();
}

// Booking pages that allow being shown inside another page, and how to ask for the embed view.
const CALENDAR_HOSTS = [
  { re: /^(www\.)?calendly\.com$/, params: { embed_type: 'Inline', hide_gdpr_banner: '1' } },
  { re: /^(app\.)?cal\.com$/, params: { embed: 'true' } },
  { re: /^calendar\.google\.com$/, path: /^\/calendar\/appointments\//, params: { gv: 'true' } },
  { re: /^meetings(-[a-z0-9]+)?\.hubspot\.com$/, params: { embed: 'true' } },
  { re: /^savvycal\.com$/, params: {} },
  { re: /^tidycal\.com$/, params: {} },
];

/** The embeddable address of a booking link, or null when it can't be shown in the page. */
export function calendarEmbedUrl(value) {
  if (!isHttpsUrl(value)) return null;
  const u = new URL(String(value));
  const host = CALENDAR_HOSTS.find((h) => h.re.test(u.hostname) && (!h.path || h.path.test(u.pathname)));
  if (!host || u.pathname === '/' || u.username || u.password) return null;
  Object.entries(host.params).forEach(([k, v]) => u.searchParams.set(k, v));
  return u.toString();
}

export function isHttpsUrl(value) {
  try {
    const u = new URL(String(value));
    return u.protocol === 'https:' && u.hostname.includes('.');
  } catch {
    return false;
  }
}

/** Problems that stop each step from completing, keyed by step number (1-based). */
export function stepErrors(draft, step) {
  const errors = [];
  if (step === 1) {
    if (!draft.video?.url) errors.push('Record or upload a video first.');
    else if (draft.video.url.startsWith('blob:')) errors.push('The video has not finished uploading.');
  }
  if (step === 2 && draft.kind !== 'same') {
    const v = draft.voice || {};
    if (v.mode === 'clone') {
      if (!CLONE_VOICE_ID.test(v.cloneVoiceId || '')) errors.push('Clone your voice, or choose a stock voice.');
      if (!v.consent?.at) errors.push('Confirm the voice is your own before using it.');
    } else if (!STOCK_VOICES.includes(v.stockVoice)) {
      errors.push('Choose a stock voice.');
    }
    const greeting = String(draft.greeting || '').trim();
    if (!greeting) errors.push('Write the greeting each contact will hear.');
    else if (greeting.length > GREETING_LIMIT) errors.push(`The spoken greeting can be up to ${GREETING_LIMIT} characters.`);
    if (!String(draft.fallbacks?.firstname || '').trim()) errors.push('Add a fallback for contacts without a first name.');
    if (!v.fallbackUrl) errors.push('Generate the voice so contacts without details still hear a greeting.');
  }
  if (step === 3) {
    const header = String(draft.header || '').trim();
    if (!header) errors.push('Write a header for the landing page.');
    if (header.length > HEADER_LIMIT) errors.push(`The header can be up to ${HEADER_LIMIT} characters.`);
    if (String(draft.message || '').length > MESSAGE_LIMIT) errors.push(`The message can be up to ${MESSAGE_LIMIT} characters.`);
    if (draft.cta?.enabled) {
      const label = String(draft.cta.label || '').trim();
      if (!label) errors.push('Give the button a label.');
      else if (label.length > CTA_LIMIT) errors.push(`The button label can be up to ${CTA_LIMIT} characters.`);
      if (!isHttpsUrl(draft.cta.url)) errors.push('The booking link must be an https:// address.');
      else if (draft.cta.embed && !calendarEmbedUrl(draft.cta.url)) errors.push('Only Calendly, Cal.com, Google Calendar appointment, HubSpot, SavvyCal and TidyCal booking pages can be shown on the page. Turn off "Show the calendar" or use one of those links.');
    }
  }
  if (step === 3 && (draft.background?.mode === 'image' || draft.background?.mode === 'map')) {
    if (!/^https:\/\//i.test(String(draft.background.image || ''))) errors.push(draft.background.mode === 'map' ? 'Add a fallback image for contacts without an address.' : 'Add a background image (it is also used for contacts without their own).');
  }
  if (step === 3 && draft.background?.mode === 'website') {
    if (!siteKey(draft.background.fallbackSite)) errors.push('Add a fallback website for contacts without one.');
  }
  if (step === 4) {
    const n = (draft.contacts || []).length;
    if (!n) errors.push('Add at least one contact.');
    if (n > MAX_CONTACTS) errors.push(`A campaign can have up to ${MAX_CONTACTS} contacts.`);
  }
  if (step === 5) {
    if (!draft.campaign?.id) errors.push('Generate the campaign to get each contact\u2019s link.');
  }
  return errors;
}

/** The voice the greeting is spoken in, as Smart Speech / agent-audio understand it. */
export function voiceSettings(draft) {
  const v = draft.voice || {};
  if (v.mode === 'clone' && CLONE_VOICE_ID.test(v.cloneVoiceId || '')) {
    return { provider: 'minimax', voice: v.cloneVoiceId, cloneVoiceId: v.cloneVoiceId };
  }
  return { provider: 'minimax', voice: STOCK_VOICES.includes(v.stockVoice) ? v.stockVoice : 'Wise_Woman' };
}

/** The request body for /api/agent-audio that speaks `text` in the chosen voice. */
export function speakRequest(draft, text) {
  const s = voiceSettings(draft);
  // The greeting's language (Customize → Output language), spoken in that language by MiniMax.
  const lang = draft.language && draft.language !== 'English' ? { languageBoost: draft.language } : {};
  return { provider: 'minimax', text, voice: s.voice, speed: 1, ...(s.cloneVoiceId ? { cloneVoiceId: s.cloneVoiceId } : {}), ...lang };
}

// ---------------------------------------------------------------- contacts

export const CONTACT_FIELDS = [
  ['firstName', 'First name'],
  ['lastName', 'Last name'],
  ['email', 'Email'],
  ['company', 'Company'],
  ['jobTitle', 'Job title'],
  ['website', 'Website or social page'],
  ['address', 'Address'],
  ['backgroundImage', 'Background image'],
  ['linkedin', 'LinkedIn URL'],
];

// Header spellings that map to each field (compared lower-case, without spaces, _ or -).
const HEADER_ALIASES = {
  firstName: ['firstname', 'first', 'givenname', 'fname', 'name'],
  lastName: ['lastname', 'last', 'surname', 'familyname', 'lname'],
  email: ['email', 'emailaddress', 'mail', 'workemail'],
  company: ['company', 'companyname', 'organization', 'organisation', 'business', 'account'],
  jobTitle: ['jobtitle', 'title', 'role', 'position', 'job'],
  website: ['website', 'url', 'site', 'domain', 'companywebsite', 'web', 'websiteorsocialpage', 'social', 'socialurl', 'socialpage', 'youtube', 'tiktok', 'facebook', 'instagram'],
  address: ['address', 'streetaddress', 'location', 'fulladdress', 'officeaddress'],
  backgroundImage: ['backgroundimage', 'background', 'backgroundurl', 'bgimage', 'image', 'imageurl'],
  linkedin: ['linkedin', 'linkedinurl', 'linkedinprofile', 'linkedinprofileurl', 'personlinkedinurl', 'profileurl'],
};
const norm = (h) => String(h || '').toLowerCase().replace(/[\s_\-.]+/g, '');

/** Parse CSV text (quoted fields, "" escapes, CRLF) → { headers, rows: object[] }. */
export function parseCsv(text) {
  const records = [];
  let row = [];
  let field = '';
  let quoted = false;
  const src = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((c) => c.trim())) records.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim())) records.push(row);
  const [headers = [], ...body] = records;
  const keys = headers.map((h) => h.trim());
  return { headers: keys, rows: body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()]))) };
}

/** Best guess of which CSV column feeds each contact field: { firstName: 'First Name', … }. */
export function guessMapping(headers) {
  const mapping = {};
  for (const [field] of CONTACT_FIELDS) {
    const hit = headers.find((h) => HEADER_ALIASES[field].includes(norm(h)) && !Object.values(mapping).includes(h));
    if (hit) mapping[field] = hit;
  }
  return mapping;
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;
const shortId = (rand = Math.random) => `c${Math.floor(rand() * 2 ** 40).toString(36)}`;

/** A contact from loose input: trims, caps lengths, adds an id; null when it has no name and no email. */
export function makeContact(input = {}, { rand } = {}) {
  const c = {};
  for (const [field] of CONTACT_FIELDS) c[field] = String(input[field] ?? '').trim().slice(0, field === 'website' || field === 'backgroundImage' || field === 'linkedin' ? 500 : field === 'address' ? 200 : 120);
  if (c.website && !/^https?:\/\//i.test(c.website)) c.website = `https://${c.website}`;
  // A background image must be a public https picture.
  if (c.backgroundImage && !/^https:\/\/[^\s]+$/i.test(c.backgroundImage)) c.backgroundImage = '';
  c.linkedin = linkedinProfile(c.linkedin);
  if (!c.firstName && !c.lastName && !c.email) return null;
  c.id = SAFE_ID.test(String(input.id || '')) ? String(input.id) : shortId(rand);
  return c;
}

/** Whether "Add from my contacts" can be offered (Contact Picker API: Android Chrome). */
export const contactPickerSupported = (nav = globalThis.navigator) => !!(nav?.contacts?.select);

/**
 * Contacts picked on the phone (Contact Picker API: { name: [], email: [] } each) → { contacts, skipped }.
 * A prospect needs an email for their link, so contacts without one are skipped.
 */
export function contactsFromPicker(picked = [], opts) {
  const contacts = [];
  let skipped = 0;
  for (const p of Array.isArray(picked) ? picked : []) {
    const email = (p?.email || []).map((e) => String(e || '').trim()).find((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
    if (!email) { skipped += 1; continue; }
    const [first = '', ...rest] = String((p?.name || [])[0] || '').trim().split(/\s+/).filter(Boolean);
    const c = makeContact({ firstName: first, lastName: rest.join(' '), email }, opts);
    if (c) contacts.push(c); else skipped += 1;
  }
  return { contacts, skipped };
}

/** CSV rows + column mapping → { contacts, skipped } (rows without a name or email are skipped). */
export function contactsFromRows(rows, mapping, opts) {
  const contacts = [];
  let skipped = 0;
  for (const row of rows) {
    const input = {};
    for (const [field] of CONTACT_FIELDS) if (mapping[field]) input[field] = row[mapping[field]];
    // A single "Name" column: split into first and last.
    if (mapping.firstName && !mapping.lastName && /\s/.test(String(input.firstName || '').trim()) && norm(mapping.firstName) === 'name') {
      const [first, ...rest] = String(input.firstName).trim().split(/\s+/);
      input.firstName = first; input.lastName = rest.join(' ');
    }
    const c = makeContact(input, opts);
    if (c) contacts.push(c); else skipped += 1;
  }
  return { contacts, skipped };
}

/** Merge new contacts into a list, skipping repeated emails (case-insensitive). */
/**
 * Leads saved in Lead Finder → contacts. A lead is a business, so the contact gets the
 * business email, name (as company) and website; leads without an email can't be sent to
 * and are counted as skipped.
 */
export function contactsFromLeads(leads = [], opts) {
  const contacts = [];
  let skipped = 0;
  for (const lead of leads) {
    const b = lead?.business || {};
    const email = String(b.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { skipped += 1; continue; }
    const address = [b.address, b.city, b.region, b.country].filter(Boolean).join(', ');
    const c = makeContact({ email, company: b.name, website: b.website, address }, opts);
    if (c) contacts.push(c); else skipped += 1;
  }
  return { contacts, skipped };
}

export function mergeContacts(existing, incoming) {
  // Same person: the same email, or (with no email) the same name and company.
  const keyOf = (c) => {
    const email = String(c?.email || '').trim().toLowerCase();
    if (email) return `e:${email}`;
    const who = [c?.firstName, c?.lastName, c?.company].map((v) => String(v || '').trim().toLowerCase());
    return who.some(Boolean) ? `n:${who.join('|')}` : '';
  };
  const seen = new Set(existing.map(keyOf).filter(Boolean));
  const out = [...existing];
  for (const c of incoming) {
    const key = keyOf(c);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(c);
  }
  return out;
}

export const CSV_TEMPLATE = 'First Name,Last Name,Email,Company,Job Title,Website,Address,Background Image,LinkedIn URL\r\nMike,Markovic,mike@example.com,Acme,Head of Sales,acme.com,"1 Market St, San Francisco, CA",,https://www.linkedin.com/in/example\r\n';

// Social pages a background can show: their public profile page (same rule as /api/outreach/site-shot normalizeSite).
const SOCIAL_HOSTS = {
  'youtube.com': 'www.youtube.com', 'm.youtube.com': 'www.youtube.com',
  'tiktok.com': 'www.tiktok.com', 'm.tiktok.com': 'www.tiktok.com',
  'facebook.com': 'www.facebook.com', 'm.facebook.com': 'www.facebook.com', 'fb.com': 'www.facebook.com',
  'instagram.com': 'www.instagram.com',
  'x.com': 'x.com', 'twitter.com': 'x.com', 'mobile.twitter.com': 'x.com',
};
const bareHost = (h) => h.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
function socialProfile(host, u) {
  const parts = u.pathname.split('/').filter(Boolean).map((p) => p.replace(/[^A-Za-z0-9@._%-]/g, '')).filter(Boolean);
  if (!parts.length) return '';
  let keep;
  if (host === 'www.youtube.com') keep = ['channel', 'c', 'user'].includes(parts[0]) ? parts.slice(0, 2) : parts[0].startsWith('@') ? parts.slice(0, 1) : [];
  else if (host === 'www.tiktok.com') keep = parts[0].startsWith('@') ? parts.slice(0, 1) : [];
  else if (host === 'www.facebook.com') {
    if (parts[0] === 'profile.php') { const id = (u.searchParams.get('id') || '').replace(/\D/g, ''); return id ? `https://${host}/profile.php?id=${id}` : ''; }
    keep = parts[0] === 'people' ? parts.slice(0, 3) : parts.slice(0, parts[0] === 'p' ? 2 : 1);
  } else keep = parts.slice(0, 1);
  return keep.length && keep.length >= (['channel', 'c', 'user', 'p'].includes(keep[0]) ? 2 : 1) ? `https://${host}/${keep.join('/')}` : '';
}

/**
 * The key a background screenshot is stored under: a website's home page, or a social profile's own page
 * (YouTube, TikTok, Facebook, Instagram, X). A LinkedIn link keeps its address so the server can say it
 * can't be captured. Null when it isn't a web address.
 */
export function siteKey(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if ((u.protocol !== 'https:' && u.protocol !== 'http:') || !u.hostname.includes('.')) return null;
    const social = SOCIAL_HOSTS[bareHost(u.hostname)];
    if (social) return socialProfile(social, u) || null;
    if (bareHost(u.hostname) === 'linkedin.com') return `https://www.linkedin.com${u.pathname.replace(/\/+$/, '') || '/'}`;
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.port ? `:${u.port}` : ''}/`;
  } catch {
    return null;
  }
}

/** Every website a campaign needs a screenshot of: each contact's site, then the fallback. */
export function sitesToCapture(draft) {
  const sites = new Set((draft.contacts || []).filter((c) => !c.backgroundShot).map((c) => siteKey(c.website)).filter(Boolean));
  const fallback = siteKey(draft.background?.fallbackSite);
  if (fallback) sites.add(fallback);
  return [...sites];
}

// Error handling (Sendspark's dynamic-background settings): when a prospect has no website, or theirs can't be
// captured, either make their video over the fallback website, or make nothing and show an error to fix first.
export const SITE_ERROR = 'URL returned an error. Please use a different URL.';
export const RESTRICTED_ERROR = 'Page is content restricted. Please try a different page.';
/** The message for a website that could not be captured (the server's own, for a login wall or LinkedIn). */
export const siteErrorFor = (draft, c) => draft.siteErrors?.[siteKey(c?.website)] || SITE_ERROR;
export const MISSING_MODES = [['fallback', 'Generate video using fallback data'], ['error', 'Don\u2019t generate: show an error so I can update it']];
export const onMissingOf = (draft) => (draft.background?.onMissing === 'error' ? 'error' : 'fallback');

/** A contact's website background: 'uploaded' (their own screenshot), 'own' (captured), 'error' (could not be captured), 'none' (no website), 'pending' (not checked yet). */
export function siteStatus(draft, c) {
  if (/^https:\/\//i.test(String(c?.backgroundShot || ''))) return 'uploaded';
  const key = siteKey(c?.website);
  if (!key) return 'none';
  if (draft.siteShots?.[key]) return 'own';
  if (draft.siteErrors?.[key]) return 'error';
  return 'pending';
}

/** Contacts that stop the campaign when Error handling is "show an error": no website, or one that failed. */
export function backgroundProblems(draft) {
  if (draft.background?.mode !== 'website' || onMissingOf(draft) !== 'error') return [];
  return (draft.contacts || []).filter((c) => ['none', 'error'].includes(siteStatus(draft, c)));
}

export const BACKGROUND_MODES = ['recording', 'website', 'image', 'map', 'profile'];
export const BUBBLE_CORNERS = [['bottom-left', 'Bottom left'], ['bottom-right', 'Bottom right'], ['top-left', 'Top left'], ['top-right', 'Top right']];

/** The camera bubble setting with defaults: { mode: 'fixed' | 'spotlight', corner }. */
export function bubbleOf(draft) {
  const b = draft.background?.bubble || {};
  return { mode: b.mode === 'spotlight' ? 'spotlight' : 'fixed', corner: BUBBLE_CORNERS.some(([k]) => k === b.corner) ? b.corner : 'bottom-left' };
}

/** The published picture-in-picture for the bubble: a corner at 26% of the frame, or Spotlight (40%, bottom centre). */
export function bubblePip(draft) {
  const b = bubbleOf(draft);
  return b.mode === 'spotlight' ? { corner: 'bottom-center', size: 40, shape: 'circle' } : { corner: b.corner, size: 26, shape: 'circle' };
}

/** Which side of the frame a profile card goes, away from the bubble. */
export const cardSide = (draft) => cardSideFor(bubbleOf(draft));
export const usesBackground = (draft) => ['website', 'image', 'map', 'profile'].includes(draft.background?.mode);

/** A contact's address as a cache key (lower-case, single spaces). '' when there is none. */
export const mapKey = (address) => String(address || '').trim().replace(/\s+/g, ' ').toLowerCase().slice(0, 200);

/** Every address a map campaign needs a picture of. */
export function addressesToCapture(draft) {
  return [...new Set((draft.contacts || []).map((c) => mapKey(c.address)).filter(Boolean))];
}

/** The picture behind this contact's camera bubble, or '' (then the fallback shows). */
export function backgroundShotFor(draft, c) {
  const mode = draft.background?.mode;
  // An uploaded screenshot (Prospects → Upload screenshot) wins over the captured one.
  if (mode === 'website') return (/^https:\/\//i.test(String(c.backgroundShot || '')) ? c.backgroundShot : '') || draft.siteShots?.[siteKey(c.website)] || '';
  if (mode === 'image') return c.backgroundImage || '';
  if (mode === 'map') return draft.mapShots?.[mapKey(c.address)] || '';
  if (mode === 'profile') return draft.profileShots?.[cardKey(cardDetails(c, draft.fallbacks), cardSide(draft))] || '';
  return '';
}

/** The picture for contacts without their own. */
export function fallbackShotFor(draft) {
  const mode = draft.background?.mode;
  if (mode === 'website') return draft.siteShots?.[siteKey(draft.background.fallbackSite)] || '';
  if (mode === 'image' || mode === 'map') return /^https:\/\//i.test(String(draft.background.image || '')) ? draft.background.image : '';
  if (mode === 'profile') return draft.profileShots?.[cardKey(cardDetails({}, draft.fallbacks), cardSide(draft))] || '';
  return '';
}

/** The contact's profile with their background picture (all background modes). */
export const contactProfileFor = (draft, c) => contactProfile(c, {}, backgroundShotFor(draft, c));

/** The contact as a token profile, the shape the personalization helpers read (tokenSchema paths). */
export function contactProfile(c, siteShots = {}, backgroundUrl = '') {
  const shot = backgroundUrl || siteShots[siteKey(c.website)] || '';
  const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ');
  return {
    id: c.id,
    name: fullName || c.email,
    contact: { firstName: c.firstName, lastName: c.lastName, name: fullName, email: c.email, company: c.company, ...(c.jobTitle ? { title: c.jobTitle } : {}) },
    social: { website: c.website },
    variables: {
      firstName: c.firstName, lastName: c.lastName, fullName, email: c.email, company: c.company, website: c.website,
      ...(c.jobTitle ? { jobTitle: c.jobTitle } : {}),
      ...(shot ? { websiteShotUrl: shot } : {}),
    },
  };
}

/** Values for the studio's {{tokens}} (keys lower-cased, as fillTemplate reads them). */
export const contactValues = (c = {}) => ({ firstname: c.firstName || '', lastname: c.lastName || '', email: c.email || '', company: c.company || '', jobtitle: c.jobTitle || '', website: c.website || '' });

// ---------------------------------------------------------------- campaign

// The greeting track must be as long as the longest greeting (and the lip-synced intro): the
// player stops a clip's audio at its end, so a longer name would otherwise be cut off.
const clipsTimeline = (draft, variants = {}, lipsync = null) => {
  const videoSeconds = Math.max(1, Math.round(Number(draft.video.duration) || 30));
  const greetingSeconds = Math.max(0.5, Number(draft.voice.fallbackDuration) || 2,
    ...Object.values(variants || {}).map((v) => Number(v?.duration) || 0),
    lipsync?.introUrl ? Number(lipsync.seconds) || 0 : 0);
  return { videoSeconds, greetingSeconds, T: Math.max(videoSeconds, Math.ceil(greetingSeconds + 1)) };
};

/**
 * The published project for a campaign. `variants` is { [contactId]: { url, duration, text, name } }
 * from perContact.voiceForContacts. Track and clip shapes are the ones the public player reads
 * (same as the editor's publish: tracks with items, start/end seconds or left/width percent).
 */
export function buildCampaignProject(draft, { variants = {}, lipsync = null, extraTracks = null, aspect = '', now = Date.now() } = {}) {
  for (const step of [1, 2, 3, 4]) {
    const errors = stepErrors(draft, step);
    if (errors.length) throw new Error(errors[0]);
  }
  const id = now.toString(36);
  const { videoSeconds, greetingSeconds, T } = clipsTimeline(draft, variants, lipsync);
  const voice = voiceSettings(draft);
  const same = draft.kind === 'same';
  const greeting = same ? '' : String(draft.greeting).trim();
  const personal = tokensIn(greeting).length > 0;

  const tts = {
    provider: 'minimax',
    voice: voice.voice,
    ...(voice.cloneVoiceId ? { cloneVoiceId: voice.cloneVoiceId } : {}),
    ...(draft.language && draft.language !== 'English' ? { languageBoost: draft.language } : {}),
    speed: 1,
    text: greeting,
    fallback: personal ? fillTemplate(greeting, {}, draft.fallbacks) : '',
    personalized: personal,
    ...(personal && Object.keys(variants).length ? { variants } : {}),
  };

  const name = String(draft.name || '').trim() || `Outreach ${new Date(now).toISOString().slice(0, 10)}`;
  const recording = { id: `outreach-video-${id}`, name: 'Outreach recording', type: 'video', src: draft.video.url, left: 0, width: (videoSeconds / T) * 100 };
  // Lip-synced greeting (src/lib/outreach/lipsync.js): the first seconds play each contact's
  // synced intro (muted: the greeting audio plays on the voiceover track), then the recording
  // continues from there. Contacts without a synced intro see the original first seconds.
  const synced = lipsync?.introUrl && Object.keys(lipsync.clips || {}).length && lipsync.seconds < videoSeconds;
  const cameraItems = synced
    ? [
      { id: `outreach-intro-${id}`, name: 'Greeting (lip-synced)', type: 'video', src: lipsync.introUrl, volume: 0, left: 0, width: (lipsync.seconds / T) * 100,
        aiPerContact: { variants: Object.fromEntries(Object.entries(lipsync.clips).map(([cid, url]) => [cid, { url }])) } },
      { ...recording, id: `outreach-video-${id}`, trimIn: lipsync.seconds, left: (lipsync.seconds / T) * 100, width: ((videoSeconds - lipsync.seconds) / T) * 100 },
    ]
    : [recording];
  // Same audio: no greeting track; everyone hears the recording as it is.
  const voiceTrack = same ? null : { id: `track-voiceover-${id}`, type: 'audio', name: 'Voiceover', muted: false, solo: false,
    items: [{ id: `speech-outreach-${id}`, type: 'audio', role: 'voiceover', name: 'Greeting', src: draft.voice.fallbackUrl, volume: 1, tts, start: 0, end: greetingSeconds }] };

  // Website background: each contact's site screenshot full frame (scrolling), the recording in a round
  // bubble on top (Multi-Cam picture-in-picture, which the public player draws).
  const website = usesBackground(draft);
  const fallbackShot = website ? fallbackShotFor(draft) : null;
  if (website && !fallbackShot) throw new Error(draft.background.mode === 'website' ? 'Capture the fallback website first.' : 'Add the fallback image first.');
  const tracks = website
    ? [
      { id: `track-bg-${id}`, type: 'video', name: 'Contact background', muted: true, solo: false,
        // scroll: a website moves from its top (header, logo) to its bottom over the video, with a
        // pointer moving over it; images and maps stay still.
        items: [{ id: `outreach-site-${id}`, name: 'Contact background', type: 'image', src: '{{websiteShotUrl}}', fallbackSrc: fallbackShot, fit: 'cover', ...(draft.background.mode === 'website' && draft.background.scroll !== false ? { scroll: true, ...(draft.background.scrollBack ? { scrollBack: true } : {}), cursor: draft.background.cursor !== false } : {}), left: 0, width: 100 }] },
      { id: `track-cam-${id}`, type: 'video', name: 'Camera', muted: false, solo: false, items: cameraItems },
      voiceTrack,
    ].filter(Boolean)
    : [
      // The greeting plays over the first seconds of the recording (the Record step asks for a pause there).
      { id: `track-video-${id}`, type: 'video', name: 'Main Video', muted: false, solo: false, items: cameraItems },
      voiceTrack,
    ].filter(Boolean);

  // Personal additions from the editor (src/lib/outreach/editTools.js personalTracks): text with {{tokens}} and the
  // prospect's website as B-roll, on top of everything, filled in for each prospect.
  if (typeof extraTracks === 'function') tracks.push(...extraTracks(T));
  const chapters = (draft.chapters || []).filter((c) => Number.isFinite(c?.startMs) && c.title).slice(0, 20).map((c) => ({ startMs: Math.max(0, Math.round(c.startMs)), title: String(c.title).slice(0, 80) }));
  return {
    title: name.slice(0, 200),
    timelineSeconds: T,
    tracks,
    // The video's own shape (a square or vertical recording plays uncropped); a website background stays 16:9.
    ...(aspect && !website && aspect !== '16:9' ? { aspect } : {}),
    ...(chapters.length > 1 ? { chapters } : {}),
    ...(website ? { multiCam: { mode: 'pip', mainTrackId: `track-bg-${id}`, secondTrackId: `track-cam-${id}`, pip: bubblePip(draft) } } : {}),
    kind: 'outreach',
    campaign: { name: name.slice(0, 120), contacts: (draft.contacts || []).length },
    // Captions made in the Record step: the landing page's transcript (times match the recording,
    // which starts at 0 in every layout).
    ...(draft.captions?.lines?.length && draft.showTranscript !== false ? { transcript: draft.captions } : {}),
    landing: {
      header: String(draft.header || '').trim(),
      message: String(draft.message || '').trim(),
      fallbacks: { ...draft.fallbacks },
      cta: draft.cta?.enabled
        ? { label: String(draft.cta.label).trim(), url: draft.cta.url, ...(draft.cta.embed && calendarEmbedUrl(draft.cta.url) ? { embed: true } : {}) }
        : null,
      // "Talk live with Sam now" on the page while Sam is available (just the first name is shown).
      ...(draft.cta?.live ? { live: { host: String(draft.sender?.name || '').trim().split(/\s+/)[0].slice(0, 40) } } : {}),
    },
  };
}

/** Each contact's link, given the campaign's watch URL and the personalLink helper. */
export function campaignLinks(draft, watchUrl, personalLink, variants = {}) {
  const website = usesBackground(draft);
  const tokens = ['firstName', 'lastName', 'company', 'email', 'website', 'jobTitle', ...(website ? ['websiteShotUrl'] : [])];
  return (draft.contacts || []).map((c) => ({
    contactId: c.id,
    name: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email,
    email: c.email,
    company: c.company,
    voiced: !!variants[c.id]?.url,
    // Which background the contact sees: their own site, or the fallback.
    ...(website ? { site: backgroundShotFor(draft, c) ? 'own' : 'fallback' } : {}),
    ...(website && draft.background?.mode === 'website' && siteStatus(draft, c) === 'error' ? { siteError: true } : {}),
    link: personalLink(watchUrl, website ? contactProfileFor(draft, c) : contactProfile(c), tokens),
  }));
}

/** A LinkedIn profile link (https://www.linkedin.com/in/<name>), else ''. */
export function linkedinProfile(value) {
  const v = String(value || '').trim();
  const m = v.match(/^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/(in|pub)\/([A-Za-z0-9_%-]{2,100})\/?(?:[?#].*)?$/i);
  return m ? `https://www.linkedin.com/${m[1].toLowerCase()}/${m[2]}` : '';
}

// ---- Videos library: every generated campaign's draft is kept on this device, so a campaign can
// be opened again (its prospects, links, thumbnails and page) or used to start a new one.
export const LIBRARY_KEY = 'outreach-library-v1';
export const LIBRARY_LIMIT = 30;

const readLibrary = (storage) => {
  try {
    const v = JSON.parse(storage?.getItem(LIBRARY_KEY) || 'null');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch { return {}; }
};

/** Save a generated campaign's draft in the library (newest kept, at most LIBRARY_LIMIT). */
export function saveToLibrary(draft, storage = globalThis.localStorage, now = Date.now()) {
  const id = draft?.campaign?.id;
  if (!id) return false;
  const lib = readLibrary(storage);
  lib[id] = { savedAt: now, draft };
  const keep = Object.entries(lib).sort(([, a], [, b]) => b.savedAt - a.savedAt).slice(0, LIBRARY_LIMIT);
  for (let n = keep.length; n > 0; n -= 1) {
    try { storage?.setItem(LIBRARY_KEY, JSON.stringify(Object.fromEntries(keep.slice(0, n)))); return true; } catch { /* too big: drop the oldest */ }
  }
  return false;
}

/** The library, newest first: [{ id, savedAt, name, contacts, video, thumbnailUrl }]. */
export function listLibrary(storage = globalThis.localStorage) {
  return Object.entries(readLibrary(storage))
    .filter(([, e]) => e?.draft?.campaign)
    .sort(([, a], [, b]) => b.savedAt - a.savedAt)
    .map(([id, e]) => ({
      id,
      savedAt: e.savedAt,
      name: e.draft.name || 'Untitled campaign',
      contacts: e.draft.contacts?.length || 0,
      video: e.draft.video?.url || '',
      thumbnailUrl: e.draft.campaign.links?.find((l) => l.thumbnailUrl)?.thumbnailUrl || '',
    }));
}

/** Generated campaigns that let prospects call live: [{ videoId, name, contacts }] (for the studio's host line). */
export function liveCampaigns(storage = globalThis.localStorage, extra = null) {
  const out = new Map();
  const add = (d) => { if (d?.cta?.live && d.campaign?.id) out.set(d.campaign.id, { videoId: d.campaign.id, name: d.name || 'Untitled campaign', contacts: (d.contacts || []).map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, email: c.email })) }); };
  for (const e of Object.values(readLibrary(storage))) add(e?.draft);
  add(extra);
  return [...out.values()].slice(0, 20);
}

/** A saved campaign's draft (merged over defaults like loadDraft), or null. */
export function libraryDraft(id, storage = globalThis.localStorage) {
  const e = readLibrary(storage)[id];
  if (!e?.draft) return null;
  const mem = { getItem: () => JSON.stringify(e.draft) };
  return loadDraft(mem);
}

/** A new dynamic video: keeps your voice, sender details and page settings; the rest starts fresh. */
export function newDynamicVideo(from = {}, { keepVideo = false } = {}) {
  const d = defaultDraft();
  if (from.voice?.mode) d.voice = { ...d.voice, mode: from.voice.mode, cloneVoiceId: from.voice.cloneVoiceId || '', stockVoice: from.voice.stockVoice || d.voice.stockVoice, consent: from.voice.consent || null, consentChecked: !!from.voice.consentChecked };
  if (from.sender) d.sender = { ...d.sender, ...from.sender };
  if (from.cta) d.cta = { ...d.cta, ...from.cta };
  if (from.email) d.email = { ...d.email, ...from.email };
  if (from.language) d.language = from.language;
  if (from.page) d.page = cleanPage(JSON.parse(JSON.stringify(from.page)));
  if (DYNAMIC_KINDS.some((k) => k.id === from.kind)) d.kind = from.kind;
  if (keepVideo && from.video) {
    Object.assign(d, { video: from.video, captions: from.captions || null, script: from.script || '', greeting: from.greeting || d.greeting, header: from.header || d.header, message: from.message || d.message, background: { ...d.background, ...(from.background || {}) }, fallbacks: { ...d.fallbacks, ...(from.fallbacks || {}) } });
    d.voice = { ...d.voice, fallbackUrl: from.voice?.fallbackUrl || '', fallbackDuration: from.voice?.fallbackDuration || 0, lipsync: !!from.voice?.lipsync };
  }
  return d;
}
