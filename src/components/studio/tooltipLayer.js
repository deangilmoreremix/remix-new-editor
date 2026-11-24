// One delegated, portaled hover-help layer for every studio. It watches pointer hover and keyboard focus, finds the control's label
// (data-help, data-tooltip, title, aria-label, short button text), looks it up in lib/help/studioHelp.js and shows a themed card:
// name + one-line summary first, then the longer text after a pause. Controls with only a title / data-tooltip (no entry) still get
// the same themed card, so the old unstyled bubbles are replaced without touching those studios.
// Theming: the card reads --tip-* from CSS. A studio root can opt into a palette with data-studio-theme="<key>" (see STUDIO_COLOR_SCHEMES).
// The Timeline Editor (.cinegen-root) has its own help layer and is skipped here.

import { resolveStudioHelp, idLabels, studioEntry } from '../../lib/help/studioHelp.js';
import { getStudioTipAccent } from '../../lib/config/openaiConfig.js';

const SHOW_DELAY_MS = 350;
const EXPAND_DELAY_MS = 900;
const HIDE_DELAY_MS = 120;
const CARD_ID = 'studio-tip-card';
const SKIP = '.cinegen-root, .help-tip, .studio-tip';

let mounted = false;

/** The short caption beside a form field ("Duration", "Resolution"), for selects and inputs that carry no label of their own. */
function fieldLabel(el) {
  if (!(el instanceof window.HTMLSelectElement || el instanceof HTMLInputElement || el instanceof window.HTMLTextAreaElement)) return '';
  const own = (n) => (n?.textContent || '').trim().replace(/\s+/g, ' ');
  const wrap = el.closest('label');
  const span = wrap?.querySelector(':scope > span, :scope > div');
  const first = el instanceof window.HTMLSelectElement ? (el.options[0]?.text || '').trim() : '';
  return [own(span), own(el.previousElementSibling), own(wrap), first].find((c) => c && c.length <= 28) || '';
}

/** Find the control under the pointer and the text it is known by. */
export function findHelp(start) {
  let el = start instanceof HTMLElement ? start : start && start.parentElement;
  let firstPlain = null; // a control's own title is only used when no ancestor has written copy
  for (let i = 0; el && i < 6; i++, el = el.parentElement) {
    if (el.closest(SKIP)) return null;
    // Sidebar items and Apps hub cards carry their route id: show that studio's own description.
    const studio = el.dataset.sidebarItem || el.dataset.studio ? studioEntry(el.dataset.sidebarItem || el.dataset.studio) : null;
    if (studio) return { el, entry: studio };
    // Copy supplied by the studio at render time: data-help-text is the sentence, data-help-name an optional heading.
    if (el.dataset.helpText) {
      const name = el.dataset.helpName || el.getAttribute('aria-label') || el.getAttribute('placeholder') || fieldLabel(el) || el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40);
      return { el, entry: { name: name || 'Info', summary: el.dataset.helpText } };
    }
    const plain = el.dataset.tooltip || el.dataset.helpTitle || el.getAttribute('title') || '';
    const text = (el.tagName === 'BUTTON' || el.tagName === 'SUMMARY' || el.getAttribute('role') === 'button')
      ? (el.textContent || '').trim().replace(/\s+/g, ' ') : '';
    // Try every label the control carries against the copy before settling for plain text: a long tooltip sentence
    // ("Show advanced options") must not shadow the visible name ("Advanced") that has an entry.
    const placeholder = el.getAttribute('placeholder');
    const candidates = [el.dataset.help, text, el.getAttribute('aria-label'), ...idLabels(el.id), placeholder, fieldLabel(el),
      el.dataset.helpTitle, el.getAttribute('title'), el.dataset.tooltip];
    for (const c of candidates) {
      const entry = c && c.length <= (c === placeholder ? 240 : 80) ? resolveStudioHelp(c) : null;
      if (entry) return { el, entry };
    }
    // No copy yet: still theme the control's own title / data-tooltip text.
    if (plain && plain.length <= 160 && !firstPlain) firstPlain = { el, entry: { name: plain } };
  }
  return firstPlain;
}

/** Card position: beside small icon controls, otherwise below, then above, clamped to the viewport. */
export function place(rect, w, h, vw = window.innerWidth, vh = window.innerHeight) {
  const pad = 10;
  const clampTop = (t) => Math.max(pad, Math.min(t, vh - h - pad));
  const clampLeft = (l) => Math.max(pad, Math.min(l, vw - w - pad));
  if (rect.width <= 64 && rect.right + pad + w <= vw) return { left: rect.right + pad, top: clampTop(rect.top + rect.height / 2 - 24) };
  if (rect.bottom + pad + h <= vh) return { left: clampLeft(rect.left + rect.width / 2 - w / 2), top: rect.bottom + pad };
  if (rect.top - pad - h >= 0) return { left: clampLeft(rect.left + rect.width / 2 - w / 2), top: rect.top - pad - h };
  if (rect.right + pad + w <= vw) return { left: rect.right + pad, top: clampTop(rect.top) };
  return { left: clampLeft(rect.left - pad - w), top: clampTop(rect.top) };
}

function buildCard(entry) {
  const card = document.createElement('div');
  card.id = CARD_ID;
  // A card with no written summary is just a studio's own title / data-tooltip text: it keeps the light text color, not the accent title.
  card.className = entry.summary ? 'studio-tip' : 'studio-tip studio-tip--plain';
  card.setAttribute('role', 'tooltip');
  const head = document.createElement('div');
  head.className = 'studio-tip__head';
  const name = document.createElement('strong');
  name.className = 'studio-tip__name';
  name.textContent = entry.name;
  head.appendChild(name);
  if (entry.shortcut) {
    const key = document.createElement('kbd');
    key.className = 'studio-tip__key';
    key.textContent = entry.shortcut;
    head.appendChild(key);
  }
  card.appendChild(head);
  if (entry.summary) {
    const p = document.createElement('p');
    p.className = 'studio-tip__summary';
    p.textContent = entry.summary;
    card.appendChild(p);
  }
  return card;
}

function applyTheme(card, el) {
  const root = el.closest('[data-studio-theme]');
  if (!root) return;
  card.style.setProperty('--tip-accent', getStudioTipAccent(root.dataset.studioTheme));
}

export function mountStudioTooltips() {
  if (mounted || typeof document === 'undefined') return () => {};
  mounted = true;
  document.documentElement.setAttribute('data-tip-layer', 'on'); // lets CSS retire the old [data-tooltip] bubbles

  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  let card = null;
  let target = null; // { el, title }
  const timers = {};

  const clearTimers = () => { clearTimeout(timers.show); clearTimeout(timers.expand); clearTimeout(timers.hide); };
  const restore = () => {
    if (!target) return;
    const { el, title } = target;
    if (title != null && !el.getAttribute('title')) el.setAttribute('title', title);
    el.removeAttribute('aria-describedby');
    delete el.dataset.helpTitle;
    target = null;
  };
  const hide = () => {
    clearTimers();
    restore();
    card?.remove();
    card = null;
  };

  const open = (el, entry) => {
    if (target?.el === el) return;
    clearTimers();
    restore();
    card?.remove();
    card = null;
    const title = el.getAttribute('title');
    if (title != null) { el.dataset.helpTitle = title; el.removeAttribute('title'); } // no second, native bubble
    target = { el, title };
    timers.show = setTimeout(() => {
      if (target?.el !== el) return;
      card = buildCard(entry);
      applyTheme(card, el);
      card.style.left = '-9999px';
      card.style.top = '-9999px';
      document.body.appendChild(card);
      const r = card.getBoundingClientRect();
      const pos = place(el.getBoundingClientRect(), r.width, r.height);
      card.style.left = `${pos.left}px`;
      card.style.top = `${pos.top}px`;
      el.setAttribute('aria-describedby', CARD_ID);
      if (entry.what) {
        timers.expand = setTimeout(() => {
          if (!card || target?.el !== el) return;
          const more = document.createElement('p');
          more.className = 'studio-tip__what';
          more.textContent = entry.what;
          card.appendChild(more);
          const rr = card.getBoundingClientRect();
          const p2 = place(el.getBoundingClientRect(), rr.width, rr.height);
          card.style.left = `${p2.left}px`;
          card.style.top = `${p2.top}px`;
        }, EXPAND_DELAY_MS - SHOW_DELAY_MS);
      }
    }, SHOW_DELAY_MS);
  };

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch' || coarse) return;
    const hit = findHelp(e.target);
    if (hit) { clearTimeout(timers.hide); open(hit.el, hit.entry); }
  }, true);
  document.addEventListener('pointerout', (e) => {
    const to = e.relatedTarget;
    if (to && target?.el.contains(to)) return;
    clearTimeout(timers.hide);
    timers.hide = setTimeout(hide, HIDE_DELAY_MS);
  }, true);
  document.addEventListener('focusin', (e) => {
    const hit = findHelp(e.target);
    if (hit && e.target.matches?.(':focus-visible')) open(hit.el, hit.entry);
  }, true);
  document.addEventListener('focusout', hide, true);
  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); }, true);
  window.addEventListener('scroll', hide, true);
  window.addEventListener('blur', hide);

  return hide;
}
