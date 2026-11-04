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

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Upstream retarget arrow hint path (popcorn.retarget.js _setup).
const ARROW_PATH = 'M68.7705 61.9585C53.6729 59.1867 41.6596 54.1241 38.166 48.8973C35.213 44.4916 34.8473 38.2327 37.1133 31.2063C31.303 29.1839 25.7175 26.491 21.0438 23.5385C17.1984 21.1142 14.4246 18.6122 12.4284 16.4156L13.8427 21.5047C14.0613 22.3073 13.5957 23.1267 12.8029 23.3472C12.0002 23.5658 11.1808 23.1002 10.9505 22.3056L7.44816 9.70597C7.40279 9.56547 7.37889 9.41874 7.37647 9.26579C7.37666 9.15398 7.39472 9.05563 7.41278 8.95727C7.47137 8.69352 7.5952 8.46207 7.76279 8.26916C7.8515 8.17361 7.94824 8.0897 8.06466 8.00941C8.34225 7.82653 8.69391 7.73858 9.0516 7.78392C9.0516 7.78392 9.0516 7.78392 9.06144 7.78573C9.06144 7.78573 9.08111 7.78934 9.09094 7.79114L23.0426 9.66127C23.8662 9.77181 24.4391 10.5277 24.3286 11.3513C24.218 12.1748 23.4621 12.7478 22.6386 12.6372L12.0617 11.2139C13.8588 13.7196 16.9972 17.4476 22.6376 21.0046C27.0754 23.802 32.5045 26.4052 38.1531 28.3674C41.5023 20.2589 47.5757 13.3725 53.1296 11.586C59.2355 9.22987 67.6878 9.76499 73.5883 12.9021C76.7571 14.5819 78.7336 16.7749 79.3 19.2275C80.5127 24.4727 75.5281 29.6375 65.2843 33.7655C65.2413 33.778 65.1984 33.7904 65.1536 33.8127C58.1439 35.9419 48.9206 34.8992 39.9605 32.1459C38.7213 36.0158 37.466 42.4651 40.6581 47.2299C47.432 57.3495 96.567 67.9973 119.951 54.9861C120.676 54.5803 121.593 54.8503 121.99 55.5638C122.396 56.289 122.138 57.1973 121.412 57.603C110.451 63.7038 92.9863 65.5708 73.4882 62.7332C71.884 62.4997 70.3147 62.2421 68.7705 61.9585ZM41.01 29.3088C49.3587 31.8482 57.8952 32.8664 64.2221 30.9677C72.6454 27.5628 77.1756 23.433 76.3687 19.9093C76.0145 18.3497 74.519 16.8043 72.175 15.5606C67.9223 13.3055 60.4579 11.9859 54.1238 14.4222C49.4013 15.9444 44.0348 22.1371 41.01 29.3088Z';

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

function buildInput(declaration, prefill) {
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
  input.style.borderRadius = `${INPUT_BORDER_RADIUS}px`;
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

/**
 * Build the upstream-style opt-in form element (not attached).
 * `prefill` maps field tokens to values (personalization).
 */
export function buildOptinForm(config, { prefill = {}, compact = false } = {}) {
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
  elements.forEach((d) => inputWrapper.appendChild(buildInput(d, prefill)));
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

/** Upstream red-arrow hint: header, "Fill out your <fields>", "Click <btn>", description. */
export function buildArrowHint(config) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay-arrow on';
  overlay.innerHTML = `
    <svg class="arrow-image" width="129" height="72" viewBox="0 0 129 72" fill="none" aria-hidden="true"><path d="${ARROW_PATH}" fill="#EB5054"/></svg>
    <div class="container-hint">
      <h3 class="title-hint">${esc(config.popupHeaderText)}</h3>
      <p class="container-fill-out"><span class="fill-out">${esc(config.popupFillOutText)}</span>${(config.elements || []).map((e) => `<span class="element-field">${esc(e.label)}</span>`).join('')}</p>
      <p class="try-now-hint">${esc(config.popupClickText)} <span class="btn-form-name">${esc(config.btnText ?? 'Play')}</span></p>
      <p class="experience-hint">${esc(config.popupDescriptionText)}</p>
    </div>`;
  return overlay;
}

/**
 * Show the List Builder / Personalizer over the video.
 * onSubmit(data) resolves to a status message (or throws); onSkip() fires
 * from the Skip button. The arrow hint hides after 5s or on click, as upstream.
 */
export function showListBuilderOverlay(layer, config, { onSubmit, onSkip, prefill = {} } = {}) {
  clearOverlay(layer, 'list-builder');
  const wrap = document.createElement('div');
  wrap.className = 'addon-overlay addon-overlay--optin';
  wrap.dataset.overlay = 'list-builder';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-label', config.caption || 'Sign up');
  const compact = (layer.clientWidth || 1000) < 480;
  const form = buildOptinForm(config, { prefill, compact });
  wrap.appendChild(form);

  const hint = buildArrowHint(config);
  wrap.appendChild(hint);
  const hideHint = (e) => {
    e?.stopPropagation?.();
    hint.classList.remove('on');
    hint.classList.add('off');
  };
  hint.addEventListener('click', hideHint, { once: true });
  const hintTimer = setTimeout(hideHint, 5000);

  form.querySelector('.skip-button')?.addEventListener('click', () => {
    clearTimeout(hintTimer);
    wrap.remove();
    onSkip?.();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const btn = form.querySelector('button[type="submit"]');
    const status = form.querySelector('.addon-optin__status');
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
