/**
 * Personalization helpers for the page editor:
 *   withTokenPickers(components)  every text / long-text / link field gets an "Insert field" menu ({{firstname|there}} ...)
 *   withTokenUrls(components)     links and pictures may contain {{tokens}}: filled from the current contact before each
 *                                 component renders (in the editor preview and on the public page, extensions included)
 *   ContactAccent                 the page root: a contact's own brand colour ({{accent}}) replaces the page accent
 */
import { useRef } from 'react';
import { fillTokens, fillUrlTokens, TOKEN_CHOICES } from '../templates.js';
import { usePage } from './context.js';

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
