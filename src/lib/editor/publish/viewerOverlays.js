/**
 * Interactive overlays for the published player (/watch/<id>): the Lead
 * Generator form, CTA buttons and clickable overlay links. Plain DOM, no
 * editor state. The form mirrors the editor's preview of the Lead Generator
 * (TimelineEditorPage.jsx) so a published video looks like its preview.
 */
import { showOptinOverlay } from '../addons/addonOverlay.js';
import { leadFormToOptin } from '../addons/listBuilder.js';
import { resolveOverlayText } from '../addons/overlayRender.js';
import { getAddon, addonOptions } from '../addons/registry.js';
import { ctaTarget } from '../addons/ctaLink.js';
import { ctaBox } from '../addons/ctaLottie.js';


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

/**
 * Lead Generator form over the video — the SAME renderer as the List Builder
 * (addons/addonOverlay.js showOptinOverlay), so a published video looks like
 * its editor preview. {{tokens}} in the visible text are personalized.
 * @param {HTMLElement} layer
 * @param {object} clip      lead-form clip (stored shape; adapted by leadFormToOptin)
 * @param {object} o         { profile, onSubmit(data) → Promise<{ ok, message? }>, onSkip() }
 * @returns {HTMLElement}
 */
export function showLeadForm(layer, clip, { profile, onSubmit, onSkip, onEditText, preview = false, allowRedirect = false } = {}) {
  const cfg = leadFormToOptin(clip);
  cfg.caption = personalize(cfg.caption, profile);
  cfg.btnText = personalize(cfg.btnText, profile) || 'Submit';
  cfg.privacyDisclaimer = personalize(cfg.privacyDisclaimer, profile);
  if (!isSafeLink(cfg.brandLogoSrc)) cfg.brandLogoSrc = '';
  if (!isSafeLink(cfg.backgroundImage)) cfg.backgroundImage = '';
  const vars = profile?.variables || {};
  const prefill = {};
  cfg.elements.forEach((el) => {
    const pre = vars[el.id] ?? vars[String(el.label || '').toLowerCase()];
    if (pre) prefill[el.token] = String(pre);
  });
  const wrap = showOptinOverlay(layer, cfg, {
    name: 'lead-form',
    prefill,
    preview,
    allowRedirect,
    onEditText,
    onSkip,
    onSubmit: async (data) => {
      if (!Object.values(data).some((v) => String(v).trim())) throw new Error('Please fill in the form.');
      const res = await onSubmit?.(data);
      if (res && res.ok === false) throw new Error(res.message || 'Something went wrong — please try again.');
      return '';
    },
  });
  setTimeout(() => wrap.querySelector('input, textarea')?.focus({ preventScroll: true }), 50);
  return wrap;
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
