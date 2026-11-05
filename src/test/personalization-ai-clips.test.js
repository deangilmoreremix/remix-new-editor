import { describe, expect, it } from 'vitest';
import '../lib/editor/addons/index.js';
import {
  AI_CLIP_MODELS,
  CLIP_IMAGE_SLOTS,
  aiClipConfig,
  clipPromptFor,
  clipSrcFor,
  describeClipGaps,
  planClipJobs,
} from '../lib/personalization/aiContactClips.js';
import { i2vModels } from '../lib/models.js';
import { timelineToComposition } from '../lib/editor/remotion/timelineToComposition.js';

const acme = {
  id: 'c_acme', name: 'Ann',
  personalization: { business: { businessName: 'Acme Roofing' }, assets: { firstFrame: { id: 'f', url: 'https://cdn/acme-first.png' } } },
  variables: {},
};
const bolt = {
  id: 'c_bolt', name: 'Bo',
  personalization: { business: {}, assets: { firstFrame: { id: 'f2', url: 'https://cdn/bolt-first.png' } } },
  variables: {},
};
const nofirst = { id: 'c_none', name: 'Cy', personalization: { business: { businessName: 'Cy Co' }, assets: {} }, variables: {} };

describe('settings', () => {
  it('only offers real image-to-video models from the catalog', () => {
    const ids = new Set(i2vModels.map((m) => m.id));
    AI_CLIP_MODELS.forEach((m) => expect(ids.has(m.id), m.id).toBe(true));
  });

  it('never animates photos of people', () => {
    expect(CLIP_IMAGE_SLOTS.map((s) => s.key)).not.toContain('avatarUrl');
  });

  it('fills defaults and rejects unknown values', () => {
    const cfg = aiClipConfig({ aiPerContact: { model: 'nope', imageKey: 'avatarUrl', duration: 7 } });
    expect(cfg).toMatchObject({ model: AI_CLIP_MODELS[0].id, imageKey: 'firstFrameUrl', duration: 5, variants: {} });
  });
});

describe('planClipJobs', () => {
  it('plans one job per contact with an image and a complete prompt', () => {
    const cfg = aiClipConfig({ aiPerContact: { prompt: 'Push in on {{businessName}}' } });
    const { jobs, skipped } = planClipJobs(cfg, [acme, bolt, nofirst]);
    expect(jobs).toEqual([{ contactId: 'c_acme', contactName: 'Ann', imageUrl: 'https://cdn/acme-first.png', prompt: 'Push in on Acme Roofing' }]);
    expect(skipped).toEqual([
      { contactName: 'Bo', reason: 'a detail in the prompt is missing' },
      { contactName: 'Cy', reason: 'no opening frame' },
    ]);
  });

  it('skips contacts that already have a clip unless redoing', () => {
    const cfg = aiClipConfig({ aiPerContact: { prompt: 'x', variants: { c_acme: { url: 'https://v/a.mp4' } } } });
    expect(planClipJobs(cfg, [acme, bolt]).jobs.map((j) => j.contactId)).toEqual(['c_bolt']);
    expect(planClipJobs(cfg, [acme, bolt], { redo: true }).jobs).toHaveLength(2);
  });

  it('uses defaults in prompts', () => {
    expect(clipPromptFor('Hello {{d businessName "there"}}', bolt)).toBe('Hello there');
    expect(clipPromptFor('Hello {{businessName}}', bolt)).toBeNull();
  });
});

describe('which clip each contact sees', () => {
  const clip = {
    id: 'v1', name: 'Intro', type: 'video', src: 'https://v/original.mp4', left: 0, width: 50,
    aiPerContact: { prompt: 'x', variants: { c_acme: { url: 'https://v/acme.mp4' } } },
  };

  it('plays the contact\'s own version, else the original', () => {
    expect(clipSrcFor(clip, acme)).toBe('https://v/acme.mp4');
    expect(clipSrcFor(clip, bolt)).toBe('https://v/original.mp4');
    expect(clipSrcFor(clip, null)).toBe('https://v/original.mp4');
  });

  it('reaches the export composition per contact', () => {
    const project = { timelineSeconds: 10, tracks: [{ id: 'main', type: 'video', name: 'Main Video', items: [clip] }] };
    const srcFor = (p) => timelineToComposition(project, { fps: 30, quality: '720p', profile: p }).layers.find((l) => l.id === 'v1')?.src;
    expect(srcFor(acme)).toBe('https://v/acme.mp4');
    expect(srcFor(bolt)).toBe('https://v/original.mp4');
  });

  it('warns about contacts without their version', () => {
    const project = { tracks: [{ items: [clip] }] };
    expect(describeClipGaps(project, [acme, bolt])[0]).toMatch(/^1 contact doesn't have their own version of "Intro" yet \(Bo\)/);
    expect(describeClipGaps(project, [acme])).toEqual([]);
  });
});
