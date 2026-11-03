import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/models.js', () => ({
  t2iModels: [{ id: 'flux', inputs: { aspect_ratio: { enum: ['1:1', '16:9'] } } }],
  i2iModels: [],
  i2vModels: [
    { id: 'kling-i2v', inputs: { aspect_ratio: { enum: ['16:9', '9:16', '1:1'] }, negative_prompt: { type: 'string' }, seed: { type: 'integer' } } },
    { id: 'char-i2v', inputs: { reference_images: { type: 'array' }, guidance_scale: { type: 'number' } } },
  ],
  t2vModels: [{ id: 'kling-t2v', inputs: { aspect_ratio: { enum: ['16:9', '9:16'] } } }],
  v2vModels: [{ id: 'v2v-model', inputs: {} }],
}));

const charRef = vi.hoisted(() => ({ saved: null as any }));
vi.mock('../../src/lib/characterConsistency.js', () => ({
  saveCharacterReference: vi.fn(async (ref) => { charRef.saved = ref; }),
  getCharacterReference: vi.fn(async () => charRef.saved),
}));

vi.mock('../../src/lib/studioControls.js', () => ({
  createAdvancedControls: vi.fn(({ container }) => {
    const el = document.createElement('div');
    el.dataset.advancedMock = '';
    container.appendChild(el);
    return { getPayload: () => ({ negative_prompt: 'no blur', seed: 42 }) };
  }),
}));

const picker = vi.hoisted(() => ({ onSelect: null as any }));
vi.mock('../../src/lib/modelPickerIntegration.js', () => ({
  openModelPicker: vi.fn(async ({ onSelectModel }) => { picker.onSelect = onSelectModel; }),
}));

import { createTemplateVideoTools, motionStyleModifiers } from '../../src/lib/templateVideoTools.js';

const flush = () => new Promise(r => setTimeout(r, 0));

describe('motionStyleModifiers (same wording as the Video Studio)', () => {
  it('only adds what the user changed', () => {
    expect(motionStyleModifiers({})).toEqual([]);
    expect(motionStyleModifiers({ style: 'Anime' })).toEqual(['anime style']);
    expect(motionStyleModifiers({ cameraSpeed: 9 })).toEqual(['fast camera speed (9/10)']);
    expect(motionStyleModifiers({ cameraSpeed: 2, style: 'Noir' })).toEqual(['slow camera speed (2/10)', 'noir style']);
  });
});

describe('createTemplateVideoTools', () => {
  let target;
  beforeEach(() => {
    target = { route: 'i2v', model: 'kling-i2v', imageUrl: 'https://cdn/a.png' };
    charRef.saved = null;
  });

  it('renders the Video Studio tools: AI Pick, Ratio, Advanced, Motion & Style', () => {
    const t = createTemplateVideoTools({ getTarget: () => target });
    t.refresh();
    const el = t.element;
    expect(el.querySelector('[data-tool="ai-pick"]')).not.toBeNull();
    expect(el.querySelector('[data-tool="advanced"]')).not.toBeNull();
    expect(el.querySelector('[data-tool="motion-style"]')).not.toBeNull();
    const ratios = Array.from(el.querySelectorAll('select[name="template-aspect-ratio"] option')).map(o => (o as HTMLOptionElement).value);
    expect(ratios).toEqual(['16:9', '9:16', '1:1']);
  });

  it('image templates get no Motion & Style and no video attachments', () => {
    const t = createTemplateVideoTools({ kind: 'image', getTarget: () => ({ route: 't2i', model: 'flux' }) });
    expect(t.element.querySelector('[data-tool="motion-style"]')).toBeNull();
  });

  it('templates with their own ratio field keep it (no duplicate control)', () => {
    const t = createTemplateVideoTools({ getTarget: () => target, hasOwnAspectRatio: true });
    t.refresh();
    expect(t.element.querySelector('select[name="template-aspect-ratio"]')).toBeNull();
  });

  it('Advanced panel → negative prompt and seed in the request', async () => {
    const t = createTemplateVideoTools({ getTarget: () => target });
    t.refresh();
    (t.element.querySelector('[data-tool="advanced"]') as HTMLButtonElement).click();
    await flush(); await flush();
    expect(t.element.querySelector('[data-advanced-mock]')).not.toBeNull();
    const params: any = { negative_prompt: 'template negative' };
    await t.applyToParams(params);
    expect(params.negative_prompt).toBe('no blur');
    expect(params.seed).toBe(42);
    expect(params.aspect_ratio).toBe('16:9');
  });

  it('Character Lock (models that support it) sends the saved reference', async () => {
    target = { route: 'i2v', model: 'char-i2v', imageUrl: 'https://cdn/face.png' };
    const t = createTemplateVideoTools({ getTarget: () => target });
    t.refresh();
    const lockRow = t.element.querySelector('[data-row="character-lock"]');
    expect(lockRow.classList.contains('hidden')).toBe(false);
    (t.element.querySelector('[data-toggle="character-lock"]') as HTMLButtonElement).click();
    await flush(); await flush();
    expect(charRef.saved?.imageUrl).toBe('https://cdn/face.png');
    const params: any = {};
    await t.applyToParams(params);
    expect(params.reference_images).toEqual(['https://cdn/face.png']);
    expect(params.character_consistency).toBe(true);
  });

  it('Character Lock is hidden for models without character support', () => {
    const t = createTemplateVideoTools({ getTarget: () => target });
    t.refresh();
    expect(t.element.querySelector('[data-row="character-lock"]').classList.contains('hidden')).toBe(true);
  });

  it('Motion & Style changes the prompt (not for video-to-video)', () => {
    const t = createTemplateVideoTools({ getTarget: () => target });
    (t.element.querySelector('[data-style="Cinematic"]') as HTMLButtonElement).click();
    const speed = t.element.querySelector('[name="template-camera-speed"]') as HTMLInputElement;
    speed.value = '9';
    speed.dispatchEvent(new Event('input'));
    expect(t.applyToPrompt('a chef plating', 'i2v')).toBe('a chef plating, fast camera speed (9/10), cinematic style.');
    expect(t.applyToPrompt('a chef plating', 'v2v')).toBe('a chef plating');
    // Not appended twice.
    const once = t.applyToPrompt('a chef plating', 'i2v');
    expect(t.applyToPrompt(once, 'i2v')).toBe(once);
  });

  it('guidance scale is sent only for models that accept it', async () => {
    target = { route: 'i2v', model: 'char-i2v' };
    const t = createTemplateVideoTools({ getTarget: () => target });
    t.refresh();
    const g = t.element.querySelector('[name="template-guidance"]') as HTMLInputElement;
    g.value = '12';
    g.dispatchEvent(new Event('input'));
    const p1: any = {};
    await t.applyToParams(p1);
    expect(p1.guidance_scale).toBe(12);
    target = { route: 'i2v', model: 'kling-i2v' };
    t.refresh();
    const p2: any = {};
    await t.applyToParams(p2);
    expect(p2.guidance_scale).toBeUndefined();
  });

  it('AI Pick hands the chosen model back to the studio', async () => {
    const picked = vi.fn();
    const t = createTemplateVideoTools({ getTarget: () => target, onModelPicked: picked });
    (t.element.querySelector('[data-tool="ai-pick"]') as HTMLButtonElement).click();
    await flush(); await flush();
    picker.onSelect('char-i2v');
    expect(picked).toHaveBeenCalledWith('char-i2v');
  });
});
