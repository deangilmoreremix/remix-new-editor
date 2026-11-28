// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { OutreachStudio } from '../OutreachStudio.js';

describe('Video Outreach studio, mounted', () => {
  beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });
  it('announces its status line to screen readers on every step it shows', () => {
    const el = OutreachStudio();
    document.body.appendChild(el);
    const status = document.querySelector('[data-outreach-busy]');
    expect(status).not.toBeNull();
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
  });
});
