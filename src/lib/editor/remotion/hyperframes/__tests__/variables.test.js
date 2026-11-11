import { describe, it, expect } from 'vitest';
import { parseVariableDecls, resolveVariables, bindVariables } from '../variables.js';
import { validateOverrides } from '../security.js';

const root = (decls) => { const d = document.createElement('div'); d.setAttribute('data-composition-variables', JSON.stringify(decls)); return d; };
const DECLS = [
  { id: 'title', type: 'string', default: 'Hello' }, { id: 'speed', type: 'number', default: 1, min: 0.25, max: 3 },
  { id: 'bg', type: 'color', default: '#ffffff' }, { id: 'rank', type: 'enum', default: '1', options: [{ value: '1' }, { value: '2' }] },
  { id: 'fog', type: 'boolean', default: true }, { id: 'pic', type: 'image', default: 'assets/a.jpg' },
];
describe('composition variables', () => {
  it('parses declarations and rejects malformed ones', () => {
    expect(parseVariableDecls(root(DECLS)).length).toBe(6);
    expect(parseVariableDecls(root([{ id: '__bad id', type: 'string' }, { id: 'ok', type: 'weird' }])).length).toBe(0);
    const bad = document.createElement('div'); bad.setAttribute('data-composition-variables', '{not json'); expect(parseVariableDecls(bad)).toEqual([]);
  });
  it('applies valid values and falls back to defaults for invalid ones', () => {
    const rejected = [];
    const v = resolveVariables(parseVariableDecls(root(DECLS)), { 'var.title': 'Acme', 'var.speed': 99, 'var.bg': 'url(javascript:x)', 'var.rank': '3', 'var.fog': 'yes', 'var.pic': 'http://evil.example/x.png' }, { onReject: (r) => rejected.push(r.key) });
    expect(v).toMatchObject({ title: 'Acme', speed: 3, bg: '#ffffff', rank: '1', fog: true, pic: 'assets/a.jpg' });
    expect(rejected.sort()).toEqual(['var.bg', 'var.fog', 'var.pic', 'var.rank']);
  });
  it('accepts allow-listed or data image URLs, even long data URLs', () => {
    const big = 'data:image/png;base64,' + 'A'.repeat(5000);
    const cleaned = validateOverrides({ 'var.pic': big }).cleaned;
    expect(resolveVariables(parseVariableDecls(root(DECLS)), cleaned).pic).toBe(big);
  });
  it('binds data-var-text and data-var-src', () => {
    const h = document.createElement('div'); h.innerHTML = '<p data-var-text="title">x</p><img data-var-src="pic">';
    bindVariables(h, { title: 'Acme', pic: 'data:image/png;base64,AAAA' });
    expect(h.querySelector('p').textContent).toBe('Acme'); expect(h.querySelector('img').getAttribute('src')).toBe('data:image/png;base64,AAAA');
  });
});
