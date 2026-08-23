// src/lib/contactStore.js
//
// Browser-side contact/profile store backed by localStorage.
//
// This is the canonical read/write layer for the personalizer's client state.
// It uses exactly the same keys as `src/components/personalize/personalizePopover.js`
// and `src/components/modals/PersonalizeModal.jsx`, which inline equivalent
// helpers deliberately to stay dependency-free:
//
//   remix_contacts             -> Contact[]
//   remix_contact_profiles     -> Profile[]  (Profile.id === Contact.id)
//   remix_selected_contact_id  -> string | null
//
// NOTE: this module is browser-only. Do not import it from a Netlify function
// or any other server context — there is no localStorage there. The
// server-side equivalents live inside `netlify/functions/intelligence-api.js`
// and are backed by Supabase.

import { buildVariables } from '../components/personalize/tokenSchema.js';

const CONTACTS_KEY = 'remix_contacts';
const PROFILES_KEY = 'remix_contact_profiles';
const SELECTED_CONTACT_KEY = 'remix_selected_contact_id';

/** Safe JSON read from localStorage. */
function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

/** Safe JSON write to localStorage. Returns false when storage is unavailable. */
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Quota exceeded or private-mode restrictions — callers treat this as
    // best-effort rather than fatal.
    return false;
  }
}

/** Notify the app that the active contact or its data changed. */
function emitContactChanged(contactId) {
  try {
    window.dispatchEvent(new CustomEvent('remix:contact-changed', { detail: { contactId } }));
  } catch {}
}

// ─── Contacts ────────────────────────────────────────────────────────────────

/** @returns {object[]} all stored contacts, newest first. */
export function listContacts() {
  const contacts = read(CONTACTS_KEY, []);
  return Array.isArray(contacts) ? contacts : [];
}

/** @returns {object|null} */
export function getContact(contactId) {
  if (!contactId) return null;
  return listContacts().find((c) => c.id === contactId) || null;
}

/**
 * Insert or update a contact. Matching is by `id`; an updated contact keeps
 * its original `createdAt` and moves to the front of the list.
 * @returns {object} the saved contact
 */
export function saveContact(contact) {
  if (!contact || !contact.id) throw new Error('saveContact: contact.id is required');
  const contacts = listContacts();
  const existingIndex = contacts.findIndex((c) => c.id === contact.id);
  const now = new Date().toISOString();

  const merged = {
    ...(existingIndex >= 0 ? contacts[existingIndex] : {}),
    ...contact,
    createdAt: (existingIndex >= 0 ? contacts[existingIndex].createdAt : null) || contact.createdAt || now,
    updatedAt: now,
  };

  if (existingIndex >= 0) contacts.splice(existingIndex, 1);
  contacts.unshift(merged);
  write(CONTACTS_KEY, contacts);
  return merged;
}

/**
 * Delete a contact, its profile, and clear the selection if it was selected.
 * @returns {boolean} whether a contact was removed
 */
export function deleteContact(contactId) {
  if (!contactId) return false;
  const contacts = listContacts();
  const next = contacts.filter((c) => c.id !== contactId);
  const removed = next.length !== contacts.length;
  if (removed) write(CONTACTS_KEY, next);

  const profiles = listProfiles().filter((p) => p.id !== contactId);
  write(PROFILES_KEY, profiles);

  if (getSelectedContactId() === contactId) {
    setSelectedContactId(null);
    emitContactChanged(null);
  }
  return removed;
}

// ─── Profiles ────────────────────────────────────────────────────────────────

/** @returns {object[]} all stored profiles. */
export function listProfiles() {
  const profiles = read(PROFILES_KEY, []);
  return Array.isArray(profiles) ? profiles : [];
}

/** @returns {object|null} */
export function getProfile(contactId) {
  if (!contactId) return null;
  return listProfiles().find((p) => p.id === contactId) || null;
}

/**
 * Insert or update a profile.
 *
 * The flat `variables` token map is always recomputed from the nested profile
 * via the shared token schema, so it can never drift out of sync with the
 * underlying data (the previous hand-built map left most tokens empty).
 *
 * @returns {object} the saved profile
 */
export function saveProfile(profile) {
  if (!profile || !profile.id) throw new Error('saveProfile: profile.id is required');
  const profiles = listProfiles();
  const existingIndex = profiles.findIndex((p) => p.id === profile.id);
  const now = new Date().toISOString();

  const merged = {
    ...(existingIndex >= 0 ? profiles[existingIndex] : {}),
    ...profile,
    createdAt: (existingIndex >= 0 ? profiles[existingIndex].createdAt : null) || profile.createdAt || now,
    updatedAt: now,
  };

  // Explicitly provided variables act as a seed; derived values fill the rest.
  merged.variables = buildVariables(merged, profile.variables || {});

  if (existingIndex >= 0) profiles.splice(existingIndex, 1);
  profiles.unshift(merged);
  write(PROFILES_KEY, profiles);
  return merged;
}

/**
 * Shallow-merge a patch into an existing profile (nested containers are merged
 * one level deep so callers can update e.g. only `intelligence`).
 * @returns {object|null} the updated profile, or null when it doesn't exist
 */
export function updateProfile(contactId, patch = {}) {
  const existing = getProfile(contactId);
  if (!existing) return null;

  const MERGE_KEYS = ['contact', 'company', 'brand', 'social', 'website', 'assets', 'intelligence', 'campaign', 'history'];
  const next = { ...existing, ...patch };
  for (const key of MERGE_KEYS) {
    if (patch[key] && typeof patch[key] === 'object' && !Array.isArray(patch[key])) {
      next[key] = { ...(existing[key] || {}), ...patch[key] };
    }
  }
  next.id = contactId;
  return saveProfile(next);
}

/**
 * Append a discovery attempt to a profile's history.
 * Mirrors the server-side `recordDiscovery` shape.
 * @returns {object|null} the updated profile
 */
export function addDiscovery(contactId, source, status, data = null, error = null, durationMs = null) {
  const existing = getProfile(contactId);
  if (!existing) return null;
  const history = existing.history || {};
  const discoveries = Array.isArray(history.discoveries) ? [...history.discoveries] : [];
  discoveries.push({
    source,
    status,
    success: status === 'success',
    timestamp: new Date().toISOString(),
    data,
    error,
    durationMs,
  });
  return updateProfile(contactId, { history: { ...history, discoveries } });
}

// ─── Selection ───────────────────────────────────────────────────────────────

/** @returns {string|null} */
export function getSelectedContactId() {
  try {
    return localStorage.getItem(SELECTED_CONTACT_KEY) || null;
  } catch {
    return null;
  }
}

/** Set (or clear, with a falsy value) the active contact. */
export function setSelectedContactId(contactId) {
  try {
    if (contactId) localStorage.setItem(SELECTED_CONTACT_KEY, contactId);
    else localStorage.removeItem(SELECTED_CONTACT_KEY);
  } catch {}
}

/** @returns {object|null} the profile of the currently selected contact. */
export function getActiveProfile() {
  return getProfile(getSelectedContactId());
}

/** @returns {object|null} the currently selected contact. */
export function getActiveContact() {
  return getContact(getSelectedContactId());
}

/**
 * Select a contact and broadcast the change so mounted triggers re-label.
 * @returns {object|null} the newly active profile
 */
export function selectContact(contactId) {
  setSelectedContactId(contactId);
  emitContactChanged(contactId || null);
  return getProfile(contactId);
}
