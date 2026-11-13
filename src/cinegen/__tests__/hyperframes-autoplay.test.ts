import { describe, expect, it } from 'vitest';
import { pickPlaying } from '@cinegen/lib/hyperframes/autoplay';

describe('pickPlaying', () => {
  const order = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  it('plays visible cards in list order, capped', () => {
    expect(pickPlaying(order, new Set(order), null, 3)).toEqual(['a', 'b', 'c']);
  });
  it('skips cards that are not visible', () => {
    expect(pickPlaying(order, new Set(['c', 'd', 'x']), null)).toEqual(['c', 'd']);
  });
  it('always plays the hovered card, even outside the cap or view', () => {
    expect(pickPlaying(order, new Set(['a', 'b', 'c']), 'h', 3)).toEqual(['h', 'a', 'b']);
  });
  it('does not duplicate the hovered card', () => {
    expect(pickPlaying(order, new Set(order), 'b', 3)).toEqual(['b', 'a', 'c']);
  });
});
