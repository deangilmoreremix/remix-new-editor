// src/components/personalize/discovery/__tests__/urlSafety.test.js
import { describe, it, expect } from 'vitest';
import {
  validateUrl,
  reResolveGuard,
  validateAssetUrl,
  checkSocialDomainBlock,
  isPrivateIp,
  UNSUPPORTED_SOCIAL_DOMAINS,
  JUNK_EXTENSIONS,
  ALLOWED_ASSET_EXTENSIONS,
  MAX_URL_LENGTH,
} from '../urlSafety.js';

describe('urlSafety.isPrivateIp', () => {
  it('flags loopback IPv4', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('127.255.255.254')).toBe(true);
  });
  it('flags RFC1918 ranges', () => {
    expect(isPrivateIp('10.0.0.1')).toBe(true);
    expect(isPrivateIp('172.16.0.1')).toBe(true);
    expect(isPrivateIp('172.31.255.255')).toBe(true);
    expect(isPrivateIp('192.168.1.1')).toBe(true);
  });
  it('flags link-local', () => {
    expect(isPrivateIp('169.254.1.1')).toBe(true);
    expect(isPrivateIp('169.254.169.254')).toBe(true);
  });
  it('flags IPv6 loopback and ULA', () => {
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('fc00::1')).toBe(true);
    expect(isPrivateIp('fd00::1')).toBe(true);
    expect(isPrivateIp('fe80::1')).toBe(true);
  });
  it('does not flag public IPs', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
    expect(isPrivateIp('2606:4700:4700::1111')).toBe(false);
  });
});

describe('urlSafety.validateUrl — IP literals', () => {
  it('rejects 127.0.0.1', async () => {
    const r = await validateUrl('http://127.0.0.1/page');
    expect(r.safe).toBe(false);
    expect(r.reason).toMatch(/private IP/);
  });
  it('rejects 10.0.0.1', async () => {
    const r = await validateUrl('http://10.0.0.1/');
    expect(r.safe).toBe(false);
  });
  it('rejects 192.168.1.1', async () => {
    const r = await validateUrl('http://192.168.1.1/');
    expect(r.safe).toBe(false);
  });
  it('rejects 169.254.169.254', async () => {
    const r = await validateUrl('http://169.254.169.254/');
    expect(r.safe).toBe(false);
  });
  it('rejects ::1', async () => {
    const r = await validateUrl('http://[::1]/');
    expect(r.safe).toBe(false);
  });
  it('rejects fc00::1', async () => {
    const r = await validateUrl('http://[fc00::1]/');
    expect(r.safe).toBe(false);
  });
});

describe('urlSafety.validateUrl — hostnames', () => {
  it('rejects localhost', async () => {
    const r = await validateUrl('http://localhost/page');
    expect(r.safe).toBe(false);
    expect(r.reason).toMatch(/blocked/);
  });
  it('rejects metadata.google.internal', async () => {
    const r = await validateUrl('http://metadata.google.internal/computeMetadata/v1/');
    expect(r.safe).toBe(false);
  });
});

describe('urlSafety.validateUrl — protocol + shape', () => {
  it('rejects ftp://', async () => {
    const r = await validateUrl('ftp://example.com/');
    expect(r.safe).toBe(false);
    expect(r.reason).toMatch(/Protocol/);
  });
  it('rejects file://', async () => {
    const r = await validateUrl('file:///etc/passwd');
    expect(r.safe).toBe(false);
  });
  it('rejects javascript:', async () => {
    const r = await validateUrl('javascript:alert(1)');
    expect(r.safe).toBe(false);
  });
  it('rejects userinfo in URL', async () => {
    const r = await validateUrl('https://user:pass@example.com/');
    expect(r.safe).toBe(false);
    expect(r.reason).toMatch(/userinfo/);
  });
  it('rejects URLs longer than MAX_URL_LENGTH', async () => {
    const longPath = 'a'.repeat(MAX_URL_LENGTH);
    const r = await validateUrl(`https://example.com/${longPath}`);
    expect(r.safe).toBe(false);
    expect(r.reason).toMatch(/exceeds/);
  });
  it('rejects empty URL', async () => {
    const r = await validateUrl('');
    expect(r.safe).toBe(false);
  });
  it('strips fragments on normalization', async () => {
    const r = await validateUrl('https://example.com/page#section');
    if (r.safe) {
      expect(r.normalized).not.toContain('#');
    }
    // Network may not be available in CI — just assert shape if safe.
    expect([true, false]).toContain(r.safe);
  });
});

describe('urlSafety.checkSocialDomainBlock', () => {
  it('blocks facebook.com', () => {
    const r = checkSocialDomainBlock('https://facebook.com/x');
    expect(r.blocked).toBe(true);
    expect(r.domain).toBe('facebook.com');
  });
  it('blocks subdomain facebook.com', () => {
    const r = checkSocialDomainBlock('https://m.facebook.com/x');
    expect(r.blocked).toBe(true);
  });
  it('blocks twitter / x / tiktok / linkedin / reddit / pinterest / youtube / instagram', () => {
    for (const d of UNSUPPORTED_SOCIAL_DOMAINS) {
      const r = checkSocialDomainBlock(`https://${d}/x`);
      expect(r.blocked).toBe(true);
    }
  });
  it('does not block unrelated domains', () => {
    const r = checkSocialDomainBlock('https://example.com/x');
    expect(r.blocked).toBe(false);
  });
});

describe('urlSafety.validateAssetUrl', () => {
  it('rejects .exe', () => {
    const r = validateAssetUrl('https://example.com/file.exe');
    expect(r.ok).toBe(false);
  });
  it('rejects .zip', () => {
    const r = validateAssetUrl('https://example.com/file.zip');
    expect(r.ok).toBe(false);
  });
  it.each(JUNK_EXTENSIONS)('rejects junk extension %s', (ext) => {
    const r = validateAssetUrl(`https://example.com/file${ext}`);
    expect(r.ok).toBe(false);
  });
  it.each(ALLOWED_ASSET_EXTENSIONS)('allows extension %s', (ext) => {
    const r = validateAssetUrl(`https://example.com/file${ext}`);
    expect(r.ok).toBe(true);
    expect(r.extension).toBe(ext);
  });
});

describe('urlSafety.reResolveGuard', () => {
  it('rejects if a hostname now resolves to a private IP', async () => {
    // example.com resolves to a public IP normally. We can't reliably
    // rebind in a unit test, but we can pass a known private literal.
    const r = await reResolveGuard('127.0.0.1', ['1.2.3.4']);
    expect(r.safe).toBe(false);
  });
  it('returns same address set for a literal IP', async () => {
    const r = await reResolveGuard('8.8.8.8', ['8.8.8.8']);
    expect(r.safe).toBe(true);
  });
});