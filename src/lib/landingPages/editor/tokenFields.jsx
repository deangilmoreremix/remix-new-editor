/**
 * Personalization helpers for the page editor:
 *   withTokenPickers(components)  every text / long-text / link field gets an "Insert field" menu ({{firstname|there}} ...)
 *   withTokenUrls(components)     links and pictures may contain {{tokens}}: filled from the current contact before each
 *                                 component renders (in the editor preview and on the public page, extensions included)
 *   ContactAccent                 the page root: a contact's own brand colour ({{accent}}) replaces the page accent
 */
import { useRef } from 'react';
import { fillTokens, fillUrlTokens, safeImageUrl, TOKEN_CHOICES } from '../templates.js';
import { usePage, ViewerContext } from './context.js';

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 };
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--lp-field-border, #cbd5e1)', borderRadius: 6, background: 'var(--lp-field-bg, #fff)', color: 'var(--lp-field-text, inherit)', font: 'inherit' };
const selectStyle = { marginTop: 6, padding: '5px 8px', border: '1px solid var(--lp-field-border, #cbd5e1)', borderRadius: 6, background: 'var(--lp-field-bg-alt, #f8fafc)', color: 'var(--lp-field-text, inherit)', font: 'inherit', fontSize: 12 };

/** Pure: insert `token` into `value` at the cursor (or the end). Returns { value, caret }. */
export function insertToken(value, token, start, end) {
  const v = String(value ?? '');
  const s = Number.isInteger(start) ? start : v.length;
  const e = Number.isInteger(end) ? end : s;
  return { value: v.slice(0, s) + token + v.slice(e), caret: s + token.length };
}

/** Pure: the text a menu choice inserts, e.g. {{firstname|there}}. */
export const tokenText = ([key, , fallback]) => `{{${key}${fallback ? `|${fallback}` : ''}}}`;

/** A text or long-text field with an "Insert field" menu next to it. */
export function tokenField(orig) {
  const multi = orig.type === 'textarea';
  return {
    type: 'custom',
    label: orig.label,
    render: ({ value, onChange, name }) => {
      const ref = useRef(null); // eslint-disable-line react-hooks/rules-of-hooks
      const add = (e) => {
        const key = e.target.value;
        e.target.value = '';
        const choice = TOKEN_CHOICES.find((c) => c[0] === key);
        if (!choice) return;
        const el = ref.current;
        const { value: next, caret } = insertToken(value, tokenText(choice), el?.selectionStart, el?.selectionEnd);
        onChange(next);
        requestAnimationFrame(() => { try { el?.focus(); el?.setSelectionRange(caret, caret); } catch { /* ignore */ } });
      };
      const common = { id: name, ref, style: inputStyle, value: value || '', onChange: (e) => onChange(e.target.value) };
      return (
        <div>
          <label style={labelStyle} htmlFor={name}>{orig.label}</label>
          {multi ? <textarea rows={3} {...common} /> : <input type="text" {...common} />}
          <select aria-label={`Insert field into ${orig.label}`} data-insert-field style={selectStyle} defaultValue="" onChange={add}>
            <option value="">Insert field…</option>
            {TOKEN_CHOICES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
      );
    },
  };
}

const SKIP_LABEL = /#hex|colou?r|field name|\(a-z\)/i;
const isTextual = (f) => f && (f.type === 'text' || f.type === 'textarea') && !SKIP_LABEL.test(f.label || '');

/** Swap every plain text / long-text field (and those inside lists) for the field with the Insert field menu. */
export function withTokenPickers(components) {
  for (const comp of Object.values(components)) {
    const fields = comp.fields || {};
    for (const [k, f] of Object.entries(fields)) {
      if (isTextual(f)) fields[k] = tokenField(f);
      else if (f?.type === 'array' && f.arrayFields) {
        for (const [ak, af] of Object.entries(f.arrayFields)) if (isTextual(af)) f.arrayFields[ak] = tokenField(af);
      }
    }
  }
  return components;
}

const URL_KEY = /(url|link|src|href|image|photo|logo|avatar|background|video|cta)/i;
const TEXT_KEYS = new Set(['senderName', 'senderTitle']);

/** Pure: a copy of `value` with {{tokens}} filled in every link / picture string and sender text. */
export function fillPropTokens(value, tokens, key = '') {
  if (typeof value === 'string') {
    if (!value.includes('{{')) return value;
    if (TEXT_KEYS.has(key)) return fillTokens(value, tokens);
    return URL_KEY.test(key) ? fillUrlTokens(value, tokens) : value;
  }
  if (Array.isArray(value)) return value.map((v) => fillPropTokens(v, tokens, key));
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fillPropTokens(v, tokens, k)]));
  }
  return value;
}

function FilledRender({ render, props }) {
  const { tokens } = usePage();
  return render(fillPropTokens(props, tokens || {}));
}

/** Wrap every component so links and pictures accept {{tokens}} (filled from the current contact). */
export function withTokenUrls(components) {
  for (const comp of Object.values(components)) {
    const orig = comp.render;
    if (typeof orig !== 'function' || orig.__tokenUrls) continue;
    const wrapped = (props) => <FilledRender render={orig} props={props} />;
    wrapped.__tokenUrls = true;
    comp.render = wrapped;
  }
  return components;
}

const HEX6 = /^#[0-9a-f]{6}$/i;
const luminance = (h) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Pure: style overrides for a contact's own brand colour (empty when they have none). */
export function accentOverride(accent) {
  if (!HEX6.test(String(accent || ''))) return {};
  return { '--pk-accent': accent, '--pk-on-accent': luminance(accent) > 0.4 ? '#0b0f19' : '#ffffff' };
}

/** The page's outer box. A contact's own colour ({{accent}}) replaces the page accent for that visitor. */
export function ContactAccent({ style, children, ...rest }) {
  const { tokens } = usePage();
  return <div style={{ ...style, ...accentOverride(tokens?.accent) }} {...rest}>{children}</div>;
}

const VIEWER_KEYS = ['viewerType', 'viewerAlt', 'viewerAspect', 'viewerControls', 'viewerAutoplay', 'viewerLoop', 'viewerCaption'];

function ViewerScope({ render, props }) {
  const value = {};
  VIEWER_KEYS.forEach((k) => { value[k.slice(6).replace(/^./, (c) => c.toLowerCase())] = props[k]; });
  return <ViewerContext.Provider value={value}>{render(props)}</ViewerContext.Provider>;
}

/** Components that hold a video slot hand their viewer options (shape, controls, autoplay, caption...) down to the player. */
export function withViewerOptions(components) {
  for (const comp of Object.values(components)) {
    const orig = comp.render;
    if (typeof orig !== 'function' || !comp.fields?.slotImage || orig.__viewer) continue;
    const wrapped = (props) => <ViewerScope render={orig} props={props} />;
    wrapped.__viewer = true;
    comp.render = wrapped;
  }
  return components;
}

const HEX6S = /^#[0-9a-f]{6}$/i;

/** Pure: inline style for a section's own background colour, text colour and background photo (empty when none is set). */
export function sectionStyle({ sectionBg, sectionText, sectionImage } = {}) {
  const style = {};
  if (HEX6S.test(String(sectionBg || ''))) { style.background = sectionBg; style['--pk-bg'] = sectionBg; }
  if (HEX6S.test(String(sectionText || ''))) { style.color = sectionText; style['--pk-text'] = sectionText; }
  const img = safeImageUrl(sectionImage);
  if (img && !/["'()\\\s<>]/.test(img)) { style.backgroundImage = `url(${JSON.stringify(img)})`; style.backgroundSize = 'cover'; style.backgroundPosition = 'center'; }
  return style;
}

function SectionScope({ render, props }) {
  const style = sectionStyle(props);
  const out = render(props);
  return Object.keys(style).length ? <div className="pk-sec" style={style}>{out}</div> : out;
}

/** Every named section gets its own background colour, text colour and background photo (nothing changes until one is set). */
export function withSectionStyle(components, names) {
  for (const name of names) {
    const comp = components[name];
    if (!comp || typeof comp.render !== 'function' || comp.render.__section) continue;
    comp.fields = {
      ...comp.fields,
      sectionBg: { type: 'text', label: 'Section background colour (#hex, empty = page)' },
      sectionText: { type: 'text', label: 'Section text colour (#hex, empty = page)' },
      sectionImage: { type: 'text', label: 'Section background photo (https link)' },
    };
    comp.defaultProps = { ...comp.defaultProps, sectionBg: '', sectionText: '', sectionImage: '' };
    const orig = comp.render;
    const wrapped = (props) => <SectionScope render={orig} props={props} />;
    wrapped.__section = true;
    comp.render = wrapped;
  }
  return components;
}
