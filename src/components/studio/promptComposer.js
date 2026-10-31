// Floating prompt composer shared by the studios that mirror upstream
// Open-Generative-AI (packages/studio/src/components/prompt/PromptComposer.jsx).
// Same size contract — 38px parameter pills, 40px media circles, 2rem panel —
// in SmartVideo's lime primary instead of upstream's cyan.
//
// Presentation only: studios keep their own API calls, validation, uploads and
// persistence and pass behaviour in through callbacks.

const PRIMARY = 'var(--color-primary, #d9ff00)';

const POSITION_CLASS = 'absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-[95%] lg:max-w-4xl z-30 animate-fade-in-up';
const PANEL_CLASS = 'w-full bg-gradient-to-b from-[#18181c]/90 via-[#0f0f12]/90 to-[#0c0c0e]/95 backdrop-blur-2xl rounded-[2rem] border border-white/[0.08] p-4 flex flex-col gap-3 shadow-[0_15px_50px_rgba(0,0,0,0.8)]';
const TEXTAREA_CLASS = 'w-full bg-transparent border-none text-white text-sm placeholder:text-white/20 focus:outline-none resize-none pt-1 leading-relaxed min-h-[40px] max-h-[150px] md:max-h-[250px] overflow-y-auto custom-scrollbar disabled:opacity-40';
const ACTION_CLASS = 'bg-primary text-black px-7 py-3 rounded-full font-bold text-sm hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 w-full sm:w-auto shadow-lg shadow-primary/20 hover:shadow-primary/35 border border-primary/10 z-10 disabled:opacity-50 disabled:cursor-not-allowed';
const CONTROL_LAYOUT_CLASS = 'h-[38px] flex items-center gap-2 rounded-md transition-all border group whitespace-nowrap shadow-inner focus:outline-none focus-visible:border-primary/45 focus-visible:ring-1 focus-visible:ring-primary/30';
const CONTROL_IDLE_CLASS = 'text-white bg-[#16161a]/60 hover:bg-[#202026]/80 border-white/[0.06]';
const CONTROL_ACTIVE_CLASS = 'text-primary bg-primary/10 hover:bg-primary/15 border-primary/25';
const MEDIA_LAYOUT_CLASS = 'w-10 h-10 shrink-0 rounded-full border transition-all flex items-center justify-center relative overflow-hidden group focus:outline-none focus-visible:border-primary/45 focus-visible:ring-1 focus-visible:ring-primary/30';
const POPOVER_CLASS = 'absolute bottom-[calc(100%+12px)] left-0 z-50 rounded-xl p-3.5 shadow-[0_10px_40px_rgba(0,0,0,0.8)] border border-white/[0.08] backdrop-blur-2xl min-w-[160px] max-h-[40vh] overflow-y-auto custom-scrollbar bg-[#0c0c0f]/95';

export const CONTROL_LABEL_CLASS = 'text-xs font-semibold text-current opacity-70 group-hover:text-primary group-hover:opacity-100 transition-all';
export const MEDIA_PREVIEW_CLASS = 'relative w-10 h-10 shrink-0 rounded-full border border-white/10 overflow-hidden shadow-md group';

const join = (...c) => c.filter(Boolean).join(' ');

export function controlClassName({ active = false, compact = false, iconOnly = false, className = '' } = {}) {
  return join(
    CONTROL_LAYOUT_CLASS,
    iconOnly ? 'w-[38px] px-0 justify-center' : compact ? 'px-3' : 'px-4',
    active ? CONTROL_ACTIVE_CLASS : CONTROL_IDLE_CLASS,
    className,
  );
}

export function mediaButtonClassName({ active = false, className = '' } = {}) {
  return join(
    MEDIA_LAYOUT_CLASS,
    active ? 'border-primary/60 bg-primary/5 hover:border-primary/70' : 'border-white/[0.03] bg-white/[0.03] hover:bg-white/[0.06] hover:border-primary/40',
    className,
  );
}

export const ICONS = {
  chevron: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-current opacity-[0.45] group-hover:opacity-100 flex-shrink-0 transition-opacity" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  aspect: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-current opacity-[0.45] flex-shrink-0" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/></svg>',
  duration: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-current opacity-[0.45] flex-shrink-0" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  quality: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-current opacity-70 flex-shrink-0" aria-hidden="true"><path d="M6.5 3.5h11L22 9 12 21 2 9l4.5-5.5Z"/><path d="M2 9h20"/><path d="m6.5 3.5 3 5.5L12 21"/><path d="m17.5 3.5-3 5.5L12 21"/></svg>',
  more: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  check: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${PRIMARY}" stroke-width="4.5" class="flex-shrink-0" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`,
  sparkle: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l1.9 5.6L19.5 9.5 13.9 11.4 12 17l-1.9-5.6L4.5 9.5l5.6-1.9z"/></svg>',
  spinner: '<svg class="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity=".25" stroke-width="3"/><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
};

/**
 * A 38px parameter pill. `icon` is an ICONS key or raw SVG; `chevron` shows
 * the list affordance. Returns the button with a `setLabel(text)` helper.
 */
export function createPill({ label = '', icon = '', chevron = true, active = false, compact = false, iconOnly = false, title = '', onClick } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = controlClassName({ active, compact, iconOnly });
  if (title) { btn.title = title; btn.setAttribute('aria-label', title); }
  const iconHtml = ICONS[icon] || icon || '';
  btn.innerHTML = `${iconHtml}${iconOnly ? '' : `<span class="${CONTROL_LABEL_CLASS}" data-pill-label></span>`}${chevron && !iconOnly ? ICONS.chevron : ''}`;
  btn.setLabel = (text) => {
    const span = btn.querySelector('[data-pill-label]');
    if (span) span.textContent = text;
  };
  btn.setActive = (on) => { btn.className = controlClassName({ active: on, compact, iconOnly }); };
  btn.setLabel(label);
  if (onClick) btn.addEventListener('click', onClick);
  return btn;
}

let openPopover = null;

function closeOpenPopover() {
  if (!openPopover) return;
  const { el, anchor, onClose } = openPopover;
  openPopover = null;
  el.remove();
  anchor?.setActive?.(false);
  anchor?.setAttribute('aria-expanded', 'false');
  onClose?.();
}

if (typeof document !== 'undefined') {
  document.addEventListener('mousedown', (e) => {
    if (!openPopover) return;
    if (openPopover.el.contains(e.target) || openPopover.anchor?.contains(e.target)) return;
    closeOpenPopover();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOpenPopover(); });
}

/**
 * Opens a popover above `anchor` (toggling it closed if already open).
 * `content` is a node, or `items` builds a checkmarked menu list.
 */
export function openComposerPopover(anchor, { title = '', items = null, content = null, className = '', onClose } = {}) {
  if (openPopover?.anchor === anchor) { closeOpenPopover(); return null; }
  closeOpenPopover();
  const el = document.createElement('div');
  el.className = join(POPOVER_CLASS, className);
  el.setAttribute('role', 'dialog');
  if (title) {
    const header = document.createElement('div');
    header.className = 'text-[11px] font-semibold text-white/30 uppercase tracking-wider pb-2 border-b border-white/[0.05] mb-2 px-1';
    header.textContent = title;
    el.appendChild(header);
  }
  if (items) el.appendChild(createMenuList(items, () => closeOpenPopover()));
  if (content) el.appendChild(content);
  const host = anchor.parentElement;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  host.appendChild(el);
  // Keep the popover inside the viewport horizontally.
  const bounds = el.getBoundingClientRect();
  const overflowRight = bounds.right - (window.innerWidth - 16);
  if (overflowRight > 0) el.style.translate = `${-overflowRight}px 0`;
  anchor.setActive?.(true);
  anchor.setAttribute('aria-expanded', 'true');
  openPopover = { el, anchor, onClose };
  return el;
}

export function closeComposerPopover() { closeOpenPopover(); }

/** Menu rows: [{ label, description?, selected?, onSelect }] — min 40px, check on the selected one. */
export function createMenuList(items, afterSelect) {
  const list = document.createElement('div');
  list.setAttribute('role', 'menu');
  list.className = 'flex flex-col gap-1';
  items.forEach((item) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.setAttribute('role', 'menuitemradio');
    row.setAttribute('aria-checked', item.selected ? 'true' : 'false');
    row.className = 'w-full min-h-10 flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left cursor-pointer transition-all text-xs font-semibold text-white/70 hover:bg-primary/10 hover:text-primary focus:outline-none focus-visible:bg-primary/10 focus-visible:text-primary';
    const text = document.createElement('span');
    text.className = 'min-w-0';
    const label = document.createElement('span');
    label.className = 'block truncate';
    label.textContent = item.label;
    text.appendChild(label);
    if (item.description) {
      const desc = document.createElement('span');
      desc.className = 'block font-medium mt-0.5 text-[9px] text-white/35 truncate';
      desc.textContent = item.description;
      text.appendChild(desc);
    }
    row.appendChild(text);
    if (item.selected) row.insertAdjacentHTML('beforeend', ICONS.check);
    row.addEventListener('click', () => { item.onSelect?.(); afterSelect?.(); });
    list.appendChild(row);
  });
  return list;
}

/** Segmented control: options [{ value, label }]. Returns the track with `setValue`. */
export function createSegmented(options, value, onChange) {
  const track = document.createElement('div');
  track.className = 'inline-flex items-center gap-1 bg-white/[0.03] border border-white/[0.05] rounded-full p-0.5';
  const render = (current) => {
    track.innerHTML = '';
    options.forEach((opt) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-pressed', opt.value === current ? 'true' : 'false');
      b.className = join(
        'min-h-7 px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40',
        opt.value === current ? 'bg-primary text-black shadow-md shadow-primary/20' : 'text-white/40 hover:text-white/70',
      );
      b.textContent = opt.label;
      b.addEventListener('click', () => {
        if (opt.value === track.value) return;
        track.value = opt.value;
        render(opt.value);
        onChange?.(opt.value);
      });
      track.appendChild(b);
    });
  };
  track.value = value;
  track.setValue = (v) => { track.value = v; render(v); };
  render(value);
  return track;
}

/**
 * The ⋯ menu that holds SmartVideo-only tools (AI Pick, Personalize, …) so the
 * composer row matches upstream. items: [{ label, description?, onSelect }].
 */
export function createMoreMenu(items, { title = 'More tools' } = {}) {
  const btn = createPill({ icon: 'more', iconOnly: true, title });
  btn.dataset.composerMore = '';
  btn.addEventListener('click', () => openComposerPopover(btn, { title, items: items.map((i) => ({ ...i, selected: false })) }));
  return btn;
}

/**
 * Builds the floating composer. Slots are plain DOM nodes:
 *   composer.mediaRow  — 40px media circles (uploads)
 *   composer.controls  — 38px pills
 * `onSubmit` fires on the Generate button and on ⌘/Ctrl+Enter.
 */
export function createPromptComposer({ placeholder = 'Describe what you want to create', actionLabel = 'Generate', onSubmit, positionClass = POSITION_CLASS, textareaFirst = false } = {}) {
  const root = document.createElement('div');
  root.className = positionClass;
  root.style.animationDelay = '0.2s';
  root.dataset.promptComposer = '';

  const panel = document.createElement('div');
  panel.className = PANEL_CLASS;
  root.appendChild(panel);

  const mediaRow = document.createElement('div');
  mediaRow.className = 'flex items-center gap-2 flex-wrap empty:hidden';

  const textarea = document.createElement('textarea');
  textarea.rows = 1;
  textarea.placeholder = placeholder;
  textarea.className = TEXTAREA_CLASS;
  const resize = () => {
    textarea.style.height = 'auto';
    const max = window.innerWidth < 768 ? 150 : 250;
    textarea.style.height = `${Math.min(textarea.scrollHeight, max)}px`;
  };
  textarea.addEventListener('input', resize);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (!action.disabled) onSubmit?.();
    }
  });

  const status = document.createElement('div');
  status.className = 'hidden text-xs rounded-xl px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-300';
  status.setAttribute('role', 'alert');

  const footer = document.createElement('div');
  footer.className = 'flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-3 border-t border-white/[0.03] relative';

  const controls = document.createElement('div');
  controls.className = 'flex items-center gap-2 relative flex-wrap pb-1 md:pb-0';

  const action = document.createElement('button');
  action.type = 'button';
  action.className = ACTION_CLASS;
  action.dataset.composerAction = '';
  const setActionContent = (html) => { action.innerHTML = html; };
  setActionContent(`${actionLabel} ${ICONS.sparkle}`);
  action.addEventListener('click', () => onSubmit?.());

  footer.append(controls, action);
  if (textareaFirst) panel.append(textarea, mediaRow, status, footer);
  else panel.append(mediaRow, textarea, status, footer);

  return {
    root, panel, mediaRow, textarea, controls, footer, action, status,
    getPrompt: () => textarea.value.trim(),
    setPrompt: (v) => { textarea.value = v || ''; resize(); },
    resize,
    /** Spinner + "Generating…" while busy; back to the label after. */
    setGenerating(busy) {
      action.disabled = !!busy;
      setActionContent(busy ? `${ICONS.spinner} Generating…` : `${actionLabel} ${ICONS.sparkle}`);
    },
    /** After a failure the button offers a retry, like Video Studio. */
    setRetry() {
      action.disabled = false;
      setActionContent('↻ Retry');
    },
    showError(message) {
      status.textContent = message;
      status.classList.remove('hidden');
    },
    clearError() {
      status.textContent = '';
      status.classList.add('hidden');
    },
  };
}
