/**
 * Shared studio helpers: abort-aware generation + inline error display.
 */

import { showToast } from './loading.js';

/**
 * Creates an AbortController wired to a cancel button next to the generate button.
 *
 * @param {HTMLButtonElement} generateBtn
 * @returns {{ controller: AbortController, reset(): void, isCancelled(): boolean }}
 */
export function createAbortAwareGenerate(generateBtn) {
  const controller = new AbortController();
  let cancelBtn = null;

  function showCancel() {
    if (cancelBtn) return;
    cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'ml-3 px-4 py-2 bg-white/10 text-white text-xs font-bold rounded-lg hover:bg-white/20 transition-colors shrink-0';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.setAttribute('aria-label', 'Cancel generation');
    cancelBtn.onclick = () => {
      controller.abort();
      removeCancel();
    };
    generateBtn.parentElement.insertBefore(cancelBtn, generateBtn.nextSibling);
  }

  function removeCancel() {
    if (cancelBtn) {
      cancelBtn.remove();
      cancelBtn = null;
    }
  }

  function reset() {
    controller.abort();
    removeCancel();
    if (generateBtn) generateBtn.disabled = false;
  }

  if (generateBtn) generateBtn.disabled = true;

  function isCancelled() {
    return controller.signal.aborted;
  }

  return { controller, showCancel, reset, isCancelled };
}

/**
 * Injects an inline error region into the studio container if absent,
 * then shows the message. Auto-hides after `duration` ms (0 = sticky).
 */
export function showInlineError(container, message, duration = 6000) {
  let el = container.querySelector('.studio-inline-error');
  if (!el) {
    el = document.createElement('div');
    el.className = 'studio-inline-error hidden w-full max-w-2xl mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-300';
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'assertive');
    container.appendChild(el);
  }
  el.textContent = message;
  el.classList.remove('hidden');
  if (duration > 0) {
    setTimeout(() => el.classList.add('hidden'), duration);
  }
  return el;
}

/**
 * Hides the inline error region if present.
 */
export function hideInlineError(container) {
  const el = container.querySelector('.studio-inline-error');
  if (el) el.classList.add('hidden');
}

/**
 * Map an API error to a user-facing, actionable message.
 */
export function categorizeGenerationError(err) {
  if (!err) return { message: 'An unexpected error occurred.', category: 'unknown' };

  const msg = err.message || String(err);

  if (err.name === 'AbortError' || /cancel/i.test(msg)) {
    return { message: 'Generation cancelled.', category: 'cancelled' };
  }
  if (/Authentication failed/i.test(msg) || /\b401\b|\b403\b/.test(msg)) {
    return { message: 'Authentication error. Please log in again.', category: 'auth' };
  }
  if (/Rate limit/i.test(msg) || /\b429\b/.test(msg)) {
    return { message: 'Too many requests. Wait a moment and retry.', category: 'rate_limit' };
  }
  if (/Network error/i.test(msg) || /Failed to fetch|Load failed|fetch failed|NetworkError/i.test(msg)) {
    return { message: 'Network error. Check your connection and retry.', category: 'network' };
  }
  if (/Service temporarily unavailable/i.test(msg)) {
    return { message: 'Service temporarily unavailable. Try again shortly.', category: 'upstream' };
  }
  if (/Polling timed out|Generation timed out/i.test(msg)) {
    return { message: 'Generation is taking longer than expected. You can wait or cancel.', category: 'timeout' };
  }
  if (/Request timed out/i.test(msg)) {
    return { message: 'Request timed out. Please try again with a simpler prompt or smaller image.', category: 'timeout' };
  }
  if (/No (?:image|video|output) (?:URL|returned|result)/i.test(msg)) {
    return { message: 'Service temporarily unavailable. Try again shortly.', category: 'upstream' };
  }
  if (/\b5\d\d\b/.test(msg)) {
    return { message: 'Service temporarily unavailable. Try again shortly.', category: 'upstream' };
  }

  return { message: `Generation failed: ${msg}`, category: 'unknown' };
}

let generationTimer = null;

/**
 * Start a visible progress indicator with elapsed-time ticker.
 * Returns a handle with `.stop()` to remove the indicator.
 */
export function startGenerationProgress(options = {}) {
  const { parent, type = 'image', message } = options;
  const startTime = Date.now();

  const messages = {
    image: 'Generating image...',
    video: 'Generating video (this may take a few minutes)...',
    training: 'Training model...'
  };

  const statusEl = document.createElement('div');
  statusEl.className = 'generation-status flex items-center gap-2 text-xs text-secondary mt-2';
  statusEl.setAttribute('role', 'status');
  statusEl.setAttribute('aria-live', 'polite');

  const updateTimer = () => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    statusEl.innerHTML = `
      <span class="animate-spin inline-block mr-1" aria-hidden="true">◌</span>
      <span>${escapeHtml(message || messages[type] || 'Generating...')}</span>
      <span class="text-white/40 ml-1">${timeStr}</span>
    `;
  };

  updateTimer();
  generationTimer = setInterval(updateTimer, 5000);

  const target = parent || document.body;
  if (target) target.appendChild(statusEl);

  return {
    statusEl,
    stop: () => {
      clearInterval(generationTimer);
      generationTimer = null;
      if (statusEl && statusEl.parentNode) {
        statusEl.remove();
      }
    }
  };
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
