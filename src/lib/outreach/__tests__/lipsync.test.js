import { describe, it, expect, vi } from 'vitest';
import { introSeconds, lipsyncJobs, padSamples, lipsyncContacts, paidJobCount, copyClip, introKey, clipKey, speechStart, pauseWarning } from '../lipsync.js';
import { buildCampaignProject, defaultDraft } from '../draft.js';
import { timelineToComposition } from '../../editor/remotion/timelineToComposition.js';
import { preparePublishProject } from '../../editor/publish/publishClient.js';

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

  it('cuts the intro once, pads audio, lip-syncs per greeting, keeps our copy, and keeps going when one fails', async () => {
    const upload = vi.fn(async (f) => `https://store/${f.name}`);
    const lipSync = vi.fn(async ({ audio_url }) => { if (lipSync.mock.calls.length === 2) throw new Error('model busy'); return { url: `https://ls/${lipSync.mock.calls.length}.mp4`, audio_url }; });
    const cutIntro = vi.fn(async () => new Blob(['v']));
    const padAudio = vi.fn(async () => new Blob(['a']));
    const copyClip = vi.fn(async (url) => url.replace('https://ls/', 'https://store/ls-'));
    const out = await lipsyncContacts({ draft: ready(), variants, upload, lipSync, concurrency: 1, deps: { cutIntro, padAudio, copyClip } });
    expect(cutIntro).toHaveBeenCalledWith('https://cdn.x/rec.mp4', 2);
    expect(lipSync).toHaveBeenCalledTimes(2);
    expect(lipSync.mock.calls[0][0]).toMatchObject({ video_url: 'https://store/greeting-intro.mp4', audio_url: 'https://store/greeting-padded.wav' });
    expect(out).toMatchObject({ introUrl: 'https://store/greeting-intro.mp4', seconds: 2, clips: { c1: 'https://store/ls-1.mp4', c2: 'https://store/ls-1.mp4' }, failed: ['c3'], errors: { c3: 'model busy' }, paid: 2 });
  });

  it('when the quick cut fails it renders the window instead; when both fail, Generate goes on without lip-sync', async () => {
    const upload = vi.fn(async (f) => `https://store/${f.name}`);
    const lipSync = vi.fn(async () => ({ url: 'https://ls/x.mp4' }));
    const padAudio = async () => new Blob(['a']);
    const renderIntro = vi.fn(async () => new Blob(['r']));
    const ok = await lipsyncContacts({ draft: ready(), variants, upload, lipSync, deps: { cutIntro: async () => { throw new Error('webm'); }, renderIntro, padAudio, copyClip: async (u) => u } });
    expect(renderIntro).toHaveBeenCalledWith('https://cdn.x/rec.mp4', 2);
    expect(ok.failed).toEqual([]);
    const none = await lipsyncContacts({ draft: ready(), variants, upload, lipSync: vi.fn(), deps: { cutIntro: async () => { throw new Error('webm'); }, renderIntro: async () => { throw new Error('no codec'); }, padAudio } });
    expect(none).toMatchObject({ introUrl: '', clips: {}, failed: ['c1', 'c2', 'c3'], paid: 0 });
    expect(none.error).toMatch(/skipped.*no codec/);
  });

  it('reuses clips already paid for, and counts only the new ones', async () => {
    const cache = {};
    const upload = vi.fn(async (f) => `https://store/${f.name}`);
    const lipSync = vi.fn(async () => ({ url: 'https://ls/x.mp4' }));
    const deps = { cutIntro: vi.fn(async () => new Blob(['v'])), padAudio: async () => new Blob(['a']), copyClip: async (u) => `${u}#ours` };
    expect(paidJobCount(ready(), variants, cache)).toBe(2);
    await lipsyncContacts({ draft: ready(), variants, upload, lipSync, cache, deps });
    expect(cache[introKey('https://cdn.x/rec.mp4', 2)]).toBe('https://store/greeting-intro.mp4');
    expect(cache[clipKey('https://cdn.x/rec.mp4', 2, 'https://cdn.x/ann.mp3')]).toBe('https://ls/x.mp4#ours');
    expect(paidJobCount(ready(), variants, cache)).toBe(0);
    const again = await lipsyncContacts({ draft: ready(), variants, upload, lipSync, cache, deps });
    expect(lipSync).toHaveBeenCalledTimes(2);
    expect(deps.cutIntro).toHaveBeenCalledTimes(1);
    expect(again).toMatchObject({ paid: 0, failed: [] });
  });

  it('runs 3 at a time and gives up on a job that takes too long', async () => {
    const many = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`k${i}`, { url: `https://cdn.x/${i}.mp3`, duration: 1 }]));
    let running = 0; let peak = 0;
    const lipSync = vi.fn(({ audio_url, signal }) => new Promise((resolve, reject) => {
      running += 1; peak = Math.max(peak, running);
      if (lipSync.mock.calls.length === 1) { signal.addEventListener('abort', () => { running -= 1; reject(new Error('aborted')); }); return; } // never finishes
      setTimeout(() => { running -= 1; resolve({ url: `https://ls/${audio_url.split('/').pop()}` }); }, 5);
    }));
    const out = await lipsyncContacts({
 draft: ready(), variants: many, upload: async (f) => `https://store/${f.name}`, lipSync, timeoutMs: 40,
      deps: { cutIntro: async () => new Blob(['v']), padAudio: async () => new Blob(['a']), copyClip: async (u) => u } 
});
    expect(peak).toBe(3);
    expect(out.failed).toEqual(['k0']);
    expect(out.errors.k0).toBe('Lip-sync took too long');
  });

  it('stops everything when Generate is stopped', async () => {
    const ctrl = new AbortController();
    const lipSync = vi.fn(({ signal }) => new Promise((_, reject) => { signal.addEventListener('abort', () => reject(new Error('x'))); ctrl.abort(); }));
    await expect(lipsyncContacts({
 draft: ready(), variants, upload: async (f) => f.name, lipSync, signal: ctrl.signal,
      deps: { cutIntro: async () => new Blob(['v']), padAudio: async () => new Blob(['a']) } 
})).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('copies a finished clip into our storage', async () => {
    const upload = vi.fn(async (f) => `https://store/${f.name}`);
    const fetchImpl = vi.fn(async () => ({ ok: true, blob: async () => new Blob(['mp4'], { type: 'video/mp4' }) }));
    expect(await copyClip('https://ls/a.mp4', upload, { fetchImpl })).toBe('https://store/greeting-lipsync.mp4');
    await expect(copyClip('https://ls/a.mp4', upload, { fetchImpl: async () => ({ ok: false, status: 403 }) })).rejects.toThrow(/403/);
  });

  it('the greeting track lasts as long as the longest greeting and the lip-synced intro (no cut-off names)', () => {
    const long = { ...variants, c3: { url: 'https://cdn.x/alexandra.mp3', duration: 2.6 } };
    const voiceEnd = (p) => p.tracks.find((t) => t.name === 'Voiceover').items[0].end;
    expect(voiceEnd(buildCampaignProject(ready(), { variants: long, now: 1000 }))).toBe(2.6);
    const lipsync = { introUrl: 'https://store/intro.mp4', seconds: 3, clips: { c1: 'https://ls/1.mp4' } };
    const p = buildCampaignProject(ready(), { variants: long, lipsync, now: 1000 });
    expect(voiceEnd(p)).toBe(3);
    const [intro, rest] = p.tracks.find((t) => t.name === 'Main Video').items;
    // The intro and the rest of the recording meet exactly: no gap, no overlap.
    expect(intro.left + intro.width).toBeCloseTo(rest.left, 6);
    expect(rest.trimIn).toBe(3);
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

  it('warns when the greeting window runs into your first words (the real sample: 1.6s pause, "Alexandra" needs 2.6s)', () => {
    expect(speechStart([{ start: 0, end: 1.6 }, { start: 5, end: 6 }])).toBe(1.6);
    expect(speechStart([{ start: 2, end: 3 }])).toBe(0);
    expect(pauseWarning(2.6, 1.6)).toMatch(/pause is 1\.6s.*needs 2\.6s.*first 1\.0s/);
    expect(pauseWarning(1.9, 1.8)).toBeNull();
  });

  it('publishes chapters and the editor’s personal additions with the campaign', () => {
    const d = { ...ready(), chapters: [{ startMs: 0, title: 'Intro' }, { startMs: 9000, title: 'Demo' }] };
    const extra = vi.fn((T) => [{ id: 'track-personal-text', type: 'video', name: 'Personal text', items: [{ id: 'x', type: 'overlay-text', left: 0, width: (5 / T) * 100, addon: { text: 'For {{company}}' } }] }]);
    const p = buildCampaignProject(d, { variants, extraTracks: extra, now: 1000 });
    expect(extra).toHaveBeenCalledWith(20);
    expect(p.tracks.map((t) => t.name)).toEqual(['Main Video', 'Voiceover', 'Personal text']);
    expect(p.chapters).toEqual(d.chapters);
    expect(preparePublishProject(p, { title: 'x' }).chapters).toEqual(d.chapters);
    expect(buildCampaignProject({ ...d, chapters: [d.chapters[0]] }, { variants, now: 1000 }).chapters).toBeUndefined();
  });

  it('a square or vertical video is published in its own shape, and the player uses it', async () => {
    const { buildViewerModel } = await import('../../editor/publish/interactivePlayer.js');
    const p = preparePublishProject(buildCampaignProject(ready(), { variants, aspect: '1:1', now: 1000 }), { title: 'x' });
    expect(p.aspect).toBe('1:1');
    expect(buildViewerModel(p, null, { quality: '720p' })).toMatchObject({ width: 720, height: 720 });
    expect(preparePublishProject(buildCampaignProject(ready(), { variants, aspect: '16:9', now: 1000 }), { title: 'x' }).aspect).toBeUndefined();
    expect(preparePublishProject({ tracks: [], aspect: '1:1;evil' }, { title: 'x' }).aspect).toBeUndefined();
  });
});
