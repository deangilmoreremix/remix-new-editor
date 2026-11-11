/**
 * Interactive overlays for the published player (/watch/<id>): the Lead
 * Generator form, CTA buttons and clickable overlay links. Plain DOM, no
 * editor state. The form mirrors the editor's preview of the Lead Generator
 * (TimelineEditorPage.jsx) so a published video looks like its preview.
 */
import { leadFieldTokens } from '../addons/leadClient.js';
import { formBackground, ensureFormFont } from '../addons/addonOverlay.js';
import { resolveOverlayText } from '../addons/overlayRender.js';
import { getAddon, addonOptions } from '../addons/registry.js';
import { ctaTarget } from '../addons/ctaLink.js';
import { ctaBox } from '../addons/ctaLottie.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Personalized text with unresolved {{tokens}} removed (a viewer never sees raw tokens). */
export const personalize = (text, profile) => resolveOverlayText(text || '', profile).replace(/\{\{[^}]*\}\}/g, '').replace(/\s{2,}/g, ' ').trim();

export const isValidPhoneNumber = (v) => !!v && /^(\+[0-9\s]*-?)?(\([0-9\s]*\))?[0-9-.\s]{10,14}$/.test(String(v).trim());
export function isSafeLink(v) {
  try {
    const u = new URL(String(v || '').trim());
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

const inputType = (type) => ({ phone: 'tel', email: 'email', number: 'number', date: 'date' }[type] || 'text');

/**
 * Lead Generator form over the video.
 * @param {HTMLElement} layer
 * @param {object} clip      lead-form clip (flat options)
 * @param {object} o         { profile, onSubmit(data) → Promise<{ ok, message? }>, onSkip() }
 * @returns {HTMLElement}
 */
export function showLeadForm(layer, clip, { profile, onSubmit, onSkip } = {}) {
  layer.querySelector('.wf-card')?.remove();
  const fields = Array.isArray(clip.fields) && clip.fields.length ? clip.fields.slice(0, 5) : [{ id: 'email', type: 'email', label: 'Email' }];
  const tokens = leadFieldTokens(fields);
  const style = clip.style || {};
  const vars = profile?.variables || {};
  const card = document.createElement('div');
  card.className = `wf-card wf-card--fields-${fields.length}`;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'false');
  card.setAttribute('aria-label', personalize(clip.heading, profile) || 'Form');
  const btnStyle = [
    style.buttonColor && `background:${esc(style.buttonColor)}`,
    style.buttonFontColor && `color:${esc(style.buttonFontColor)}`,
    style.buttonBorderRadius !== undefined && `border-radius:${Number(style.buttonBorderRadius) || 0}px`,
  ].filter(Boolean).join(';');
  // Upstream popcorn.form.js sizing: caption and body text are a % of the base size (76 / 60), text colour, and an inner box
  // (width / height %, colour at opacity %) behind the content.
  const pct = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
  const captionScale = pct(style.captionFontSize, 76) / 76;
  const bodyScale = pct(style.fontSize, 60) / 60;
  const hexToRgb = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '')); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const inner = hexToRgb(style.innerColor);
  const innerBg = inner ? `rgba(${inner[0]},${inner[1]},${inner[2]},${Math.min(100, Math.max(0, Number(style.innerOpacity) || 0)) / 100})` : 'transparent';
  card.innerHTML = `
    <form class="wf-form" novalidate style="font-size:${(13 * bodyScale).toFixed(2)}px;width:${pct(style.innerWidth, 90)}%;min-height:${pct(style.innerHeight, 90) < 90 ? pct(style.innerHeight, 90) : 0}%;background:${innerBg};border-radius:10px;padding:6px 8px;box-sizing:border-box;margin:0 auto">
      ${isSafeLink(clip.brandLogoUrl) ? `<img class="wf-logo" src="${esc(clip.brandLogoUrl)}" alt=""/>` : ''}
      ${clip.heading ? `<h2 class="wf-heading" style="text-align:${esc(style.captionAlignment || 'center')};font-size:calc(clamp(16px, 2.4vw, 22px) * ${captionScale.toFixed(3)})">${esc(personalize(clip.heading, profile))}</h2>` : ''}
      <div class="wf-fields">
        ${fields.map((f, i) => {
          const name = esc(tokens[i]);
          const pre = vars[f.id] ?? vars[String(f.label || '').toLowerCase()] ?? '';
          const req = f.required ? ' required' : '';
          const id = `wf-${esc(clip.id)}-${i}`;
          const input = f.type === 'multiline'
            ? `<textarea id="${id}" name="${name}" rows="3" maxlength="250"${req}>${esc(pre)}</textarea>`
            : `<input id="${id}" type="${inputType(f.type)}" name="${name}" value="${esc(pre)}"${f.type === 'email' || f.type === 'date' ? '' : ' maxlength="80"'}${req}/>`;
          return `<div class="wf-field"><label for="${id}">${esc(f.label || f.type)}</label>${input}</div>`;
        }).join('')}
      </div>
      ${clip.privacyText ? `<p class="wf-privacy">${esc(personalize(clip.privacyText, profile))}</p>` : ''}
      ${clip.privacyPolicyCaption && isSafeLink(clip.privacyPolicyLink) ? `<a class="wf-privacy-link" href="${esc(clip.privacyPolicyLink)}" target="_blank" rel="noopener noreferrer">${esc(clip.privacyPolicyCaption)}</a>` : ''}
      <p class="wf-status" role="status" aria-live="polite"></p>
      <div class="wf-actions">
        <button type="submit" class="wf-submit" style="${btnStyle}">${esc(personalize(clip.ctaText, profile) || 'Submit')}</button>
        ${clip.skipButtonEnabled ? '<button type="button" class="wf-skip">Skip</button>' : ''}
      </div>
    </form>`;
  if (isSafeLink(style.backgroundImage)) card.style.backgroundImage = `url("${style.backgroundImage}")`;
  else if (style.backgroundColor) card.style.background = formBackground({ backgroundColor: style.backgroundColor });
  if (style.fontColor) card.style.color = style.fontColor;
  if (style.fontFamily) {
    ensureFormFont(style.fontFamily);
    card.style.fontFamily = `"${style.fontFamily}", system-ui, sans-serif`;
  }
  if (style.widthPercent) card.style.width = `${Number(style.widthPercent)}%`;
  card.style.alignSelf = style.position === 'top' ? 'flex-start' : style.position === 'bottom' ? 'flex-end' : 'center';
  layer.appendChild(card);

  const form = card.querySelector('form');
  const status = card.querySelector('.wf-status');
  form.addEventListener('input', (e) => {
    if (e.target.type === 'number') e.target.value = e.target.value.replace(/[^0-9]/g, '');
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity?.();
      return;
    }
    const data = Object.fromEntries(new FormData(form).entries());
    if (!Object.values(data).some((v) => String(v).trim())) {
      status.textContent = 'Please fill in the form.';
      return;
    }
    const btn = form.querySelector('.wf-submit');
    btn.disabled = true;
    status.textContent = 'Sending…';
    const res = await onSubmit?.(data);
    if (res && res.ok === false) {
      btn.disabled = false;
      status.textContent = res.message || 'Something went wrong — please try again.';
      return;
    }
    card.remove();
  });
  card.querySelector('.wf-skip')?.addEventListener('click', () => { card.remove(); onSkip?.(); });
  setTimeout(() => card.querySelector('input, textarea')?.focus({ preventScroll: true }), 50);
  return card;
}

/**
 * CTA button (click-to-call clip). The video already draws the button
 * (animated or plain), so this is a transparent, accessible tap target over
 * it: a tel: or https link.
 */
export function ctaElement(clip, { onCall, frameAspect = 16 / 9 } = {}) {
  const style = clip.style || {};
  const phone = isValidPhoneNumber(clip.phoneNumber);
  const link = !phone && isSafeLink(clip.linkUrl);
  if (!phone && !link) return null;
  const a = document.createElement('a');
  a.className = 'wf-cta';
  a.href = phone ? `tel:${String(clip.phoneNumber).replace(/[^0-9+]/g, '')}` : String(clip.linkUrl).trim();
  if (link) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } else {
    a.addEventListener('click', () => onCall?.({ clip, phone: String(clip.phoneNumber).replace(/[^0-9+]/g, ''), notify: clip.callNotifyAddress || '' }));
  }
  a.setAttribute('aria-label', `${clip.buttonText || 'Call Now'}${phone ? ` — call ${clip.phoneNumber}` : ''}`);
  const box = ctaBox(style, frameAspect);
  Object.assign(a.style, { left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` });
  a.dataset.clipId = String(clip.id);
  return a;
}

/** Invisible clickable box over an overlay that has a link or click-to-call number. */
export function linkBoxElement(clip, { onCall } = {}) {
  if (!getAddon(clip.type) || getAddon(clip.type).category !== 'overlay') return null;
  const o = addonOptions(clip);
  const target = ctaTarget(o);
  if (!target) return null;
  const g = o.fill ? { left: 0, top: 0, width: 100, height: 100 } : { left: 0, top: 0, width: 100, height: 100, ...(o.geometry || {}) };
  const a = document.createElement('a');
  a.className = 'wf-linkbox';
  a.href = target.href;
  if (target.kind === 'url') {
    a.target = o.linkTarget === '_parent' ? '_top' : '_blank';
    a.rel = 'noopener noreferrer';
  } else {
    // Click-to-call: let the phone app open, and tell the owner about the attempt.
    a.addEventListener('click', () => onCall?.({ clip, phone: target.phone, notify: o.callNotifyAddress || '' }));
  }
  const label = o.text ? String(o.text).slice(0, 60) : '';
  a.setAttribute('aria-label', target.kind === 'phone' ? `Call ${target.phone}${label ? ` — ${label}` : ''}` : (label ? `Open link: ${label}` : 'Open link'));
  Object.assign(a.style, { left: `${g.left}%`, top: `${g.top}%`, width: `${g.width}%`, height: `${g.height}%` });
  a.dataset.clipId = String(clip.id);
  return a;
}
