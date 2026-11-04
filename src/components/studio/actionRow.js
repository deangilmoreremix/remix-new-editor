/**
 * Shared studio action row — the Image Studio button layout
 * (🖼 Thumbnail · Advanced · Tools · Personalize) used by every
 * generation studio so the prompt bar looks the same everywhere.
 */

export const ACTION_ROW_CLASS = 'flex flex-wrap items-center gap-1.5 md:gap-2.5';

export const ACTION_PILL_CLASS =
  'flex items-center gap-1.5 md:gap-2.5 px-3 md:px-4 py-2 md:py-2.5 bg-white/5 hover:bg-white/10 rounded-xl md:rounded-2xl transition-all border border-white/5 group whitespace-nowrap';

export const SECONDARY_BTN_CLASS = 'btn-action-secondary shrink-0';

const CHEVRON =
  '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" class="opacity-20 group-hover:opacity-100 transition-opacity"><path d="M6 9l6 6 6-6"/></svg>';

export const ADVANCED_ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-60 text-secondary"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 001.82-.33 1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-1.82.33A1.65 1.65 0 0019.4 9a1.65 1.65 0 00-1.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>';

export const TOOLS_ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-60 text-secondary"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>';

/** Wrapping row that holds the action buttons. */
export function createActionRow(extraClass = '') {
  const row = document.createElement('div');
  row.className = extraClass ? `${ACTION_ROW_CLASS} ${extraClass}` : ACTION_ROW_CLASS;
  row.setAttribute('data-studio-action-row', '');
  return row;
}

/** Pill button with icon, `${id}-label` span and chevron (Image Studio createControlBtn). */
export function createActionPill({ icon = '', label, id, tooltip } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  if (id) btn.id = id;
  btn.className = ACTION_PILL_CLASS;
  if (tooltip) btn.setAttribute('data-tooltip', tooltip);
  btn.innerHTML = `
    ${icon}
    <span${id ? ` id="${id}-label"` : ''} data-action-label class="text-xs font-bold text-white group-hover:text-primary transition-colors">${label}</span>
    ${CHEVRON}
  `;
  return btn;
}

/** Sets the visible label of a pill created by createActionPill. */
export function setActionPillLabel(btn, label) {
  const span = btn?.querySelector('[data-action-label]');
  if (span) span.textContent = label;
}

/**
 * Advanced pill. Toggles its label between "Advanced" and "Less" and calls
 * onToggle(isOpen). Use `externalToggle: true` when the studio already owns
 * toggle state and wires its own click handler.
 */
export function createAdvancedButton({ id = 'advanced-btn', tooltip = 'Show advanced options', onToggle, initiallyOpen = false } = {}) {
  const btn = createActionPill({ icon: ADVANCED_ICON, label: initiallyOpen ? 'Less' : 'Advanced', id, tooltip });
  btn.setAttribute('aria-expanded', String(initiallyOpen));
  if (typeof onToggle === 'function') {
    let open = initiallyOpen;
    btn.addEventListener('click', () => {
      open = !open;
      btn.setAttribute('aria-expanded', String(open));
      setActionPillLabel(btn, open ? 'Less' : 'Advanced');
      onToggle(open);
    });
  }
  return btn;
}

export function styleSecondaryButton(btn) {
  if (!btn) return btn;
  btn.type = 'button';
  btn.className = SECONDARY_BTN_CLASS;
  return btn;
}

export function styleThumbnailButton(btn) {
  if (!btn) return btn;
  styleSecondaryButton(btn);
  btn.textContent = '🖼 Thumbnail';
  if (!btn.title) btn.title = 'Generate a custom thumbnail';
  return btn;
}

/**
 * Appends the given buttons to `row` in the canonical order
 * Thumbnail · Advanced · Tools · Personalize. Missing entries are
 * skipped. Already-mounted nodes are moved.
 */
export function arrangeActionRow(row, { thumbnail, advanced, tools, personalize } = {}) {
  [thumbnail, advanced, tools, personalize].forEach((el) => {
    if (el) row.appendChild(el);
  });
  return row;
}

export const GENERATE_BTN_CLASS =
  'btn-primary-modern px-[14px] py-2 min-h-[40px] text-[13px] font-bold rounded-2xl inline-flex items-center justify-center gap-1.5 hover:scale-105 active:scale-95 transition-all w-full sm:w-auto shadow-lg disabled:opacity-50 disabled:cursor-not-allowed';

/**
 * Advanced pill + collapsible panel (hidden until the pill is clicked),
 * matching Image Studio's Advanced behaviour. `elements` are moved into the
 * panel. Returns { button, panel }.
 */
export function createAdvancedPanel({ id = 'advanced-btn', elements = [], tooltip = 'Show advanced options' } = {}) {
  const panel = document.createElement('div');
  panel.className = 'hidden flex-col gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.02]';
  panel.setAttribute('data-studio-advanced-panel', '');
  elements.filter(Boolean).forEach((el) => panel.appendChild(el));
  const emptyNote = document.createElement('p');
  emptyNote.className = 'text-xs text-muted';
  emptyNote.textContent = 'No advanced options for this model.';
  panel.appendChild(emptyNote);

  // Show the note only when no visible control is in the panel.
  const syncEmptyNote = () => {
    const hasContent = [...panel.children].some(
      (c) => c !== emptyNote && !c.classList.contains('hidden') && c.querySelector('input, select, textarea, button'),
    );
    emptyNote.classList.toggle('hidden', hasContent);
  };
  syncEmptyNote();

  // Studios rebuild their controls when the model changes (often while the
  // panel is open), so keep the note in sync with the panel's contents.
  if (typeof MutationObserver === 'function') {
    const observer = new MutationObserver((mutations) => {
      if (mutations.every((m) => m.target === emptyNote)) return;
      syncEmptyNote();
    });
    observer.observe(panel, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  const button = createAdvancedButton({
    id,
    tooltip,
    onToggle: (open) => {
      if (open) syncEmptyNote();
      panel.classList.toggle('hidden', !open);
      panel.classList.toggle('flex', open);
    },
  });
  return { button, panel, refresh: syncEmptyNote };
}

/**
 * Image Studio bottom bar: action buttons on the left, Generate on the right,
 * separated from the form by a hairline. Restyles `generate` to the Image
 * Studio generate button.
 */
export function createStudioActionBar({ row, generate } = {}) {
  const bar = document.createElement('div');
  bar.className = 'flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4 border-t border-white/5';
  bar.setAttribute('data-studio-action-bar', '');
  if (row) {
    row.classList.add('min-w-0');
    bar.appendChild(row);
  }
  if (generate) {
    generate.className = GENERATE_BTN_CLASS;
    bar.appendChild(generate);
  }
  return bar;
}
