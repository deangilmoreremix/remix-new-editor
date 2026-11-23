// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { liveCaptionSupport, installOnDevice, createLiveCaptions, speechRecognitionCtor } from '../lib/editor/speech/liveCaptions.js';

/** A stand-in for the browser's recognizer: tests push results through `emit`. */
function fakeRecognizer({ available = 'available', install = true } = {}) {
  const made = [];
  class Rec {
    constructor() { made.push(this); this.started = 0; this.stopped = 0; }
    start() { this.started += 1; }
    stop() { this.stopped += 1; this.onend?.(); }
    emit(list, resultIndex = 0) { this.onresult?.({ resultIndex, results: list.map(([t, f]) => Object.assign([{ transcript: t }], { isFinal: f })) }); }
  }
  Rec.available = vi.fn(async () => available);
  Rec.install = vi.fn(async () => install);
  return { Rec, made };
}
const win = (Rec) => (Rec ? { SpeechRecognition: Rec } : {});

describe('live captions: what the browser can do', () => {
  it('finds the recognizer under either name, and none in a browser without it', () => {
    const { Rec } = fakeRecognizer();
    expect(speechRecognitionCtor({ SpeechRecognition: Rec })).toBe(Rec);
    expect(speechRecognitionCtor({ webkitSpeechRecognition: Rec })).toBe(Rec);
    expect(speechRecognitionCtor({})).toBeNull();
  });

  it('reports on-device availability for the language, and "unknown" when the browser cannot say', async () => {
    for (const state of ['available', 'downloadable', 'downloading', 'unavailable']) {
      const { Rec } = fakeRecognizer({ available: state });
      expect(await liveCaptionSupport({ lang: 'es-ES', win: win(Rec) })).toEqual({ supported: true, onDevice: state });
      expect(Rec.available).toHaveBeenCalledWith({ langs: ['es-ES'], processLocally: true });
    }
    class OldRec {}
    expect(await liveCaptionSupport({ win: { webkitSpeechRecognition: OldRec } })).toEqual({ supported: true, onDevice: 'unknown' });
    expect(await liveCaptionSupport({ win: {} })).toEqual({ supported: false, onDevice: 'unavailable' });
    const boom = fakeRecognizer(); boom.Rec.available = vi.fn(async () => { throw new Error('x'); });
    expect(await liveCaptionSupport({ win: win(boom.Rec) })).toEqual({ supported: true, onDevice: 'unknown' });
  });

  it('downloads the on-device language pack, and says no when it cannot', async () => {
    const ok = fakeRecognizer({ install: true });
    expect(await installOnDevice({ lang: 'fr-FR', win: win(ok.Rec) })).toBe(true);
    expect(ok.Rec.install).toHaveBeenCalledWith({ langs: ['fr-FR'], processLocally: true });
    expect(await installOnDevice({ win: win(fakeRecognizer({ install: false }).Rec) })).toBe(false);
    expect(await installOnDevice({ win: {} })).toBe(false);
  });
});

describe('live captions: a session', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('on-device mode asks the browser to process locally; browser mode does not', () => {
    const a = fakeRecognizer(); createLiveCaptions({ mode: 'on-device', win: win(a.Rec) }).start();
    expect(a.made[0].processLocally).toBe(true); expect(a.made[0].continuous).toBe(true); expect(a.made[0].interimResults).toBe(true);
    const b = fakeRecognizer(); createLiveCaptions({ mode: 'browser', lang: 'de-DE', win: win(b.Rec) }).start();
    expect(b.made[0].processLocally).toBeUndefined(); expect(b.made[0].lang).toBe('de-DE');
  });

  it('shows finished words and the words still being decided, and keeps finished phrases with times', () => {
    let t = 1000; const updates = [];
    const { Rec, made } = fakeRecognizer();
    const live = createLiveCaptions({ win: win(Rec), now: () => t, onUpdate: (u) => updates.push(u) });
    live.start();
    t = 1800; made[0].emit([['hello there', false]]);
    expect(updates.at(-1)).toMatchObject({ text: 'hello there', final: '', interim: 'hello there' });
    t = 2500; made[0].emit([['hello there', true]]);
    t = 3200; made[0].emit([['hello there', true], ['and welcome', false]], 1);
    expect(updates.at(-1)).toMatchObject({ text: 'hello there and welcome', final: 'hello there', interim: 'and welcome' });
    expect(updates.at(-1).segments).toEqual([{ text: 'hello there', startMs: 0, endMs: 1500 }]);
    t = 4000; made[0].emit([['hello there', true], ['and welcome', true]], 1);
    expect(live.stop()).toEqual({ text: 'hello there and welcome', segments: [{ text: 'hello there', startMs: 0, endMs: 1500 }, { text: 'and welcome', startMs: 1500, endMs: 3000 }] });
  });

  it('carries on after the browser ends the session on a pause, and stops for good on stop()', () => {
    const { Rec, made } = fakeRecognizer();
    const live = createLiveCaptions({ win: win(Rec) });
    live.start();
    made[0].onend();                                  // a pause in speech
    expect(made.length).toBe(2); expect(made[1].started).toBe(1);
    live.stop();
    expect(live.running).toBe(false);
    const n = made.length; made.at(-1).onend?.();
    expect(made.length).toBe(n);                      // no restart after stop
  });

  it('reports a blocked microphone or language and ignores silence', () => {
    const errors = [];
    const { Rec, made } = fakeRecognizer();
    const live = createLiveCaptions({ win: win(Rec), onError: (e) => errors.push(e.code) });
    live.start();
    made[0].onerror({ error: 'no-speech' }); made[0].onerror({ error: 'aborted' });
    expect(errors).toEqual([]);
    made[0].onerror({ error: 'not-allowed' });
    expect(errors).toEqual(['not-allowed']); expect(live.running).toBe(false);
    const none = []; expect(createLiveCaptions({ win: {}, onError: (e) => none.push(e.code) }).start()).toBe(false); expect(none).toEqual(['unsupported']);
  });
});
