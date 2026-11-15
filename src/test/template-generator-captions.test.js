// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';

const wasm = vi.hoisted(() => ({
  canUseWhisperWeb: vi.fn(async () => ({ supported: true })),
  downloadWhisperModel: vi.fn(async ({ onProgress }) => { onProgress({ progress: 1 }); return { alreadyDownloaded: false }; }),
  transcribe: vi.fn(async () => ({ transcription: [] })),
  toCaptions: vi.fn(() => ({ captions: [{ text: ' Hello', startMs: 0, endMs: 400 }, { text: ' world', startMs: 450, endMs: 900 }] })),
}));
const tx = vi.hoisted(() => ({
  transcribeInBrowser: vi.fn(async () => ({ text: 'hi there', captions: [{ text: 'Hi', startMs: 100, endMs: 500 }, { text: ' there', startMs: 520, endMs: 900 }] })),
  decodeAudio: vi.fn(async () => new Float32Array(16000)),
}));
vi.mock('@remotion/whisper-web', () => wasm);
vi.mock('../lib/editor/remotion/transcribe.js', () => tx);

import { TemplateGeneratorModal } from '../components/modals/TemplateGeneratorModal.jsx';
import { STEPS, createWizardState, toBuilderState, captionTrackFor, previewTexts } from '../components/modals/template-generator/rules.js';
import { createTemplateStore, snapshotTemplate, restoreTemplate } from '../components/modals/template-generator/templates.js';
import { captionsToWords, evenWords, transcribeCaptions, engineStatus, localServerStatus, encodeWav, CAPTION_MODELS, MAX_CAPTION_AUDIO_SEC } from '../components/modals/template-generator/captions.js';
import { captionPages, captionPageHTML, captionTextCss, pagesToSrt } from '../components/modals/template-generator/captionPreview.js';
import { CAPITE_STYLES } from '../openchatcut/captions/capiteStyles';
import { CAPTION_STYLES, CAPTION_STYLE_BY_ID, captionStyleFor } from '../openchatcut/captions/styles';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const clip = (n) => ({ id: `v${n}`, kind: 'video', source: 'x', title: `Clip ${n}`, url: `https://x.test/${n}.mp4`, poster: `https://x.test/${n}.jpg`, duration: 6 });
const wizard = () => { const s = createWizardState(); s.selectedVideos = [clip(1), clip(2)]; s.script.text = 'First line of the script.\nSecond line to read.'; return s; };

describe('Capite caption styles', () => {
  it('ports all 27 looks, each a valid, distinct style the editor can draw', () => {
    expect(CAPITE_STYLES).toHaveLength(27);
    expect(new Set(CAPITE_STYLES.map((x) => x.id)).size).toBe(27);
    expect(CAPITE_STYLES.every((x) => x.id.startsWith('capite-'))).toBe(true);
    for (const st of CAPITE_STYLES) {
      expect(captionStyleFor(st.id)).toBe(st);
      expect(st.fontSize).toBeGreaterThan(0.03); expect(st.fontSize).toBeLessThan(0.07);
      expect(st.fontFamily).toBeTruthy(); expect(st.color).toMatch(/^#/);
      expect(['pop', 'word-pop', 'karaoke-pulse', 'fade-up']).toContain(st.motion);
    }
  });

  it('leaves the editor\'s own looks untouched', () => {
    expect(CAPTION_STYLES).toHaveLength(22);
    expect(CAPTION_STYLE_BY_ID.tiktok.label).toBe('TikTok Pop');
    expect(captionStyleFor('capite-hormozi').highlightColor).toBe('#00FFFF');
    expect(captionStyleFor('capite-mrbeast').textTransform).toBe('uppercase');
    expect(captionStyleFor('not-a-style').id).toBe('plain');   // unknown ids still degrade
  });

  it('a "box" look highlights with a chip behind the word, a "glow" look with a glow', () => {
    expect(captionStyleFor('capite-crimson-pop').highlightBackground).toBe('#E11D48');
    expect(captionStyleFor('capite-cyberpunk').textShadow).toContain('#FF007F');
  });
});

describe('captions.js', () => {
  it('turns Remotion captions into clean, non-overlapping words in ms', () => {
    const w = captionsToWords([{ text: ' world', startMs: 500, endMs: 900 }, { text: ' Hello', startMs: 0, endMs: 700 }, { text: ' ', startMs: 1, endMs: 2 }]);
    expect(w).toEqual([{ text: 'Hello', start: 0, end: 500 }, { text: 'world', start: 500, end: 900 }]);
  });

  it('spreads a script over the cut when there is no audio to listen to', () => {
    const w = evenWords('One two three. Four five', 10);
    expect(w).toHaveLength(5);
    expect(w[0].start).toBe(0);
    expect(w.at(-1).end).toBeGreaterThan(9900); expect(w.at(-1).end).toBeLessThanOrEqual(10000);
    expect(w.every((x, i) => i === 0 || x.start >= w[i - 1].start)).toBe(true);
    expect(evenWords('', 5)).toEqual([]);
  });

  /** A stand-in for captions.worker.js: answers the way the real one does (the @remotion/whisper-webgpu package runs inside it). */
  const fakeWorker = (reply) => () => {
    const listeners = { message: [], error: [] };
    return {
      addEventListener: (t, f) => listeners[t].push(f), removeEventListener: (t, f) => { listeners[t] = listeners[t].filter((x) => x !== f); },
      postMessage: (msg) => { Promise.resolve().then(() => { for (const m of reply(msg)) listeners.message.forEach((f) => f({ data: { id: msg.id, ...m } })); }); },
      terminate: vi.fn(),
    };
  };
  const heard = (words) => (msg) => [{ type: 'progress', stage: 'download', progress: 0.5 }, { type: 'done', words }];
  const secWords = [{ text: ' Hi', startInSeconds: 0.1, endInSeconds: 0.5 }, { text: ' there', startInSeconds: 0.52, endInSeconds: 0.9 }];

  it('Whisper WebGPU: the @remotion/whisper-webgpu package (in its worker) returns word timings, with the chosen model and language', async () => {
    const sent = [];
    const workerFactory = fakeWorker((msg) => { sent.push(msg); return heard(secWords)(msg); });
    const progress = [];
    const out = await transcribeCaptions('https://x.test/a.mp3', { engine: 'whisper-webgpu', model: 'tiny', language: 'es', workerFactory, onProgress: (p) => progress.push(p.stage) });
    expect(out).toMatchObject({ engine: 'whisper-webgpu', model: 'tiny', words: [{ text: 'Hi', start: 100, end: 500 }, { text: 'there', start: 520, end: 900 }] });
    expect(out.note).toBeUndefined();
    expect(sent[0]).toMatchObject({ type: 'transcribe', model: 'tiny', language: 'es' });
    expect(sent[0].audio).toBeInstanceOf(Float32Array);
    expect(progress).toEqual(expect.arrayContaining(['decode', 'download']));
    expect(tx.transcribeInBrowser).not.toHaveBeenCalled();     // the older engine is not used when the package works
  });

  it('Whisper WebGPU: offers several model sizes, and an old saved model id falls back to the default', async () => {
    expect(CAPTION_MODELS['whisper-webgpu'].map(([id]) => id)).toEqual(['base', 'tiny', 'small', 'large-v3-turbo']);
    const out = await transcribeCaptions('https://x.test/a.mp3', { model: 'onnx-community/whisper-base_timestamped', workerFactory: fakeWorker(heard(secWords)) });
    expect(out.model).toBe('base');
  });

  it('Whisper WebGPU: when the package cannot run here, the editor\'s built-in Whisper listens instead, and says so', async () => {
    const workerFactory = fakeWorker(() => [{ type: 'error', message: 'WebGPU is not available', fallback: true }]);
    const out = await transcribeCaptions('https://x.test/a.mp3', { engine: 'whisper-webgpu', model: 'tiny', workerFactory });
    expect(out.words).toEqual([{ text: 'Hi', start: 100, end: 500 }, { text: 'there', start: 520, end: 900 }]);
    expect(out.note).toContain('built-in Whisper');
    expect(tx.transcribeInBrowser.mock.calls.at(-1)[1].model).toBe('onnx-community/whisper-tiny_timestamped');
  });

  it('Whisper WebGPU: a real failure (not a "cannot run here") is reported, and Cancel stops a listen', async () => {
    await expect(transcribeCaptions('https://x.test/a.mp3', { workerFactory: fakeWorker(() => [{ type: 'error', message: 'out of memory' }]) })).rejects.toThrow(/out of memory/);
    const ctl = new AbortController();
    const hang = () => ({ addEventListener() {}, removeEventListener() {}, postMessage() { ctl.abort(); }, terminate: vi.fn() });
    await expect(transcribeCaptions('https://x.test/a.mp3', { workerFactory: hang, signal: ctl.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('Whisper.cpp (WASM): downloads the model, listens through the WASM build, and returns the same shape', async () => {
    const out = await transcribeCaptions('https://x.test/a.mp3', { engine: 'whisper-cpp', model: 'tiny', language: 'en' });
    expect(out).toMatchObject({ engine: 'whisper-cpp', model: 'tiny', words: [{ text: 'Hello', start: 0, end: 400 }, { text: 'world', start: 450, end: 900 }] });
    expect(wasm.downloadWhisperModel).toHaveBeenCalledWith(expect.objectContaining({ model: 'tiny' }));
    expect(wasm.transcribe.mock.calls.at(-1)[0]).toMatchObject({ model: 'tiny', language: 'en' });
  });

  it('Whisper.cpp (WASM) on a page that is not cross-origin isolated says so and uses Whisper WebGPU', async () => {
    wasm.canUseWhisperWeb.mockResolvedValueOnce({ supported: false, reason: 'not-cross-origin-isolated' });
    const out = await transcribeCaptions('https://x.test/a.mp3', { engine: 'whisper-cpp', workerFactory: fakeWorker(heard(secWords)) });
    expect(out.engine).toBe('whisper-webgpu');
    expect(out.note).toContain('cross-origin-isolated');
    expect(CAPTION_MODELS['whisper-webgpu'].some(([id]) => id === out.model)).toBe(true);   // a model of the engine that ran
    wasm.canUseWhisperWeb.mockResolvedValueOnce({ supported: false, reason: 'not-cross-origin-isolated' });
    expect((await engineStatus('whisper-cpp')).ok).toBe(false);
    expect((await engineStatus('whisper-webgpu')).ok).toBe(true);
  });

  describe('Whisper.cpp (local server, @remotion/install-whisper-cpp)', () => {
    const server = (handlers) => vi.fn(async (url, init) => {
      const path = new URL(url).pathname;
      const h = handlers[path];
      if (!h) throw new Error('connection refused');
      return h(url, init);
    });
    const json = (body, ok = true, status = 200) => ({ ok, status, json: async () => body });

    it('is offered only while the server answers /health', async () => {
      expect(await localServerStatus({ fetchImpl: server({ '/health': () => json({ ok: true, models: ['base'] }) }) })).toEqual({ ok: true, models: ['base'] });
      expect(await localServerStatus({ fetchImpl: server({}) })).toEqual({ ok: false });
      expect(await localServerStatus({ fetchImpl: server({ '/health': () => json({}, false, 500) }) })).toEqual({ ok: false });
    });

    it('sends the 16 kHz audio as a WAV, with the model and language, and returns the same word timings', async () => {
      const calls = [];
      const fetchImpl = server({
        '/health': () => json({ ok: true }),
        '/transcribe': (url, init) => { calls.push({ url, init }); return json({ ok: true, captions: [{ text: ' Hola', startMs: 0, endMs: 300 }, { text: ' mundo', startMs: 320, endMs: 800 }] }); },
      });
      const out = await transcribeCaptions('https://x.test/a.mp3', { engine: 'whisper-cpp-local', model: 'medium', language: 'es', fetchImpl });
      expect(out).toMatchObject({ engine: 'whisper-cpp-local', model: 'medium', words: [{ text: 'Hola', start: 0, end: 300 }, { text: 'mundo', start: 320, end: 800 }] });
      expect(calls[0].url).toContain('model=medium'); expect(calls[0].url).toContain('language=es');
      expect(calls[0].init.method).toBe('POST');
      expect(String.fromCharCode(...calls[0].init.body.slice(0, 4))).toBe('RIFF');
    });

    it('with the server not running, says so and uses Whisper WebGPU; a server error is reported', async () => {
      const out = await transcribeCaptions('https://x.test/a.mp3', { engine: 'whisper-cpp-local', fetchImpl: server({}), workerFactory: fakeWorker(heard(secWords)) });
      expect(out.engine).toBe('whisper-webgpu'); expect(out.note).toContain('captions-server');
      const bad = server({ '/health': () => json({ ok: true }), '/transcribe': () => json({ ok: false, error: 'Whisper.cpp failed.' }, false, 500) });
      await expect(transcribeCaptions('https://x.test/a.mp3', { engine: 'whisper-cpp-local', fetchImpl: bad })).rejects.toThrow('Whisper.cpp failed.');
    });

    it('encodes a real WAV header (16-bit mono, 16 kHz)', () => {
      const wav = encodeWav(new Float32Array([0, 0.5, -0.5, 1]), 16000);
      const v = new DataView(wav.buffer);
      expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF'); expect(String.fromCharCode(...wav.slice(8, 12))).toBe('WAVE');
      expect(v.getUint16(22, true)).toBe(1); expect(v.getUint32(24, true)).toBe(16000); expect(v.getUint16(34, true)).toBe(16);
      expect(v.getUint32(40, true)).toBe(8); expect(v.getInt16(46, true)).toBeGreaterThan(16000);
    });
  });

  it('listens to at most the first few minutes, and refuses audio with no speech', async () => {
    await transcribeCaptions('https://x.test/long.mp3', { workerFactory: fakeWorker(heard(secWords)) });
    expect(tx.decodeAudio.mock.calls.at(-1)[1].toSec).toBe(MAX_CAPTION_AUDIO_SEC);
    await expect(transcribeCaptions('https://x.test/silence.mp3', { workerFactory: fakeWorker(heard([])) })).rejects.toThrow(/No speech/);
  });
});

describe('the styled caption track', () => {
  it('without a chosen look, captions stay the plain per-scene script lines', () => {
    const s = wizard();
    expect(captionTrackFor(s, 12)).toBeNull();
    const st = toBuilderState(s);
    expect(st.captionTrack).toBeNull();
    expect(st.overlays.filter((o) => o.type === 'caption').length).toBeGreaterThan(0);
  });

  it('a chosen look makes ONE word-timed track (script spread over the cut) and drops the per-scene lines', () => {
    const s = wizard(); s.captions.style = 'capite-hormozi';
    const st = toBuilderState(s);
    expect(st.captionTrack).toMatchObject({ template: 'capite-hormozi', pacing: 'phrase', source: 'script' });
    expect(st.captionTrack.words.length).toBeGreaterThan(8);
    expect(st.overlays.some((o) => o.type === 'caption')).toBe(false);
    expect(previewTexts(s).some((t) => t.role === 'caption')).toBe(false);
  });

  it('transcribed words win over the script, are kept inside the cut, and switching captions off removes the track', () => {
    const s = wizard(); s.captions.style = 'capite-mrbeast';
    s.captions.words = [{ text: 'Hi', start: 0, end: 400 }, { text: 'there', start: 500, end: 900 }, { text: 'late', start: 99000, end: 99500 }];
    const tr = captionTrackFor(s, 12);
    expect(tr.source).toBe('transcript');
    expect(tr.words.map((w) => w.text)).toEqual(['Hi', 'there']);
    expect(tr.motionPreset).toBe(captionStyleFor('capite-mrbeast').motion);
    s.elements.captions = false;
    expect(captionTrackFor(s, 12)).toBeNull();
  });

  it('an unknown style id (from a newer build) falls back to plain captions', () => {
    const s = wizard(); s.captions.style = 'capite-from-the-future';
    expect(captionTrackFor(s, 12)).toBeNull();
  });

  it('saved templates keep the look and the word timings', () => {
    const s = wizard(); s.captions = { ...s.captions, style: 'capite-vox', engine: 'whisper-cpp', language: 'es', words: [{ text: 'Hola', start: 0, end: 300 }], wordsFor: 'a' };
    const back = restoreTemplate(snapshotTemplate(s, { name: 'T' }));
    expect(back.captions).toMatchObject({ style: 'capite-vox', engine: 'whisper-cpp', language: 'es', words: [{ text: 'Hola', start: 0, end: 300 }] });
    const old = restoreTemplate({ ...snapshotTemplate(s, { name: 'T' }), captions: undefined });   // a template saved before this existed
    expect(old.captions.style).toBe('');
  });
});

describe('caption preview drawing', () => {
  const words = [{ text: 'Move', start: 0, end: 400 }, { text: 'it', start: 400, end: 600 }, { text: 'up', start: 600, end: 1000 }];
  it('picks out the word being spoken, with the look\'s highlight', () => {
    const st = captionStyleFor('capite-hormozi');
    const page = captionPages(words, st)[0];
    const html = captionPageHTML(st, page, 450, { motion: st.motion });
    expect(html.match(/is-on/g)).toHaveLength(1);
    expect(html).toMatch(/is-on" style="[^"]*color:#00FFFF[^"]*">it</);
    expect(captionTextCss(st, 360)).toContain('Montserrat');
    expect(captionTextCss(st, 360)).toContain('-webkit-text-stroke');
  });

  it('escapes the words and writes an .srt with one cue per page', () => {
    const st = captionStyleFor('capite-minimal');
    expect(captionPageHTML(st, { words: [{ text: '<b>', start: 0, end: 100 }], start: 0, end: 100 }, 0)).not.toContain('<b>');
    const srt = pagesToSrt([{ words: [{ text: 'Hello' }, { text: 'there' }], start: 0, end: 1500 }, { words: [{ text: 'Bye' }], start: 1600, end: 2100 }]);
    expect(srt).toBe('1\n00:00:00,000 --> 00:00:01,500\nHello there\n\n2\n00:00:01,600 --> 00:00:02,100\nBye\n');
  });
});

describe('Preview step — styled captions panel', () => {
  afterEach(() => { vi.clearAllMocks(); document.body.innerHTML = ''; });
  const open = (extra = {}) => {
    const m = new TemplateGeneratorModal({ defaultProvider: 'pixabay', templateCatalog: async () => { throw new Error('offline'); }, stockSearch: async () => ({ items: [], hasMore: false }), templateStore: createTemplateStore(memory()), ...extra });
    m.open(); Object.assign(m.s, wizard()); m.s.started = true; m.s.step = STEPS.PREVIEW; m.ui.openPanels = { captions: true }; m.paint();
    return m;
  };

  it('shows Capite\'s 27 looks and the editor\'s own, with real styled samples, not names alone', () => {
    const m = open();
    const tiles = document.querySelectorAll('#tg-captions .tg-capstyle[data-id^="capite-"]');
    expect(tiles).toHaveLength(27);
    expect(document.querySelector('#tg-captions .tg-capstyle[data-id="tiktok"]')).toBeTruthy();
    expect(tiles[0].querySelector('.tg-capstyle__demo .tg-cw.is-on')).toBeTruthy();        // a sample with its active word lit
    expect(tiles[0].querySelector('.tg-capstyle__demo').getAttribute('style')).toContain('font-family');
    m.destroy();
  });

  it('choosing a look makes the styled track and reaches the live preview; "No styled captions" goes back', () => {
    const m = open();
    const spy = vi.spyOn(m._player, 'setCaptionTrack');
    document.querySelector('[data-act="cap-style"][data-id="capite-mrbeast"]').click();
    expect(m.s.captions.style).toBe('capite-mrbeast');
    expect(spy.mock.calls.at(-1)[0]).toMatchObject({ style: { id: 'capite-mrbeast' } });
    expect(document.querySelector('.tg-capstyle.is-active').getAttribute('data-id')).toBe('capite-mrbeast');
    document.querySelector('[data-act="cap-style"][data-id=""]').click();
    expect(spy.mock.calls.at(-1)[0]).toBeNull();
    m.destroy();
  });

  it('"Make word-timed captions" listens to the voiceover, stores the words and switches a look on', async () => {
    const captionMaker = vi.fn(async () => ({ words: [{ text: 'Hi', start: 0, end: 300 }, { text: 'all', start: 320, end: 700 }], engine: 'whisper-webgpu', model: 'm' }));
    const m = open({ captionMaker });
    m.s.voice.enabled = true; m.s.voice.generatedAsset = { url: 'https://cdn.test/v.mp3', duration: 6 }; m._refreshCaptions();
    document.querySelector('[data-act="cap-generate"]').click();
    await vi.waitFor(() => expect(m.s.captions.words?.length).toBe(2));
    expect(captionMaker.mock.calls[0][0]).toBe('https://cdn.test/v.mp3');
    expect(m.s.captions.style).toBe('capite-hormozi');
    expect(document.querySelector('#tg-captions .tg-status').textContent).toContain('2 words timed');
    expect(toBuilderState(m.s).captionTrack.source).toBe('transcript');
    m.destroy();
  });

  it('with no voiceover it listens to each video clip, placed where that clip sits in the cut', async () => {
    const captionMaker = vi.fn(async () => ({ words: [{ text: 'Hey', start: 0, end: 300 }], engine: 'whisper-webgpu', model: 'm' }));
    const m = open({ captionMaker });
    document.querySelector('[data-act="cap-generate"]').click();
    await vi.waitFor(() => expect(m.s.captions.words?.length).toBe(2));
    expect(captionMaker.mock.calls.map((c) => c[0])).toEqual(['https://x.test/1.mp4', 'https://x.test/2.mp4']);
    expect(m.s.captions.words.map((w) => w.start)).toEqual([0, 6000]);   // the second clip starts 6 s in
    m.destroy();
  });

  it('a failed listen shows the reason and keeps the script; with nothing to listen to the button is off', async () => {
    const m = open({ captionMaker: async () => { throw new Error('No speech was found to caption.'); } });
    document.querySelector('[data-act="cap-generate"]').click();
    await vi.waitFor(() => expect(document.querySelector('#tg-captions .tg-status--error').textContent).toContain('No speech'));
    expect(m.s.captions.words).toBeNull(); expect(m.s.script.text).toContain('First line');
    m.s.selectedVideos = [{ ...clip(1), kind: 'image' }]; m._refreshCaptions();
    expect(document.querySelector('[data-act="cap-generate"]').disabled).toBe(true);
    m.destroy();
  });

  it('the engine, model and language selectors store the choice (Whisper.cpp is offered next to Whisper WebGPU)', () => {
    const m = open();
    const eng = document.querySelector('select[data-cap="engine"]');
    expect([...eng.options].map((o) => o.value)).toEqual(['whisper-webgpu', 'whisper-cpp']);
    eng.value = 'whisper-cpp'; eng.dispatchEvent(new Event('change', { bubbles: true }));
    expect(m.s.captions.engine).toBe('whisper-cpp');
    expect([...document.querySelector('select[data-cap="model"]').options].map((o) => o.value)).toEqual(['base', 'tiny', 'small']);
    const lang = document.querySelector('select[data-cap="language"]'); lang.value = 'es'; lang.dispatchEvent(new Event('change', { bubbles: true }));
    expect(m.s.captions.language).toBe('es');
    m.destroy();
  });
});

describe('Preview step — engines and automatic captions', () => {
  afterEach(() => { vi.clearAllMocks(); document.body.innerHTML = ''; });
  const open = (extra = {}) => {
    const m = new TemplateGeneratorModal({ defaultProvider: 'pixabay', templateCatalog: async () => { throw new Error('offline'); }, stockSearch: async () => ({ items: [], hasMore: false }), templateStore: createTemplateStore(memory()), ...extra });
    m.open(); Object.assign(m.s, wizard()); m.s.started = true; m.s.step = STEPS.PREVIEW; m.ui.openPanels = { captions: true }; m.paint();
    return m;
  };

  it('the local Whisper.cpp engine appears only while its server answers, and goes away (back to Whisper WebGPU) when it stops', async () => {
    let up = true;
    const m = open({ localCaptionProbe: async () => ({ ok: up }) });
    const options = () => [...document.querySelector('select[data-cap="engine"]').options].map((o) => o.value);
    expect(options()).toEqual(['whisper-webgpu', 'whisper-cpp']);
    expect(document.querySelector('#tg-captions').textContent).toContain('node scripts/captions-server.mjs');
    await m._probeLocalCaptions();
    expect(options()).toEqual(['whisper-webgpu', 'whisper-cpp', 'whisper-cpp-local']);
    const sel = document.querySelector('select[data-cap="engine"]'); sel.value = 'whisper-cpp-local'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(m.s.captions.engine).toBe('whisper-cpp-local');
    expect([...document.querySelector('select[data-cap="model"]').options].map((o) => o.value)).toContain('medium');
    up = false; document.querySelector('[data-act="cap-probe"]')?.click(); await m._probeLocalCaptions();
    expect(m.s.captions.engine).toBe('whisper-webgpu'); expect(options()).toEqual(['whisper-webgpu', 'whisper-cpp']);
    m.destroy();
  });

  it('with "make captions automatically" on, making the voiceover also times the captions', async () => {
    const captionMaker = vi.fn(async () => ({ words: [{ text: 'Hi', start: 0, end: 300 }], engine: 'whisper-webgpu', model: 'base' }));
    const m = open({ captionMaker, voiceMaker: async () => ({ url: 'https://cdn.test/v.mp3', duration: 6, name: 'AI voiceover', durable: true }), localCaptionProbe: async () => ({ ok: false }) });
    const box = document.querySelector('input[data-cap-auto]'); box.checked = true; box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(m.s.captions.auto).toBe(true);
    m.s.captions.style = 'capite-hormozi';
    await m.generateVoice();
    await vi.waitFor(() => expect(captionMaker).toHaveBeenCalledTimes(1));
    expect(captionMaker.mock.calls[0][0]).toBe('https://cdn.test/v.mp3');
    // off (the default): no listening without a click
    captionMaker.mockClear(); m.s.captions.auto = false; await m.generateVoice();
    expect(captionMaker).not.toHaveBeenCalled();
    m.destroy();
  });

  it('the engine, model, language and the automatic choice are saved with a template', () => {
    const s = wizard(); s.captions = { ...s.captions, style: 'capite-vox', engine: 'whisper-cpp-local', model: 'medium', language: 'fr', auto: true };
    const back = restoreTemplate(snapshotTemplate(s, { name: 'T' }));
    expect(back.captions).toMatchObject({ engine: 'whisper-cpp-local', model: 'medium', language: 'fr', auto: true });
  });
});
