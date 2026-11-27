// src/components/landing/TemplateChooser.js
//
// The landing page chooser from Video Pages ("New video page"): picture cards of the landing page
// designs, grouped: a live picture of each editable design's real page, a real preview picture for the older layouts (a tinted wireframe stands in if it cannot load). Used inline by
// Video Pages and as a modal by Video Outreach (the page each prospect lands on).

import { wireframeSvg } from '../../lib/landingPages/wireframes.js';
import { attachDesignPreview } from '../../lib/landingPages/designPreview.js';

const el = (tag, cls = '', text = '') => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
};

/**
 * Grouped template cards. `groups` is [[label, items]], an item a template (or any
 * { id, name, description, theme?, layout? }). Clicking a card selects it and calls onPick(id).
 * An item with `editorData` gets a live preview of the real page. Returns { node, select(id), destroy() }.
 */
export function templateCards({ groups = [], selected = '', onPick = () => {}, deps = {}, preview = null } = {}) {
  const node = el('div', 'flex flex-col gap-4');
  const cards = new Map();
  const previews = [];
  let current = selected;
  const paint = () => cards.forEach((c, id) => {
    const on = id === current;
    c.classList.toggle('border-primary', on);
    c.classList.toggle('ring-2', on);
    c.classList.toggle('ring-primary', on);
    c.setAttribute('aria-pressed', String(on));
  });
  for (const [label, list] of groups) {
    if (!list?.length) continue;
    const grp = el('div', 'flex flex-col gap-2');
    grp.appendChild(el('div', 'text-xs font-bold text-secondary', label));
    const row = el('div', 'grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4');
    for (const t of list) {
      const b = el('button', 'text-left rounded-2xl border border-white/10 bg-panel-bg overflow-hidden hover:border-primary/60 transition-colors');
      b.type = 'button';
      b.title = t.description || '';
      b.setAttribute('data-template-card', t.id);
      let sw;
      if (t.editorData) {
        // Editable landing pages: a live, scaled picture of the real page (drawn when it scrolls into view).
        sw = el('div');
        sw.style.margin = '8px 8px 0';
        sw.setAttribute('aria-label', `Preview of ${t.name}`);
        previews.push(attachDesignPreview(sw, t.editorData, { deps, ...(preview || {}) }));
      } else if (t.id) {
        // Every other design: a real picture of it (public/landing-previews, made by scripts/generate-landing-design-previews.mjs).
        // If it cannot load, the page's SHAPE (a wireframe) tinted with its colours stands in, so a card is never blank.
        sw = el('div', 'overflow-hidden flex items-center justify-center');
        sw.style.aspectRatio = '8 / 5';
        sw.style.background = t.theme?.bg || '#111';
        sw.style.color = t.theme?.accent || '#d9ff00';
        const shot = el('img', 'w-full h-full object-cover');
        shot.alt = '';
        shot.loading = 'lazy';
        shot.dataset.designPreview = t.id;
        shot.addEventListener('error', () => { sw.classList.add('p-2'); sw.innerHTML = wireframeSvg(t.layout); }, { once: true });
        shot.src = `/landing-previews/${encodeURIComponent(t.id)}.jpg`;
        sw.appendChild(shot);
      } else {
        // The plain video page (no design): its SHAPE (a wireframe), so layouts are told apart by structure.
        sw = el('div', 'h-20 p-2 flex items-center justify-center');
        sw.style.background = t.theme?.bg || '#111';
        sw.style.color = t.theme?.accent || '#d9ff00';
        sw.innerHTML = wireframeSvg(t.layout);
      }
      const cap = el('div', 'p-2');
      cap.append(el('div', 'text-xs font-bold truncate', t.name), el('div', 'text-[11px] text-secondary line-clamp-2', t.description || ''));
      b.append(sw, cap);
      b.addEventListener('click', () => { current = t.id; paint(); onPick(t.id); });
      cards.set(t.id, b);
      row.appendChild(b);
    }
    grp.appendChild(row);
    node.appendChild(grp);
  }
  paint();
  return { node, select(id) { current = id; paint(); }, destroy() { previews.splice(0).forEach((h) => h.destroy()); } };
}

/**
 * The chooser as a modal: pick a card, then "Use this page" calls onPick(id). Esc, the close
 * button or a click outside closes it without picking. Returns { close }.
 */
export function openTemplateChooser({ title = 'Choose a landing page', subtitle = '', groups = [], selected = '', onPick = () => {}, confirmLabel = 'Use this page', deps = {}, preview = null } = {}) {
  const opener = document.activeElement;
  let pick = selected;
  const overlay = el('div', 'fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4');
  overlay.setAttribute('data-template-chooser', '');
  const box = el('div', 'flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0b0c10] text-white shadow-2xl');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', title);
  const head = el('div', 'flex items-start justify-between gap-3 px-6 pb-3 pt-5');
  const words = el('div', 'flex flex-col gap-1');
  words.appendChild(el('h2', 'text-lg font-extrabold', title));
  if (subtitle) words.appendChild(el('p', 'text-xs text-secondary', subtitle));
  const x = el('button', 'rounded-lg px-2 py-1 text-xl leading-none text-white/70 hover:text-white', '×');
  x.type = 'button'; x.setAttribute('aria-label', 'Close');
  head.append(words, x);
  const body = el('div', 'overflow-y-auto px-6 py-3');
  const foot = el('div', 'flex items-center justify-end gap-2 border-t border-white/10 px-6 py-4');
  const cancel = el('button', 'rounded-full border border-white/[0.08] bg-transparent px-4 py-2 text-sm font-bold text-white/70 hover:bg-white/[0.06] hover:text-white', 'Cancel');
  cancel.type = 'button';
  // Outlined with a lime left edge, like Generate in the studios' prompt bar (never filled).
  const ok = el('button', 'rounded-full border border-white/[0.12] border-l-2 border-l-primary bg-transparent px-5 py-2 text-sm font-bold text-white/90 hover:bg-white/[0.06] hover:text-white disabled:opacity-40', confirmLabel);
  ok.type = 'button'; ok.setAttribute('data-template-confirm', '');
  ok.disabled = !groups.some(([, l]) => l?.some((t) => t.id === pick));
  const cards = templateCards({ groups, selected, deps, preview, onPick: (id) => { pick = id; ok.disabled = false; } });
  body.appendChild(cards.node);
  foot.append(cancel, ok);
  box.append(head, body, foot);
  overlay.appendChild(box);

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() {
    document.removeEventListener('keydown', onKey, true);
    cards.destroy();
    overlay.remove();
    if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
  }
  x.addEventListener('click', close);
  cancel.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  ok.addEventListener('click', () => { const id = pick; close(); onPick(id); });
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(overlay);
  (body.querySelector('[aria-pressed="true"]') || body.querySelector('[data-template-card]'))?.focus?.();
  return { close };
}
