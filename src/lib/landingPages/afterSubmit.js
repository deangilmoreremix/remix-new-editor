/**
 * "After the form is sent" for landing pages: keep the thank-you message (default), add a button with a link, or go to
 * another page. One setting per page, so every design gets it. Links must be http(s), mailto or tel (a redirect: http(s) only).
 */
import { safeUrl } from './templates.js';

export const AFTER_SUBMIT_OPTIONS = [
  ['message', 'Show the thank-you message'],
  ['button', 'Show a button with a link'],
  ['redirect', 'Go to another page'],
];
/** Time the thank-you stays visible before a redirect, so people see that it worked. */
export const REDIRECT_DELAY_MS = 1800;

const MESSAGE_ONLY = Object.freeze({ action: 'message', url: '', buttonText: '' });

/** @param {object} settings { afterSubmitAction, afterSubmitUrl, afterSubmitButtonText } (unsanitized is fine) */
export function resolveAfterSubmit(settings) {
  const s = settings && typeof settings === 'object' ? settings : {};
  const action = s.afterSubmitAction === 'button' || s.afterSubmitAction === 'redirect' ? s.afterSubmitAction : 'message';
  const url = safeUrl(s.afterSubmitUrl);
  if (action === 'message' || !url) return MESSAGE_ONLY;
  if (action === 'redirect' && !/^https?:\/\//i.test(url)) return MESSAGE_ONLY;
  return { action, url, buttonText: String(s.afterSubmitButtonText ?? '').trim().slice(0, 40) || 'Continue' };
}

/** Navigate to `url` after the delay; returns a cancel function. */
export function scheduleRedirect(url, { navigate = (u) => globalThis.location?.assign(u), schedule = setTimeout, cancel = clearTimeout, delay = REDIRECT_DELAY_MS } = {}) {
  const id = schedule(() => navigate(url), delay);
  return () => cancel(id);
}

/** Opens in a new tab for web links; mailto:/tel: stay in place. */
export const linkTarget = (url) => (/^https?:\/\//i.test(url) ? { target: '_blank', rel: 'noopener noreferrer' } : {});
