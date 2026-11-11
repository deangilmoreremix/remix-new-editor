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

import { pointerSvg, getPointerDesign, safeColor } from './pointerDesigns.js';

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
  return `radial-gradient(circle, ${hexToRgba(c, 0.07)} 10%, ${hexToRgba(c, 0.8)} 90%, ${hexToRgba(c, 1)} 100%)`;
}

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
      input.setAttribute('maxlength', '80');
      break;
    default:
      input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('maxlength', '80');
  }
  const token = declaration.token || String(declaration.label || '').toUpperCase();
  input.name = token;
  input.placeholder = `${declaration.label || ''} `;
  input.setAttribute('aria-label', declaration.label || token);
  if (declaration.required) input.required = true;
  input.style.borderRadius = `${Number(config.inputBorderRadius ?? INPUT_BORDER_RADIUS)}px`;
  if (config.inputBackground) input.style.background = config.inputBackground;
  if (config.inputFontColor) input.style.color = config.inputFontColor;
  if (config.inputBorderColor) input.style.border = `1px solid ${config.inputBorderColor}`;
  if (prefill?.[token]) input.value = prefill[token];
  return input;
}

/** Apply upstream's per-field-count layout rules (2/3/4/5 fields). */
function applyCountLayout(count, wrapperContainer, inputWrapper, buttonsInner, submitButton) {
  const kids = () => Array.from(inputWrapper.children);
  if (count === 2) {
    wrapperContainer.style.flexDirection = 'column';
    inputWrapper.style.flexDirection = 'column';
    inputWrapper.style.width = '70%';
    inputWrapper.style.marginRight = '0';
    kids()[0].style.marginBottom = '1em';
    buttonsInner.style.width = '70%';
  } else if (count === 3) {
    Object.assign(inputWrapper.style, { flexGrow: '0', marginRight: '0', flexWrap: 'wrap', alignItems: 'center', width: '90%' });
    wrapperContainer.style.flexDirection = 'column';
    kids().forEach((k, i) => { if (i < 2) k.style.width = '49%'; });
    Object.assign(kids()[2].style, { width: '10%', flexGrow: '5', marginRight: '0.5em' });
    inputWrapper.appendChild(buttonsInner);
  } else if (count === 4) {
    wrapperContainer.style.flexDirection = 'column';
    Object.assign(inputWrapper.style, { flexGrow: '0', marginRight: '0', flexWrap: 'wrap', alignItems: 'center', width: '100%' });
    buttonsInner.style.maxWidth = '100%';
    submitButton.style.padding = '0 1em';
    kids().forEach((k) => { k.style.width = '49%'; k.style.marginBottom = '0.5em'; });
  } else if (count === 5) {
    Object.assign(inputWrapper.style, { flexGrow: '0', marginRight: '0', flexDirection: 'column', width: '80%' });
    kids().forEach((k, i) => { if (i < 4) k.style.marginBottom = '0.5em'; });
    buttonsInner.style.width = '100%';
    buttonsInner.style.maxWidth = '100%';
    submitButton.style.boxSizing = 'border-box';
    wrapperContainer.style.justifyContent = 'center';
    inputWrapper.appendChild(buttonsInner);
  }
}

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

  const inner = document.createElement('div');
  inner.className = 'form-inner';
  Object.assign(inner.style, compact
    ? { margin: 'auto', height: '90%', width: '90%' }
    : { display: 'flex', justifyContent: 'center', alignItems: 'center', margin: 'auto', height: `${config.innerHeight ?? 100}%`, width: `${config.innerWidth ?? 90}%` });
  if (config.innerColor && Number(config.innerOpacity) > 0) {
    inner.style.background = hexToRgba(config.innerColor, Number(config.innerOpacity) / 100);
  }

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

  const caption = document.createElement('div');
  caption.className = 'retarget-caption';
  caption.textContent = config.caption ?? '';
  caption.style.fontSize = `${config.captionFontSize || config.fontSize || 76}%`;
  caption.style.textAlign = config.captionAlignment || 'center';
  caption.style.marginBottom = '0.5em';
  caption.style.width = '100%';
  scrollInner.appendChild(caption);

  const inputWrapper = document.createElement('div');
  inputWrapper.className = 'input-wrapper';
  const elements = (config.elements || []).slice(0, 5);
  elements.forEach((d) => inputWrapper.appendChild(buildInput(d, prefill, config)));
  Object.assign(inputWrapper.style, { display: 'flex', justifyContent: 'space-between', flexGrow: '4', marginRight: '0.5em', color: '#000000' });

  const buttonsInner = document.createElement('div');
  buttonsInner.className = 'buttons-inner';
  Object.assign(buttonsInner.style, { width: 'auto', flexGrow: '0.5', display: 'grid' });
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.textContent = config.btnText ?? 'Play';
  Object.assign(submitButton.style, {
    width: '100%',
    boxSizing: 'border-box',
    borderColor: 'transparent',
    background: config.buttonBackground || '#eb5054',
    borderRadius: `${config.buttonBorderRadius ?? 5}px`,
    color: config.buttonFontColor || '#ffffff',
  });
  if (config.btnBottomBorder && config.btnBottomBorder !== 'none') submitButton.style.borderBottom = `1px solid ${config.btnBottomBorder}`;
  form.style.setProperty('--optin-btn-bg', config.buttonBackground || '#eb5054');
  form.style.setProperty('--optin-btn-hover', config.buttonHoverColor || config.buttonBackground || '#eb5054');
  buttonsInner.appendChild(submitButton);

  const wrapperContainer = document.createElement('div');
  wrapperContainer.className = 'input-wrapper-container';
  wrapperContainer.appendChild(inputWrapper);
  wrapperContainer.appendChild(buttonsInner);
  applyCountLayout(elements.length, wrapperContainer, inputWrapper, buttonsInner, submitButton);
  scrollInner.appendChild(wrapperContainer);

  if (config.privacyDisclaimer && !config.isPersonalizer) {
    const disclaimer = document.createElement('div');
    disclaimer.className = 'privacy-disclaimer';
    disclaimer.style.fontSize = '40%';
    disclaimer.textContent = config.privacyDisclaimer;
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

  scrollable.appendChild(scrollInner);
  inner.appendChild(scrollable);
  form.appendChild(inner);

  if (config.enableSkipButton) {
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'skip-button';
    skip.textContent = 'Skip';
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
    fontFamily: config.fontFamily ? `"${config.fontFamily}"` : '',
  });
  if (config.backgroundImage) form.style.backgroundSize = 'cover';
  form.querySelectorAll('button, input, textarea').forEach((el) => {
    el.style.fontSize = `${Number(config.fontSize) || 60}%`;
    if (config.fontFamily) el.style.fontFamily = `"${config.fontFamily}"`;
  });
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
  const pos = ['bottom-right', 'bottom-left', 'top-right', 'top-left'].includes(config.hintPosition) ? config.hintPosition : 'bottom-right';
  const overlay = document.createElement('div');
  overlay.className = `overlay-arrow on hint-pos-${pos}${design.animated ? ' pointer-animated' : ''}`;
  overlay.dataset.pointer = design.id;
  const color = safeColor(config.pointerColor);
  overlay.style.setProperty('--arrow-scale', String((Number(config.pointerSize) || 100) / 100));
  const svg = pointerSvg(design.id, color);
  const bubbleBg = hexToRgba(safeColor(config.hintBackground, '#17171c'), 0.9) || '#17171c';
  overlay.innerHTML = `
    ${svg ? `<svg class="arrow-image" width="129" height="72" viewBox="0 0 129 72" fill="none" aria-hidden="true">${svg}</svg>` : ''}
    <div class="container-hint">
      <h3 class="title-hint">${esc(config.popupHeaderText)}</h3>
      <p class="container-fill-out"><span class="fill-out">${esc(config.popupFillOutText)}</span>${(config.elements || []).map((e) => `<span class="element-field">${esc(e.label)}</span>`).join('')}</p>
      <p class="try-now-hint">${esc(config.popupClickText)} <span class="btn-form-name">${esc(config.btnText ?? 'Play')}</span></p>
      <p class="experience-hint">${esc(config.popupDescriptionText)}</p>
    </div>`;
  const bubble = overlay.querySelector('.container-hint');
  bubble.style.background = bubbleBg;
  bubble.style.borderColor = safeColor(config.hintBorderColor, '#575773');
  bubble.style.color = safeColor(config.hintTextColor, '#ffffff');
  bubble.style.borderRadius = `${Math.max(0, Number(config.hintRadius ?? 12))}px`;
  return overlay;
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
 * Show the opt-in form (List Builder / Personalizer / Lead Generator) over
 * the video — the one renderer for all three.
 * onSubmit(data) resolves to a status message (or throws); onSkip() fires
 * from the Skip button. The pointer hides after `hintDuration` seconds
 * (default 5, as upstream; 0 = stays until clicked) or on click.
 * Options: prefill, preview (editor: see-through backdrop).
 */
export function showOptinOverlay(layer, config, { onSubmit, onSkip, prefill = {}, preview = false, name = 'list-builder' } = {}) {
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
    const seconds = Number(config.hintDuration ?? 5);
    if (seconds > 0) hintTimer = setTimeout(hideHint, seconds * 1000);
  }

  form.querySelector('.skip-button')?.addEventListener('click', () => {
    clearTimeout(hintTimer);
    wrap.remove();
    onSkip?.();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = form.querySelector('.addon-optin__status');
    // Whitespace-only answers don't count for required fields.
    const blank = Array.from(form.elements).find((el) => el.required && !String(el.value || '').trim());
    if (blank) {
      status.textContent = 'Please complete all fields.';
      blank.focus?.({ preventScroll: true });
      return;
    }
    const data = Object.fromEntries(new FormData(form).entries());
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const message = await onSubmit?.(data);
      status.textContent = message || '';
      clearTimeout(hintTimer);
      wrap.remove();
    } catch (err) {
      btn.disabled = false;
      status.textContent = err?.message || 'Something went wrong — try again.';
    }
  });
  layer.appendChild(wrap);
  return wrap;
}

/** Back-compat name for the project-level List Builder / Personalizer. */
export const showListBuilderOverlay = showOptinOverlay;
