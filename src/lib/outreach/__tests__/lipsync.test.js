import { describe, it, expect, vi } from 'vitest';
import { introSeconds, lipsyncJobs, padSamples, lipsyncContacts } from '../lipsync.js';
import { buildCampaignProject, defaultDraft } from '../draft.js';
import { timelineToComposition } from '../../editor/remotion/timelineToComposition.js';

const ready = () => ({
  ...defaultDraft(),
  video: { url: 'https://cdn.x/rec.mp4', duration: 20, hasAudio: true, type: 'camera' },
  voice: { mode: 'stock', stockVoice: 'Wise_Woman', cloneVoiceId: '', consent: null, fallbackUrl: 'https://cdn.x/fb.mp3', fallbackDuration: 1.2 },
  cta: { enabled: false, label: '', url: '' },
  contacts: [{ id: 'c1', firstName: 'Mike', lastName: '', email: 'm@x.co', company: '', website: '' }, { id: 'c2', firstName: 'Mike', lastName: 'B', email: 'm2@x.co', company: '', website: '' }, { id: 'c3', firstName: 'Ann', lastName: '', email: 'a@x.co', company: '', website: '' }],
});
const variants = { c1: { url: 'https://cdn.x/mike.mp3', duration: 1.1 }, c2: { url: 'https://cdn.x/mike.mp3', duration: 1.1 }, c3: { url: 'https://cdn.x/ann.mp3', duration: 1.6 } };

describe('lip-synced greeting', () => {
  it('sizes the intro to the longest greeting and syncs each distinct greeting once', () => {
    expect(introSeconds(ready(), variants)).toBe(2);
    expect(introSeconds({ ...ready(), video: { duration: 1.5 } }, variants)).toBe(1);
    expect(lipsyncJobs(variants)).toEqual([{ audioUrl: 'https://cdn.x/mike.mp3', contactIds: ['c1', 'c2'] }, { audioUrl: 'https://cdn.x/ann.mp3', contactIds: ['c3'] }]);
    const padded = padSamples(new Float32Array([1, 1]), 4, 1);
    expect(Array.from(padded)).toEqual([1, 1, 0, 0]);
  });

  it('cuts the intro once, pads audio, lip-syncs per greeting, and keeps going when one fails', async () => {
    const upload = vi.fn(async (f) => `https://store/${f.name}`);
    const lipSync = vi.fn(async ({ audio_url }) => { if (lipSync.mock.calls.length === 2) throw new Error('model busy'); return { url: `https://ls/${lipSync.mock.calls.length}.mp4`, audio_url }; });
    const cutIntro = vi.fn(async () => new Blob(['v']));
    const padAudio = vi.fn(async () => new Blob(['a']));
    const out = await lipsyncContacts({ draft: ready(), variants, upload, lipSync, deps: { cutIntro, padAudio } });
    expect(cutIntro).toHaveBeenCalledWith('https://cdn.x/rec.mp4', 2);
    expect(lipSync).toHaveBeenCalledTimes(2);
    expect(lipSync.mock.calls[0][0]).toMatchObject({ video_url: 'https://store/greeting-intro.mp4', audio_url: 'https://store/greeting-padded.wav' });
    expect(out).toEqual({ introUrl: 'https://store/greeting-intro.mp4', seconds: 2, clips: { c1: 'https://ls/1.mp4', c2: 'https://ls/1.mp4' }, failed: ['c3'] });
  });

  it('the campaign plays each contact their synced intro, muted, then the rest of the recording', () => {
    const lipsync = { introUrl: 'https://store/intro.mp4', seconds: 2, clips: { c1: 'https://ls/1.mp4' } };
    const project = buildCampaignProject(ready(), { variants, lipsync, now: 1000 });
    const items = project.tracks.find((t) => t.name === 'Main Video').items;
    expect(items[0]).toMatchObject({ src: 'https://store/intro.mp4', volume: 0, aiPerContact: { variants: { c1: { url: 'https://ls/1.mp4' } } } });
    expect(items[1]).toMatchObject({ src: 'https://cdn.x/rec.mp4', trimIn: 2 });
    const forMike = timelineToComposition(project, { profile: { id: 'c1' } });
    const forAnn = timelineToComposition(project, { profile: { id: 'c3' } });
    const firstVideo = (m) => m.layers.filter((l) => l.kind === 'video').sort((a, b) => a.from - b.from)[0];
    expect(firstVideo(forMike)).toMatchObject({ src: 'https://ls/1.mp4', volume: 0 });
    expect(firstVideo(forAnn).src).toBe('https://store/intro.mp4');
    // Without lip-sync the project is unchanged: one recording clip.
    expect(buildCampaignProject(ready(), { variants, now: 1000 }).tracks.find((t) => t.name === 'Main Video').items).toHaveLength(1);
  });
});
