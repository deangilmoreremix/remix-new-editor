import { describe, expect, it } from 'vitest';
import { scrapeBrandSite } from '../../netlify/functions/_personalizationAssets.js';

describe('scrapeBrandSite SSRF guards', () => {
  it.each([
    'http://localhost/test',
    'http://127.0.0.1/test',
    'http://169.254.169.254/latest/meta-data',
    'http://10.0.0.1/test',
    'file:///etc/passwd',
  ])('rejects unsafe URL %s', async (url) => {
    await expect(scrapeBrandSite(url)).rejects.toThrow();
  });

  it('requires a url', async () => {
    await expect(scrapeBrandSite('')).rejects.toThrow(/required/i);
  });
});
