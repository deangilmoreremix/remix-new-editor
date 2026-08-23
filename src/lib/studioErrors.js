/**
 * Shared inline-error + cancel-button helpers for studios.
 *
 * Usage:
 *   const { showInlineError, wireCancelButton } = useStudioErrors(container);
 *   const controller = wireCancelButton(genBtn);
 *   const result = await muapi.generateVideo(params, controller.signal);
 */

import { showToast } from './loading.js';

export function useStudioErrors(container) {
  let errorEl = null;

  function ensureErrorEl() {
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.className = 'hidden w-full max-w-2xl mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-300';
      container.appendChild(errorEl);
    }
    return errorEl;
  }

  function show(message, duration = 5000) {
    const el = ensureErrorEl();
    el.textContent = message;
    el.classList.remove('hidden');
    if (duration > 0) {
      setTimeout(() => el.classList.add('hidden'), duration);
    }
  }

  function hide() {
    const el = ensureErrorEl();
    el.classList.add('hidden');
  }

  return { showInlineError: show, hideInlineError: hide };
}

/**
 * Wires a "Cancel" button next to a generate button that aborts an
 * in-flight generation via AbortController.
 *
 * @param {HTMLButtonElement} genBtn - The generate button to augment
 * @param {AbortController} [existingController] - Reuse an existing controller
 * @returns {{ controller: AbortController, reset: Function }}
 */
export function wireCancelButton(genBtn, existingController) {
  const controller = existingController || new AbortController();

  let cancelBtn = null;

  function showCancel() {
    if (cancelBtn) return;
    cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'ml-3 px-4 py-2 bg-white/10 text-white text-xs font-bold rounded-lg hover:bg-white/20 transition-colors shrink-0';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => {
      controller.abort();
      cancelBtn.remove();
      cancelBtn = null;
    };
    genBtn.parentElement.insertBefore(cancelBtn, genBtn.nextSibling);
  }

  function reset() {
    if (cancelBtn) {
      cancelBtn.remove();
      cancelBtn = null;
    }
  }

  return { controller, showCancel, reset };
}
