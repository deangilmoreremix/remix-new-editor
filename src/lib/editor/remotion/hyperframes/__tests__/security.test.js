// Ported from poc/hyperframes-remotion/security.check.mjs (node:test) to the repo's vitest runner.
import { describe, it, expect } from 'vitest';
import { validateAssetUrl, validateOverrides, validateColor, sanitizeText, stripUnsafeAttributes } from '../security.js';
import { applyOverrides } from '../overrides.js';

const bad = (u, o) => expect(validateAssetUrl(u, o).ok, `should reject: ${u}`).toBe(false);
const good = (u, o) => expect(validateAssetUrl(u, o).ok, `should accept: ${u}`).toBe(true);

describe('asset URL policy', () => {
  it('rejects hostile URLs', () => {
    for (const u of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', 'data:image/svg+xml,<svg onload=alert(1)>', 'file:///etc/passwd', 'ftp://x/y.png', 'http://example.com/a.png', 'https://evil.example/x.png', '//evil.example/x.png', '/etc/passwd', '../secret.png', 'a/../../b.png', 'a\\b.png', 'a%2e%2e/b.png', 'https://fonts.googleapis.com.evil.com/x', '', ' ', 'java\nscript:alert(1)']) bad(u);
    expect(validateAssetUrl(5).ok).toBe(false);
    expect(validateAssetUrl('data:image/png;base64,' + 'A'.repeat(2_000_001)).ok).toBe(false);
  });
  it('accepts legitimate URLs', () => {
    good('data:image/png;base64,' + 'A'.repeat(50_000)); // large inline images are fine up to 2 MB
    bad('https://cdn.example.com/' + 'a'.repeat(5000), { allowHosts: ['cdn.example.com'] });
    good('assets/logo.png'); good('./assets/logo.png'); good('blob:https://app.example/1234-5678'); good('data:image/png;base64,iVBORw0KGgo=');
    good('https://cdn.example.com/a.png', { allowHosts: ['cdn.example.com'] }); good('https://img.cdn.example.com/a.png', { allowHosts: ['cdn.example.com'] });
    good('https://fonts.gstatic.com/s/x.woff2', { allowFontHosts: true }); bad('https://fonts.gstatic.com/s/x.woff2');
  });
});

describe('values and overrides', () => {
  it('validates colors and text', () => {
    for (const c of ['#fff', '#e11d48', 'rgb(1,2,3)', 'rgba(0, 0, 0, .5)', 'hsl(10 20% 30%)', 'crimson']) expect(validateColor(c)).toBe(true);
    for (const c of ['url(javascript:1)', 'red;background:url(x)', 'expression(alert(1))', '#ggg', 'x'.repeat(100), 5]) expect(validateColor(c)).toBe(false);
    expect(sanitizeText('a\u0000b\u0007c')).toBe('abc'); expect(sanitizeText('x'.repeat(500)).length).toBe(200); expect(sanitizeText(5)).toBe(null);
  });
  it('accepts a real SDK business override set', () => {
    const r = validateOverrides({ 'hf-tjqa.text': "Maria's Bakery", 'hf-0l4y.style.backgroundColor': '#e11d48', 'hf-logo.attr.src': 'https://cdn.example.com/logo.png' }, { allowHosts: ['cdn.example.com'] });
    expect(r.ok).toBe(true); expect(Object.keys(r.cleaned)).toHaveLength(3);
  });
  it('rejects hostile keys and values; nothing hostile survives; no prototype pollution', () => {
    const hostile = { 'hf-a.attr.onclick': 'alert(1)', 'hf-a.attr.style': 'background:url(javascript:1)', 'hf-a.attr.href': 'javascript:alert(1)', 'hf-a.attr.src': 'https://evil.example/x.png', 'hf-a.style.background': 'url(https://evil/x)', 'hf-a.style.backgroundColor': 'red;background:url(x)', '__proto__.polluted': 'x', 'hf-new': { html: '<img src=x onerror=alert(1)>' }, 'hf-a.text': { not: 'a string' }, 'hf-a.removed': null, unknown: 'x' };
    const r = validateOverrides(hostile);
    expect(r.ok).toBe(false); expect(Object.keys(r.cleaned)).toHaveLength(0); expect(r.rejected).toHaveLength(Object.keys(hostile).length);
    expect({}.polluted).toBeUndefined();
  });
});

describe('applying overrides to a block DOM (master HTML untouched)', () => {
  const master = '<div data-composition-id="x"><div data-hf-id="hf-a" class="n">Dr. Maya Chen<span data-hf-id="hf-s">sub</span></div><div data-hf-id="hf-bar" style="background:#ff5a36"></div><img data-hf-id="hf-i" src="assets/a.png"></div>';
  it('sets text (keeping child elements), validated styles and image src', () => {
    const root = document.createElement('div'); root.innerHTML = master;
    const r = applyOverrides(root, { 'hf-a.text': 'Northside Dental', 'hf-bar.style.backgroundColor': '#0ea5e9', 'hf-i.attr.src': 'data:image/png;base64,iVBORw0KGgo=' });
    expect(r.applied).toBe(3);
    expect(root.querySelector('[data-hf-id=hf-a]').firstChild.textContent).toBe('Northside Dental');
    expect(root.querySelector('[data-hf-id=hf-s]').textContent).toBe('sub');
    expect(root.querySelector('[data-hf-id=hf-bar]').style.backgroundColor).not.toBe('');
    expect(master).toContain('Dr. Maya Chen'); // the master string is unchanged
  });
  it('drops hostile or unknown overrides and reports them', () => {
    const root = document.createElement('div'); root.innerHTML = master; const seen = [];
    const r = applyOverrides(root, { 'hf-a.attr.onclick': 'alert(1)', 'hf-i.attr.src': 'https://evil.example/x.png', 'hf-missing.text': 'x' }, { onReject: (x) => seen.push(...x) });
    expect(r.applied).toBe(0); expect(seen.length).toBe(3); expect(root.querySelector('[data-hf-id=hf-i]').getAttribute('src')).toBe('assets/a.png');
  });
  it('strips inline handlers and javascript: URLs from catalog markup', () => {
    const root = document.createElement('div'); root.innerHTML = '<a href="javascript:alert(1)" onclick="x()">a</a><img src="x" onerror="y()">';
    expect(stripUnsafeAttributes(root)).toBe(3); expect(root.innerHTML).not.toMatch(/onclick|onerror|javascript:/);
  });
});
