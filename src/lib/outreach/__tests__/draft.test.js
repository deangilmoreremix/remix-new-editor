import { describe, it, expect } from 'vitest';
import {
  defaultDraft, loadDraft, saveDraft, DRAFT_KEY, tokensIn, fillTemplate, stepErrors,
  speakRequest, buildEditorProject, isHttpsUrl,
} from '../draft.js';
import { encodeWav, encodeWavBuffer, mixToMono } from '../voiceSample.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

function readyDraft(overrides = {}) {
  const d = defaultDraft();
  d.video = { url: 'https://store/rec.webm', duration: 42, hasAudio: true, type: 'both' };
  d.voice = { ...d.voice, mode: 'clone', cloneVoiceId: 'voice_abc123', consent: { at: '2026-11-15T00:00:00Z', userId: 'user_1' }, fallbackUrl: 'https://store/greeting.mp3', fallbackDuration: 1.8 };
  d.cta = { enabled: true, label: 'Book a call', url: 'https://cal.com/me/intro' };
  return Object.assign(d, overrides);
}

describe('outreach draft', () => {
  it('round-trips through storage and fills missing fields from defaults', () => {
    const store = memory();
    expect(loadDraft(store)).toEqual(defaultDraft());
    store.setItem(DRAFT_KEY, JSON.stringify({ header: 'Yo {{firstname}}', cta: { label: 'Call me' } }));
    const d = loadDraft(store);
    expect(d.header).toBe('Yo {{firstname}}');
    expect(d.cta).toEqual({ enabled: true, label: 'Call me', url: '' });
    expect(d.voice.mode).toBe('clone');
    saveDraft({ ...d, header: 'Saved' }, store);
    expect(loadDraft(store).header).toBe('Saved');
    store.setItem(DRAFT_KEY, '{not json');
    expect(loadDraft(store)).toEqual(defaultDraft());
  });

  it('fills tokens from the contact, then the fallbacks', () => {
    expect(tokensIn('Hi {{firstName}} at {{ company }} {{firstname}}')).toEqual(['firstname', 'company']);
    expect(fillTemplate('Hi {{firstname}}!', { firstName: 'Mike' }, { firstname: 'there' })).toBe('Hi Mike!');
    expect(fillTemplate('Hi {{firstname}}!', { firstname: '  ' }, { firstname: 'there' })).toBe('Hi there!');
    expect(fillTemplate('Hi {{firstname}} from {{unknown}}', {}, { firstname: 'friend' })).toBe('Hi friend from');
  });

  it('blocks each step until it is complete', () => {
    const d = defaultDraft();
    expect(stepErrors(d, 1)[0]).toMatch(/Record or upload/);
    expect(stepErrors({ ...d, video: { url: 'blob:x' } }, 1)[0]).toMatch(/uploading/);
    expect(stepErrors(d, 2).join(' ')).toMatch(/Clone your voice/);
    expect(stepErrors(d, 2).join(' ')).toMatch(/own before/);
    expect(stepErrors({ ...readyDraft(), greeting: 'x'.repeat(71) }, 2)[0]).toMatch(/70 characters/);
    expect(stepErrors(readyDraft({ cta: { enabled: true, label: 'Go', url: 'http://cal.com/x' } }), 3)[0]).toMatch(/https/);
    expect(stepErrors(readyDraft({ cta: { enabled: false, label: '', url: '' } }), 3)).toEqual([]);
    for (const s of [1, 2, 3]) expect(stepErrors(readyDraft(), s)).toEqual([]);
    // A stock voice needs no clone or consent.
    const stock = readyDraft();
    stock.voice = { ...stock.voice, mode: 'stock', stockVoice: 'Calm_Woman', cloneVoiceId: '', consent: null };
    expect(stepErrors(stock, 2)).toEqual([]);
  });

  it('only accepts https booking links with a real host', () => {
    expect(isHttpsUrl('https://cal.com/me')).toBe(true);
    for (const bad of ['http://cal.com', 'javascript:alert(1)', 'https://localhost/x', 'cal.com/me', '']) expect(isHttpsUrl(bad)).toBe(false);
  });

  it('speaks with the cloned voice, or the stock one', () => {
    expect(speakRequest(readyDraft(), 'Hi Mike')).toEqual({ provider: 'minimax', text: 'Hi Mike', voice: 'voice_abc123', speed: 1, cloneVoiceId: 'voice_abc123' });
    const stock = readyDraft(); stock.voice.mode = 'stock'; stock.voice.stockVoice = 'Calm_Woman';
    expect(speakRequest(stock, 'Hi')).toEqual({ provider: 'minimax', text: 'Hi', voice: 'Calm_Woman', speed: 1 });
  });

  it('builds an editor project: recording, personalized greeting and CTA', () => {
    const p = buildEditorProject(readyDraft(), { now: 1000 });
    expect(p.timelineSeconds).toBe(42);
    const [video, voice, text] = p.tracks;
    expect(video).toMatchObject({ type: 'video', name: 'Main Video', muted: false });
    expect(video.items[0]).toMatchObject({ type: 'video', src: 'https://store/rec.webm', left: 0, width: 100 });
    expect(voice).toMatchObject({ type: 'audio', name: 'Voiceover' });
    expect(voice.items[0]).toMatchObject({
      type: 'audio', role: 'voiceover', src: 'https://store/greeting.mp3', start: 0, end: 1.8,
      tts: { provider: 'minimax', voice: 'voice_abc123', cloneVoiceId: 'voice_abc123', text: 'Hi {{firstname}}!', fallback: 'Hi there!', personalized: true },
    });
    expect(text.name).toBe('Text');
    expect(text.items[0]).toMatchObject({ type: 'click-to-call', linkMode: 'url', linkUrl: 'https://cal.com/me/intro', buttonText: 'Book a call', end: 42 });
    expect(text.items[0].start).toBeGreaterThanOrEqual(36);
    // Both keys, like the editor's own saves.
    for (const t of p.tracks) expect(t.clips).toBe(t.items);
    expect(p.outreach).toMatchObject({ header: 'Hi {{firstname}}, I made this for you', aiVoice: 'cloned', cta: { label: 'Book a call' } });
  });

  it('leaves out the CTA when it is off, and refuses an unfinished draft', () => {
    expect(buildEditorProject(readyDraft({ cta: { enabled: false, label: '', url: '' } })).tracks[2].items).toEqual([]);
    expect(() => buildEditorProject(defaultDraft())).toThrow(/Record or upload/);
  });
});

describe('voice sample encoding', () => {
  it('writes a valid mono 16-bit WAV', () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 0.5]), 24000);
    const bytes = new DataView(encodeWavBuffer(new Float32Array([0, 1, -1, 0.5]), 24000));
    const tag = (o) => String.fromCharCode(...[0, 1, 2, 3].map((i) => bytes.getUint8(o + i)));
    expect(wav.type).toBe('audio/wav');
    expect([tag(0), tag(8), tag(12), tag(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data']);
    expect(bytes.getUint16(22, true)).toBe(1); // mono
    expect(bytes.getUint32(24, true)).toBe(24000);
    expect(bytes.getUint32(40, true)).toBe(8); // 4 samples × 2 bytes
    expect(bytes.getInt16(46, true)).toBe(32767);
    expect(bytes.getInt16(48, true)).toBe(-32768);
  });

  it('mixes channels to mono and trims to the limit', () => {
    const buffer = { length: 4, numberOfChannels: 2, getChannelData: (c) => (c === 0 ? new Float32Array([1, 1, 1, 1]) : new Float32Array([0, 0, 0, 0])) };
    expect(Array.from(mixToMono(buffer, 3))).toEqual([0.5, 0.5, 0.5]);
  });
});
