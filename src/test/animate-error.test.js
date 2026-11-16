// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ videoI2V: vi.fn(), generateI2V: vi.fn() }));
vi.mock('../lib/muapi.js', () => ({ muapi: m, MuapiClient: class {} }));

beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks();
  localStorage.setItem('brand_dna_list', JSON.stringify([{ id: 'b1', brandName: 'B' }]));
  // The shared test setup stubs sessionStorage, so feed the hand-off through the stub.
  const handoff = JSON.stringify({ imageUrl: 'https://img/a.png', sourceType: 'asset', sourceId: 'a1' });
  globalThis.sessionStorage.getItem = vi.fn((k) => (k === 'storyboard_animate_frame' ? handoff : null));
  globalThis.sessionStorage.removeItem = vi.fn();
  window.history.replaceState({}, '', '/?brandId=b1#/animate');
});

describe('Animate failure is persistent', () => {
  it('keeps the reason on the page after the toast is gone', async () => {
    m.videoI2V.mockRejectedValue(new Error('Generation failed: Insufficient credits. Please top up your account to continue'));
    m.generateI2V.mockRejectedValue(new Error('Generation failed: Insufficient credits. Please top up your account to continue'));
    const { AnimatePage } = await import('../components/AnimatePage.js');
    const el = AnimatePage();
    const btn = [...el.querySelectorAll('button.btn-primary-modern')].find((b) => b.textContent.trim() === 'Animate');
    btn.click();
    await vi.waitFor(() => expect(el.querySelector('[data-animate-error]')).toBeTruthy());
    expect(el.querySelector('[data-animate-error]').textContent).toContain('Insufficient credits');
    expect(btn.disabled).toBe(false); // can retry
  });
});
