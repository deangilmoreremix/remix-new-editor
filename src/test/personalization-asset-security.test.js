import { describe, expect, it } from 'vitest';
import { sanitizePublicHttpUrl } from '../../netlify/functions/_personalizationAssets.js';

describe('personalization asset SSRF guards', () => {
  it.each([
    'http://localhost/test',
    'http://127.0.0.1/test',
    'http://10.0.0.1/test',
    'http://192.168.1.10/test',
    'file:///etc/passwd',
  ])('rejects unsafe URL %s', async (url) => {
    await expect(sanitizePublicHttpUrl(url)).rejects.toThrow();
  });
});
