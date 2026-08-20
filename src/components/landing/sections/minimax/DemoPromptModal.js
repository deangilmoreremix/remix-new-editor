// Demo prompt viewer — a single shared modal reused by every MiniMax section.
//
// Behaviour contract:
//  - never navigates away just to read a prompt,
//  - full keyboard support: Tab is trapped, Escape closes, focus returns to the
//    exact element that opened it,
//  - long prompts scroll inside the panel, the page behind is locked,
//  - prompt text is fetched from a lazy chunk so it costs nothing until opened.

import {
  MINIMAX_MODEL,
  formatDuration,
  loadDemoPrompt as loadMiniMaxDemoPrompt,
} from '../../../../data/minimaxH3Demos.js';
import { createStyleLink, escapeHtml, injectMinimaxStyles } from './ui.js';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea',
  'input',
  'select',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

let activeModal = null;

function lockScroll() {
  const { body } = document;
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  body.dataset.mmxPrevOverflow = body.style.overflow || '';
  body.dataset.mmxPrevPadding = body.style.paddingRight || '';
  body.style.overflow = 'hidden';
  if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
}

function unlockScroll() {
  const { body } = document;
  body.style.overflow = body.dataset.mmxPrevOverflow || '';
  body.style.paddingRight = body.dataset.mmxPrevPadding || '';
  delete body.dataset.mmxPrevOverflow;
  delete body.dataset.mmxPrevPadding;
}

function metaCell(label, value) {
  return `
    <div class="min-w-0">
      <dt class="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">${escapeHtml(label)}</dt>
      <dd class="mt-1 truncate text-sm font-medium text-white/90">${escapeHtml(value)}</dd>
    </div>`;
}

/**
 * Opens the prompt modal for a demo.
 * @param {object} demo         manifest entry
 * @param {HTMLElement} trigger element that opened it (focus returns here)
 * @param {object} [options]
 * @param {function(string): Promise<string>} [options.loadPrompt]
 * @param {string} [options.model]
 */
export function openDemoPromptModal(demo, trigger, options = {}) {
  injectMinimaxStyles();

  // Only one modal at a time.
  if (activeModal) activeModal.close(true);

  const loadPrompt = options.loadPrompt || loadMiniMaxDemoPrompt;
  const model = options.model || MINIMAX_MODEL;

  const titleId = `mmx-prompt-title-${demo.slug}`;
  const descId = `mmx-prompt-desc-${demo.slug}`;

  const backdrop = document.createElement('div');
  backdrop.className =
    'mmx-modal-backdrop fixed inset-0 z-[120] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-6';
  backdrop.dataset.mmxModal = demo.slug;

  backdrop.innerHTML = `
    <div
      class="mmx-modal-panel flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#080a10] shadow-2xl shadow-black/60 sm:max-h-[85vh] sm:rounded-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="${titleId}"
      aria-describedby="${descId}"
    >
      <!-- drag affordance on mobile -->
      <div class="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/15 sm:hidden" aria-hidden="true"></div>

      <header class="flex shrink-0 items-start gap-4 border-b border-white/8 px-5 py-4 sm:px-7 sm:py-5">
        <div class="min-w-0 flex-1">
          <span class="inline-flex items-center rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300">
            ${escapeHtml(demo.category)}
          </span>
          <h2 id="${titleId}" class="mt-2 text-lg font-bold leading-snug text-white sm:text-xl">
            ${escapeHtml(demo.title)}
          </h2>
          <p id="${descId}" class="mt-1 text-sm text-gray-400">${escapeHtml(demo.useCase)}</p>
        </div>
        <button
          type="button"
          data-mmx-close
          class="shrink-0 rounded-lg border border-white/10 p-2 text-white/60 transition hover:border-white/25 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
          aria-label="Close prompt"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </header>

      <dl class="grid shrink-0 grid-cols-2 gap-4 border-b border-white/8 px-5 py-4 sm:grid-cols-4 sm:px-7">
        ${metaCell('Model', model)}
        ${metaCell('Duration', formatDuration(demo))}
        ${metaCell('Aspect ratio', demo.aspectRatio || '—')}
        ${metaCell('Category', demo.category)}
      </dl>

      <div class="mmx-prompt-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
        <h3 class="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Generation prompt</h3>
        <div data-mmx-prompt-body>
          <div class="space-y-2" aria-live="polite" aria-busy="true">
            <div class="h-3 w-11/12 animate-pulse rounded bg-white/8"></div>
            <div class="h-3 w-full animate-pulse rounded bg-white/8"></div>
            <div class="h-3 w-9/12 animate-pulse rounded bg-white/8"></div>
          </div>
        </div>
        ${
          demo.sourceUrl
            ? `<p class="mt-6 border-t border-white/8 pt-4 text-xs text-white/35">
                 Reference clip by ${escapeHtml(demo.sourceAuthor || 'unknown')} ·
                 <a href="${escapeHtml(demo.sourceUrl)}" target="_blank" rel="noopener noreferrer"
                    class="text-cyan-400/80 underline-offset-4 hover:text-cyan-300 hover:underline">original post</a>
               </p>`
            : ''
        }
      </div>

      <footer class="flex shrink-0 flex-col gap-2.5 border-t border-white/8 bg-white/[0.02] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <button
          type="button"
          data-mmx-copy
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-white/12 px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-cyan-400/50 hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 disabled:cursor-not-allowed disabled:opacity-50"
          disabled
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-2m-6-4h8a2 2 0 002-2V5a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
          </svg>
          <span data-mmx-copy-label>Copy Prompt</span>
        </button>
        <div data-mmx-create-slot class="sm:ml-auto"></div>
      </footer>
    </div>`;

  const panel = backdrop.querySelector('[role="dialog"]');
  const closeButton = backdrop.querySelector('[data-mmx-close]');
  const copyButton = backdrop.querySelector('[data-mmx-copy]');
  const copyLabel = backdrop.querySelector('[data-mmx-copy-label]');
  const promptBody = backdrop.querySelector('[data-mmx-prompt-body]');
  const createSlot = backdrop.querySelector('[data-mmx-create-slot]');

  createSlot.appendChild(createStyleLink(demo, { label: 'Create This Style', variant: 'primary', getTarget: options.getTarget }));

  let promptText = '';

  /* ------------------------------------------------------------- prompt load */

  loadPrompt(demo.slug)
    .then((text) => {
      promptText = text || '';
      if (!promptText) {
        promptBody.innerHTML =
          '<p class="text-sm text-white/50">Prompt text is not available for this demo.</p>';
        return;
      }
      promptBody.innerHTML = `
        <p class="whitespace-pre-wrap break-words font-mono text-[13px] leading-[1.7] text-gray-300 sm:text-sm">${escapeHtml(
          promptText
        )}</p>`;
      copyButton.disabled = false;
    })
    .catch(() => {
      promptBody.innerHTML =
        '<p class="text-sm text-red-400/80">Could not load the prompt. Please try again.</p>';
    });

  /* -------------------------------------------------------------- copy button */

  copyButton.addEventListener('click', async () => {
    if (!promptText) return;
    try {
      await navigator.clipboard.writeText(promptText);
    } catch {
      // Clipboard API unavailable (insecure context) — fall back to a selection copy.
      const textarea = document.createElement('textarea');
      textarea.value = promptText;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } catch {
        /* ignore */
      }
      textarea.remove();
    }
    copyLabel.textContent = 'Copied';
    copyButton.classList.add('border-cyan-400/50', 'text-cyan-300');
    setTimeout(() => {
      copyLabel.textContent = 'Copy Prompt';
      copyButton.classList.remove('border-cyan-400/50', 'text-cyan-300');
    }, 1800);
  });

  /* ------------------------------------------------------- focus + keyboard */

  const previouslyFocused = trigger || document.activeElement;

  function focusableElements() {
    return Array.from(panel.querySelectorAll(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      event.preventDefault();
      close();
      return;
    }

    if (event.key !== 'Tab') return;

    const items = focusableElements();
    if (!items.length) return;

    const first = items[0];
    const last = items[items.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onBackdropPointerDown(event) {
    if (event.target === backdrop) close();
  }

  let closed = false;

  function close(immediate = false) {
    if (closed) return;
    closed = true;

    document.removeEventListener('keydown', onKeyDown, true);
    backdrop.removeEventListener('pointerdown', onBackdropPointerDown);
    backdrop.classList.remove('mmx-open');
    if (activeModal && activeModal.element === backdrop) activeModal = null;

    const remove = () => {
      backdrop.remove();
      unlockScroll();
      // Return focus to whatever opened the modal.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };

    if (immediate) remove();
    else setTimeout(remove, 220);
  }

  closeButton.addEventListener('click', () => close());
  backdrop.addEventListener('pointerdown', onBackdropPointerDown);
  document.addEventListener('keydown', onKeyDown, true);

  lockScroll();
  document.body.appendChild(backdrop);

  // Trigger the enter transition on the next frame.
  requestAnimationFrame(() => backdrop.classList.add('mmx-open'));

  closeButton.focus({ preventScroll: true });

  activeModal = { element: backdrop, close };
  return { close };
}

/** Convenience handler passed straight to createViewPromptButton. */
export function handleViewPrompt(demo, trigger, options = {}) {
  openDemoPromptModal(demo, trigger, options);
}
