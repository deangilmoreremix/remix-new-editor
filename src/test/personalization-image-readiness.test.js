import { describe, expect, it } from 'vitest';
import {
  MAX_LINK_IMAGE_URL,
  contactImageGaps,
  describeBrokenImages,
  describeImageGaps,
  findBrokenImages,
  imageSlotsInProject,
  shareableImageValue,
} from '../lib/personalization/imageReadiness.js';
import { personalLink, personalLinkIssues } from '../lib/editor/personalize/perContact.js';
import { profileFromQuery } from '../lib/editor/publish/publishClient.js';
import { resolveOverlayText } from '../lib/editor/addons/overlayRender.js';

const LONG = `https://storage.example.com/personalization/acme/logo.png?X-Amz-Signature=${'a'.repeat(400)}`;

const acme = {
  id: 'c_acme', name: 'Ann',
  personalization: { assets: { logos: [{ id: 'l1', url: LONG }], primaryLogoId: 'l1', ctaGraphic: { id: 'c', url: 'https://cdn.example/cta.png' } } },
  variables: {},
};
const bolt = {
  id: 'c_bolt', name: 'Bo',
  personalization: { assets: { logos: [{ id: 'l9', url: 'https://cdn.example/bolt.png' }] } },
  variables: {},
};
const local = {
  id: 'c_local', name: 'Lou',
  personalization: { assets: { logos: [{ id: 'lx', url: 'data:image/png;base64,AAAA' }] } },
  variables: {},
};

const project = {
  tracks: [{
    id: 't', items: [
      { id: 'logo', name: 'Logo overlay', type: 'overlay-personalized-image', addon: { src: '{{logoUrl}}', fallbackSrc: '' } },
      { id: 'cta', name: 'CTA end card', type: 'overlay-personalized-image', addon: { src: '{{ctaImageUrl}}', fallbackSrc: '' } },
      { id: 'face', name: 'Face', type: 'overlay-personalized-image', addon: { src: '{{avatarUrl}}', fallbackSrc: 'https://cdn.example/fallback.png' } },
      { id: 'txt', name: 'Hi', type: 'overlay-text', addon: { text: 'Hi {{firstName}}' } },
    ],
  }],
};

describe('imageSlotsInProject', () => {
  it('finds personalized image slots and whether they have a fallback', () => {
    expect(imageSlotsInProject(project).map((s) => [s.key, s.hasFallback])).toEqual([
      ['logoUrl', false], ['ctaImageUrl', false], ['avatarUrl', true],
    ]);
  });

  it('treats an inline default as a fallback', () => {
    const p = { tracks: [{ items: [{ type: 'overlay-personalized-image', addon: { src: '{{d logoUrl "https://cdn.example/x.png"}}' } }] }] };
    expect(imageSlotsInProject(p)[0]).toMatchObject({ key: 'logoUrl', hasFallback: true });
  });
});

describe('contactImageGaps', () => {
  it('lists contacts with nothing in a slot that has no fallback', () => {
    expect(contactImageGaps(project, [acme, bolt])).toEqual([{ id: 'c_bolt', name: 'Bo', missing: ['CTA graphic'] }]);
  });

  it('summarizes gaps in plain language', () => {
    const [line] = describeImageGaps(contactImageGaps(project, [acme, bolt]));
    expect(line).toMatch(/^1 contact has no CTA graphic \(Bo\), so their video shows nothing there/);
  });

  it('returns nothing when every slot has a fallback', () => {
    const safe = { tracks: [{ items: [project.tracks[0].items[2]] }] };
    expect(contactImageGaps(safe, [bolt])).toEqual([]);
  });
});

describe('personal share links carry image URLs', () => {
  it('keeps long image URLs whole', () => {
    const link = personalLink('https://smartvid.app/watch/abc', acme, ['logoUrl', 'firstName']);
    const params = new URL(link).searchParams;
    expect(params.get('logoUrl')).toBe(LONG);
    expect(params.get('c')).toBe('c_acme');
  });

  it('leaves out local (data:/blob:) images and reports them', () => {
    const link = personalLink('https://smartvid.app/watch/abc', local, ['logoUrl']);
    expect(new URL(link).searchParams.has('logoUrl')).toBe(false);
    expect(personalLinkIssues(local, ['logoUrl'])).toEqual(['logoUrl']);
    expect(personalLinkIssues(acme, ['logoUrl'])).toEqual([]);
  });

  it('round-trips through the watch page to the same image', () => {
    const link = personalLink('https://smartvid.app/watch/abc', acme, ['logoUrl']);
    const viewer = profileFromQuery(new URL(link).search);
    expect(resolveOverlayText('{{logoUrl}}', viewer)).toBe(LONG);
  });

  it('only accepts http(s) image URLs from a link', () => {
    expect(profileFromQuery('?logoUrl=javascript:alert(1)')).toBeNull();
    expect(profileFromQuery(`?logoUrl=https://x.example/${'a'.repeat(MAX_LINK_IMAGE_URL)}`)).toBeNull();
    expect(shareableImageValue('data:image/png;base64,AA')).toBeNull();
    // Text tokens are still cut at 200 characters.
    expect(profileFromQuery(`?firstName=${'b'.repeat(300)}`).variables.firstName).toHaveLength(200);
  });
});

describe('findBrokenImages', () => {
  it('reports images that no longer load, with the contacts they affect', async () => {
    const probe = async (url) => url !== 'https://cdn.example/bolt.png';
    const broken = await findBrokenImages(project, [acme, bolt], { probe });
    expect(broken).toEqual([{ url: 'https://cdn.example/bolt.png', contacts: ['Bo'], slots: ['logo'] }]);
    expect(describeBrokenImages(broken)[0]).toMatch(/^An image \(logo\) for Bo no longer loads/);
  });

  it('checks the fallback image too', async () => {
    const broken = await findBrokenImages(project, [], { probe: async () => false });
    expect(broken.map((b) => b.slots[0])).toEqual(['fallback image']);
  });

  it('does nothing without a probe', async () => {
    expect(await findBrokenImages(project, [acme])).toEqual([]);
  });
});
