import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAssetUrl, validateOverrides, validateColor, sanitizeText } from './src/security.js';

const bad = (u, o) => assert.equal(validateAssetUrl(u, o).ok, false, `should reject: ${u}`);
const good = (u, o) => assert.equal(validateAssetUrl(u, o).ok, true, `should accept: ${u}`);

test('asset URLs: hostile inputs rejected', () => {
  for (const u of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', 'data:image/svg+xml,<svg onload=alert(1)>', 'file:///etc/passwd', 'ftp://x/y.png',
    'http://example.com/a.png', 'https://evil.example/x.png', '//evil.example/x.png', '/etc/passwd', '../secret.png', 'a/../../b.png', 'a\\b.png', 'a%2e%2e/b.png', 'https://fonts.googleapis.com.evil.com/x', '', ' ', 'java\nscript:alert(1)']) bad(u);
  assert.equal(validateAssetUrl(5).ok, false);
  assert.equal(validateAssetUrl('data:image/png;base64,' + 'A'.repeat(2_000_001)).ok, false);
});
test('asset URLs: legitimate inputs accepted', () => {
  good('assets/logo.png'); good('./assets/logo.png'); good('blob:https://app.example/1234-5678');
  good('data:image/png;base64,iVBORw0KGgo='); good('https://cdn.example.com/a.png', { allowHosts: ['cdn.example.com'] });
  good('https://img.cdn.example.com/a.png', { allowHosts: ['cdn.example.com'] }); good('https://fonts.gstatic.com/s/x.woff2', { allowFontHosts: true });
  bad('https://fonts.gstatic.com/s/x.woff2'); // not allowed unless font hosts enabled
});
test('colors and text', () => {
  for (const c of ['#fff', '#e11d48', 'rgb(1,2,3)', 'rgba(0, 0, 0, .5)', 'hsl(10 20% 30%)', 'crimson']) assert.ok(validateColor(c), c);
  for (const c of ['url(javascript:1)', 'red;background:url(x)', 'expression(alert(1))', '#ggg', 'x'.repeat(100), 5]) assert.ok(!validateColor(c), String(c));
  assert.equal(sanitizeText('a\u0000b\u0007c'), 'abc'); assert.equal(sanitizeText('x'.repeat(500)).length, 200); assert.equal(sanitizeText(5), null);
});
test('overrides: legitimate business personalization passes', () => {
  const r = validateOverrides({ 'hf-tjqa.text': "Maria's Bakery", 'hf-jkgi.text': 'Owner · Fresh bread daily', 'hf-0l4y.style.backgroundColor': '#e11d48', 'hf-logo.attr.src': 'https://cdn.example.com/logo.png', 'hf-logo.attr.alt': 'logo', 'var.accent': '#fff', 'var.logo': { url: 'blob:https://app/1', alt: 'x' } }, { allowHosts: ['cdn.example.com'] });
  assert.equal(r.ok, true, JSON.stringify(r.rejected)); assert.equal(Object.keys(r.cleaned).length, 7);
});
test('overrides: hostile keys and values are rejected', () => {
  const hostile = {
    'hf-a.attr.onclick': 'alert(1)', 'hf-a.attr.onerror': 'alert(1)', 'hf-a.attr.style': 'background:url(javascript:1)', 'hf-a.attr.href': 'javascript:alert(1)',
    'hf-a.attr.src': 'https://evil.example/x.png', 'hf-a.style.background': 'url(https://evil/x)', 'hf-a.style.backgroundColor': 'red;background:url(x)', 'hf-a.style.position': 'fixed',
    '__proto__.polluted': 'x', 'hf-a.constructor.x': '1', 'hf-new': { html: '<img src=x onerror=alert(1)>', parent: null }, 'hf-a.text': { not: 'a string' },
    'hf-a.removed': null, 'var.logo': { url: 'javascript:1' }, 'var.f': { fn: () => 1 }, 'unknown': 'x',
  };
  const r = validateOverrides(hostile);
  assert.equal(r.ok, false); assert.equal(Object.keys(r.cleaned).length, 0, 'nothing hostile may survive: ' + JSON.stringify(r.cleaned));
  assert.equal(r.rejected.length, Object.keys(hostile).length);
  assert.equal(Object.getPrototypeOf({}).polluted, undefined);
});
test('overrides: non-object roots rejected', () => { for (const x of [null, 'x', 5, [], undefined]) assert.equal(validateOverrides(x).ok, false); });
