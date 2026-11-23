import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTemplateCost } from '../lib/templateCost.js';

afterEach(() => vi.useRealTimers());

async function shown(opts) {
  vi.useFakeTimers();
  const c = createTemplateCost({ getRequest: () => ({ model: 'm', settings: {} }), ...opts });
  c.refresh();
  await vi.advanceTimersByTimeAsync(500);
  return c.element.classList.contains('hidden') ? null : c.element.textContent;
}

describe('createTemplateCost fallback', () => {
  it('shows the estimate when the endpoint can price the model', async () => {
    expect(await shown({ estimate: async () => ({ cost: 0.5, currency: 'usd' }), fallbackUsd: 0.045 })).toBe('≈ 0.5 USD');
  });

  it('falls back to the default price when the estimate fails', async () => {
    expect(await shown({ estimate: async () => { throw new Error('404'); }, fallbackUsd: 0.045 })).toBe('≈ 0.05 USD');
  });

  it('falls back when the estimate returns a bad cost', async () => {
    expect(await shown({ estimate: async () => ({ cost: 'n/a' }), fallbackUsd: 1.25 })).toBe('≈ 1.25 USD');
  });

  it('keeps the old behaviour (hidden) with no fallback', async () => {
    expect(await shown({ estimate: async () => { throw new Error('404'); } })).toBeNull();
  });
});
