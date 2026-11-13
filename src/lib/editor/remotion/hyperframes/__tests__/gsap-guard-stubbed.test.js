// Simulates what the dev server's stub plugin produces when the gsap package is missing: an empty module.
import { describe, it, expect, vi } from 'vitest';

vi.mock('gsap', () => ({ gsap: {} }));

describe('gsapAvailable with an empty gsap stand-in', () => {
  it('is false, so the block host reports a clear error instead of "gsap.timeline is not a function"', async () => {
    const { gsapAvailable } = await import('../BlockClip.jsx');
    expect(gsapAvailable()).toBe(false);
  });
});
