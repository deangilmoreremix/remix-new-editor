import { describe, it, expect } from 'vitest';
import { cardDetails, cardKey, initials, drawProfileCard, CARD_THEMES, cardThemeId } from '../profileCard.js';
import { backgroundShotFor, fallbackShotFor, usesBackground, defaultDraft, cardTheme } from '../draft.js';

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

describe('named card looks', () => {
  const mike = { id: 'c1', firstName: 'Mike', company: 'Linear' };
  const fills = (theme) => { const ctx = fakeCtx(); drawProfileCard(ctx, cardDetails(mike), theme ? { theme } : {}); return ctx.calls.filter(([k]) => k === 'set:fillStyle').map(([, v]) => v).filter((v) => typeof v === 'string'); };

  it('every look has all its colours, and the default is the original', () => {
    Object.values(CARD_THEMES).forEach((t) => ['bg', 'banner', 'card', 'name', 'line', 'sub', 'avatarText', 'label'].forEach((k) => expect(t[k]).toBeTruthy()));
    expect(fills()).toEqual(fills('classic'));
    expect(cardThemeId('nonsense')).toBe('classic');
    expect(cardThemeId(undefined)).toBe('classic');
  });
  it('a look changes what is drawn', () => {
    expect(fills('midnight')).not.toEqual(fills('classic'));
    expect(fills('midnight')).toContain('#111827'); // the dark card
    expect(fills('classic')).toContain('#ffffff');
  });
  it('the original look keeps its cache key, so cards already made are still found; other looks get their own', () => {
    const d = cardDetails(mike);
    expect(cardKey(d)).toBe(cardKey(d, 'right', 'classic'));
    expect(cardKey(d, 'right', 'midnight')).not.toBe(cardKey(d));
    expect(cardKey(d, 'right', 'midnight')).not.toBe(cardKey(d, 'right', 'soft'));
    expect(cardKey(d, 'left')).not.toBe(cardKey(d, 'right'));
  });
  it('the campaign finds the card made for the chosen look only', () => {
    const d = { ...defaultDraft(), background: { mode: 'profile', cardTheme: 'midnight' } };
    d.profileShots = { [cardKey(cardDetails(mike, d.fallbacks))]: 'https://cdn.x/classic.jpg' };
    expect(cardTheme(d)).toBe('midnight');
    expect(backgroundShotFor(d, mike)).toBe(''); // the classic card is not used for the midnight look
    d.profileShots[cardKey(cardDetails(mike, d.fallbacks), 'right', 'midnight')] = 'https://cdn.x/midnight.jpg';
    expect(backgroundShotFor(d, mike)).toBe('https://cdn.x/midnight.jpg');
  });
});
