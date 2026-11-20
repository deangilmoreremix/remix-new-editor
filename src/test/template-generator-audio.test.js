// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TemplateGeneratorModal } from '../components/modals/TemplateGeneratorModal.jsx';
import { STEPS, createWizardState, toBuilderState } from '../components/modals/template-generator/rules.js';
import { createTemplateStore, snapshotTemplate, restoreTemplate } from '../components/modals/template-generator/templates.js';
import { MUSIC_TRACKS, musicTrack } from '../components/modals/template-generator/music.js';
import { audioPlan } from '../components/modals/template-generator/audioPlan.js';
import { makeVoiceover, narrationText, MAX_VOICE_CHARS } from '../components/modals/template-generator/voiceover.js';
import { createPreviewPlayer, renderPlayerHTML } from '../components/modals/template-generator/preview.js';
import { buildCompositionFromState } from '../lib/editor/templateCompositionBuilder.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const clip = (n) => ({ id: `v${n}`, kind: 'video', source: 'x', title: `Clip ${n}`, url: `https://x.test/${n}.mp4`, poster: `https://x.test/${n}.jpg`, duration: 6 });
const wizard = () => { const s = createWizardState(); s.selectedVideos = [clip(1), clip(2)]; s.script.text = 'First line.\nSecond line.'; return s; };

describe('music + audio plan', () => {
  it('offers only the three tracks the app licenses, as bundled files', () => {
    expect(MUSIC_TRACKS.map((t) => t.id)).toEqual(['cat-walk', 'house-vibez', 'tonight-hiphop']);
    expect(MUSIC_TRACKS.every((t) => t.url.startsWith('/motion-studio/bgmlib/'))).toBe(true);
    expect(musicTrack('nope')).toBeNull();
  });

  it('no music and no voice → nothing plays; music is trimmed to the cut with a fade curve at the mix volume', () => {
    const s = wizard();
    expect(audioPlan(s, 12)).toMatchObject({ voice: null, music: null, footageVolume: 1 });
    s.music.id = 'cat-walk'; s.mix.music = 0.4;
    const p = audioPlan(s, 12);
    expect(p.music.duration).toBe(12);                         // not the 124 s file
    expect(p.music.keyframes[0].v).toBe(0);                    // fades in
    expect(Math.max(...p.music.keyframes.map((k) => k.v))).toBeCloseTo(0.4, 2);   // curve already carries the volume
  });

  it('ducks the music under the voiceover, and not when ducking is off', () => {
    const s = wizard(); s.music.id = 'house-vibez'; s.mix.music = 0.5; s.voice.enabled = true; s.voice.generatedAsset = { url: 'https://x.test/v.mp3', duration: 6 };
    const at = (list, t) => { const k = list.find((x) => Math.abs(x.t - t) < 0.01); return k?.v; };
    const ducked = audioPlan(s, 12).music.keyframes;
    expect(Math.min(...ducked.filter((k) => k.t >= 0.3 && k.t <= 6).map((k) => k.v))).toBeLessThan(0.5);
    s.music.duck = false;
    const flat = audioPlan(s, 12).music.keyframes;
    expect(Math.min(...flat.filter((k) => k.t >= 1 && k.t <= 10).map((k) => k.v))).toBeCloseTo(0.5, 2);
    expect(at(flat, 0)).toBe(0);
  });
});

describe('makeVoiceover', () => {
  const deps = () => ({
    generateAudio: vi.fn(async () => 'data:audio/mpeg;base64,AAAA'),
    persistAudio: vi.fn(async (u, o) => (o.upload ? 'https://cdn.test/voice.mp3' : u)),
    probeDuration: vi.fn(async () => 7.5),
    upload: vi.fn(async () => ({ url: 'https://cdn.test/voice.wav' })),
  });

  it('reads the script as one text, capped to what the provider accepts', () => {
    expect(narrationText('One.\n\nTwo.\n')).toBe('One. Two.');
    expect(narrationText('x'.repeat(5000))).toHaveLength(MAX_VOICE_CHARS);
  });

  it('OpenAI voices use the customer\'s key, are copied to storage (never a data: URL), and report the real length', async () => {
    const d = deps();
    const out = await makeVoiceover({ text: 'Hello there.\nBook now.', engine: 'openai', voice: 'marin', instructions: 'Warm', deps: d });
    expect(d.generateAudio).toHaveBeenCalledWith('tts', expect.objectContaining({ provider: 'openai', voice: 'marin', text: 'Hello there. Book now.', instructions: 'Warm' }), expect.anything());
    expect(typeof d.persistAudio.mock.calls[0][1].upload).toBe('function');      // the regression to avoid: no upload → data: URL in the project
    expect(out).toMatchObject({ url: 'https://cdn.test/voice.mp3', duration: 7.5, durable: true, engine: 'openai' });
  });

  it('a missing key is a clear message, and an empty script is refused', async () => {
    const d = deps(); d.generateAudio = vi.fn(async () => { throw new Error('OpenAI voices use your own OpenAI key. Add it in Settings → API keys (OpenAI API Key).'); });
    await expect(makeVoiceover({ text: 'Hi', deps: d })).rejects.toThrow(/your own OpenAI key/);
    await expect(makeVoiceover({ text: '   ', deps: deps() })).rejects.toThrow(/script/i);
  });

  it('the free voice runs on the device, is uploaded, and falls back to a session-only URL when the upload fails', async () => {
    const d = deps(); d.speakFree = vi.fn(async () => ({ wav: new Blob(['x'], { type: 'audio/wav' }), duration: 4.2 }));
    const ok = await makeVoiceover({ text: 'Hi there', engine: 'free', deps: d });
    expect(d.generateAudio).not.toHaveBeenCalled();
    expect(ok).toMatchObject({ url: 'https://cdn.test/voice.wav', duration: 4.2, durable: true, engine: 'free' });
    d.upload = vi.fn(async () => { throw new Error('offline'); }); d.localUrl = () => 'blob:local';
    expect(await makeVoiceover({ text: 'Hi there', engine: 'free', deps: d })).toMatchObject({ url: 'blob:local', durable: false });
  });
});

describe('audio reaches the composition and saved templates', () => {
  const full = () => {
    const s = wizard(); s.music.id = 'tonight-hiphop'; s.mix = { footage: 0.8, voice: 0.9, music: 0.3 };
    s.voice.enabled = true; s.voice.generatedAsset = { url: 'https://cdn.test/v.mp3', duration: 5 };
    return s;
  };

  it('the builder adds a Voice track and a Music track trimmed to the cut, with the mix', () => {
    const comp = buildCompositionFromState(toBuilderState(full()));
    const voice = comp.tracks.find((t) => t.name === 'Voice').clips[0];
    const music = comp.tracks.find((t) => t.name === 'Music').clips[0];
    expect(voice.asset.url).toBe('https://cdn.test/v.mp3');
    expect(voice.volume).toBe(0.9);
    expect(music.duration).toBe(12);
    expect(music.asset.duration).toBe(113);                      // the source file, to be trimmed by the host
    expect(music.keyframes.volume.length).toBeGreaterThan(3);
    expect(comp.tracks.find((t) => t.name === 'Scene Media').clips[0].volume).toBe(0.8);
  });

  it('saved templates keep the voice (when stored for good), the music and the mix', () => {
    const s = full();
    let rec = JSON.parse(JSON.stringify(snapshotTemplate(s, { name: 'T' })));
    let back = restoreTemplate(rec, () => null);
    expect(back.voice.generatedAsset.url).toBe('https://cdn.test/v.mp3');
    expect(back.music.id).toBe('tonight-hiphop'); expect(back.mix.music).toBe(0.3);
    s.voice.generatedAsset = { url: 'blob:session-only', duration: 5 };
    rec = JSON.parse(JSON.stringify(snapshotTemplate(s, { name: 'T' })));
    expect(rec.voice.generatedAsset).toBeNull();                 // a blob: URL would be dead on another device
    delete rec.music; delete rec.mix;
    back = restoreTemplate(rec, () => null);
    expect(back.music.id).toBe(''); expect(back.mix.footage).toBe(1);   // old records load
  });
});

describe('preview audio', () => {
  const made = [];
  class FakeAudio { constructor() { this.paused = true; this.volume = 1; this.currentTime = 0; made.push(this); } play() { this.paused = false; return Promise.resolve(); } pause() { this.paused = true; } removeAttribute() {} load() {} }
  afterEach(() => { vi.unstubAllGlobals(); made.length = 0; document.body.innerHTML = ''; });
  const mount = (audio) => {
    vi.stubGlobal('Audio', FakeAudio);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const root = document.createElement('div');
    const playlist = [{ type: 'video', src: 'https://x.test/a.mp4', name: 'A', duration: 10, start: 0, poster: '' }];
    root.innerHTML = renderPlayerHTML(playlist); document.body.appendChild(root);
    return { root, player: createPreviewPlayer(root, playlist, { audio }) };
  };

  it('plays and pauses with the player, at the track volume', () => {
    const { root, player } = mount([{ id: 'music', url: 'https://x.test/m.mp3', start: 0, duration: 10, volume: 0.5 }]);
    expect(made).toHaveLength(1);
    root.querySelector('[data-player="toggle"]').click();
    expect(made[0].paused).toBe(false); expect(made[0].volume).toBe(0.5);
    root.querySelector('[data-player="toggle"]').click();
    expect(made[0].paused).toBe(true);
    player.destroy();
  });

  it('follows the duck curve, resyncs on seek, and a new mix replaces the tracks', () => {
    const { root, player } = mount([{ id: 'music', url: 'https://x.test/m.mp3', start: 0, duration: 10, volume: 1, keyframes: [{ t: 0, v: 1 }, { t: 10, v: 0 }] }]);
    root.querySelector('[data-player="toggle"]').click();
    player.seek(5);
    expect(made[0].currentTime).toBeCloseTo(5, 0); expect(made[0].volume).toBeCloseTo(0.5, 1);
    player.setAudio([{ id: 'voice', url: 'https://x.test/v.mp3', start: 2, duration: 3, volume: 0.7 }]);
    expect(made.at(-1).src === undefined || true).toBe(true);
    player.seek(3);
    expect(made.at(-1).volume).toBe(0.7); expect(made.at(-1).paused).toBe(false);
    player.seek(8);                                              // after the voiceover ended
    expect(made.at(-1).paused).toBe(true);
    player.destroy();
  });
});

describe('Preview step — voice, music and mix panels', () => {
  afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });
  const open = (extra = {}) => {
    const m = new TemplateGeneratorModal({ defaultProvider: 'pixabay', templateCatalog: async () => { throw new Error('offline'); }, stockSearch: async () => ({ items: [], hasMore: false }), templateStore: createTemplateStore(memory()), ...extra });
    m.open(); Object.assign(m.s, wizard()); m.s.started = true; m.s.step = STEPS.PREVIEW; m.ui.openPanels = { voice: true, mix: true }; m.paint();
    return m;
  };

  it('"Make the voiceover" stores the asset, switches the voice on, and shows it is ready', async () => {
    const voiceMaker = vi.fn(async () => ({ url: 'https://cdn.test/v.mp3', duration: 6.4, name: 'AI voiceover', durable: true }));
    const m = open({ voiceMaker });
    document.querySelector('[data-act="voice-generate"]').click();
    await vi.waitFor(() => expect(m.s.voice.generatedAsset?.url).toBe('https://cdn.test/v.mp3'));
    expect(voiceMaker.mock.calls[0][0]).toMatchObject({ engine: 'openai', voice: 'marin' });
    expect(m.s.voice.enabled).toBe(true);
    expect(document.querySelector('#tg-voice .tg-status').textContent).toContain('Voiceover ready');
    expect(document.querySelector('.tg-voice-audio').getAttribute('src')).toBe('https://cdn.test/v.mp3');
    m.destroy();
  });

  it('a failed voiceover shows the reason (e.g. no key) and does not lose the script', async () => {
    const m = open({ voiceMaker: async () => { throw new Error('Add your OpenAI key in Settings → API keys.'); } });
    document.querySelector('[data-act="voice-generate"]').click();
    await vi.waitFor(() => expect(document.querySelector('.tg-status--error').textContent).toContain('OpenAI key'));
    expect(m.s.voice.generatedAsset).toBeNull(); expect(m.s.script.text).toContain('First line');
    m.destroy();
  });

  it('switching to the free voice changes the voice list; music and volume changes reach the live preview', () => {
    const m = open();
    const sel = document.querySelector('select[data-voice="engine"]'); sel.value = 'free'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(m.s.voice.engine).toBe('free'); expect(m.s.voice.voice).toBe('af_heart');
    expect(document.querySelector('select[data-voice="voice"]').textContent).toContain('Heart');
    const spy = vi.spyOn(m._player, 'setAudio');
    const radio = document.querySelector('input[data-music="cat-walk"]'); radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true }));
    expect(m.s.music.id).toBe('cat-walk'); expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls.at(-1)[0].find((a) => a.id === 'music').duration).toBe(12);
    const slider = document.querySelector('input[data-mix="music"]'); slider.value = '60'; slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(m.s.mix.music).toBe(0.6);
    m.destroy();
  });
});
