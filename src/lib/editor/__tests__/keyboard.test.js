// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { isTypingTarget } from '../keyboard.js';

const el = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; };

describe('isTypingTarget', () => {
  it('is true for text-like fields', () => {
    for (const html of ['<input type="text">', '<input>', '<input type="search">', '<input type="email">', '<input type="number">', '<input type="date">', '<textarea></textarea>', '<select></select>']) {
      expect(isTypingTarget(el(html)), html).toBe(true);
    }
    const ce = document.createElement('div'); Object.defineProperty(ce, 'isContentEditable', { value: true });
    expect(isTypingTarget(ce)).toBe(true);
  });
  it('is false for controls that do not take typed text, and for non-fields', () => {
    for (const html of ['<input type="checkbox">', '<input type="range">', '<input type="radio">', '<input type="button">', '<button></button>', '<div></div>', '<canvas></canvas>']) {
      expect(isTypingTarget(el(html)), html).toBe(false);
    }
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(undefined)).toBe(false);
    expect(isTypingTarget(document)).toBe(false);
  });
});
