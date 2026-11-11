import { describe, it, expect, vi, beforeEach } from 'vitest';

const pickerState = vi.hoisted(() => ({ pickers: [] as any[] }));

vi.mock('../../src/components/UploadPicker.js', () => ({
  createUploadPicker: vi.fn((opts) => {
    const trigger = document.createElement('button');
    trigger.className = 'mt-1.5';
    const panel = document.createElement('div');
    panel.className = 'upload-panel';
    const entry: any = { opts, trigger, panel, reset: vi.fn(), uploadFile: vi.fn(async () => {}), clicks: 0, frames: { start: null, end: null } };
    // Mirrors UploadPicker: frame-mode onSelect reports only its own slots.
    entry.reset.mockImplementation(() => { entry.frames = { start: null, end: null }; });
    entry.setFrames = vi.fn((start, end) => { entry.frames = { start, end }; });
    entry.pickEnd = (url) => {
      entry.frames.end = url;
      const urls = [entry.frames.start, entry.frames.end].filter(Boolean);
      opts.onSelect({ startUrl: entry.frames.start, endUrl: entry.frames.end, urls });
    };
    trigger.onclick = () => { entry.clicks += 1; };
    pickerState.pickers.push(entry);
    return { trigger, panel, reset: entry.reset, uploadFile: entry.uploadFile, setFrames: entry.setFrames };
  }),
}));

const pexelsState = vi.hoisted(() => ({ last: null as any }));
vi.mock('../../src/lib/studioPexels.js', () => ({
  browsePexelsImages: vi.fn(async (opts) => { pexelsState.last = { kind: 'image', opts }; }),
  browsePexelsVideos: vi.fn(async (opts) => { pexelsState.last = { kind: 'video', opts }; }),
}));

vi.mock('../../src/lib/models.js', () => ({
  t2iModels: [{ id: 'flux' }],
  i2iModels: [{ id: 'flux-i2i' }],
  i2vModels: [
    { id: 'kling-i2v', inputs: { duration: { enum: [5, 10], default: 5 }, resolution: { enum: ['720p', '1080p'], default: '1080p' } } },
    { id: 'veo-i2v', inputs: { duration: { minValue: 4, maxValue: 8, step: 2 }, native_audio: { type: 'boolean' } } },
    { id: 'ai-video-effects', inputs: { name: { enum: ['Cakeify', 'Lego'] }, aspect_ratio: { enum: ['16:9', '9:16', '1:1'] } } },
    { id: 'seedance-25-i2v', inputs: { last_frame_url: { type: 'string' }, character_consistency: { type: 'boolean' } } },
  ],
  t2vModels: [{ id: 'kling-t2v', inputs: { duration: { enum: ['5', '10'] }, native_audio: { type: 'boolean' } } }],
  v2vModels: [
    { id: 'kling-v2v', inputs: { resolution: { enum: ['720p'] } } },
    { id: 'watermark-remover', name: 'Watermark Remover', hasPrompt: false, inputs: { video_url: { type: 'string' } } },
  ],
}));

vi.mock('../../src/lib/videoFrames.js', () => ({
  extractLastFrameFile: vi.fn(async () => new File(['x'], 'clip-last-frame.png', { type: 'image/png' })),
}));

import {
  createTemplateMediaField,
  extractTemplateMedia,
  routeTemplateGeneration,
  applyTemplateMediaToParams,
  templateMediaRoute,
  modelsForRoute,
  createVideoSettingsControls,
  durationsForModel,
  snapAspectRatioForModel,
  endFrameSupport,
  promptlessV2VBlock,
} from '../../src/lib/templateMedia.js';

describe('templateMedia: createTemplateMediaField', () => {
  let anchor: HTMLElement;

  beforeEach(() => {
    pickerState.pickers.length = 0;
    pexelsState.last = null;
    anchor = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(anchor);
  });

  it('mounts one persistent Video Studio picker and its panel into the studio container', () => {
    const field = createTemplateMediaField({ kind: 'image', anchorContainer: anchor, onChange: () => {} });
    anchor.appendChild(field.element);
    expect(pickerState.pickers).toHaveLength(1);
    const p = pickerState.pickers[0];
    expect(anchor.contains(p.panel)).toBe(true);
    expect(field.element.contains(p.trigger)).toBe(true);
    expect(p.opts.acceptVideo).toBe(false);
    expect(anchor.style.position).toBe('relative');
  });

  it('clicking the field label opens the same picker (no new picker per click)', () => {
    const field = createTemplateMediaField({ kind: 'image', anchorContainer: anchor, onChange: () => {} });
    anchor.appendChild(field.element);
    const label = field.element.querySelector('button.flex-1') as HTMLButtonElement;
    label.click();
    label.click();
    expect(pickerState.pickers).toHaveLength(1);
    expect(pickerState.pickers[0].clicks).toBe(2);
  });

  it('reports uploads, frames and clears through onChange', () => {
    const onChange = vi.fn();
    const frame = createTemplateMediaField({ kind: 'frame', anchorContainer: anchor, onChange });
    const p = pickerState.pickers[0];
    expect(p.opts.frameMode).toBe(true);
    p.opts.onSelect({ startUrl: 'https://a/start.png', endUrl: 'https://a/end.png', urls: ['https://a/start.png', 'https://a/end.png'] });
    expect(onChange).toHaveBeenLastCalledWith(
      { startUrl: 'https://a/start.png', endUrl: 'https://a/end.png', urls: ['https://a/start.png', 'https://a/end.png'] },
      expect.anything(),
    );
    expect(frame.element.textContent).toContain('Start & end frames set');
    frame.clear();
    expect(onChange).toHaveBeenLastCalledWith(null, expect.anything());
    expect(p.reset).toHaveBeenCalled();
  });

  it('video fields accept video and use the Pexels video browser', async () => {
    const onChange = vi.fn();
    const field = createTemplateMediaField({ kind: 'video', anchorContainer: anchor, studioName: 'Template Studio', onChange });
    expect(pickerState.pickers[0].opts.acceptVideo).toBe(true);
    const pexelsBtn = field.element.querySelector('button[aria-label="Browse stock videos"]') as HTMLButtonElement;
    pexelsBtn.click();
    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));
    expect(pexelsState.last?.kind).toBe('video');
    pexelsState.last.opts.onSelect({ video_files: [{ quality: 'sd', link: 'sd.mp4' }, { quality: 'hd', link: 'hd.mp4' }] });
    expect(onChange).toHaveBeenLastCalledWith('hd.mp4', expect.anything());
    expect(field.element.textContent).toContain('Video from stock library');
  });

  it('a stock start frame is kept when the end frame is then picked from the picker', async () => {
    const onChange = vi.fn();
    const field = createTemplateMediaField({ kind: 'frame', anchorContainer: anchor, onChange });
    const p = pickerState.pickers[0];
    (field.element.querySelector('button[aria-label="Browse stock photos"]') as HTMLButtonElement).click();
    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));
    pexelsState.last.opts.onSelect({ src: { large2x: 'https://stock/start.jpg' } });
    expect(onChange).toHaveBeenLastCalledWith(
      { startUrl: 'https://stock/start.jpg', endUrl: null, urls: ['https://stock/start.jpg'] }, expect.anything());
    p.pickEnd('https://a/end.png');
    expect(onChange).toHaveBeenLastCalledWith(
      { startUrl: 'https://stock/start.jpg', endUrl: 'https://a/end.png', urls: ['https://stock/start.jpg', 'https://a/end.png'] },
      expect.anything());
  });

  it('restored frames are kept when another frame is then picked from the picker', () => {
    const onChange = vi.fn();
    createTemplateMediaField({ kind: 'frame', anchorContainer: anchor, onChange,
      initialValue: { startUrl: 'https://a/start.png', endUrl: null, urls: ['https://a/start.png'] } });
    pickerState.pickers[0].pickEnd('https://a/end.png');
    expect(onChange).toHaveBeenLastCalledWith(
      { startUrl: 'https://a/start.png', endUrl: 'https://a/end.png', urls: ['https://a/start.png', 'https://a/end.png'] },
      expect.anything());
  });

  it('restores an already-attached value after a re-render', () => {
    const field = createTemplateMediaField({ kind: 'image', anchorContainer: anchor, initialValue: 'https://a/img.png' });
    expect(field.getValue()).toBe('https://a/img.png');
    expect(field.element.textContent).toContain('Image ready');
  });
});

describe('templateMedia: extract / route / apply', () => {
  it('extracts image, end frame and video from mixed state shapes', () => {
    const inputs = [{ name: 'ref', type: 'frame' }, { name: 'src', type: 'video' }];
    const media = extractTemplateMedia({ ref: { startUrl: 's.png', endUrl: 'e.png', urls: ['s.png', 'e.png'] }, src: 'v.mp4' }, inputs);
    expect(media).toEqual({ imageUrl: 's.png', endImageUrl: 'e.png', videoUrl: 'v.mp4' });
    expect(extractTemplateMedia({ image_url: 'x.png', video_url: 'y.mp4' }, [])).toEqual({ imageUrl: 'x.png', endImageUrl: null, videoUrl: 'y.mp4' });
  });

  it('routes like the Video Studio and swaps to a compatible model', () => {
    expect(routeTemplateGeneration({ outputType: 'video', modelType: 't2v', model: 'kling-t2v' })).toEqual({ route: 't2v', model: 'kling-t2v' });
    expect(routeTemplateGeneration({ outputType: 'video', modelType: 't2v', model: 'kling-t2v', imageUrl: 'a.png' })).toEqual({ route: 'i2v', model: 'kling-i2v' });
    expect(routeTemplateGeneration({ outputType: 'video', modelType: 'i2v', model: 'kling-i2v' })).toEqual({ route: 'i2v', model: 'kling-i2v' });
    expect(routeTemplateGeneration({ outputType: 'video', modelType: 'i2v', model: 'veo-i2v', imageUrl: 'a.png' })).toEqual({ route: 'i2v', model: 'veo-i2v' });
    expect(routeTemplateGeneration({ outputType: 'video', modelType: 't2v', model: 'kling-t2v', videoUrl: 'v.mp4' })).toEqual({ route: 'v2v', model: 'kling-v2v' });
    expect(routeTemplateGeneration({ outputType: 'video', modelType: 'v2v', model: 'kling-v2v' }).route).toBe('v2v');
    expect(routeTemplateGeneration({ outputType: 'image', modelType: 't2i', model: 'flux', imageUrl: 'a.png' })).toEqual({ route: 'i2i', model: 'flux-i2i' });
    expect(routeTemplateGeneration({ outputType: 'image', modelType: 't2i', model: 'flux' })).toEqual({ route: 't2i', model: 'flux' });
  });

  it('writes MuAPI field names and drops raw frame objects', () => {
    const params: any = { prompt: 'p', ref: { startUrl: 's.png', endUrl: 'e.png' }, video_url: 'stale.mp4' };
    applyTemplateMediaToParams(params, { imageUrl: 's.png', endImageUrl: 'e.png', videoUrl: null }, 'i2v');
    expect(params).toEqual({ prompt: 'p', image_url: 's.png', last_image_url: 'e.png', lastFrameUrl: 'e.png' });

    const v2v: any = { image_url: 'x.png' };
    applyTemplateMediaToParams(v2v, { imageUrl: 'x.png', endImageUrl: null, videoUrl: 'v.mp4' }, 'v2v');
    // Reference image kept for v2v models that take one (face swap, motion control).
    expect(v2v).toEqual({ video_url: 'v.mp4', image_url: 'x.png' });
  });
});

describe('templateMedia: route follows media only', () => {
  it('clearing the video leaves video-to-video even with a v2v model selected', () => {
    expect(templateMediaRoute({ outputType: 'video', modelType: 't2v', videoUrl: 'v.mp4' })).toBe('v2v');
    expect(templateMediaRoute({ outputType: 'video', modelType: 't2v' })).toBe('t2v');
    expect(routeTemplateGeneration({ outputType: 'video', modelType: 't2v', model: 'kling-v2v' })).toEqual({ route: 't2v', model: 'kling-t2v' });
    expect(templateMediaRoute({ outputType: 'video', modelType: 't2v', imageUrl: 'a', videoUrl: 'v', preferV2V: true })).toBe('v2v');
    expect(templateMediaRoute({ outputType: 'video', modelType: 't2v', imageUrl: 'a', videoUrl: 'v' })).toBe('i2v');
    expect(modelsForRoute('v2v').map(m => m.id)).toEqual(['kling-v2v', 'watermark-remover']);
  });
});

describe('templateMedia: last-frame shortcut', () => {
  it('extracts the last frame and uploads it through the same picker', async () => {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    pickerState.pickers.length = 0;
    const field = createTemplateMediaField({ kind: 'frame', anchorContainer: anchor });
    const btn = field.element.querySelector('[data-action="last-frame"]') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    const input = btn.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toBe('video/*');
    Object.defineProperty(input, 'files', { value: [new File(['v'], 'clip.mp4', { type: 'video/mp4' })], configurable: true });
    input.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 10));
    const uploaded = pickerState.pickers[0].uploadFile.mock.calls[0]?.[0];
    expect(uploaded?.name).toBe('clip-last-frame.png');
  });

  it('video fields have no last-frame button', () => {
    const field = createTemplateMediaField({ kind: 'video', anchorContainer: document.createElement('div') });
    expect(field.element.querySelector('[data-action="last-frame"]')).toBeNull();
  });
});

describe('templateMedia: video settings follow the model', () => {
  it('offers only the durations / resolutions the model accepts and snaps template defaults', () => {
    let target = { route: 'i2v', model: 'kling-i2v' };
    const settings = createVideoSettingsControls({ getTarget: () => target, preferred: { duration: 8 } });
    settings.refresh();
    const durSel = settings.element.querySelector('select[name="template-duration"]') as HTMLSelectElement;
    expect(Array.from(durSel.options).map(o => o.value)).toEqual(['5', '10']);
    expect(settings.getSettings()).toEqual({ duration: 10, resolution: '1080p' });

    target = { route: 'i2v', model: 'veo-i2v' };
    settings.refresh();
    expect(Array.from(durSel.options).map(o => o.value)).toEqual(['4', '6', '8']);
    const audio = settings.element.querySelector('button[name="template-native-audio"]') as HTMLButtonElement;
    expect(audio.classList.contains('hidden')).toBe(false);
    audio.click();
    expect(settings.getSettings()).toEqual({ duration: 8, native_audio: true });

    target = { route: 'v2v', model: 'kling-v2v' };
    settings.refresh();
    expect(settings.getSettings()).toEqual({ resolution: '720p' });
  });

  it('offers an effect preset for effect models unless the template has its own', () => {
    const target = { route: 'i2v', model: 'ai-video-effects' };
    const withFx = createVideoSettingsControls({ getTarget: () => target });
    withFx.refresh();
    expect(withFx.getSettings()).toEqual({ name: 'Cakeify' });
    // A template's own preset (defaultParams.name) is kept, not replaced.
    const preset = createVideoSettingsControls({ getTarget: () => target, preferred: { effect: 'Lego' } });
    preset.refresh();
    expect(preset.getSettings()).toEqual({ name: 'Lego' });
    const withoutFx = createVideoSettingsControls({ getTarget: () => target, offerEffects: false });
    withoutFx.refresh();
    expect(withoutFx.getSettings()).toEqual({});
    expect(withoutFx.element.classList.contains('hidden')).toBe(true);
  });

  it('hides everything for image routes', () => {
    const s = createVideoSettingsControls({ getTarget: () => ({ route: 't2i', model: 'flux' }) });
    s.refresh();
    expect(s.element.classList.contains('hidden')).toBe(true);
    expect(s.getSettings()).toEqual({});
  });

  it('parses string enums and ranges', () => {
    expect(durationsForModel({ inputs: { duration: { enum: ['5', '10'] } } })).toEqual([5, 10]);
    expect(durationsForModel({ inputs: { duration: { minValue: 2, maxValue: 6, step: 2 } } })).toEqual([2, 4, 6]);
    expect(durationsForModel({})).toEqual([]);
  });
});

describe('templateMedia: aspect ratio snapping', () => {
  it('keeps supported ratios and snaps others to the closest one with the same orientation', () => {
    expect(snapAspectRatioForModel('i2v', 'ai-video-effects', '9:16')).toBe('9:16');
    expect(snapAspectRatioForModel('i2v', 'ai-video-effects', '4:3')).toBe('16:9');
    expect(snapAspectRatioForModel('i2v', 'ai-video-effects', '3:4')).toBe('9:16');
    expect(snapAspectRatioForModel('i2v', 'ai-video-effects', '21:9')).toBe('16:9');
    expect(snapAspectRatioForModel('i2v', 'kling-i2v', '4:3')).toBe('4:3');
    expect(snapAspectRatioForModel('i2v', 'ai-video-effects', undefined)).toBeUndefined();
  });
});

describe('templateMedia: review fixes', () => {
  it('a cleared start frame does not promote the end frame', () => {
    const media = extractTemplateMedia({ ref: { startUrl: null, endUrl: 'e.png', urls: ['e.png'] } }, [{ name: 'ref', type: 'frame' }]);
    expect(media.imageUrl).toBeNull();
    expect(media.endImageUrl).toBe('e.png');
  });

  it('image-to-video templates stay on i2v when only a video is attached', () => {
    expect(templateMediaRoute({ outputType: 'video', modelType: 'i2v', videoUrl: 'v.mp4' })).toBe('i2v');
    expect(templateMediaRoute({ outputType: 'video', modelType: 'i2v', videoUrl: 'v.mp4', preferV2V: true })).toBe('v2v');
  });

  it('retries never keep an old end frame', () => {
    const params: any = { lastFrameUrl: 'old.png', last_image_url: 'old.png' };
    applyTemplateMediaToParams(params, { imageUrl: 'a.png', endImageUrl: null, videoUrl: null }, 'i2v');
    expect(params.lastFrameUrl).toBeUndefined();
    expect(params.last_image_url).toBeUndefined();
  });

  it('drops settings the model does not declare and asks generateI2V to do the same', async () => {
    const { dropUndeclaredSettings } = await import('../../src/lib/templateMedia.js');
    const p: any = { model: 'veo-i2v', aspect_ratio: '16:9', resolution: '720p', duration: 6 };
    dropUndeclaredSettings(p, 'i2v');
    expect(p).toEqual({ model: 'veo-i2v', duration: 6, onlyDeclaredInputs: true });
  });

  it('keeps the template effect preset across model switches and explains long template durations', () => {
    let target = { route: 'i2v', model: 'ai-video-effects' };
    const s = createVideoSettingsControls({ getTarget: () => target, preferred: { effect: 'Lego', duration: 45 } });
    s.refresh();
    expect(s.getSettings().name).toBe('Lego');
    target = { route: 'i2v', model: 'kling-i2v' };
    s.refresh();
    const hint = s.element.querySelector('[data-duration-hint]');
    expect(hint.classList.contains('hidden')).toBe(false);
    expect(hint.textContent).toMatch(/45s/);
    target = { route: 'i2v', model: 'ai-video-effects' };
    s.refresh();
    expect(s.getSettings().name).toBe('Lego');
  });
});

describe('templateMedia: review fixes (end frame, prompt-less v2v, durations)', () => {
  it('sends the end frame as last_frame_url only to models that declare it', () => {
    const declared: any = { model: 'seedance-25-i2v' };
    applyTemplateMediaToParams(declared, { imageUrl: 'a.png', endImageUrl: 'b.png', videoUrl: null }, 'i2v');
    expect(declared.last_frame_url).toBe('b.png');
    expect(declared.last_image_url).toBeUndefined();
    expect(endFrameSupport('i2v', 'seedance-25-i2v')).toBe('declared');

    const none: any = { model: 'kling-i2v' };
    applyTemplateMediaToParams(none, { imageUrl: 'a.png', endImageUrl: 'b.png', videoUrl: null }, 'i2v');
    expect(none.image_url).toBe('a.png');
    expect(none.last_frame_url).toBeUndefined();
    expect(none.last_image_url).toBeUndefined();
    expect(none.lastFrameUrl).toBeUndefined();
    expect(endFrameSupport('i2v', 'kling-i2v')).toBe('none');

    // A model with no input schema keeps the legacy keys.
    const unknown: any = { model: 'no-schema-model' };
    applyTemplateMediaToParams(unknown, { imageUrl: 'a.png', endImageUrl: 'b.png', videoUrl: null }, 'i2v');
    expect(unknown.last_image_url).toBe('b.png');
    expect(endFrameSupport('i2v', 'no-schema-model')).toBe('unknown');
  });

  it('a prompt-less v2v model only runs when the user picked it', () => {
    expect(promptlessV2VBlock('v2v', 'watermark-remover', null)).toMatch(/doesn't use your prompt/);
    expect(promptlessV2VBlock('v2v', 'watermark-remover', 'watermark-remover')).toBeNull();
    expect(promptlessV2VBlock('v2v', 'kling-v2v', null)).toBeNull();
    expect(promptlessV2VBlock('i2v', 'watermark-remover', null)).toBeNull();
  });

  it('offers a min/max duration range (Seedance Lite T2V: 3-12 s)', async () => {
    const actual: any = await vi.importActual('../../src/lib/models.js');
    const lite = actual.t2vModels.find((m: any) => m.id === 'seedance-lite-t2v');
    expect(durationsForModel(lite)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(lite.inputs.duration.default).toBe(5);
  });
});
