// src/components/personalize/personalizePopover.js
//
// Trigger button + token utilities for the Personalize modal.
//
// The button opens the Personalization + Lead Finder modal ported from
// OpenHiggsBolt (`src/features/personalization/mount.jsx`). This module mounts the trigger button
// into a host app's controls container and exports the token-insertion /
// token-replacement helpers the modal and host apps share.
//
// Responsibilities of this module:
//   - Mount a "Personalize" button into any controls container
//   - On click, open the Personalization + Lead Finder modal
//   - Export `insertTokenAtCursor` for inline token insertion
//   - Export `replaceTokensInPrompt` for host-app token replacement at
//     generation time
//   - Auto-open the modal when `remix_open_personalize === 'true'` is set
//
// The modal itself handles the lead finder (business search + saved leads),
// brand asset discovery, the guided personalize wizard and generation.

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
 * button opens the Personalization + Lead Finder modal (src/features/personalization).
 *
 * Available in every video/image creation module (VideoStudio, ImageStudio,
 * CinemaStudio, CharacterStudio, etc.).
 *
 * @param {object} opts
 * @param {HTMLElement} opts.controlsContainer - the flex row that holds model/aspect/etc. buttons
 * @param {string} [opts.label] - button label, default "Personalize"
 * @param {string} [opts.tooltip] - button tooltip
 * @param {() => HTMLTextAreaElement|null} opts.getTextarea - returns the prompt textarea (looked up lazily)
 * @param {string} [opts.studioId] - source studio id for handoff
 * @param {string} [opts.studioName] - source studio display name
 * @param {string} [opts.returnRoute] - route to return to from Personalizer
 * @param {() => object} [opts.getAsset] - returns current personalizable asset
 * @param {() => object} [opts.getProject] - returns current project metadata
 * @param {() => Array<object>} [opts.getPersonalizableFields] - returns personalizable fields for the current asset
 * @param {() => string} [opts.getPreview] - returns a preview URL or blob reference
 * @param {(detail: {contactId: string, profile: object, handoff: object}) => void} [opts.onSendToPersonalizer] - called when the user clicks "Open in Personalizer"
 * @returns {{ button: HTMLButtonElement, open: () => Promise<void>, refresh: () => void, getActiveProfile: () => object|null, getModal: () => object|null, destroy: () => void }}
 */
  export function mountPersonalizeTrigger(opts) {
    return _mountTrigger(opts);
  }

  /**
   * Backward-compatible alias: the old name `mountPersonalizePopover` now mounts
   * a trigger button that opens the Personalization + Lead Finder modal.
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
   studioId,
   studioName,
   returnRoute,
   getAsset,
   getProject,
   getPersonalizableFields,
   getPreview,
   onApply,
   onClear,
   onSendToPersonalizer,
 } = {}) {
  if (!controlsContainer || typeof controlsContainer.appendChild !== 'function') {
    throw new Error('mountPersonalizeTrigger: controlsContainer must be a DOM element');
  }
  const button = document.createElement('button');
  button.id = 'v-contact-btn';
  button.className = 'btn-personalize';
  button.setAttribute('data-tooltip', tooltip);
  const labelSpan = document.createElement('span');
  labelSpan.id = 'v-contact-btn-label';
  labelSpan.className = 'text-xs font-bold text-white group-hover:text-primary transition-colors';
  labelSpan.textContent = label;
  const arrowSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  arrowSvg.setAttribute('width', '10');
  arrowSvg.setAttribute('height', '10');
  arrowSvg.setAttribute('viewBox', '0 0 24 24');
  arrowSvg.setAttribute('fill', 'none');
  arrowSvg.setAttribute('stroke', 'currentColor');
  arrowSvg.setAttribute('stroke-width', '4');
  arrowSvg.setAttribute('class', 'opacity-20 group-hover:opacity-100 transition-opacity');
  const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  arrowPath.setAttribute('d', 'M6 9l6 6 6-6');
  arrowSvg.appendChild(arrowPath);
  button.appendChild(labelSpan);
  button.appendChild(arrowSvg);
  controlsContainer.appendChild(button);

  // Lazy-load the Personalization + Lead Finder modal (ported from
  // OpenHiggsBolt, see src/features/personalization). It is a React island,
  // so host apps that only need the trigger don't pay for the bundle until
  // the button is clicked.
  const readContext = () => {
    const textarea = typeof getTextarea === 'function' ? getTextarea() : null;
    let asset = null;
    try { asset = typeof getAsset === 'function' ? getAsset() : null; } catch { asset = null; }
    let mediaUrl = '';
    try { mediaUrl = (typeof getPreview === 'function' ? getPreview() : '') || asset?.previewUrl || ''; } catch { mediaUrl = ''; }
    // Blob/data URLs can't be fetched by the server-side discovery and
    // generation routes; open prompt-only instead.
    if (/^(blob:|data:)/i.test(mediaUrl)) mediaUrl = '';
    const fields = Array.isArray(asset?.fields) ? asset.fields : [];
    const fieldValue = (id) => fields.find((f) => f && f.id === id)?.value;
    // The asset's type describes the studio's OUTPUT. It only says what the
    // preview is when the preview is that output; a studio can preview a
    // reference/first-frame image instead (Cinema Studio before a video
    // exists), which mount.jsx then classifies from the URL itself.
    const referenceUrls = [fieldValue('firstFrameUrl'), fieldValue('lastFrameUrl')]
      .concat(Array.isArray(fieldValue('referenceImages')) ? fieldValue('referenceImages') : []);
    const previewIsReferenceImage = Boolean(mediaUrl) && referenceUrls.includes(mediaUrl);
    const typeHint = previewIsReferenceImage
      ? 'image'
      : asset?.type === 'video' ? 'video' : asset?.type === 'image' ? 'image' : undefined;
    return {
      studioId,
      studioName,
      appId,
      mediaUrl,
      mediaType: typeHint,
      prompt: textarea?.value || fieldValue('prompt') || '',
      model: fieldValue('model') || undefined,
      aspectRatio: fieldValue('aspectRatio') || undefined,
      title: asset?.title || undefined,
    };
  };

  const open = async () => {
    const { openPersonalization } = await import('../../features/personalization/mount.jsx');
    openPersonalization({
      ...readContext(),
      trigger: button,
      onComplete: (completion) => {
        refresh();
        if (typeof onApply === 'function') onApply({ completion, returnRoute, appId, appTheme, onSendToPersonalizer, onClear });
      },
    });
  };

  button.onclick = (e) => {
    e.stopPropagation();
    open();
  };

  // Update the trigger label to the active contact's first name (if any).
  const refresh = () => {
    const id = getSelectedContactId();
    const lbl = button.querySelector('#v-contact-btn-label');
    if (!lbl) return;
    if (id) {
      try {
        const contacts = _listContacts();
        const c = contacts.find((x) => x.id === id);
        const rawName = c?.name || label;
        const firstName = rawName.split(' ')[0];
        lbl.textContent = firstName.length > 12 ? firstName.slice(0, 12) + '…' : firstName;
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
    getModal: () => null,
    getActiveProfile: () => {
      const id = getSelectedContactId();
      return id ? _getProfile(id) : null;
    },
  };
}
