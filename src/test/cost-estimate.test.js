import { describe, it, expect, vi, afterEach } from 'vitest';
import { createCostLine } from '../components/studio/costEstimate.js';

afterEach(() => vi.useRealTimers());

describe('cost line', () => {
  it('shows the estimate once the debounce fires', async () => {
    vi.useFakeTimers();
    const estimate = vi.fn().mockResolvedValue({ cost: 3.456, currency: 'usd' });
    const line = createCostLine({ estimate });
    line.refresh('m1', { model: 'm1' });
    expect(line.el.classList.contains('hidden')).toBe(true);
    await vi.advanceTimersByTimeAsync(450);
    expect(estimate).toHaveBeenCalledWith({ model: 'm1' });
    expect(line.el.textContent).toBe('≈ 3.46 USD');
    expect(line.el.classList.contains('hidden')).toBe(false);
  });

  it('hides and stops asking for a model after a failure', async () => {
    vi.useFakeTimers();
    const estimate = vi.fn().mockRejectedValue(new Error('404'));
    const line = createCostLine({ estimate });
    line.refresh('m1', {});
    await vi.advanceTimersByTimeAsync(450);
    expect(line.el.classList.contains('hidden')).toBe(true);
    line.refresh('m1', {});
    await vi.advanceTimersByTimeAsync(450);
    expect(estimate).toHaveBeenCalledTimes(1);
  });

  it('clears when the key is null and rejects malformed costs', async () => {
    vi.useFakeTimers();
    const estimate = vi.fn().mockResolvedValue({ cost: 'abc' });
    const line = createCostLine({ estimate });
    line.refresh('m2', {});
    await vi.advanceTimersByTimeAsync(450);
    expect(line.el.classList.contains('hidden')).toBe(true);
    line.refresh(null);
    expect(line.el.textContent).toBe('');
  });
});
