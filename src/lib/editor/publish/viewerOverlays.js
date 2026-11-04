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
  card.innerHTML = `
    <form class="wf-form" novalidate>
      ${isSafeLink(clip.brandLogoUrl) ? `<img class="wf-logo" src="${esc(clip.brandLogoUrl)}" alt=""/>` : ''}
      ${clip.heading ? `<h2 class="wf-heading" style="text-align:${esc(style.captionAlignment || 'center')}">${esc(personalize(clip.heading, profile))}</h2>` : ''}
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

/** CTA button (click-to-call clip): a real tel: or https link at its position. */
export function ctaElement(clip) {
  const style = clip.style || {};
  const phone = isValidPhoneNumber(clip.phoneNumber);
  const link = !phone && isSafeLink(clip.linkUrl);
  if (!phone && !link) return null;
  const a = document.createElement('a');
  a.className = 'wf-cta';
  a.href = phone ? `tel:${String(clip.phoneNumber).replace(/[^0-9+]/g, '')}` : String(clip.linkUrl).trim();
  if (link) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  a.textContent = `${link ? '🔗' : '📞'} ${clip.buttonText || 'Call Now'}`;
  if (style.buttonColor) a.style.background = style.buttonColor;
  Object.assign(a.style, {
    left: `${style.posLeft ?? 50}%`, top: `${style.posTop ?? 50}%`, width: `${style.posWidth ?? 40}%`,
    opacity: String((style.opacity ?? 100) / 100),
  });
  a.dataset.clipId = String(clip.id);
  return a;
}

/** Invisible clickable box over an overlay that has a link (Smart Text / Image). */
export function linkBoxElement(clip) {
  if (!getAddon(clip.type) || getAddon(clip.type).category !== 'overlay') return null;
  const o = addonOptions(clip);
  if (!isSafeLink(o.linkUrl)) return null;
  const g = o.fill ? { left: 0, top: 0, width: 100, height: 100 } : { left: 0, top: 0, width: 100, height: 100, ...(o.geometry || {}) };
  const a = document.createElement('a');
  a.className = 'wf-linkbox';
  a.href = String(o.linkUrl).trim();
  a.target = o.linkTarget === '_self' ? '_top' : '_blank';
  a.rel = 'noopener noreferrer';
  a.setAttribute('aria-label', o.text ? `Open link: ${String(o.text).slice(0, 60)}` : 'Open link');
  Object.assign(a.style, { left: `${g.left}%`, top: `${g.top}%`, width: `${g.width}%`, height: `${g.height}%` });
  a.dataset.clipId = String(clip.id);
  return a;
}
