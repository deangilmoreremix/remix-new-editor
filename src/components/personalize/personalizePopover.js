// src/components/personalize/personalizePopover.js
//
// Trigger button + token utilities for the Personalize modal.
//
// The popover is now a proper themed `BaseModal` (see
// `../modals/PersonalizeModal.jsx`). This module mounts the trigger button
// into a host app's controls container and exports the token-insertion /
// token-replacement helpers the modal and host apps share.
//
// Responsibilities of this module:
//   - Mount a "Personalize" button into any controls container
//   - On click, open the PersonalizeModal (BaseModal subclass)
//   - Export `insertTokenAtCursor` for inline token insertion
//   - Export `replaceTokensInPrompt` for host-app token replacement at
//     generation time
//   - Auto-open the modal when `remix_open_personalize === 'true'` is set
//
// The modal itself handles Maigret scan, GitHub lookup, website crawl,
// OpenAI enrichment, localStorage persistence, profile display, and
// token chip rendering. See `./modals/PersonalizeModal.jsx`.

// The popover is self-contained: it reads/writes localStorage directly
// using the same key shape as the rest of the personalizer code. The
// functions below are intentionally tiny so they can be inlined without
// pulling in src/lib/contactStore.js.
import { resolveToken, extractTokens, TOKEN_PATTERN } from './tokenSchema.js';

const CONTACTS_KEY = 'remix_contacts';
const PROFILES_KEY = 'remix_contact_profiles';
const SELECTED_CONTACT_KEY = 'remix_selected_contact_id';

function _listContacts() {
  try { return JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]'); }
  catch { return []; }
}

function _getProfile(id) {
  try {
    const profiles = JSON.parse(localStorage.getItem(PROFILES_KEY) || '[]');
    return profiles.find((p) => p.id === id) || null;
  } catch { return null; }
}

export function getSelectedContactId() {
  try { return localStorage.getItem(SELECTED_CONTACT_KEY) || null; } catch { return null; }
}

export function setSelectedContactId(contactId) {
  try {
    // Remove rather than storing '' so getSelectedContactId() returns a
    // consistent `null` when nothing is selected, instead of an empty string.
    if (contactId) localStorage.setItem(SELECTED_CONTACT_KEY, contactId);
    else localStorage.removeItem(SELECTED_CONTACT_KEY);
  } catch {}
}

/**
 * Insert a `{{token}}` placeholder at the textarea cursor.
 *
 * Pads with a single space on each side only where one isn't already present,
 * so repeated insertions don't accumulate double spaces in the prompt.
 *
 * @param {HTMLTextAreaElement} ta
 * @param {string} token - e.g. `{{firstName}}`
 */
export function insertTokenAtCursor(ta, token) {
  if (!ta) return;
  ta.focus();
  const start = ta.selectionStart ?? ta.value.length;
  const end = ta.selectionEnd ?? ta.value.length;
  const before = ta.value.slice(0, start);
  const after = ta.value.slice(end);
  const needsSpaceBefore = before.length > 0 && !/\s$/.test(before);
  // Only pad after the token when the following text doesn't already start
  // with whitespace. When inserting at the very end we still add a space so
  // the user can keep typing without needing to add one.
  const needsSpaceAfter = after.length === 0 || !/^\s/.test(after);
  const insertion = (needsSpaceBefore ? ' ' : '') + token + (needsSpaceAfter ? ' ' : '');
  ta.value = before + insertion + after;
  const newPos = start + insertion.length;
  if (typeof ta.setSelectionRange === 'function') ta.setSelectionRange(newPos, newPos);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Replace `{{token}}` placeholders in a prompt with values from the profile.
 *
 * Resolution is delegated to `tokenSchema.resolveToken`, which accepts the
 * canonical camelCase key (`{{firstName}}`), the display label
 * (`{{First Name}}`), and registered aliases — all case/spacing insensitive —
 * and falls back to reading the nested profile when `profile.variables`
 * doesn't carry the value.
 *
 * Unresolved tokens are left in place so the user can see what was missing
 * rather than silently shipping an empty string to the model.
 *
 * @param {string} prompt
 * @param {object} profile
 * @returns {string}
 */
export function replaceTokensInPrompt(prompt, profile) {
  if (!prompt || !profile) return prompt;
  return String(prompt).replace(TOKEN_PATTERN, (match, rawName) => {
    const value = resolveToken(profile, rawName.trim());
    return value === null ? match : value;
  });
}

/**
 * Report which tokens in a prompt resolve against a profile and which don't.
 * Lets callers surface "3 of 5 tokens will personalize" style feedback and
 * warn before shipping a prompt that still contains raw placeholders.
 *
 * @param {string} prompt
 * @param {object} profile
 * @returns {{ resolved: Array<{token:string,value:string}>, unresolved: string[] }}
 */
export function inspectPromptTokens(prompt, profile) {
  const resolved = [];
  const unresolved = [];
  for (const token of extractTokens(prompt)) {
    const value = profile ? resolveToken(profile, token) : null;
    if (value === null) unresolved.push(token);
    else resolved.push({ token, value });
  }
  return { resolved, unresolved };
}

/**
 * Mount a "Personalize" trigger button into `controlsContainer`. Clicking the
 * button opens the `PersonalizeModal` (BaseModal subclass) as a pop-up dialog.
 *
 * Available in every video/image creation module (VideoStudio, ImageStudio,
 * CinemaStudio, CharacterStudio, etc.).
 *
 * @param {object} opts
 * @param {HTMLElement} opts.controlsContainer - the flex row that holds model/aspect/etc. buttons
 * @param {string} [opts.label] - button label, default "Personalize"
 * @param {string} [opts.tooltip] - button tooltip
 * @param {() => HTMLTextAreaElement|null} opts.getTextarea - returns the prompt textarea (looked up lazily)
 * @param {string} [opts.appId] - app id passed to /api/personalizer/generate
 * @param {string} [opts.appTheme] - BaseModal theme key for the pop-up
 * @param {(detail: {contactId: string, profile: object}) => void} [opts.onApply] - called when the user applies personalization
 * @param {() => void} [opts.onClear] - called when the user clears the selected contact
 * @returns {{ button: HTMLButtonElement, open: () => Promise<void>, refresh: () => void, getActiveProfile: () => object|null, getModal: () => object|null, destroy: () => void }}
 */
export function mountPersonalizeTrigger(opts) {
  return _mountTrigger(opts);
}

/**
 * Backward-compatible alias: the old name `mountPersonalizePopover` now mounts
 * a trigger button that opens the PersonalizeModal (no more inline popover).
 *
 * @deprecated Use `mountPersonalizeTrigger` instead.
 */
export function mountPersonalizePopover(opts) {
  return _mountTrigger(opts);
}

function _mountTrigger({
  controlsContainer,
  label = 'Personalize',
  tooltip = 'Personalize with a discovered contact',
  getTextarea,
  appId = 'ai-video-agency',
  appTheme,
  onApply,
  onClear,
} = {}) {
  if (!controlsContainer || typeof controlsContainer.appendChild !== 'function') {
    throw new Error('mountPersonalizeTrigger: controlsContainer must be a DOM element');
  }
  const button = document.createElement('button');
  button.id = 'v-contact-btn';
  button.className = 'flex items-center gap-1.5 md:gap-2.5 px-3 md:px-4 py-2 md:py-2.5 bg-white/5 hover:bg-white/10 rounded-xl md:rounded-2xl transition-all border border-white/5 group whitespace-nowrap';
  button.setAttribute('data-tooltip', tooltip);
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-60 text-secondary"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    <span id="v-contact-btn-label" class="text-xs font-bold text-white group-hover:text-primary transition-colors">${label}</span>
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" class="opacity-20 group-hover:opacity-100 transition-opacity"><path d="M6 9l6 6 6-6"/></svg>
  `;
  controlsContainer.appendChild(button);

  // Lazy-load the modal class so host apps that only need the trigger don't
  // pay the cost of the full BaseModal/PersonalizeModal bundle.
  let modal = null;
  let modalPromise = null;
  const ensureModal = async () => {
    if (modal) return modal;
    if (!modalPromise) {
      modalPromise = import('../modals/PersonalizeModal.jsx').then((m) => {
        // Forward the host app's callbacks. These used to be dropped here,
        // which meant no studio could ever react to "Apply personalization".
        modal = new m.PersonalizeModal({
          appId,
          appTheme,
          getTextarea,
          onApply: (detail) => {
            refresh();
            if (typeof onApply === 'function') onApply(detail);
          },
          onClear: () => {
            refresh();
            if (typeof onClear === 'function') onClear();
          },
        });
        return modal;
      });
    }
    return modalPromise;
  };

  const open = async () => {
    const m = await ensureModal();
    m.open();
  };

  button.onclick = (e) => {
    e.stopPropagation();
    open();
  };

  // Update the trigger label to the active contact's name (if any).
  const refresh = () => {
    const id = getSelectedContactId();
    const lbl = button.querySelector('#v-contact-btn-label');
    if (!lbl) return;
    if (id) {
      try {
        const contacts = _listContacts();
        const c = contacts.find((x) => x.id === id);
        lbl.textContent = c?.name || label;
      } catch { lbl.textContent = label; }
    } else {
      lbl.textContent = label;
    }
  };

  // Auto-open if requested by another app (e.g., AI creation apps that set
  // localStorage flag and navigate here).
  if (typeof localStorage !== 'undefined' && localStorage.getItem('remix_open_personalize') === 'true') {
    localStorage.removeItem('remix_open_personalize');
    setTimeout(() => { open(); }, 100);
  }

  // Keep the label in sync with contact changes.
  window.addEventListener('remix:contact-changed', refresh);
  refresh();

  // Callers that unmount their host container should call destroy() so the
  // window listener doesn't leak one entry per mount.
  const destroy = () => {
    window.removeEventListener('remix:contact-changed', refresh);
    button.remove();
  };

  return {
    button,
    open,
    refresh,
    destroy,
    getModal: () => modal,
    getActiveProfile: () => {
      const id = getSelectedContactId();
      return id ? _getProfile(id) : null;
    },
  };
}
