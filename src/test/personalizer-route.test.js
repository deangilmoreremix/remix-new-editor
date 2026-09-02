import { describe, it, expect } from 'vitest';
import { getRouteForItem } from '../lib/router.js';

describe('Personalizer route mapping', () => {
  it('routes Personalizer to personalizer, not timeline', () => {
    expect(getRouteForItem('Personalizer')).toBe('personalizer');
  });

  it('does not route Personalizer to timeline', () => {
    expect(getRouteForItem('Personalizer')).not.toBe('timeline');
  });

  it('loads Personalizer component for personalizer page', async () => {
    const mod = await import('../components/Personalizer.js');
    expect(typeof mod.Personalizer).toBe('function');
  });
});
