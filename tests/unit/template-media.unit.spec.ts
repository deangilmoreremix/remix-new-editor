import { describe, it, expect, vi, beforeEach } from 'vitest';

const pickerState = vi.hoisted(() => ({ pickers: [] as any[] }));

vi.mock('../../src/components/UploadPicker.js', () => ({
  createUploadPicker: vi.fn((opts) => {
    const trigger = document.createElement('button');
    trigger.className = 'mt-1.5';
    const panel = document.createElement('div');
    panel.className = 'upload-panel';
    const entry = { opts, trigger, panel, reset: vi.fn(), clicks: 0 };
    trigger.onclick = () => { entry.clicks += 1; };
    pickerState.pickers.push(entry);
    return { trigger, panel, reset: entry.reset };
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
  i2vModels: [{ id: 'kling-i2v' }, { id: 'veo-i2v' }],
  t2vModels: [{ id: 'kling-t2v' }],
  v2vModels: [{ id: 'kling-v2v' }],
}));

import {
  createTemplateMediaField,
  extractTemplateMedia,
  routeTemplateGeneration,
  applyTemplateMediaToParams,
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
    expect(v2v).toEqual({ video_url: 'v.mp4' });
  });
});
