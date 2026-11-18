// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { tokensToHtml, htmlToTokens, tokenChip } from '../tokenChips.js';

const box = (html) => { const el = document.createElement('div'); el.innerHTML = html; return el; };

describe('Smart Text token chips', () => {
  it('round-trips plain text, tokens and helpers', () => {
    for (const text of ['Hi {{firstName}}, welcome', '{{up company}} ready', 'Hello {{d name "friend"}}!', 'no tokens', '']) {
      expect(htmlToTokens(box(tokensToHtml(text)))).toBe(text);
    }
  });
  it('shows each token as a non-editable chip named after the token', () => {
    const el = box(tokensToHtml('Hi {{firstName}}'));
    const chip = el.querySelector('.personalized-token');
    expect(chip.getAttribute('contenteditable')).toBe('false');
    expect(chip.textContent).toBe('firstName');
    expect(chip.dataset.token).toBe('{{firstName}}');
  });
  it('escapes markup so typed text is never run as HTML', () => {
    const el = box(tokensToHtml('<img src=x onerror=alert(1)> & {{a}}'));
    expect(el.querySelector('img')).toBeNull();
    expect(htmlToTokens(el)).toBe('<img src=x onerror=alert(1)> & {{a}}');
  });
  it('keeps line breaks, including the <div> lines browsers add on Enter', () => {
    expect(htmlToTokens(box(tokensToHtml('a\nb')))).toBe('a\nb');
    expect(htmlToTokens(box('a<div>b</div><div><br></div><div>c</div>'))).toBe('a\nb\n\nc');
    expect(htmlToTokens(box('a<div><br></div>'))).toBe('a\n');
  });
  it('turns non-breaking spaces into spaces', () => {
    expect(htmlToTokens(box('a b'))).toBe('a b');
  });
  it('builds a chip for the Personalize menu', () => {
    const chip = tokenChip(document, 'lastName');
    expect(chip.dataset.token).toBe('{{lastName}}');
    expect(chip.textContent).toBe('lastName');
  });
});
