import { describe, it, expect } from 'vitest';
import { cardDetails, cardKey, initials, drawProfileCard } from '../profileCard.js';
import { backgroundShotFor, fallbackShotFor, usesBackground, defaultDraft } from '../draft.js';

function fakeCtx() {
  const calls = [];
  const grad = { addColorStop() {} };
  const ctx = new Proxy({ calls }, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createLinearGradient') return () => grad;
      if (k === 'measureText') return (s) => ({ width: String(s).length * 10 });
      return (...a) => { calls.push([k, ...a]); };
    },
    set(t, k, v) { calls.push([`set:${String(k)}`, v]); return true; },
  });
  return ctx;
}

describe('profile card background', () => {
  it('uses the prospect’s own details, never a LinkedIn page', () => {
    const d = cardDetails({ firstName: 'Mike', lastName: 'Ross', jobTitle: 'Head of Sales', company: 'Linear', linkedin: 'https://www.linkedin.com/in/mike-ross/', website: 'https://linear.app/home' });
    expect(d).toEqual({ name: 'Mike Ross', title: 'Head of Sales', company: 'Linear', linkedin: 'linkedin.com/in/mike-ross', website: 'linear.app' });
    expect(cardDetails({}, { firstname: 'there', company: 'your team' })).toMatchObject({ name: 'there', company: 'your team' });
    expect(initials('Mike Ross')).toBe('MR');
    expect(initials('')).toBe('?');
  });

  it('draws the name, title and company, with initials when there is no logo', () => {
    const ctx = fakeCtx();
    drawProfileCard(ctx, cardDetails({ firstName: 'Mike', lastName: 'Ross', jobTitle: 'Head of Sales', company: 'Linear' }));
    const texts = ctx.calls.filter(([k]) => k === 'fillText').map(([, t]) => t);
    expect(texts).toEqual(['MR', 'Mike Ross', 'Head of Sales · Linear']);
  });

  it('each prospect gets their own card behind the camera bubble, and the fallbacks get one too', () => {
    const d = { ...defaultDraft(), background: { mode: 'profile' } };
    const mike = { id: 'c1', firstName: 'Mike', company: 'Linear' };
    d.profileShots = { [cardKey(cardDetails(mike, d.fallbacks))]: 'https://cdn.x/mike-card.jpg', [cardKey(cardDetails({}, d.fallbacks))]: 'https://cdn.x/fallback-card.jpg' };
    expect(usesBackground(d)).toBe(true);
    expect(backgroundShotFor(d, mike)).toBe('https://cdn.x/mike-card.jpg');
    expect(backgroundShotFor(d, { id: 'c2', firstName: 'Ann' })).toBe('');
    expect(fallbackShotFor(d)).toBe('https://cdn.x/fallback-card.jpg');
  });
});
