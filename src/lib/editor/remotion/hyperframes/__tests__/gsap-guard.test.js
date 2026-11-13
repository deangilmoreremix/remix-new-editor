// The block host must notice a missing / stubbed gsap instead of failing every block with "gsap.timeline is not a function".
import { describe, it, expect } from 'vitest';
import { gsapAvailable } from '../BlockClip.jsx';

describe('gsapAvailable', () => {
  it('is true when the real gsap package is installed', () => {
    expect(gsapAvailable()).toBe(true);
  });
});
