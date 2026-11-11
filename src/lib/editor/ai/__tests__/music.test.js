import { describe, it, expect, vi } from 'vitest';
import { buildMusicRequest, styleTags, snapDuration, normalizePlan, sectionRequest, composeFromPlan, planComposition, generateMusic } from '../music.js';

function makeEditor() {
  const clips = [{ id: 'vo', type: 'audio', role: 'voiceover', s: 2, d: 4 }];
  return {
    clips,
    allClips: () => clips,
    clipStart: (c) => c.s ?? c.start, clipDuration: (c) => c.d ?? (c.end - c.start),
    playheadSec: () => 5,
    ensureTrack: vi.fn(), growTimeline: vi.fn(), snapshot: vi.fn(), commit: vi.fn(), toast: vi.fn(),
    storeBlob: vi.fn(async () => 'https://store/music.mp3'),
    insertClip: vi.fn((c) => { clips.push(c); return c; }),
  };
}

describe('music presets', () => {
  it('builds the style tags and request', () => {
    expect(styleTags({ genre: 'lo-fi', mood: 'calm', style: 'warm', tempo: 82.4 })).toBe('lo-fi, calm, warm, 82 bpm');
    expect(buildMusicRequest({ genre: 'cinematic', mood: 'epic', duration: 500 })).toEqual({ prompt: 'cinematic, epic instrumental background music', style: 'cinematic, epic', duration: 180, instrumental: true });
    expect(buildMusicRequest({ prompt: 'rainy jazz bar', instrumental: false }).instrumental).toBe(false);
    expect(() => buildMusicRequest({})).toThrow(/Describe/);
    expect(snapDuration(3)).toBe(10);
  });
  it('generates, stores and places the track at the playhead with ducking under the voiceover', async () => {
    const editor = makeEditor();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('mp3', { status: 200 })));
    const run = vi.fn(async () => ({ url: 'https://muapi/x.mp3' }));
    const clip = await generateMusic(editor, { genre: 'ambient', mood: 'calm', duration: 20 }, { run });
    expect(run).toHaveBeenCalledWith('music', expect.objectContaining({ style: 'ambient, calm', duration: 20, instrumental: true }), expect.anything());
    expect(clip).toMatchObject({ role: 'music', src: 'https://store/music.mp3', start: 5, end: 25, duck: true });
    expect(clip.keyframes.volume.length).toBeGreaterThan(2);
    expect(editor.ensureTrack).toHaveBeenCalledWith('Music', 'audio');
    vi.unstubAllGlobals();
  });
});

describe('composition plan', () => {
  const plan = normalizePlan({ title: 'Trailer', global_style: 'orchestral', sections: [
    { name: 'Intro', style_tags: 'strings, slow', description: 'Quiet opening', duration: 3, lyrics: '' },
    { name: 'Climax', style_tags: 'brass, 140 bpm', description: 'Big finish', duration: 40, lyrics: 'Rise up' },
  ] });
  it('normalizes sections and builds MuAPI requests per section', () => {
    expect(plan.sections.map((s) => s.duration)).toEqual([10, 40]);
    expect(sectionRequest(plan, plan.sections[0])).toMatchObject({ style: 'orchestral, strings, slow', prompt: 'Quiet opening', instrumental: true, title: 'Trailer — Intro' });
    expect(sectionRequest(plan, plan.sections[1])).toMatchObject({ lyrics: 'Rise up', instrumental: false });
  });
  it('plans with the composition task', async () => {
    const llm = vi.fn(async () => ({ data: { title: 'T', global_style: 'g', sections: [{ name: 'A', style_tags: 't', description: 'd', duration: 20, lyrics: '' }] } }));
    const r = await planComposition('CLIPS…', { seconds: 60, llm });
    expect(llm).toHaveBeenCalledWith('composition', { text: expect.stringContaining('about 60 seconds') }, expect.anything());
    expect(r.sections).toHaveLength(1);
    await expect(planComposition('x', { llm: async () => ({ data: { sections: [] } }) })).rejects.toThrow(/no sections/);
  });
  it('lays sections end to end and keeps what was placed when one fails', async () => {
    const editor = makeEditor();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('mp3', { status: 200 })));
    const run = vi.fn()
      .mockResolvedValueOnce({ url: 'https://m/1.mp3' })
      .mockRejectedValueOnce(new Error('MuAPI returned an error'));
    const status = [];
    const r = await composeFromPlan(editor, plan, { start: 10, run, onSection: (i, s, st) => status.push(`${i}:${st}`) });
    expect(r.placed).toHaveLength(1);
    expect(r.placed[0]).toMatchObject({ start: 10, end: 20, name: 'Trailer · Intro' });
    expect(r.failed).toMatch(/Climax: MuAPI returned an error/);
    expect(status).toEqual(['0:generating', '0:done', '1:generating', '1:failed']);
    vi.unstubAllGlobals();
  });
});
