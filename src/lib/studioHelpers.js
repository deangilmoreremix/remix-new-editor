/**
 * Shared studio helpers: abort-aware generation, inline errors, retry, progress.
 *
 * Usage:
 *   import {
 *     createAbortAwareGenerate,
 *     showInlineError,
 *     hideInlineError,
 *     categorizeGenerationError,
 *     startGenerationProgress,
 *     withRetry,
 *     escapeHtml
 *   } from '../lib/studioHelpers.js';
 */

import { showToast } from './loading.js';

let generationTimer = null;

/**
 * Wrap an async generate function with AbortController support.
 * Creates a fresh AbortController per invocation so callers can cancel
 * in-flight work and the wrapper cleans up automatically.
 *
 * @param {(signal: AbortSignal, ...args: any[]) => Promise<any>} generateFn
 *   Async function that receives an AbortSignal as its first argument.
 * @param {(event: {phase: string, detail?: any}) => void} [onProgress]
 *   Optional progress callback: called with {phase, detail} at start,
 *   progress, and completion.
 * @returns {{ run(...args): Promise<{result: any, cancelled: boolean}>,
 *            reset(): void,
 *            isCancelled(): boolean,
 *            controller: AbortController }}
 */
export function createAbortAwareGenerate(generateFn, onProgress) {
  let controller = null;

  function getController() {
    if (!controller) {
      controller = new AbortController();
    }
    return controller;
  }

  async function run(...args) {
    controller = new AbortController();
    const signal = controller.signal;

    onProgress?.({ phase: 'start' });

    try {
      const result = await generateFn(signal, ...args);
      if (signal.aborted) {
        onProgress?.({ phase: 'cancelled' });
        return { result: null, cancelled: true };
      }
      onProgress?.({ phase: 'complete', detail: result });
      return { result, cancelled: false };
    } catch (err) {
      if (err.name === 'AbortError' || signal.aborted) {
        onProgress?.({ phase: 'cancelled' });
        return { result: null, cancelled: true };
      }
      onProgress?.({ phase: 'error', detail: err });
      throw err;
    }
  }

  function reset() {
    if (controller) {
      controller.abort();
    }
    controller = null;
  }

  function isCancelled() {
    return controller ? controller.signal.aborted : false;
  }

  return { run, reset, isCancelled, getController };
}

/**
 * Creates an AbortController wired to a cancel button next to the generate button.
 *
 * @param {HTMLButtonElement} generateBtn
 * @returns {{ controller: AbortController, reset(): void, isCancelled(): boolean }}
 */
export function createAbortAwareGenerateButton(generateBtn) {
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

/**
 * Retry an async function with exponential backoff on transient errors.
 * Eliminates duplicated retry loops across studio files.
 *
 * @param {(...args: any[]) => Promise<any>} fn
 *   Async function to retry.
 * @param {object} [options]
 * @param {number} [options.maxAttempts=3]
 * @param {number} [options.baseDelay=500]
 * @param {number} [options.maxDelay=8000]
 * @param {(event: {attempt: number, maxAttempts: number, error: Error}) => void} [onRetry]
 * @param {(pct: number) => void} [onProgress]
 * @returns {Promise<any>}
 */
export async function withRetry(fn, options = {}, onRetry, onProgress) {
  const {
    maxAttempts = 3,
    baseDelay = 500,
    maxDelay = 8000
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      onProgress?.(Math.round((attempt / maxAttempts) * 100));
      return await fn();
    } catch (err) {
      lastError = err;

      const isTransient =
        err.name === 'AbortError' ||
        /Network error|Rate limit|Service temporarily unavailable|5\d\d/i.test(err.message || '');

      if (!isTransient || attempt >= maxAttempts) {
        throw err;
      }

      onRetry?.({ attempt, maxAttempts, error: err });

      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Validate required input fields and show inline errors for missing ones.
 * Returns true if all inputs are present, false otherwise.
 *
 * @param {HTMLInputElement[]} inputs
 *   Array of input elements to validate.
 * @param {string[]} fieldNames
 *   Human-readable names for each input (shown in error message).
 * @param {HTMLElement} container
 *   Container element for inline error display.
 * @returns {boolean}
 */
export function validateRequiredInputs(inputs, fieldNames, container) {
  for (let i = 0; i < inputs.length; i++) {
    const val = inputs[i].value.trim();
    if (!val) {
      showInlineError(container, `Please enter a value for "${fieldNames[i]}" before generating.`);
      inputs[i].focus();
      return false;
    }
  }
  return true;
}

/**
 * Escape a string for safe insertion into innerHTML.
 *
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Debounce a function, delaying invocation until after `wait` ms have
 * elapsed since the last call.
 *
 * @param {Function} fn
 * @param {number} [wait=300]
 * @returns {Function}
 */
export function debounce(fn, wait = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
