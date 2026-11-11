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
