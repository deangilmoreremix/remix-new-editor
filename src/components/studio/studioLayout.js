// Adapts an existing studio page to the upstream Open-Generative-AI layout
// without rewriting its generation logic:
//
//   [AI header image]            ← kept, collapses to a slim banner once results exist
//   [empty state | results grid] ← upstream tilted cards / grid cards
//   [floating composer]          ← sticky at the bottom of the scroll area
//   [quick tips, examples …]     ← below the fold
//
// Studios keep their own controls; these helpers restyle them to the composer
// contract and fold SmartVideo-only tools into one ⋯ menu.

import { controlClassName, CONTROL_LABEL_CLASS, createMoreMenu, ICONS } from './promptComposer.js';
import { createResultsGallery } from './resultsGallery.js';
import { createEmptyState } from './emptyState.js';
import { notifyGeneration } from './generationNotifications.js';
import { showToast } from '../../lib/loading.js';

const PANEL_CLASS = 'w-full bg-gradient-to-b from-[#18181c]/90 via-[#0f0f12]/90 to-[#0c0c0e]/95 backdrop-blur-2xl rounded-[2rem] border border-white/[0.08] p-4 flex flex-col gap-3 shadow-[0_15px_50px_rgba(0,0,0,0.8)]';
const ACTION_CLASS = 'bg-primary text-black px-7 py-3 rounded-full font-bold text-sm hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 w-full sm:w-auto shadow-lg shadow-primary/20 hover:shadow-primary/35 border border-primary/10 z-10 disabled:opacity-50 disabled:cursor-not-allowed';
const FOOTER_CLASS = 'flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-3 border-t border-white/[0.03] relative';
const CONTROLS_CLASS = 'flex items-center gap-2 relative flex-wrap pb-1 md:pb-0';

/** Restyle an existing control button to the 38px pill contract, keeping its ids/handlers. */
export function restylePill(btn) {
  if (!btn) return btn;
  btn.className = controlClassName({});
  btn.querySelectorAll('span').forEach((span) => {
    if (span.id?.endsWith('-label') || span.dataset.advancedLabel !== undefined) span.className = CONTROL_LABEL_CLASS;
  });
  return btn;
}

/** Restyle a Generate button to the composer action and normalise its label. */
export function restyleAction(btn, label = 'Generate') {
  if (!btn) return btn;
  btn.className = ACTION_CLASS;
  btn.dataset.composerAction = '';
  btn.dataset.idleLabel = label;
  btn.innerHTML = `${label} ${ICONS.sparkle}`;
  return btn;
}

export function setActionBusy(btn, busy) {
  if (!btn) return;
  btn.disabled = !!busy;
  btn.innerHTML = busy ? `${ICONS.spinner} Generating…` : `${btn.dataset.idleLabel || 'Generate'} ${ICONS.sparkle}`;
}

export function setActionRetry(btn) {
  if (!btn) return;
  btn.disabled = false;
  btn.innerHTML = '↻ Retry';
}

/** Apply the floating composer panel look to an existing prompt bar. */
export function styleComposer({ wrapper, bar, footer, controls }) {
  if (bar) bar.className = PANEL_CLASS;
  if (footer) footer.className = FOOTER_CLASS;
  if (controls) controls.className = CONTROLS_CLASS;
  if (wrapper) {
    // Docked to the bottom of the studio's scroll area, like upstream's
    // absolute bottom-4 composer, but still in flow so the page can scroll.
    wrapper.className = 'sticky bottom-4 z-30 w-full max-w-[95%] lg:max-w-4xl mx-auto animate-fade-in-up';
    wrapper.style.animationDelay = '0.2s';
    wrapper.dataset.promptComposer = '';
  }
}

/**
 * Move SmartVideo-only buttons out of the composer into one ⋯ menu. Each entry
 * is { label, el } (the original button is kept, hidden, and clicked) or
 * { label, onSelect }.
 */
export function foldIntoMoreMenu(host, entries) {
  const stash = document.createElement('div');
  stash.hidden = true;
  stash.dataset.moreStash = '';
  const items = entries.filter((e) => e && (e.el || e.onSelect)).map(({ label, el, onSelect, description }) => {
    if (el) stash.appendChild(el);
    return { label, description, onSelect: onSelect || (() => el.click()) };
  });
  const more = createMoreMenu(items);
  host.appendChild(more);
  host.appendChild(stash);
  return more;
}

/**
 * Mounts the upstream empty state and results gallery between the hero and
 * the composer, and wires the hero to collapse once there are results.
 */
export function mountStudioResults({ container, hero, before, kind = 'image', historyType = kind, studio, label, empty = {}, extraActions, filenamePrefix, onDelete }) {
  const area = document.createElement('div');
  area.className = 'w-full flex flex-col items-center pb-6';
  area.dataset.studioResults = '';

  const emptyState = createEmptyState(empty);
  const gallery = createResultsGallery({ kind, historyType, extraActions, filenamePrefix, onDelete });
  area.append(emptyState, gallery.root);

  if (before && before.parentNode === container) container.insertBefore(area, before);
  else container.appendChild(area);

  const banner = hero?.classList?.contains('hero-banner') ? hero : hero?.querySelector?.('.hero-banner');
  if (banner) banner.style.transition = 'height .5s ease';
  const sync = () => {
    const has = !gallery.isEmpty();
    emptyState.classList.toggle('hidden', has);
    // Once there are results the AI header shrinks to a slim strip so the grid gets the space.
    if (banner) banner.style.height = has ? '96px' : '';
  };
  gallery.onChange(sync);
  sync();

  /**
   * Wraps one generation: pending card, button state, notifications, toast.
   * `run` resolves to { url, ...entry } or throws.
   */
  const track = async (run, { actionBtn, pendingLabel = 'Generating…' } = {}) => {
    const pending = gallery.addPending(pendingLabel);
    const id = `${studio}:${Date.now()}`;
    setActionBusy(actionBtn, true);
    notifyGeneration({ phase: 'start', id, studio, label });
    try {
      const entry = await run();
      pending.remove();
      setActionBusy(actionBtn, false);
      if (entry?.url) {
        gallery.addItem(entry);
        notifyGeneration({ phase: 'success', id, studio, label, url: entry.url });
      }
      return entry;
    } catch (err) {
      pending.remove();
      setActionRetry(actionBtn);
      const message = err?.message || 'Generation failed';
      notifyGeneration({ phase: 'error', id, studio, label, message });
      showToast(message, 'error', 5000);
      throw err;
    }
  };

  return { area, emptyState, gallery, track };
}
