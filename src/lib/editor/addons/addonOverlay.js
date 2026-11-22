/**
 * Playback overlays for addons: the Pause "click to continue" prompt and the
 * project-level List Builder / Personalizer form.
 *
 * The form reproduces upstream's retarget `buildForm` DOM and classes
 * (form.popcorn.retarget-form > .form-inner > .form-scrollable >
 * .form-scrollable-inner with .brand-logo, .retarget-caption,
 * .input-wrapper-container, .buttons-inner, .privacy-disclaimer,
 * .privacy-policy-link, .skip-button) and its per-field-count layout, plus
 * the red-arrow `.overlay-arrow` hint. Styles live in
 * styles/timeline-addons.css (ported from upstream popcorn.retarget.scss and
 * popcorn/style.scss). Rendered into an overlay layer above the preview stage.
 */

import { pointerSvg, getPointerDesign, safeColor, HINT_STYLES } from './pointerDesigns.js';
import { turnstileSiteKey, mountTurnstile } from '../publish/turnstile.js';
import { safeDesignId } from './optinDesigns.js';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const INPUT_BORDER_RADIUS = 3;

/** Find or create the overlay layer inside `frame`. */
export function ensureOverlayLayer(frame) {
  let layer = Array.from(frame.children).find((c) => c.classList.contains('addon-overlay-layer'));
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'addon-overlay-layer';
    frame.appendChild(layer);
  }
  return layer;
}

/** http(s) links only (a thank-you button or redirect must never run javascript: / data: URLs). */
export function safeWebUrl(url) {
  const value = String(url || '').trim();
  if (!value) return null;
  // Any other scheme (ftp://, javascript:, data:, tel:, ...) is refused, never "fixed" by prefixing https://.
  if (!/^https?:\/\//i.test(value) && (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /^(javascript|data|vbscript|file|blob|tel|mailto|sms):/i.test(value))) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

export const AFTER_SUBMIT_ACTIONS = [
  ['continue', 'Keep watching (nothing extra)'],
  ['button', 'Show a thank-you button'],
  ['redirect', 'Send the viewer to a page'],
];
const THANKS_BUTTON_MS = 8000;
const REDIRECT_DELAY_MS = 1500;

/**
 * What the viewer sees after submitting a form: nothing extra (default), a small thank-you card with a
 * link button, or a redirect to another page. Shared by the editor preview and the published player.
 *
 * Redirects only happen when `allowRedirect` is true, which only the published player sets, so the editor
 * (even during live playback) shows "viewers go to <host>" instead of navigating away from your work.
 * Returns the card element, or null when there is nothing to show.
 */
export function showThanks(layer, config, { allowRedirect = false, isActive = () => true, navigate = (url) => globalThis.location?.assign(url), schedule = setTimeout } = {}) {
  const action = config?.afterSubmitAction;
  if (action !== 'button' && action !== 'redirect') return null;
  // The owner (the published player) says whether it still exists: a submission that finishes after the
  // viewer left must not show a card or schedule a redirect.
  if (!isActive()) return null;
  const url = safeWebUrl(config.afterSubmitUrl);
  if (!url) return null; // a missing or unsafe link falls back to the default behavior
  clearOverlay(layer, 'thanks');
  const card = document.createElement('div');
  card.className = 'addon-overlay addon-overlay--thanks';
  card.dataset.overlay = 'thanks';
  card.setAttribute('role', 'status');
  const msg = document.createElement('p');
  msg.className = 'addon-thanks__msg';
  msg.textContent = String(config.successMessage || 'Thanks!');
  card.appendChild(msg);
  if (action === 'button') {
    const a = document.createElement('a');
    a.className = 'addon-thanks__btn';
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = String(config.afterSubmitButtonText || 'Continue');
    card.appendChild(a);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'addon-thanks__close';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '\u2715';
    close.addEventListener('click', () => card.remove());
    card.appendChild(close);
    schedule(() => card.remove(), THANKS_BUTTON_MS);
  } else if (allowRedirect) {
    // If the page's player is destroyed during the delay (the viewer navigated away), its layer is
    // removed from the document: don't then replace whatever page they moved on to.
    const attached = layer.isConnected;
    schedule(() => { if (!isActive() || (attached && !layer.isConnected)) return; navigate(url); }, REDIRECT_DELAY_MS);
  } else {
    const note = document.createElement('p');
    note.className = 'addon-thanks__note';
    note.textContent = `Preview: viewers are sent to ${new URL(url).hostname}`;
    card.appendChild(note);
    schedule(() => card.remove(), THANKS_BUTTON_MS);
  }
  layer.appendChild(card);
  return card;
}

export function clearOverlay(layer, name) {
  layer.querySelectorAll(name ? `[data-overlay="${name}"]` : '[data-overlay]').forEach((el) => el.remove());
}

export function showPauseOverlay(layer, { text = 'Click to continue', onContinue }) {
  clearOverlay(layer, 'pause-continue');
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'addon-overlay addon-overlay--pause';
  el.dataset.overlay = 'pause-continue';
  el.innerHTML = `<span class="addon-overlay__pause-icon" aria-hidden="true">▶</span><span>${esc(text)}</span>`;
  el.addEventListener('click', () => {
    el.remove();
    onContinue?.();
  });
  layer.appendChild(el);
  return el;
}

function hexToRgba(hex, alpha) {
  const m = String(hex || '').replace('#', '').match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return hex;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Upstream background: radial gradient from the colour at 7% → 80% → 100%. */
export function formBackground(config) {
  if (config.backgroundImage) return `url(${JSON.stringify(String(config.backgroundImage))}) center / cover`;
  const c = config.backgroundColor;
  if (!c) return '';
  if (config.backgroundColor2) {
    const angle = Math.max(0, Math.min(360, Number(config.bgAngle ?? 135) || 0));
    return `linear-gradient(${angle}deg, ${cssColor(c, '#000000')}, ${cssColor(config.backgroundColor2, '#000000')})`;
  }
  return `radial-gradient(circle, ${hexToRgba(c, 0.07)} 10%, ${hexToRgba(c, 0.8)} 90%, ${hexToRgba(c, 1)} 100%)`;
}

/** A colour an option may hold: hex, rgb()/hsl(), or "transparent". Anything else falls back. */
const cssColor = (value, fallback = '') => (String(value).trim().toLowerCase() === 'transparent' ? 'transparent' : safeColor(value, fallback));

const ICON_PATHS = {
  email: '<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="C" stroke-width="2"/><path d="M3.5 7l8.5 6 8.5-6" fill="none" stroke="C" stroke-width="2"/>',
  user: '<circle cx="12" cy="8" r="4" fill="C"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" fill="C"/>',
  phone: '<path d="M6 3h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 12l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z" fill="C"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="C" stroke-width="2" stroke-linecap="round"/>',
};
/** Small icon at the left of a box (designs turn it on with "Show icons in the boxes"). */
function inputIcon(type, color) {
  const kind = type === 'email' ? 'email' : type === 'tel' ? 'phone' : type === 'url' ? 'link' : 'user';
  const c = String(safeColor(color, '#888888')).replace('#', '%23');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>${ICON_PATHS[kind].replace(/C/g, c)}</svg>`;
  return `url("data:image/svg+xml;utf8,${svg.replace(/"/g, "'").replace(/</g, '%3C').replace(/>/g, '%3E')}")`;
}

const BADGE_SVG = {
  crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill="currentColor"/>',
  ticket: '<path d="M3 8a2 2 0 0 0 0 8v2h18v-2a2 2 0 0 1 0-8V6H3z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 9l1.1 2.2 2.4.3-1.8 1.7.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.7 2.4-.3z" fill="currentColor"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8z" fill="currentColor"/>',
  play: '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 8l6 4-6 4z" fill="currentColor"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/>',
  sparkle: '<path d="M12 2l2 7 7 2-7 2-2 7-2-7-7-2 7-2z" fill="currentColor"/>',
};
const svgEl = (inner) => {
  const wrap = document.createElement('span');
  wrap.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`; // fixed markup from the tables above, never user text
  return wrap.firstChild;
};

const PHONE_PATTERN = '[0-9+\\(\\)\\-. ]{7,30}'; // valid under both the u and v regex flags browsers use for pattern=
/** The choices of a dropdown field: "Small, Medium, Large" -> [...], at most 20, trimmed, no blanks or duplicates. */
export const selectChoices = (raw) => [...new Set(String(raw ?? '').split(',').map((o) => o.trim()).filter(Boolean))].slice(0, 20);

function buildInput(declaration, prefill, config = {}) {
  let input;
  switch (declaration.type) {
    case 'multiline':
      input = document.createElement('textarea');
      input.setAttribute('maxlength', '250');
      input.style.margin = '0.5em 0';
      input.style.paddingBottom = '3em';
      break;
    case 'email':
      input = document.createElement('input');
      input.type = 'email';
      break;
    case 'number':
      input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('maxlength', '80');
      input.setAttribute('inputmode', 'numeric');
      input.setAttribute('pattern', '\\d*');
      input.addEventListener('input', () => { input.value = input.value.replace(/[^0-9]/g, ''); });
      break;
    case 'date':
      input = document.createElement('input');
      input.type = 'date';
      break;
    case 'phone':
      input = document.createElement('input');
      input.type = 'tel';
      input.setAttribute('maxlength', '30');
      input.setAttribute('pattern', PHONE_PATTERN);
      input.title = 'Enter a phone number (digits, spaces, + ( ) - .)';
      break;
    case 'url':
      input = document.createElement('input');
      input.type = 'url';
      input.setAttribute('maxlength', '300');
      input.setAttribute('inputmode', 'url');
      break;
    case 'select': {
      if (config.choiceStyle === 'list') {
        // Quiz look: the same Dropdown field, shown as a list of choices (one answer, sent under the same name).
        const token = declaration.token || String(declaration.label || '').toUpperCase();
        const group = document.createElement('fieldset');
        group.className = 'optin-choice';
        const legend = document.createElement('legend');
        legend.textContent = declaration.label || token;
        legend.dataset.editKey = 'elements.__i.label';
        group.appendChild(legend);
        selectChoices(declaration.options).forEach((choice, n) => {
          const row = document.createElement('label');
          const radio = document.createElement('input');
          radio.type = 'radio'; radio.name = token; radio.value = choice;
          if (declaration.required && n === 0) radio.required = true;
          if (prefill?.[token] === choice) radio.checked = true;
          const text = document.createElement('span');
          text.textContent = choice;
          row.append(radio, text);
          group.appendChild(row);
        });
        return group;
      }
      input = document.createElement('select');
      const hint = declaration.placeholder != null && declaration.placeholder !== '' ? String(declaration.placeholder) : String(declaration.label || 'Choose');
      const first = document.createElement('option');
      first.value = ''; first.textContent = hint; first.disabled = true; first.selected = true;
      input.appendChild(first);
      selectChoices(declaration.options).forEach((choice) => {
        const o = document.createElement('option');
        o.value = choice; o.textContent = choice;
        input.appendChild(o);
      });
      break;
    }
    case 'checkbox': {
      // A tick box with its label; the answer is "Yes" when ticked (an unticked box sends nothing).
      const token = declaration.token || String(declaration.label || '').toUpperCase();
      const wrap = document.createElement('label');
      wrap.className = 'optin-check';
      const box = document.createElement('input');
      box.type = 'checkbox'; box.name = token; box.value = 'Yes';
      if (declaration.required) box.required = true;
      if (prefill?.[token]) box.checked = true;
      const text = document.createElement('span');
      text.textContent = declaration.label || token;
      wrap.append(box, text);
      return wrap;
    }
    default:
      input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('maxlength', '80');
  }
  const token = declaration.token || String(declaration.label || '').toUpperCase();
  input.name = token;
  input.placeholder = declaration.placeholder != null && declaration.placeholder !== '' ? String(declaration.placeholder) : `${declaration.label || ''} `;
  input.setAttribute('aria-label', declaration.label || token);
  if (declaration.required) input.required = true;
  input.style.borderRadius = `${Number(config.inputBorderRadius ?? INPUT_BORDER_RADIUS)}px`;
  if (config.inputBackground) {
    const op = config.inputOpacity === undefined || config.inputOpacity === '' ? 100 : Math.max(0, Math.min(100, Number(config.inputOpacity)));
    input.style.background = op < 100 ? hexToRgba(config.inputBackground, op / 100) : config.inputBackground;
  }
  if (config.inputFontColor) input.style.color = config.inputFontColor;
  if (config.inputBorderColor) input.style.border = `1px solid ${cssColor(config.inputBorderColor, '#c1c1c1')}`;
  if (config.inputIcons && input.tagName === 'INPUT') {
    input.classList.add('has-icon');
    Object.assign(input.style, { backgroundImage: inputIcon(input.type, config.inputFontColor || '#888888'), backgroundRepeat: 'no-repeat', backgroundPosition: '0.7em center', backgroundSize: '1.1em', paddingLeft: '2.3em' });
  }
  if (prefill?.[token]) input.value = prefill[token];
  return input;
}

/**
 * One consistent layout for 1-5 boxes (upstream used a different hack per count, which left
 * uneven rows and a stretched last box): the boxes sit in ONE centred block, all the same width,
 * with the same gap, and the Play button is centred under them.
 *   auto    1 box = box + Play on one row; 2-3 = stacked; 4 = 2x2; 5 = stacked
 *   stacked one column
 *   grid    two columns (an odd last box is centred)
 *   inline  boxes and Play on one row (up to 2 boxes; more fall back to stacked)
 */
export const FIELD_LAYOUTS = [
  ['auto', 'Auto (best for the number of boxes)'],
  ['stacked', 'Stacked (one column)'],
  ['grid', 'Two columns'],
  ['inline', 'Inline (boxes and Play on one row)'],
  ['row', 'One row (up to 4 boxes and Play side by side)'],
  ['cols', 'Columns (up to 4 boxes side by side, Play below)'],
];

export function resolveFieldLayout(count, wanted = 'auto') {
  if (wanted === 'stacked' || wanted === 'grid') return count < 2 ? 'stacked' : wanted;
  if (wanted === 'row') return 'inline';
  if (wanted === 'cols') return count < 2 ? 'stacked' : count > 4 ? 'stacked' : 'cols';
  if (wanted === 'inline') return count <= 2 ? 'inline' : 'stacked';
  if (count <= 1) return 'inline';
  if (count === 4) return 'grid';
  return 'stacked';
}

/** Font stack with a fallback, so text stays readable while (or if) the web font loads. */
const MONO_FONTS = /mono|code|courier/i;
const SERIF_FONTS = /playfair|cinzel|bevan|serif/i;
export const fontStack = (family) => (family ? `"${String(family).replace(/"/g, '')}", ${MONO_FONTS.test(family) ? 'ui-monospace, monospace' : SERIF_FONTS.test(family) ? 'Georgia, serif' : 'system-ui, sans-serif'}` : '');

/** Load a Google Font once, as upstream's buildForm did with its fontSheet. */
export function ensureFormFont(family) {
  if (!family || typeof document === 'undefined') return;
  const id = `addon-font-${family.replace(/[^a-z0-9]+/gi, '-')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css?family=${encodeURIComponent(family).replace(/%20/g, '+')}:400,700`;
  document.head.appendChild(link);
}

/**
 * Build the upstream-style opt-in form element (not attached).
 * `prefill` maps field tokens to values (personalization).
 */
export function buildOptinForm(config, { prefill = {}, compact = false } = {}) {
  ensureFormFont(config.fontFamily);
  const form = document.createElement('form');
  form.className = `popcorn retarget-form addon-optin ${config.transition && config.transition !== 'popcorn-none' ? config.transition : ''}`.trim();
  form.setAttribute('action', '#');
  form.noValidate = false;
  if (config.designAccent) form.style.setProperty('--od-accent', cssColor(config.designAccent, ''));
  if (config.decorEnabled === false) form.dataset.decor = 'off';
  const designId = safeDesignId(config.designPreset);
  if (designId) form.dataset.design = designId;
  const designLayout = ['split', 'side-card', 'sheet', 'chat'].includes(config.designLayout) ? config.designLayout : 'center';
  form.dataset.dlayout = designLayout;

  const inner = document.createElement('div');
  inner.className = 'form-inner';
  Object.assign(inner.style, compact
    ? { margin: 'auto', height: '90%', width: '90%' }
    : { display: 'flex', justifyContent: 'center', alignItems: 'center', margin: 'auto', height: `${config.innerHeight ?? 100}%`, width: `${config.innerWidth ?? 90}%` });
  if (config.innerColor && Number(config.innerOpacity) > 0) {
    inner.style.background = hexToRgba(config.innerColor, Number(config.innerOpacity) / 100);
  }
  // Card styling (corner, border, glow, frosted blur) — designs use these; all optional.
  const radius = Number(config.cardRadius) || 0;
  if (radius > 0) inner.style.borderRadius = radius >= 200 ? '50%' : `${radius}px`;
  if (Number(config.cardBorderWidth) > 0 && config.cardBorderColor) inner.style.border = `${Math.min(8, Number(config.cardBorderWidth))}px solid ${cssColor(config.cardBorderColor, '#ffffff')}`;
  if (config.cardGlow) inner.style.boxShadow = `0 0 24px ${hexToRgba(cssColor(config.cardGlow, '#ffffff'), 0.55)}, inset 0 0 18px ${hexToRgba(cssColor(config.cardGlow, '#ffffff'), 0.18)}`;
  if (Number(config.cardBlur) > 0) inner.style.backdropFilter = inner.style.webkitBackdropFilter = `blur(${Math.min(40, Number(config.cardBlur))}px)`;

  const scrollable = document.createElement('div');
  scrollable.className = 'form-scrollable';
  const scrollInner = document.createElement('div');
  scrollInner.className = 'form-scrollable-inner';

  if (config.brandLogoSrc) {
    const logo = document.createElement('img');
    logo.className = 'brand-logo';
    logo.src = config.brandLogoSrc;
    logo.alt = '';
    scrollInner.appendChild(logo);
  }

  if (config.brandName) {
    const brand = document.createElement('div');
    brand.className = 'optin-brand';
    if (config.brandIcon !== false) brand.appendChild(svgEl('<path d="M6 4l13 8-13 8z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/>'));
    const name = document.createElement('span');
    name.textContent = config.brandName;
    name.dataset.editKey = 'brandName';
    brand.appendChild(name);
    scrollInner.appendChild(brand);
  }
  if (BADGE_SVG[config.badgeIcon]) {
    const badge = document.createElement('div');
    badge.className = 'optin-badge';
    badge.dataset.badge = config.badgeIcon;
    badge.appendChild(svgEl(BADGE_SVG[config.badgeIcon]));
    scrollInner.appendChild(badge);
  }
  if (config.eyebrow) {
    const eyebrow = document.createElement('div');
    eyebrow.className = 'optin-eyebrow';
    eyebrow.textContent = config.eyebrow;
    eyebrow.dataset.editKey = 'eyebrow';
    eyebrow.style.textAlign = config.captionAlignment || 'center';
    scrollInner.appendChild(eyebrow);
  }

  const caption = document.createElement('div');
  caption.className = 'retarget-caption';
  caption.textContent = config.caption ?? '';
  caption.style.fontSize = `${config.captionFontSize || config.fontSize || 76}%`;
  caption.style.textAlign = config.captionAlignment || 'center';
  caption.style.marginBottom = '0.5em';
  caption.style.width = '100%';
  caption.dataset.editKey = 'caption';
  if (config.captionColor) caption.style.color = config.captionColor;
  if (config.captionBold === false) caption.style.fontWeight = '400';
  scrollInner.appendChild(caption);

  if (config.subtitle) {
    const sub = document.createElement('div');
    sub.className = 'optin-subtitle';
    sub.textContent = config.subtitle;
    sub.dataset.editKey = 'subtitle';
    sub.style.textAlign = config.captionAlignment || 'center';
    scrollInner.appendChild(sub);
  }
  // Testimonial + stats (Social proof design): a quote, who said it, and "50,000+ Creators, 5M+ Videos" tiles.
  if (config.sideQuote || config.sideStats) {
    const proof = document.createElement('div');
    proof.className = 'optin-proof';
    if (config.sideRating) {
      const rating = document.createElement('div');
      rating.className = 'optin-rating';
      const stars = document.createElement('b'); stars.textContent = '\u2605\u2605\u2605\u2605\u2605';
      const num = document.createElement('span'); num.textContent = config.sideRating; num.dataset.editKey = 'sideRating';
      rating.append(stars, num);
      proof.appendChild(rating);
    }
    if (config.sideQuote) {
      const q = document.createElement('blockquote');
      q.textContent = config.sideQuote;
      q.dataset.editKey = 'sideQuote';
      proof.appendChild(q);
      if (config.sideAuthor) { const a = document.createElement('cite'); a.textContent = config.sideAuthor; a.dataset.editKey = 'sideAuthor'; proof.appendChild(a); }
    }
    const stats = String(config.sideStats || '').split(';').map((x) => x.trim()).filter(Boolean).slice(0, 4);
    if (stats.length) {
      const row = document.createElement('div');
      row.className = 'optin-stats';
      stats.forEach((t) => {
        const m = t.match(/^(\S+)\s+(.*)$/);
        const cell = document.createElement('span');
        const b = document.createElement('b'); b.textContent = m ? m[1] : t;
        cell.appendChild(b);
        if (m) cell.appendChild(document.createTextNode(m[2]));
        row.appendChild(cell);
      });
      proof.appendChild(row);
    }
    scrollInner.appendChild(proof);
  }

  const inputWrapper = document.createElement('div');
  inputWrapper.className = 'input-wrapper';
  const elements = (config.elements || []).slice(0, 5);
  // Multi-step: the boxes are shown `stepSize` at a time (Next / Back, progress dots); everything is still sent once at the end.
  const stepSize = config.multiStep ? Math.max(1, Math.min(3, Number(config.stepSize) || 1)) : 0;
  const stepCount = stepSize ? Math.ceil(elements.length / stepSize) : 1;
  elements.forEach((d, i) => {
    const input = buildInput(d, prefill, config);
    if (designLayout === 'chat') {
      const questions = String(config.stepQuestions || '').split('\n').map((x) => x.trim());
      const bubble = document.createElement('div');
      bubble.className = 'optin-bubble';
      bubble.textContent = questions[i] || `What's your ${String(d.label || 'answer').trim().toLowerCase()}?`;
      if (stepCount > 1) bubble.dataset.step = String(Math.floor(i / stepSize));
      inputWrapper.appendChild(bubble);
    }
    if (input.classList.contains('optin-choice')) input.querySelector('legend').dataset.editKey = `elements.${i}.label`;
    else input.dataset.editKey = d.type === 'checkbox' ? `elements.${i}.label` : `elements.${i}.placeholder`;
    if (stepCount > 1) input.dataset.step = String(Math.floor(i / stepSize));
    inputWrapper.appendChild(input);
  });
  if (stepCount > 1) { form.dataset.steps = String(stepCount); form.noValidate = true; } // each step is checked as you go

  const buttonsInner = document.createElement('div');
  buttonsInner.className = 'buttons-inner';
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.setAttribute('data-keep-fill', ''); // the creator chooses this button's colour; the app-wide outline-only rule must not strip it
  submitButton.textContent = config.btnText ?? 'Play';
  submitButton.dataset.editKey = 'btnText';
  Object.assign(submitButton.style, {
    borderColor: 'transparent',
    background: config.buttonBackground || '#eb5054',
    borderRadius: `${config.buttonBorderRadius ?? 5}px`,
    color: config.buttonFontColor || '#ffffff',
  });
  if (config.buttonFontWeight) submitButton.style.fontWeight = String(config.buttonFontWeight);
  if (config.buttonBackground2) submitButton.style.background = `linear-gradient(90deg, ${cssColor(config.buttonBackground, '#eb5054')}, ${cssColor(config.buttonBackground2, '#eb5054')})`;
  if (config.btnBottomBorder && config.btnBottomBorder !== 'none') submitButton.style.borderBottom = `1px solid ${config.btnBottomBorder}`;
  form.style.setProperty('--optin-btn-bg', config.buttonBackground || '#eb5054');
  form.style.setProperty('--optin-btn-hover', config.buttonHoverColor || config.buttonBackground || '#eb5054');
  form.style.setProperty('--optin-placeholder', config.placeholderColor || '#6b7280');
  form.style.setProperty('--optin-in-radius', `${Number(config.inputBorderRadius ?? 5)}px`);
  if (config.btnIcon === 'play' || config.btnIcon === 'arrow') submitButton.dataset.icon = config.btnIcon;
  buttonsInner.appendChild(submitButton);
  if (stepCount > 1) {
    const back = document.createElement('button');
    back.type = 'button'; back.className = 'optin-back'; back.textContent = 'Back'; back.hidden = true;
    buttonsInner.insertBefore(back, submitButton);
    const dots = document.createElement('div');
    dots.className = 'optin-steps'; dots.setAttribute('aria-hidden', 'true');
    for (let n = 0; n < stepCount; n += 1) { const d = document.createElement('span'); d.className = n === 0 ? 'on' : ''; dots.appendChild(d); }
    buttonsInner.appendChild(dots);
  }

  const wrapperContainer = document.createElement('div');
  wrapperContainer.className = 'input-wrapper-container';
  const visibleBoxes = stepCount > 1 ? Math.min(stepSize, elements.length) : elements.length; // one step's worth at a time
  const layout = resolveFieldLayout(visibleBoxes, config.fieldLayout);
  wrapperContainer.dataset.layout = layout;
  wrapperContainer.dataset.count = String(visibleBoxes);
  wrapperContainer.style.setProperty('--cols', String(Math.max(1, Math.min(4, visibleBoxes))));
  wrapperContainer.dataset.align = config.fieldAlign === 'left' ? 'left' : 'center';
  // fieldWidth = % of the form the boxes (and Play) take; fieldGap in tenths of an em
  const w = Math.max(30, Math.min(100, Number(config.fieldWidth) || 70));
  const gap = Math.max(0, Math.min(40, Number(config.fieldGap ?? 6)));
  // on the shared parent, so the privacy text lines up with the boxes too
  scrollInner.style.setProperty('--field-w', `${w}%`);
  scrollInner.style.setProperty('--field-gap', `${gap / 10}em`);
  if (config.buttonWidth === 'auto') wrapperContainer.dataset.button = 'auto';
  wrapperContainer.appendChild(inputWrapper);
  wrapperContainer.appendChild(buttonsInner);
  // Heading over the boxes ("Your Details" + a hint), the labelled stepper and the chat-style question bubbles.
  if (config.panelTitle) {
    const t = document.createElement('div');
    t.className = 'optin-paneltitle';
    t.textContent = config.panelTitle;
    t.dataset.editKey = 'panelTitle';
    scrollInner.appendChild(t);
  }
  if (config.panelHint) {
    const t = document.createElement('div');
    t.className = 'optin-panelhint';
    t.textContent = config.panelHint;
    t.dataset.editKey = 'panelHint';
    scrollInner.appendChild(t);
  }
  const stepLabels = String(config.stepLabels || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (stepCount > 1 && stepLabels.length) {
    form.classList.add('has-stepper');
    const stepper = document.createElement('div');
    stepper.className = 'optin-stepper';
    stepper.dataset.editKey = 'stepLabels';
    for (let n = 0; n < stepCount; n += 1) {
      const item = document.createElement('span');
      item.dataset.n = String(n);
      if (n === 0) item.className = 'on';
      const dot = document.createElement('i');
      dot.textContent = String(n + 1);
      item.append(dot, document.createTextNode(stepLabels[n] || `Step ${n + 1}`));
      stepper.appendChild(item);
    }
    scrollInner.appendChild(stepper);
  }
  scrollInner.appendChild(wrapperContainer);

  // Consent checkbox (owner setting): must be ticked; the wording is stored with the lead as the CONSENT answer.
  if (config.requireConsent && config.consentText) {
    const consent = document.createElement('label');
    consent.className = 'optin-consent';
    const box = document.createElement('input');
    box.type = 'checkbox'; box.name = 'CONSENT'; box.value = String(config.consentText).slice(0, 300); box.required = true;
    const words = document.createElement('span');
    words.textContent = config.consentText;
    words.dataset.editKey = 'consentText';
    consent.append(box, words);
    if (stepCount > 1) consent.dataset.step = String(stepCount - 1);
    scrollInner.appendChild(consent);
  }

  if (config.privacyDisclaimer && !config.isPersonalizer) {
    const disclaimer = document.createElement('div');
    disclaimer.className = 'privacy-disclaimer';
    disclaimer.style.fontSize = '40%';
    disclaimer.textContent = config.privacyDisclaimer;
    disclaimer.dataset.editKey = 'privacyDisclaimer';
    scrollInner.appendChild(disclaimer);
  }
  if (config.privacyPolicyCaption && config.privacyPolicyLink && /^https?:\/\//i.test(config.privacyPolicyLink)) {
    const link = document.createElement('a');
    link.className = 'privacy-policy-link';
    link.textContent = config.privacyPolicyCaption;
    link.href = config.privacyPolicyLink;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    scrollInner.appendChild(link);
  }

  const status = document.createElement('p');
  status.className = 'addon-optin__status';
  status.setAttribute('aria-live', 'polite');
  scrollInner.appendChild(status);

  if (designLayout === 'split') {
    // Title column on the left (logo, eyebrow, caption, subtitle, testimonial), the boxes + Play on the right.
    const proofOnly = !!(config.sideQuote || config.sideStats); // a testimonial panel: only the quote sits left, the form keeps its title
    const side = document.createElement('div');
    side.className = 'optin-side';
    const main = document.createElement('div');
    main.className = 'optin-main';
    Array.from(scrollInner.children).forEach((el) => {
      (el.matches(proofOnly ? '.optin-proof' : '.brand-logo, .optin-brand, .optin-badge, .optin-eyebrow, .retarget-caption, .optin-subtitle, .optin-proof') ? side : main).appendChild(el);
    });
    // Quiz look: the question + its choices sit under the title, on the left.
    const choice = main.querySelector('.optin-choice');
    if (choice) side.appendChild(choice);
    scrollInner.append(side, main);
  }
  scrollable.appendChild(scrollInner);
  inner.appendChild(scrollable);
  form.appendChild(inner);

  if (config.enableSkipButton) {
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'skip-button';
    skip.textContent = config.skipText || 'Skip';
    skip.dataset.editKey = 'skipText';
    skip.style.color = config.fontColor || '#ffffff';
    form.appendChild(skip);
  }

  const width = compact ? 90 : Number(config.width ?? 100);
  const height = compact ? 90 : Number(config.height ?? 100);
  Object.assign(form.style, {
    top: `${(100 - height) / 2}%`,
    left: `${(100 - width) / 2}%`,
    width: `${width}%`,
    height: `${height}%`,
    background: formBackground(config),
    color: config.fontColor || '#ffffff',
    fontFamily: fontStack(config.fontFamily),
  });
  if (config.backgroundImage) form.style.backgroundSize = 'cover';
  form.querySelectorAll('button, input, textarea').forEach((el) => {
    el.style.fontSize = `${Number(config.fontSize) || 60}%`;
    if (config.fontFamily) el.style.fontFamily = fontStack(config.fontFamily);
  });
  // Play button text size, as a % of the form text size (100 = same)
  if (Number(config.buttonFontSize) > 0 && Number(config.buttonFontSize) !== 100) {
    submitButton.style.fontSize = `${(Number(config.fontSize) || 60) * Number(config.buttonFontSize) / 100}%`;
  }
  return form;
}

/**
 * Pointer hint: an arrow (any design in ./pointerDesigns.js, any colour) and
 * the bubble — header, "Fill out your <fields>", "Click <btn>", description.
 * Upstream hard-coded the red curly arrow and the dark bubble; here the
 * design, colours, size, corner and mirroring are options. Returns null when
 * the pointer is turned off.
 */
export function buildArrowHint(config) {
  if (config.pointerEnabled === false) return null;
  const design = getPointerDesign(config.pointerStyle);
  const target = design.mode === 'target';
  const pos = ['bottom-right', 'bottom-left', 'top-right', 'top-left'].includes(config.hintPosition) ? config.hintPosition : 'bottom-right';
  const style = HINT_STYLES.some(([id]) => id === config.hintStyle) ? config.hintStyle : 'card';
  // A saved motion that doesn't fit this kind of design falls back sensibly.
  const arrowMotions = new Set(['nudge', 'bounce', 'pulse', 'wiggle', 'float', 'draw', 'ping', 'none']);
  const targetMotions = new Set(['travel-click', 'tap', 'hover', 'none']);
  const wanted = String(config.pointerMotion || '');
  const motion = (target ? targetMotions : arrowMotions).has(wanted) ? wanted : (target ? 'travel-click' : 'nudge');
  const color = safeColor(config.pointerColor);
  const svg = pointerSvg(design.id, color);
  const overlay = document.createElement('div');
  overlay.className = [
    'overlay-arrow', 'on', `hint-pos-${pos}`, `pt-style-${style}`, `pt-motion-${motion}`,
    target ? 'pt-target-mode' : '',
    design.animated ? 'pointer-animated' : '',
    svg && !svg.includes('pt-stroke') ? 'pt-nostroke' : '',
  ].filter(Boolean).join(' ');
  overlay.dataset.pointer = design.id;
  overlay.dataset.motion = motion;
  overlay.style.setProperty('--arrow-scale', String((Number(config.pointerSize) || 100) / 100));
  overlay.style.setProperty('--pointer-color', color);
  // How strongly the form is dimmed while the pointer shows (upstream: 0.8).
  const dim = Number(config.hintDim ?? 80);
  overlay.style.backgroundColor = `rgba(34, 34, 40, ${Math.max(0, Math.min(100, Number.isFinite(dim) ? dim : 80)) / 100})`;
  const bubbleBg = hexToRgba(safeColor(config.hintBackground, '#17171c'), 0.9) || '#17171c';

  let pointer = '';
  if (target) {
    // Placed on the Play button by startPointer(); the tip lands on its centre.
    pointer = `<div class="pointer-target" data-tip="${design.tip.join(',')}">
      <span class="pointer-ring" style="border-color:${esc(color)}"></span>
      ${design.cursor === false ? '' : `<svg class="pointer-cursor" viewBox="${design.viewBox}" aria-hidden="true">${svg}</svg>`}
    </div>`;
  } else if (svg) {
    pointer = `<div class="arrow-image"><svg viewBox="0 0 129 72" fill="none" aria-hidden="true">${svg}</svg>${motion === 'ping' ? `<span class="pt-ping" style="border-color:${esc(color)}"></span>` : ''}</div>`;
  }
  overlay.innerHTML = `
    ${pointer}
    <div class="container-hint">
      <h3 class="title-hint" data-edit-key="popupHeaderText">${esc(config.popupHeaderText)}</h3>
      <p class="container-fill-out"><span class="fill-out" data-edit-key="popupFillOutText">${esc(config.popupFillOutText)}</span>${(config.elements || []).map((e, i) => `<span class="element-field" data-edit-key="elements.${i}.label">${esc(e.label)}</span>`).join('')}</p>
      <p class="try-now-hint"><span class="click-text" data-edit-key="popupClickText">${esc(config.popupClickText)}</span> <span class="btn-form-name" data-edit-key="btnText">${esc(config.btnText ?? 'Play')}</span></p>
      <p class="experience-hint" data-edit-key="popupDescriptionText">${esc(config.popupDescriptionText)}</p>
    </div>`;
  const bubble = overlay.querySelector('.container-hint');
  bubble.style.background = bubbleBg;
  bubble.style.borderColor = safeColor(config.hintBorderColor, '#575773');
  bubble.style.color = safeColor(config.hintTextColor, '#ffffff');
  bubble.style.borderRadius = `${Math.max(0, Number(config.hintRadius ?? 12))}px`;
  // Bubble variants read these (see .pt-style-* in the stylesheet).
  bubble.style.setProperty('--hint-bg', safeColor(config.hintBackground, '#17171c'));
  bubble.style.setProperty('--hint-border', safeColor(config.hintBorderColor, '#575773'));
  bubble.style.setProperty('--hint-text', safeColor(config.hintTextColor, '#ffffff'));
  return overlay;
}

const reducedMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Click-demo pointers (cursor / finger / pulse ring) sit ON the Play button
 * and play a click. Ported from two animation sources in this repo:
 *
 *  - HyperFrames cta-morph-press + physics-press-reaction: the cursor
 *    hard-cuts in from off-screen bottom-right, travels to the button, then
 *    cursor AND button press down together (scale 0.9, PRESS_INTENSITY 0.1)
 *    and spring back with overshoot.
 *  - Remotion ScreenshotScene: ease-out-cubic travel (1 - (1 - p)^3) and the
 *    `click_pulse` ripple (a 3px ring growing 10 → 80px while alpha 0.85 → 0).
 *
 * Needs layout, so it runs after the form is in the document; where there is
 * none (tests) or reduced motion is on, the pointer is only placed.
 */
export function startPointer(hint, form, config) {
  const holder = hint?.querySelector?.('.pointer-target');
  if (!holder) return () => {};
  const button = form.querySelector('.buttons-inner button');
  const hr = hint.getBoundingClientRect();
  const br = button?.getBoundingClientRect();
  if (!br || !hr.width || !br.width) return () => {};
  const scale = (Number(config.pointerSize) || 100) / 100;
  const size = Math.max(28, Math.round(br.height * 1.5)) * scale;
  const [tx, ty] = (holder.dataset.tip || '0.5,0.5').split(',').map(Number);
  const cx = br.left - hr.left + br.width / 2;
  const cy = br.top - hr.top + br.height / 2;
  Object.assign(holder.style, { width: `${size}px`, height: `${size}px`, left: `${cx - size * tx}px`, top: `${cy - size * ty}px` });
  const ring = holder.querySelector('.pointer-ring');
  const cursor = holder.querySelector('.pointer-cursor');
  // The ring is centred on the button, whatever the cursor tip offset is.
  Object.assign(ring.style, { left: `${size * tx}px`, top: `${size * ty}px` });

  const motion = hint.dataset.motion;
  if (reducedMotion() || typeof holder.animate !== 'function' || motion === 'none') return () => {};
  const anims = [];
  const run = (el, frames, opts) => { const a = el.animate(frames, { fill: 'both', ...opts }); anims.push(a); return a; };
  // Ripple: Remotion click_pulse (10 → 80px, alpha .85 → 0), as a scale of a 10px ring.
  const ripple = (offset, span) => [
    { opacity: 0, transform: 'translate(-50%, -50%) scale(1)', offset: 0 },
    { opacity: 0, transform: 'translate(-50%, -50%) scale(1)', offset },
    { opacity: 0.85, transform: 'translate(-50%, -50%) scale(1)', offset: offset + 0.001 },
    { opacity: 0, transform: 'translate(-50%, -50%) scale(8)', offset: Math.min(1, offset + span) },
    { opacity: 0, transform: 'translate(-50%, -50%) scale(8)', offset: 1 },
  ];
  const press = 1 - 0.1; // PRESS_INTENSITY
  const spring = 'cubic-bezier(0.34, 1.56, 0.64, 1)'; // release with overshoot
  const easeOutCubic = 'cubic-bezier(0.33, 1, 0.68, 1)'; // 1 - (1 - p)^3

  if (!cursor) {
    // Pulse ring: two ripples, staggered, looping.
    run(ring, ripple(0, 0.6), { duration: 1800, iterations: Infinity });
    return () => anims.forEach((a) => a.cancel());
  }
  if (motion === 'travel-click') {
    const sx = hr.width - cx + 60;
    const sy = hr.height - cy + 80;
    const D = 3600;
    // cut in (0.001s hard-cut) → travel → press ↓ → release ↑ (spring) → hold → fade
    run(cursor, [
      { transform: `translate(${sx}px, ${sy}px) scale(1)`, opacity: 0, offset: 0 },
      { transform: `translate(${sx}px, ${sy}px) scale(1)`, opacity: 1, offset: 0.01 },
      { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0.4, easing: 'ease' },
      { transform: `translate(0, 0) scale(${press})`, opacity: 1, offset: 0.48, easing: spring },
      { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0.58 },
      { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0.9 },
      { transform: 'translate(0, 0) scale(1)', opacity: 0, offset: 1 },
    ].map((k, i, all) => (i === 1 ? { ...k, easing: easeOutCubic } : k)), { duration: D, iterations: Infinity });
    run(ring, ripple(0.48, 0.3), { duration: D, iterations: Infinity });
    // The button presses in sync with the cursor.
    run(button, [
      { transform: 'scale(1)', offset: 0 },
      { transform: 'scale(1)', offset: 0.4 },
      { transform: `scale(${press})`, offset: 0.48, easing: spring },
      { transform: 'scale(1)', offset: 0.58 },
      { transform: 'scale(1)', offset: 1 },
    ], { duration: D, iterations: Infinity });
  } else if (motion === 'tap') {
    const D = 1500;
    run(cursor, [
      { transform: 'translate(0, 0) scale(1)', offset: 0 },
      { transform: `translate(2px, 2px) scale(${press})`, offset: 0.3, easing: spring },
      { transform: 'translate(0, 0) scale(1)', offset: 0.5 },
      { transform: 'translate(0, 0) scale(1)', offset: 1 },
    ], { duration: D, iterations: Infinity });
    run(ring, ripple(0.3, 0.45), { duration: D, iterations: Infinity });
    run(button, [
      { transform: 'scale(1)', offset: 0 }, { transform: `scale(${press})`, offset: 0.3, easing: spring },
      { transform: 'scale(1)', offset: 0.5 }, { transform: 'scale(1)', offset: 1 },
    ], { duration: D, iterations: Infinity });
  } else {
    // hover: parked on Play, floating
    run(cursor, [
      { transform: 'translate(0, 0)' }, { transform: 'translate(5px, 6px)' }, { transform: 'translate(0, 0)' },
    ], { duration: 1600, iterations: Infinity, easing: 'ease-in-out' });
  }
  return () => anims.forEach((a) => { try { a.cancel(); } catch { /* element gone */ } });
}

/** Backdrop behind the form: a registration wall hides the video (100%). */
export function backdropStyle(config, { preview = false } = {}) {
  const color = safeColor(config.backdropColor, '#3e3e51');
  let opacity = Number(config.backdropOpacity ?? 67);
  if (!Number.isFinite(opacity)) opacity = 67;
  // While editing, keep the video visible behind the form so it can be styled.
  if (preview) opacity = Math.min(opacity, 67);
  return hexToRgba(color, Math.max(0, Math.min(100, opacity)) / 100) || color;
}

/**
 * Click-to-edit for the editor preview: click a piece of text on the form (caption, Play button,
 * bubble lines, privacy text, Skip) - or double-click a box to edit its placeholder - and a small
 * input opens over it. Enter / click away keeps the change (Shift+Enter = new line in long text),
 * Esc cancels. `onEditText(key, value)` receives the option key ("caption", "btnText",
 * "elements.0.placeholder", ...). Capture phase, so it wins over the pointer's own click handler.
 */
export function attachTextEditing(wrap, onEditText) {
  let open = null;
  const LONG = new Set(['caption', 'privacyDisclaimer', 'popupDescriptionText', 'popupHeaderText']);
  const currentText = (el) => {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return el.getAttribute('placeholder') || '';
    return el.textContent || '';
  };
  const close = (commit) => {
    if (!open) return;
    const { box, el, key, original } = open;
    open = null;
    const value = box.value;
    box.remove();
    if (commit && value !== original) onEditText(key, key.endsWith('.placeholder') ? value.trimEnd() : value);
    el.classList.remove('is-editing');
  };
  const begin = (el) => {
    close(true);
    const key = el.dataset.editKey;
    const wr = wrap.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const long = LONG.has(key);
    const box = document.createElement(long ? 'textarea' : 'input');
    box.className = 'optin-text-edit';
    box.setAttribute('aria-label', 'Edit text');
    const original = currentText(el).trim();
    box.value = original;
    Object.assign(box.style, {
      position: 'absolute',
      left: `${r.left - wr.left - 6}px`,
      top: `${r.top - wr.top - 4}px`,
      width: `${Math.max(140, r.width + 12)}px`,
      minHeight: `${Math.max(28, r.height + 8)}px`,
      zIndex: '300',
    });
    if (long) box.rows = Math.min(4, Math.max(2, Math.round(r.height / 18)));
    el.classList.add('is-editing');
    wrap.appendChild(box);
    open = { box, el, key, original };
    box.focus();
    box.select();
    box.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') close(false);
      else if (e.key === 'Enter' && !(long && e.shiftKey)) { e.preventDefault(); close(true); }
    });
    box.addEventListener('blur', () => close(true));
  };
  wrap.addEventListener('click', (e) => {
    if (e.target.closest?.('.optin-text-edit')) return;
    const el = e.target.closest?.('[data-edit-key]');
    if (!el || !wrap.contains(el)) { close(true); return; }
    // typing into a box still works: its placeholder is edited with a double-click
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;
    e.preventDefault();
    e.stopPropagation();
    begin(el);
  }, true);
  wrap.addEventListener('dblclick', (e) => {
    const el = e.target.closest?.('input[data-edit-key], textarea[data-edit-key]');
    if (el) { e.preventDefault(); e.stopPropagation(); begin(el); }
  }, true);
  wrap.classList.add('is-editable');
  return () => { close(false); wrap.classList.remove('is-editable'); };
}

/**
 * Show the opt-in form (List Builder / Personalizer / Lead Generator) over
 * the video — the one renderer for all three.
 * onSubmit(data) resolves to a status message (or throws); onSkip() fires
 * from the Skip button. The pointer hides after `hintDuration` seconds
 * (default 5, as upstream; 0 = stays until clicked) or on click.
 * Options: prefill, preview (editor: see-through backdrop).
 */
export function showOptinOverlay(layer, config, { onSubmit, onSkip, onEditText, prefill = {}, preview = false, name = 'list-builder', allowRedirect = false, isActive = () => true, ctaId = name === 'list-builder' ? 'list-builder' : '' } = {}) {
  clearOverlay(layer, name);
  const wrap = document.createElement('div');
  wrap.className = 'addon-overlay addon-overlay--optin';
  wrap.dataset.overlay = name;
  wrap.dataset.kind = config.kind || 'list-builder';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-label', config.caption || 'Sign up');
  wrap.style.background = backdropStyle(config, { preview });
  const compact = (layer.clientWidth || 1000) < 480;
  const form = buildOptinForm(config, { prefill, compact });
  if (ctaId && !preview) form.dataset.ctaId = String(ctaId); // lets the heatmap count how many viewers saw THIS form
  // Bot traps: a hidden field people never see or fill, and how long the form was open. They go to onSubmit as `signals`
  // (not as answers): the server drops submissions that fill the trap or finish faster than a person can.
  const trap = document.createElement('input');
  trap.type = 'text'; trap.dataset.trap = ''; trap.tabIndex = -1; trap.autocomplete = 'off'; trap.setAttribute('aria-hidden', 'true');
  trap.style.cssText = 'position:absolute;left:-9999px;top:auto;width:1px;height:1px;opacity:0;pointer-events:none';
  form.appendChild(trap);
  // Optional Cloudflare Turnstile (only on published videos, and only when VITE_TURNSTILE_SITE_KEY is set).
  const siteKey = preview ? '' : turnstileSiteKey();
  let captcha = null;
  if (siteKey) {
    const box = document.createElement('div');
    box.className = 'addon-optin__captcha';
    const statusEl = form.querySelector('.addon-optin__status');
    if (statusEl) statusEl.before(box); else form.appendChild(box);
    captcha = mountTurnstile(box, siteKey);
  }
  const openedAt = Date.now();
  const prefilled = Object.values(prefill || {}).some((v) => String(v || '').trim());
  wrap.appendChild(form);

  const hint = buildArrowHint(config);
  let hintTimer;
  if (hint) {
    wrap.appendChild(hint);
    const hideHint = (e) => {
      e?.stopPropagation?.();
      hint.classList.remove('on');
      hint.classList.add('off');
    };
    hint.addEventListener('click', hideHint, { once: true });
    // while editing text the pointer stays up (click the dimmed area to dismiss it)
    const seconds = onEditText && preview ? 0 : Number(config.hintDuration ?? 5);
    if (seconds > 0) hintTimer = setTimeout(hideHint, seconds * 1000);
  }

  form.querySelector('.skip-button')?.addEventListener('click', () => {
    clearTimeout(hintTimer);
    wrap.remove();
    onSkip?.();
  });

  // ---- multi-step: show one group of boxes at a time
  const stepsTotal = Number(form.dataset.steps || 0);
  let step = 0;
  const submitBtn = form.querySelector('button[type="submit"]');
  const finalLabel = submitBtn?.textContent;
  const paintStep = () => {
    form.querySelectorAll('[data-step]').forEach((n) => { n.hidden = Number(n.dataset.step) !== step; });
    form.querySelectorAll('.optin-steps span').forEach((d, n) => d.classList.toggle('on', n === step));
    form.querySelectorAll('.optin-stepper [data-n]').forEach((d) => { const n = Number(d.dataset.n); d.classList.toggle('on', n === step); d.classList.toggle('done', n < step); });
    const back = form.querySelector('.optin-back');
    if (back) back.hidden = step === 0;
    if (submitBtn) submitBtn.textContent = step < stepsTotal - 1 ? (config.nextText || 'Next') : finalLabel;
    form.querySelector('[data-step]:not([hidden]) input, [data-step]:not([hidden]) select, [data-step]:not([hidden]) textarea')?.focus?.({ preventScroll: true });
  };
  const stepControls = (n) => Array.from(form.querySelectorAll(`[data-step="${n}"]`)).flatMap((node) => (node.matches('input,select,textarea') ? [node] : [...node.querySelectorAll('input,select,textarea')]));
  if (stepsTotal > 1) {
    paintStep();
    form.querySelector('.optin-back')?.addEventListener('click', () => { if (step > 0) { step -= 1; form.querySelector('.addon-optin__status').textContent = ''; paintStep(); } });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = form.querySelector('.addon-optin__status');
    if (stepsTotal > 1) {
      const bad = stepControls(step).find((el) => !el.checkValidity());
      if (bad) { status.textContent = 'Please complete this step.'; bad.reportValidity?.(); return; }
      if (step < stepsTotal - 1) { step += 1; status.textContent = ''; paintStep(); return; }
      const anyBad = Array.from(form.elements).find((el) => el.willValidate && !el.checkValidity());
      if (anyBad) { step = Number(anyBad.closest('[data-step]')?.dataset.step ?? step); paintStep(); status.textContent = 'Please complete all fields.'; return; }
    }
    // Whitespace-only answers don't count for required fields.
    const blank = Array.from(form.elements).find((el) => el.required && (el.type === 'checkbox' ? !el.checked : !String(el.value || '').trim()));
    if (blank) {
      status.textContent = 'Please complete all fields.';
      blank.focus?.({ preventScroll: true });
      return;
    }
    if (captcha?.isReady() && !captcha.token()) { status.textContent = 'Please complete the verification.'; return; }
    const data = Object.fromEntries(new FormData(form).entries());
    const signals = { hp: trap.value, ...(prefilled ? {} : { ms: Date.now() - openedAt }), ...(captcha?.token() ? { turnstile: captcha.token() } : {}) }; // prefilled answers can be sent at once
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const message = await onSubmit?.(data, signals);
      status.textContent = message || '';
      clearTimeout(hintTimer);
      wrap.remove();
      try { showThanks(layer, config, { allowRedirect, isActive }); } catch { /* the thank-you card is cosmetic; the lead is already saved */ }
    } catch (err) {
      btn.disabled = false;
      captcha?.reset(); // a Turnstile token is single-use
      status.textContent = err?.message || 'Something went wrong — try again.';
    }
  });
  layer.appendChild(wrap);
  if (onEditText && preview) attachTextEditing(wrap, onEditText);
  // Click-demo pointers need layout: place them on the Play button now.
  if (hint) {
    let stop = () => {};
    const go = () => { stop(); if (wrap.isConnected) stop = startPointer(hint, form, config); };
    requestAnimationFrame?.(go);
    // The hint hides itself after hintDuration; stop the animations with it.
    new MutationObserver(() => { if (hint.classList.contains('off') || !wrap.isConnected) { stop(); } }).observe(hint, { attributes: true, attributeFilter: ['class'] });
  }
  return wrap;
}

/** Back-compat name for the project-level List Builder / Personalizer. */
export const showListBuilderOverlay = showOptinOverlay;
