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
    description: 'Made for one-to-one outreach: greets the viewer by name.',
    theme: { mode: 'dark', accent: '#a78bfa', bg: '#1e1b4b', text: '#ede9fe', font: 'system' },
    layout: 'stack',
  },
]);

export const FONTS = Object.freeze({
  system: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  display: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
});

/** Token keys a viewer is allowed to see (must match landing_page_contact_tokens). */
export const PUBLIC_TOKEN_KEYS = Object.freeze(['firstname', 'lastname', 'company', 'role', 'city', 'custom1', 'custom2', 'custom3']);

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
  const personal = t.id === 'personal';
  return sanitizeConfig({
    template: t.id,
    theme: { ...t.theme, ...(brand.accent ? { accent: brand.accent } : {}), logoUrl: brand.logoUrl || '' },
    headline: personal ? 'Hi {{firstname|there}}, I made this for you' : title || 'Watch this video',
    subhead: personal ? 'A quick personal video for {{company|your team}}.' : '',
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
  });
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
    }))
    .filter((f) => f.key && f.label && !seen.has(f.key) && seen.add(f.key))
    .slice(0, 8);

  return {
    template: t.id,
    theme: {
      mode: theme.mode === 'dark' ? 'dark' : theme.mode === 'light' ? 'light' : t.theme.mode,
      accent: color(theme.accent, t.theme.accent),
      bg: color(theme.bg, t.theme.bg),
      text: color(theme.text, t.theme.text),
      font: Object.prototype.hasOwnProperty.call(FONTS, theme.font) ? theme.font : t.theme.font,
      logoUrl: safeImageUrl(theme.logoUrl),
    },
    headline: clip(c.headline, 160),
    subhead: clip(c.subhead, 300),
    cta: {
      label: clip(cta.label, 60),
      url: safeUrl(cta.url),
      type: ['link', 'phone', 'calendar'].includes(cta.type) ? cta.type : 'link',
    },
    form: {
      enabled: !!form.enabled && fields.length > 0,
      title: clip(form.title, 120),
      submitLabel: clip(form.submitLabel, 40) || 'Send',
      successMessage: clip(form.successMessage, 200),
      fields,
    },
    sections: (Array.isArray(c.sections) ? c.sections : [])
      .map((s) => ({ heading: clip(s?.heading, 120), body: clip(s?.body, 1000) }))
      .filter((s) => s.heading || s.body)
      .slice(0, 6),
    consent: { notice: clip(c.consent?.notice, 300) },
    autoplay: !!c.autoplay,
  };
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
  const blob = [c.headline, c.subhead, c.cta.label, c.form.title, c.form.successMessage, ...c.sections.flatMap((s) => [s.heading, s.body])].join(' ');
  return [...new Set([...blob.matchAll(/\{\{\s*([a-zA-Z0-9_]{1,40})/g)].map((m) => m[1]))];
}

/** Keep only viewer-visible keys from tokens given in a URL (?firstname=Ann). */
export function tokensFromQuery(search = '') {
  const params = new URLSearchParams(search);
  const out = {};
  PUBLIC_TOKEN_KEYS.forEach((k) => {
    const v = params.get(k);
    if (v) out[k] = v.slice(0, 80);
  });
  return out;
}
