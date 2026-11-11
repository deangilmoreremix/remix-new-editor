import { describe, it, expect } from 'vitest';
import { personalLink } from '../perContact.js';
import { profileFromQuery } from '../../publish/publishClient.js';
import { personalizedImageLook } from '../../../personalization/imageStyle.js';

const LOGO = 'https://cdn.example.com/white-logo.png';
const PHOTO = 'https://cdn.example.com/ann.jpg';

const profile = {
  id: 'c1',
  variables: {},
  personalization: {
    assets: {
      logos: [{ url: LOGO, luminance: 0.92 }],
      identities: [{ url: PHOTO, role: 'presenter_identity', focus: { x: 62.5, y: 18 } }],
    },
  },
};

const search = (link) => new URL(link).search;

describe('personal links keep image styling', () => {
  it('a white logo still gets a dark plate in the viewer', () => {
    const link = personalLink('https://app.example.com/watch/abc', profile, ['logoUrl']);
    const viewer = profileFromQuery(search(link));
    const editor = personalizedImageLook({ plate: 'auto' }, LOGO, profile);
    const watched = personalizedImageLook({ plate: 'auto' }, LOGO, viewer);
    expect(editor.plateColor).toBe('#111111');
    expect(watched.plateColor).toBe(editor.plateColor);
  });

  it('a custom crop focus survives the link', () => {
    const p = { ...profile, variables: { avatarUrl: PHOTO } };
    const link = personalLink('https://app.example.com/watch/abc', p, ['avatarUrl']);
    const viewer = profileFromQuery(search(link));
    const look = personalizedImageLook({ fit: 'cover' }, PHOTO, viewer);
    expect(look.objectPosition).toBe(personalizedImageLook({ fit: 'cover' }, PHOTO, p).objectPosition);
  });

  it('the style params are not treated as personalization variables', () => {
    const link = personalLink('https://app.example.com/watch/abc', profile, ['logoUrl']);
    const viewer = profileFromQuery(search(link));
    expect(Object.keys(viewer.variables)).toEqual(['logoUrl']);
  });

  it('links without style params behave as before', () => {
    const viewer = profileFromQuery('?logoUrl=' + encodeURIComponent(LOGO));
    expect(viewer.personalization).toBeUndefined();
    expect(viewer.variables.logoUrl).toBe(LOGO);
  });

  it('ignores malformed style values', () => {
    const viewer = profileFromQuery(`?logoUrl=${encodeURIComponent(LOGO)}&logoUrl__f=abc&logoUrl__l=9`);
    expect(viewer.personalization).toBeUndefined();
  });
});
