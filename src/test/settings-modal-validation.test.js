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
    // NOTE: must stay an obviously-fake placeholder. A real-format
    // high-entropy key here trips Netlify's secret scanner and fails
    // every production build ('building site ... exit code: 2').
    const ok = 'sk-VALIDFORMATPLACEHOLDER00000000000000000000000';
    expect(validateApiKeyFormat(ok, 'VideoDB API Key')).toBeNull();
  });

  test('rejects a key pasted twice (duplicated token)', () => {
    const single = 'sk-VALIDFORMATPLACEHOLDER00000000000000000000000';
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
