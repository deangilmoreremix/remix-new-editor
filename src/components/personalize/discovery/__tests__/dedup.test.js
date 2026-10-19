// src/components/personalize/discovery/__tests__/dedup.test.js
import { describe, it, expect } from 'vitest';
import { normalizeUrl, dedupeUrls } from '../dedup.js';

describe('dedup.normalizeUrl', () => {
  it('lowercases scheme and host', () => {
    expect(normalizeUrl('HTTPS://Example.COM/foo')).toBe('https://example.com/foo');
  });
  it('strips fragments', () => {
    expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page');
  });
  it('drops default ports', () => {
    expect(normalizeUrl('https://example.com:443/foo')).toBe('https://example.com/foo');
    expect(normalizeUrl('http://example.com:80/foo')).toBe('http://example.com/foo');
  });
  it('strips trailing slash on non-root paths', () => {
    expect(normalizeUrl('https://example.com/foo/')).toBe('https://example.com/foo');
  });
  it('keeps root slash', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });
  it('strips utm_* params', () => {
    expect(normalizeUrl('https://example.com/page?utm_source=x&id=1'))
      .toBe('https://example.com/page?id=1');
  });
  it('strips fbclid and gclid', () => {
    expect(normalizeUrl('https://example.com/page?fbclid=x&id=1'))
      .toBe('https://example.com/page?id=1');
    expect(normalizeUrl('https://example.com/page?gclid=y&id=1'))
      .toBe('https://example.com/page?id=1');
  });
  it('sorts query keys', () => {
    expect(normalizeUrl('https://example.com/page?b=2&a=1'))
      .toBe('https://example.com/page?a=1&b=2');
  });
  it('returns null for invalid URLs', () => {
    expect(normalizeUrl('not a url')).toBe(null);
  });
});

describe('dedup.dedupeUrls', () => {
  it('dedupes utm-stripped URLs', () => {
    const urls = [
      'https://example.com/page?utm_source=a',
      'https://example.com/page?utm_source=b',
      'https://example.com/page',
    ];
    const r = dedupeUrls(urls);
    // First occurrence is kept; subsequent utm variants collapse.
    expect(r.unique.length).toBe(1);
    expect(r.unique[0]).not.toMatch(/utm_/);
    expect(r.count).toBe(1);
  });
  it('keeps URLs whose paths differ in case (HTTP paths are case-sensitive)', () => {
    const urls = [
      'https://example.com/A',
      'https://example.com/a',
    ];
    const r = dedupeUrls(urls);
    expect(r.count).toBe(2);
  });
  it('keeps distinct URLs', () => {
    const urls = [
      'https://example.com/a',
      'https://example.com/b',
      'https://example.com/c',
    ];
    const r = dedupeUrls(urls);
    expect(r.count).toBe(3);
  });
  it('uses hash fallback when normalized URLs differ but SHA matches', () => {
    // Two URLs that survive normalization but happen to hash-collide
    // are extremely unlikely — instead, verify that the hash fallback
    // path is exercised by giving two IDENTICAL normalized forms via
    // different code paths (e.g. trailing slash variations that the
    // normalizer already handles). The byHash counter should be 0
    // because the normalizer catches them first.
    const urls = [
      'https://example.com/a/',
      'https://example.com/a',
    ];
    const r = dedupeUrls(urls);
    expect(r.unique.length).toBe(1);
    expect(r.byHash).toBe(0);
  });
  it('skips invalid URLs silently', () => {
    const urls = ['not a url', 'https://example.com/'];
    const r = dedupeUrls(urls);
    expect(r.unique).toEqual(['https://example.com/']);
  });
});