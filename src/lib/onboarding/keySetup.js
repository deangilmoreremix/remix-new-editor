// src/lib/onboarding/keySetup.js
//
// The "Get ready" screen's Muapi key step: validate the format, store the key, and really test it against the
// (free) balance call. A key the server rejects is removed again, so a typo never lingers as "connected".
import { apiKeyManager as defaultKeys } from '../apiKeyManager.js';

const label = 'Muapi API key';

/** Same format rules as Settings (spaces, pasted twice, too short); '' when fine. */
export async function keyFormatError(raw) {
  const { validateApiKeyFormat } = await import('../../components/SettingsModal.js');
  return validateApiKeyFormat(raw, label) || '';
}

/**
 * testAndSaveMuapiKey(raw) ->
 *   { ok: true, status: 'valid', balance } | { ok: true, status: 'unverified' } (saved, but the check could not run)
 *   | { ok: false, status: 'format'|'invalid'|'empty', error }
 */
export async function testAndSaveMuapiKey(raw, { keys = defaultKeys, probe, formatError = keyFormatError } = {}) {
  const value = String(raw || '').trim();
  if (!value) return { ok: false, status: 'empty', error: 'Paste your Muapi API key first.' };
  const bad = await formatError(value);
  if (bad) return { ok: false, status: 'format', error: bad };
  const previous = keys.getMuapiKey?.() || null;
  await keys.setMuapiKey(value, true);
  const check = await (probe || (async () => (await import('../muapi.js')).muapi.checkKey()))();
  if (check?.status === 'invalid') {
    if (previous) await keys.setMuapiKey(previous, previous !== 'dev'); else keys.clearMuapiKey();
    return { ok: false, status: 'invalid', error: 'Muapi did not accept that key. Check it and try again.' };
  }
  if (check?.status === 'valid') return { ok: true, status: 'valid', balance: check.balance };
  return { ok: true, status: 'unverified' };
}

// The local-development placeholder ("dev", see apiKeyManager.js) is not a real key.
export const hasMuapiKey = (keys = defaultKeys) => !!keys.hasMuapiKey?.() && keys.getMuapiKey?.() !== 'dev';
