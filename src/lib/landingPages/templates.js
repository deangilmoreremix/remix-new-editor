/**
 * Landing page templates, config defaults/sanitizing and {{token}} filling.
 *
 * A page's `config` (jsonb in public.landing_pages) is plain data. Templates
 * are presets over it; the public page (src/pages/VideoPage.jsx) and the studio
 * preview both render from the same config, so what you design is what viewers
 * get. Everything here is pure so it can be unit tested.
 */

export const TEMPLATES = Object.freeze([
  {
    id: 'clean',
    name: 'Clean',
    description: 'Light, centered video with a simple call to action.',
    theme: { mode: 'light', accent: '#4f46e5', bg: '#f8fafc', text: '#0f172a', font: 'system' },
    layout: 'stack',
  },
  {
    id: 'dark',
    name: 'Dark',
    description: 'Dark cinematic stage that puts the video first.',
    theme: { mode: 'dark', accent: '#22d3ee', bg: '#0b1020', text: '#f1f5f9', font: 'system' },
    layout: 'stack',
  },
  {
    id: 'hero',
    name: 'Bold hero',
    description: 'Big headline beside the video on wide screens.',
    theme: { mode: 'dark', accent: '#f97316', bg: '#111827', text: '#ffffff', font: 'display' },
    layout: 'split',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Just the video and one button, nothing else.',
    theme: { mode: 'light', accent: '#111827', bg: '#ffffff', text: '#111827', font: 'serif' },
    layout: 'minimal',
  },
  {
    id: 'sales',
    name: 'Sales',
    description: 'Video, benefits and a lead form on one page.',
    theme: { mode: 'light', accent: '#16a34a', bg: '#f0fdf4', text: '#052e16', font: 'system' },
    layout: 'split',
  },
  {
    id: 'personal',
    name: 'Personal intro',
    description: 'One-to-one outreach: co-branded header, greets the viewer by name, video with a personal caption, story and form.',
    theme: { mode: 'dark', accent: '#ef5350', highlight: '#6366f1', bg: '#0a0c12', text: '#ffffff', font: 'system' },
    layout: 'intro',
    customPlayer: true,
    intro: true,
    family: 'intro',
    radius: 16,
  },
  // ---- Ten more designs on the same anatomy as the reference (co-branded header, pill, accent headline,
  // play button, custom player with caption, story + form, testimonial, logos, footer). They differ in
  // palette, type, corner shape and structure. Colours are checked for contrast in the unit tests.
  {
    id: 'midnight',
    name: 'Midnight Violet',
    description: 'Deep indigo night with a violet glow behind the headline.',
    theme: { mode: 'dark', accent: '#7c3aed', highlight: '#c4b5fd', bg: '#0d0b1a', text: '#ffffff', font: 'system' },
    layout: 'intro', customPlayer: true, intro: true, family: 'intro', radius: 20, traits: ['glow-top'],
  },
  {
    id: 'daylight',
    name: 'Daylight',
    description: 'Clean light page with soft shadows and an indigo accent.',
    theme: { mode: 'light', accent: '#4338ca', highlight: '#4f46e5', bg: '#f7f8fc', text: '#0f172a', font: 'system' },
    layout: 'intro', customPlayer: true, intro: true, family: 'intro', radius: 16, traits: ['soft'],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm plum-to-ember gradient with an orange highlight.',
    theme: { mode: 'dark', accent: '#c2410c', highlight: '#fb923c', bg: '#1a0f14', text: '#fff7ed', font: 'system' },
    layout: 'intro', customPlayer: true, intro: true, family: 'intro', radius: 18, traits: ['gradient'],
  },
  {
    id: 'emerald',
    name: 'Emerald',
    description: 'Dark green-black with sharp corners and a mint highlight.',
    theme: { mode: 'dark', accent: '#047857', highlight: '#34d399', bg: '#07130f', text: '#ecfdf5', font: 'system' },
    layout: 'intro', customPlayer: true, intro: true, family: 'intro', radius: 6, traits: ['sharp'],
  },
  {
    id: 'editorial',
    name: 'Editorial',
    description: 'Cream paper, serif headline set left, thin rules, black button.',
    theme: { mode: 'light', accent: '#1c1917', highlight: '#b45309', bg: '#faf6ee', text: '#1c1917', font: 'serif' },
    layout: 'intro', customPlayer: true, intro: true, family: 'intro', radius: 4, traits: ['hero-left', 'rules'],
  },
  {
    id: 'splithero',
    name: 'Split hero',
    description: 'Headline on the left, video on the right (stacks on phones).',
    theme: { mode: 'dark', accent: '#0e7490', highlight: '#22d3ee', bg: '#0a1020', text: '#f1f5f9', font: 'display' },
    layout: 'intro', customPlayer: true, intro: true, family: 'intro', radius: 14, traits: ['hero-split'],
  },
  {
    id: 'cinema',
    name: 'Cinema',
    description: 'Near-black stage, wide square-edged video, gold accent, spaced caps.',
    theme: { mode: 'dark', accent: '#b45309', highlight: '#fbbf24', bg: '#050505', text: '#f5f5f4', font: 'serif' },
    layout: 'intro', customPlayer: true, intro: true, family: 'intro', radius: 2, traits: ['wide', 'caps'],
  },
  {
    id: 'pastel',
    name: 'Soft Pastel',
    description: 'Lavender canvas, very round corners, friendly and warm.',
    theme: { mode: 'light', accent: '#7e22ce', highlight: '#db2777', bg: '#f5f0ff', text: '#2d1b4e', font: 'display' },
    layout: 'intro', customPlayer: true, intro: true, family: 'intro', radius: 28, traits: ['round'],
  },
  {
    id: 'corporate',
    name: 'Corporate',
    description: 'Navy header bar, light body, the form leads on the left.',
    theme: { mode: 'light', accent: '#1d4ed8', highlight: '#1d4ed8', bg: '#f3f6fa', text: '#0b1f3a', font: 'system' },
    layout: 'intro', customPlayer: true, intro: true, family: 'intro', radius: 8, traits: ['bar', 'cols-reverse'],
  },
  {
    id: 'neon',
    name: 'Neon Tech',
    description: 'Grid backdrop, mono type and a neon glow on the player and button.',
    theme: { mode: 'dark', accent: '#be185d', highlight: '#22d3ee', bg: '#070713', text: '#e2e8f0', font: 'mono' },
    layout: 'intro', customPlayer: true, intro: true, family: 'intro', radius: 10, traits: ['grid', 'glow'],
  },
]);

/** Templates that use the co-branded "intro" anatomy. */
export const INTRO_TEMPLATES = Object.freeze(TEMPLATES.filter((t) => t.intro));

export const FONTS = Object.freeze({
  system: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  display: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
});

/** Token keys a viewer is allowed to see (must match landing_page_contact_tokens). */
export const PUBLIC_TOKEN_KEYS = Object.freeze(['firstname', 'lastname', 'company', 'companylogo', 'role', 'city', 'custom1', 'custom2', 'custom3']);

/** Token keys that carry an image URL: never accepted from the page URL, https only when rendered. */
export const IMAGE_TOKEN_KEYS = Object.freeze(['companylogo']);

export const FORM_FIELD_TYPES = Object.freeze(['text', 'email', 'tel', 'textarea']);

const HEX = /^#[0-9a-f]{6}$/i;
const clip = (v, n) => String(v ?? '').slice(0, n);

export const getTemplate = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];

/** http(s), mailto and tel links only. Anything else (javascript:, data:) becomes ''. */
export function safeUrl(value) {
  const s = String(value ?? '').trim();
  if (!s || s.length > 2048) return '';
  if (/^(https?:\/\/|mailto:|tel:)/i.test(s)) return s;
  return '';
}

/** Only https image URLs for logos/posters. */
export function safeImageUrl(value) {
  const s = String(value ?? '').trim();
  return /^https:\/\//i.test(s) && s.length <= 2048 ? s : '';
}

export function defaultConfig(templateId = 'clean', { title = '', brand = {} } = {}) {
  const t = getTemplate(templateId);
  const personal = !!t.intro;
  const base = {
    template: t.id,
    theme: { ...t.theme, ...(brand.accent ? { accent: brand.accent } : {}), logoUrl: brand.logoUrl || '' },
    headline: title || 'Watch this video',
    subhead: '',
    cta: { label: 'Book a call', url: '', type: 'link' },
    form: {
      enabled: t.id === 'sales',
      title: 'Want to hear more?',
      submitLabel: 'Send',
      successMessage: 'Thanks! We will be in touch.',
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'email', label: 'Email', type: 'email', required: true },
      ],
    },
    sections: t.id === 'sales'
      ? [{ heading: 'Why watch', body: 'Add two or three short benefits here.' }]
      : [],
    consent: { notice: '' },
    autoplay: false,
  };
  if (!personal) return sanitizeConfig(base);

  // Personal intro: the co-branded one-to-one page. Copy is a starting point the
  // sender edits; nothing here claims results, customers or quotes.
  return sanitizeConfig({
    ...base,
    brand: { name: brand.name || '', tagline: 'A personal video from {{sender|me}}' },
    badge: 'Made for {{firstname|you}} at {{company|your team}}',
    headline: "Hi {{firstname|there}}, here's a quick video for [[{{company|your team}}]]",
    subhead: 'I recorded this just for you. Press play to see what I had in mind.',
    cta: { label: 'Watch your video', url: '', type: 'play' },
    overlay: { title: '{{firstname|Hi}}, welcome to {{company|our team}}', subtitle: 'Personalized for you · {{duration}}' },
    story: {
      heading: "What I'd like to show you",
      body: ['Hi {{firstname|there}}, add a short note here about why you made this video for {{company|your team}}.', 'Say what the video covers and what you would like them to do next.'],
    },
    sender: { name: '', title: '', avatarUrl: '' },
    form: {
      enabled: true,
      title: 'Want to talk it through?',
      subtitle: "Leave your details and I'll get back to you.",
      submitLabel: 'Send',
      successMessage: 'Thanks! I will be in touch soon.',
      privacy: 'Your details go only to {{sender|me}}. No spam.',
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Your name' },
        { key: 'email', label: 'Work email', type: 'email', required: true, placeholder: 'you@company.com' },
        { key: 'message', label: 'Message (optional)', type: 'textarea', required: false, placeholder: 'Anything you would like me to know' },
      ],
    },
    testimonial: { quote: '', by: '' },
    logos: [],
    footer: { text: 'Sent by {{sender|me}} · {{brand}}', optOutUrl: '' },
  });
}

const isEmptyBlock = (v) => {
  if (v == null || v === '') return true;
  if (Array.isArray(v)) return v.length === 0 || v.every(isEmptyBlock);
  if (typeof v === 'object') return Object.values(v).every(isEmptyBlock);
  return false;
};

/**
 * Switch template but keep what the user wrote: the new template's theme is applied
 * (the user's logo is kept), and only content blocks that are still empty are filled
 * from the new template's defaults.
 */
export function applyTemplate(config, templateId, opts = {}) {
  const current = sanitizeConfig(config);
  const next = defaultConfig(templateId, opts);
  const merged = { ...current, template: next.template, theme: { ...next.theme, logoUrl: current.theme.logoUrl || next.theme.logoUrl } };
  ['brand', 'badge', 'overlay', 'story', 'sender', 'testimonial', 'logos', 'footer'].forEach((k) => {
    if (isEmptyBlock(current[k])) merged[k] = next[k];
  });
  if (!current.headline) merged.headline = next.headline;
  if (!current.subhead) merged.subhead = next.subhead;
  if (!current.form.enabled && next.form.enabled) merged.form = next.form;
  return sanitizeConfig(merged);
}

/** Make any stored/edited config safe and complete. Never throws. */
export function sanitizeConfig(input) {
  const c = input && typeof input === 'object' ? input : {};
  const t = getTemplate(c.template);
  const theme = c.theme && typeof c.theme === 'object' ? c.theme : {};
  const color = (v, fallback) => (HEX.test(String(v || '')) ? String(v).toLowerCase() : fallback);
  const cta = c.cta && typeof c.cta === 'object' ? c.cta : {};
  const form = c.form && typeof c.form === 'object' ? c.form : {};

  const seen = new Set();
  const fields = (Array.isArray(form.fields) ? form.fields : [])
    .map((f) => ({
      key: clip(f?.key, 40).replace(/[^a-z0-9_]/gi, '').toLowerCase(),
      label: clip(f?.label, 80),
      type: FORM_FIELD_TYPES.includes(f?.type) ? f.type : 'text',
      required: !!f?.required,
      placeholder: clip(f?.placeholder, 80),
    }))
    .filter((f) => f.key && f.label && !seen.has(f.key) && seen.add(f.key))
    .slice(0, 8);

  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const brand = obj(c.brand);
  const overlay = obj(c.overlay);
  const story = obj(c.story);
  const sender = obj(c.sender);
  const testimonial = obj(c.testimonial);
  const footer = obj(c.footer);
  const accent = color(theme.accent, t.theme.accent);
  const logos = (Array.isArray(c.logos) ? c.logos : [])
    .map((l) => ({ name: clip(l?.name, 60), imageUrl: safeImageUrl(l?.imageUrl) }))
    .filter((l) => l.name || l.imageUrl)
    .slice(0, 6);

  return {
    template: t.id,
    theme: {
      mode: theme.mode === 'dark' ? 'dark' : theme.mode === 'light' ? 'light' : t.theme.mode,
      accent,
      highlight: color(theme.highlight, t.theme.highlight || accent),
      bg: color(theme.bg, t.theme.bg),
      text: color(theme.text, t.theme.text),
      font: Object.prototype.hasOwnProperty.call(FONTS, theme.font) ? theme.font : t.theme.font,
      logoUrl: safeImageUrl(theme.logoUrl),
    },
    brand: { name: clip(brand.name, 60), tagline: clip(brand.tagline, 100) },
    badge: clip(c.badge, 100),
    headline: clip(c.headline, 200),
    subhead: clip(c.subhead, 300),
    cta: {
      label: clip(cta.label, 60),
      url: safeUrl(cta.url),
      type: ['link', 'phone', 'calendar', 'play'].includes(cta.type) ? cta.type : 'link',
    },
    overlay: { title: clip(overlay.title, 100), subtitle: clip(overlay.subtitle, 100) },
    story: {
      heading: clip(story.heading, 120),
      body: (Array.isArray(story.body) ? story.body : []).map((p) => clip(p, 600)).filter((p) => p.trim()).slice(0, 4),
    },
    sender: { name: clip(sender.name, 80), title: clip(sender.title, 100), avatarUrl: safeImageUrl(sender.avatarUrl) },
    form: {
      enabled: !!form.enabled && fields.length > 0,
      title: clip(form.title, 120),
      subtitle: clip(form.subtitle, 200),
      submitLabel: clip(form.submitLabel, 40) || 'Send',
      successMessage: clip(form.successMessage, 200),
      privacy: clip(form.privacy, 200),
      fields,
    },
    sections: (Array.isArray(c.sections) ? c.sections : [])
      .map((s) => ({ heading: clip(s?.heading, 120), body: clip(s?.body, 1000) }))
      .filter((s) => s.heading || s.body)
      .slice(0, 6),
    testimonial: { quote: clip(testimonial.quote, 280), by: clip(testimonial.by, 120) },
    logos,
    footer: { text: clip(footer.text, 160), optOutUrl: safeUrl(footer.optOutUrl) },
    consent: { notice: clip(c.consent?.notice, 300) },
    autoplay: !!c.autoplay,
  };
}

/** Split `[[highlighted]]` markers out of a headline (before token filling, so a token value can't add markers). */
export function splitAccent(text) {
  const out = [];
  const re = /\[\[([^\]]{1,120})\]\]/g;
  let last = 0;
  let m;
  const s = String(text ?? '');
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ text: s.slice(last, m.index), accent: false });
    out.push({ text: m[1], accent: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last), accent: false });
  return out;
}

/** Format seconds as m:ss ('' when unknown). */
export function formatDuration(seconds) {
  const n = Math.round(Number(seconds));
  if (!Number.isFinite(n) || n <= 0) return '';
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

/**
 * Fill {{token}} / {{token|fallback}} from a token map. Unknown tokens without a
 * fallback collapse to '' so a viewer never sees raw braces.
 */
export function fillTokens(text, tokens = {}) {
  return String(text ?? '').replace(/\{\{\s*([a-zA-Z0-9_]{1,40})\s*(?:\|([^}]{0,80}))?\}\}/g, (_, key, fallback) => {
    const v = tokens[key];
    if (v != null && String(v).trim() !== '') return String(v).trim();
    return fallback != null ? fallback.trim() : '';
  });
}

/** Token names used in a config, for the studio's "tokens in this page" hint. */
export function tokensUsed(config) {
  const c = sanitizeConfig(config);
  const blob = [
    c.headline, c.subhead, c.badge, c.brand.tagline, c.cta.label, c.overlay.title, c.overlay.subtitle,
    c.story.heading, ...c.story.body, c.form.title, c.form.subtitle, c.form.successMessage, c.form.privacy,
    c.footer.text, ...c.sections.flatMap((s) => [s.heading, s.body]),
  ].join(' ');
  // sender, brand and duration come from the page itself, not from a contact.
  const own = new Set(['sender', 'brand', 'duration']);
  return [...new Set([...blob.matchAll(/\{\{\s*([a-zA-Z0-9_]{1,40})/g)].map((m) => m[1]))].filter((k) => !own.has(k));
}

/** Keep only viewer-visible keys from tokens given in a URL (?firstname=Ann). */
export function tokensFromQuery(search = '') {
  const params = new URLSearchParams(search);
  const out = {};
  PUBLIC_TOKEN_KEYS.filter((k) => !IMAGE_TOKEN_KEYS.includes(k)).forEach((k) => {
    const v = params.get(k);
    if (v) out[k] = v.slice(0, 80);
  });
  return out;
}

// ---- colour helpers (WCAG 2.x relative luminance / contrast) -------------------------------

function channel(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a #rrggbb colour. */
export function luminance(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio between two #rrggbb colours (1 to 21). */
export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Mix `fg` over `bg` at `alpha` (0..1) and return #rrggbb: what semi-transparent text really looks like. */
export function blend(fg, bg, alpha) {
  const p = (h) => { const n = parseInt(String(h).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const [f, b] = [p(fg), p(bg)];
  return `#${f.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('')}`;
}

/** White or near-black, whichever reads better on `bg`. */
export function readableOn(bg) {
  return contrastRatio('#ffffff', bg) >= contrastRatio('#0b0b0f', bg) ? '#ffffff' : '#0b0b0f';
}
