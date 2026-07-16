// Tests for API key format validation in the setup popup.
// Guards against the real bug we hit: a key pasted twice (duplicated token)
// which VideoDB rejected with a 401 "Invalid API key".

import { describe, test, expect } from 'vitest';
import { validateApiKeyFormat } from '../components/SettingsModal.js';

describe('validateApiKeyFormat', () => {
  test('empty value is allowed (clears the key)', () => {
    expect(validateApiKeyFormat('', 'VideoDB API Key')).toBeNull();
    expect(validateApiKeyFormat('   ', 'VideoDB API Key')).toBeNull();
  });

  test('a valid key passes', () => {
    const ok = 'sk-1a4MzrimOpn7NHpEgrVYnwFHNgCiJweSemObWLdtnEs';
    expect(validateApiKeyFormat(ok, 'VideoDB API Key')).toBeNull();
  });

  test('rejects a key pasted twice (duplicated token)', () => {
    const single = 'sk-1a4MzrimOpn7NHpEgrVYnwFHNgCiJweSemObWLdtnEs';
    const doubled = single + single; // exactly what caused the 401
    const err = validateApiKeyFormat(doubled, 'VideoDB API Key');
    expect(err).toMatch(/duplicated|pasted twice/i);
  });

  test('rejects keys containing whitespace', () => {
    const err = validateApiKeyFormat('sk-abc def', 'OpenAI API Key');
    expect(err).toMatch(/spaces/i);
  });

  test('rejects obviously too-short keys', () => {
    const err = validateApiKeyFormat('abc', 'Muapi API Key');
    expect(err).toMatch(/too short/i);
  });

  test('uses the provider label in the message', () => {
    const err = validateApiKeyFormat('sk-abc def', 'Muapi API Key');
    expect(err).toContain('Muapi API Key');
  });
});
