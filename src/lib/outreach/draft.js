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

export const DRAFT_KEY = 'outreach-draft-v1';
export const STEPS = ['Record', 'Voice', 'Customize', 'Contacts', 'Generate', 'Campaigns'];
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
    cta: { enabled: true, label: 'Schedule a demo', url: '' },
    contacts: [],
    campaign: null,
    name: '',
    // 'recording': the video as recorded. 'website': each contact's website behind the camera bubble.
    background: { mode: 'recording', fallbackSite: '' },
    // Screenshots captured during Generate: { [site home page]: image URL }.
    siteShots: {},
    // Company logos found while capturing websites: { [site home page]: image URL }.
    siteLogos: {},
    email: { ...DEFAULT_EMAIL },
    // The recording script (Script card, AI writer), shown in the recorder's teleprompter.
    script: '',
    // Captions of the recording (src/lib/outreach/transcript.js): { lang, lines, translations }.
    captions: null,
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
      contacts: Array.isArray(saved.contacts) ? saved.contacts : [],
      background: { ...base.background, ...(saved.background || {}) },
      siteShots: saved.siteShots && typeof saved.siteShots === 'object' ? saved.siteShots : {},
      siteLogos: saved.siteLogos && typeof saved.siteLogos === 'object' ? saved.siteLogos : {},
      email: { ...base.email, ...(saved.email || {}), thumb: { ...base.email.thumb, ...(saved.email?.thumb || {}) } },
    };
  } catch {
    return base;
  }
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
  if (step === 2) {
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
  return { provider: 'minimax', text, voice: s.voice, speed: 1, ...(s.cloneVoiceId ? { cloneVoiceId: s.cloneVoiceId } : {}) };
}

// ---------------------------------------------------------------- contacts

export const CONTACT_FIELDS = [
  ['firstName', 'First name'],
  ['lastName', 'Last name'],
  ['email', 'Email'],
  ['company', 'Company'],
  ['jobTitle', 'Job title'],
  ['website', 'Website'],
];

// Header spellings that map to each field (compared lower-case, without spaces, _ or -).
const HEADER_ALIASES = {
  firstName: ['firstname', 'first', 'givenname', 'fname', 'name'],
  lastName: ['lastname', 'last', 'surname', 'familyname', 'lname'],
  email: ['email', 'emailaddress', 'mail', 'workemail'],
  company: ['company', 'companyname', 'organization', 'organisation', 'business', 'account'],
  jobTitle: ['jobtitle', 'title', 'role', 'position', 'job'],
  website: ['website', 'url', 'site', 'domain', 'companywebsite', 'web'],
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
  for (const [field] of CONTACT_FIELDS) c[field] = String(input[field] ?? '').trim().slice(0, field === 'website' ? 300 : 120);
  if (c.website && !/^https?:\/\//i.test(c.website)) c.website = `https://${c.website}`;
  if (!c.firstName && !c.lastName && !c.email) return null;
  c.id = SAFE_ID.test(String(input.id || '')) ? String(input.id) : shortId(rand);
  return c;
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
    const c = makeContact({ email, company: b.name, website: b.website }, opts);
    if (c) contacts.push(c); else skipped += 1;
  }
  return { contacts, skipped };
}

export function mergeContacts(existing, incoming) {
  const seen = new Set(existing.map((c) => c.email.toLowerCase()).filter(Boolean));
  const out = [...existing];
  for (const c of incoming) {
    const key = c.email.toLowerCase();
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(c);
  }
  return out;
}

export const CSV_TEMPLATE = 'First Name,Last Name,Email,Company,Job Title,Website\r\nMike,Markovic,mike@example.com,Acme,Head of Sales,acme.com\r\n';

/** A website's home page, the key its screenshot is stored under (same rule as /api/outreach/site-shot). */
export function siteKey(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if ((u.protocol !== 'https:' && u.protocol !== 'http:') || !u.hostname.includes('.')) return null;
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.port ? `:${u.port}` : ''}/`;
  } catch {
    return null;
  }
}

/** Every website a campaign needs a screenshot of: each contact's site, then the fallback. */
export function sitesToCapture(draft) {
  const sites = new Set((draft.contacts || []).map((c) => siteKey(c.website)).filter(Boolean));
  const fallback = siteKey(draft.background?.fallbackSite);
  if (fallback) sites.add(fallback);
  return [...sites];
}

/** The contact as a token profile, the shape the personalization helpers read (tokenSchema paths). */
export function contactProfile(c, siteShots = {}) {
  const shot = siteShots[siteKey(c.website)] || '';
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

const clipsTimeline = (draft) => {
  const videoSeconds = Math.max(1, Math.round(Number(draft.video.duration) || 30));
  const greetingSeconds = Math.max(0.5, Number(draft.voice.fallbackDuration) || 2);
  return { videoSeconds, greetingSeconds, T: Math.max(videoSeconds, Math.ceil(greetingSeconds + 1)) };
};

/**
 * The published project for a campaign. `variants` is { [contactId]: { url, duration, text, name } }
 * from perContact.voiceForContacts. Track and clip shapes are the ones the public player reads
 * (same as the editor's publish: tracks with items, start/end seconds or left/width percent).
 */
export function buildCampaignProject(draft, { variants = {}, lipsync = null, now = Date.now() } = {}) {
  for (const step of [1, 2, 3, 4]) {
    const errors = stepErrors(draft, step);
    if (errors.length) throw new Error(errors[0]);
  }
  const id = now.toString(36);
  const { videoSeconds, greetingSeconds, T } = clipsTimeline(draft);
  const voice = voiceSettings(draft);
  const greeting = String(draft.greeting).trim();
  const personal = tokensIn(greeting).length > 0;

  const tts = {
    provider: 'minimax',
    voice: voice.voice,
    ...(voice.cloneVoiceId ? { cloneVoiceId: voice.cloneVoiceId } : {}),
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
  const voiceTrack = { id: `track-voiceover-${id}`, type: 'audio', name: 'Voiceover', muted: false, solo: false,
    items: [{ id: `speech-outreach-${id}`, type: 'audio', role: 'voiceover', name: 'Greeting', src: draft.voice.fallbackUrl, volume: 1, tts, start: 0, end: greetingSeconds }] };

  // Website background: each contact's site screenshot full frame (scrolling), the recording in a round
  // bubble on top (Multi-Cam picture-in-picture, which the public player draws).
  const website = draft.background?.mode === 'website';
  const fallbackShot = website ? (draft.siteShots || {})[siteKey(draft.background.fallbackSite)] : null;
  if (website && !fallbackShot) throw new Error('Capture the fallback website first.');
  const tracks = website
    ? [
      { id: `track-bg-${id}`, type: 'video', name: 'Website background', muted: true, solo: false,
        // scroll: the page moves from its top (header, logo) to its bottom over the video.
        items: [{ id: `outreach-site-${id}`, name: 'Contact website', type: 'image', src: '{{websiteShotUrl}}', fallbackSrc: fallbackShot, fit: 'cover', scroll: true, left: 0, width: 100 }] },
      { id: `track-cam-${id}`, type: 'video', name: 'Camera', muted: false, solo: false, items: cameraItems },
      voiceTrack,
    ]
    : [
      // The greeting plays over the first seconds of the recording (the Record step asks for a pause there).
      { id: `track-video-${id}`, type: 'video', name: 'Main Video', muted: false, solo: false, items: cameraItems },
      voiceTrack,
    ];

  return {
    title: name.slice(0, 200),
    timelineSeconds: T,
    tracks,
    ...(website ? { multiCam: { mode: 'pip', mainTrackId: `track-bg-${id}`, secondTrackId: `track-cam-${id}`, pip: { corner: 'bottom-left', size: 26, shape: 'circle' } } } : {}),
    kind: 'outreach',
    campaign: { name: name.slice(0, 120), contacts: (draft.contacts || []).length },
    // Captions made in the Record step: the landing page's transcript (times match the recording,
    // which starts at 0 in every layout).
    ...(draft.captions?.lines?.length ? { transcript: draft.captions } : {}),
    landing: {
      header: String(draft.header || '').trim(),
      message: String(draft.message || '').trim(),
      fallbacks: { ...draft.fallbacks },
      cta: draft.cta?.enabled
        ? { label: String(draft.cta.label).trim(), url: draft.cta.url, ...(draft.cta.embed && calendarEmbedUrl(draft.cta.url) ? { embed: true } : {}) }
        : null,
    },
  };
}

/** Each contact's link, given the campaign's watch URL and the personalLink helper. */
export function campaignLinks(draft, watchUrl, personalLink, variants = {}) {
  const website = draft.background?.mode === 'website';
  const tokens = ['firstName', 'lastName', 'company', 'email', 'website', ...(website ? ['websiteShotUrl'] : [])];
  return (draft.contacts || []).map((c) => ({
    contactId: c.id,
    name: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email,
    email: c.email,
    company: c.company,
    voiced: !!variants[c.id]?.url,
    // Which background the contact sees: their own site, or the fallback.
    ...(website ? { site: draft.siteShots?.[siteKey(c.website)] ? 'own' : 'fallback' } : {}),
    link: personalLink(watchUrl, contactProfile(c, website ? draft.siteShots : {}), tokens),
  }));
}
