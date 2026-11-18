import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as sb from '../storyboard.js';
import * as els from '../elementsStore.js';

function makeEditor() {
  const clips = [{ id: 'v', type: 'video', s: 0, d: 4 }];
  return {
    clips,
    allClips: () => clips,
    clipStart: (c) => c.s ?? c.start, clipDuration: (c) => c.d ?? (c.end - c.start),
    insertClip: vi.fn((c) => { clips.push(c); return c; }),
    snapshot: vi.fn(), commit: vi.fn(), growTimeline: vi.fn(),
  };
}

describe('storyboard', () => {
  beforeEach(() => els.__resetElementsCache());

  it('plans shots with the storyboard task and normalizes them', async () => {
    const llm = vi.fn(async () => ({ data: { title: 'Map', shots: [{ title: 'Attic', camera: 'wide', prompt: '@Maya in an attic', duration: 30, dialogue: '' }] } }));
    const r = await sb.planShots('Maya finds a map', { shots: 4, elements: [{ handle: 'Maya', category: 'character', description: 'red coat', images: [] }], llm });
    expect(llm).toHaveBeenCalledWith('storyboard', expect.objectContaining({ text: 'Maya finds a map', shots: 4, elements: expect.stringMatching(/@Maya \(character: red coat\)/) }), expect.anything());
    expect(r.shots[0]).toMatchObject({ title: 'Attic', duration: 15, frameUrl: null });
  });

  it('expands @Elements into the frame prompt and passes their images as references', async () => {
    const maya = { handle: 'Maya', name: 'Maya', category: 'character', description: 'red coat', images: ['https://cdn/m.png', 'blob:x'] };
    const make = vi.fn(async () => ({ url: 'https://store/f.png', model: 'gpt-image-2.6-flare' }));
    const shot = sb.normalizeShots([{ prompt: '@Maya opens a chest', camera: 'close-up' }])[0];
    const r = await sb.frameForShot({}, shot, { elements: [maya], make, aspect: '9:16' });
    const [, prompt, opts] = make.mock.calls[0];
    expect(prompt).toMatch(/Maya \(red coat\) opens a chest\. Camera: close-up/);
    expect(opts).toMatchObject({ refs: ['https://cdn/m.png'], aspectRatio: '9:16', model: 'gpt-image-2.6-flare' });
    expect(r.url).toBe('https://store/f.png');
  });

  it('places shots after the last video clip with dialogue captions', () => {
    const editor = makeEditor();
    const shots = sb.normalizeShots([
      { title: 'A', prompt: 'a', duration: 2, dialogue: 'Hello.' },
      { title: 'B', prompt: 'b', duration: 3 },
      { title: 'C', prompt: 'c', duration: 3 },
    ]);
    shots[0].frameUrl = 'https://f/a.png';
    shots[1].clipUrl = 'https://f/b.mp4';
    const r = sb.placeShots(editor, shots);
    expect(r).toMatchObject({ start: 4, end: 9 });
    const [a, b, cap] = editor.insertClip.mock.calls.map((c) => c[0]);
    expect([a.type, a.start, a.end]).toEqual(['image', 4, 6]);
    expect([b.type, b.start, b.end]).toEqual(['video', 6, 9]);
    expect(cap).toMatchObject({ type: 'captions', start: 4, captions: [{ text: 'Hello.', startMs: 0, endMs: 2000 }] });
  });

  it('shot board makes nine angles from the reference and reports failures per angle', async () => {
    const make = vi.fn(async (ed, prompt) => { if (/POV/i.test(prompt) || /point-of-view/.test(prompt)) throw new Error('blocked'); return { url: `https://s/${make.mock.calls.length}.png` }; });
    const onShot = vi.fn();
    const out = await sb.shotBoard({}, 'https://ref/frame.png', { make, onShot, concurrency: 3 });
    expect(make).toHaveBeenCalledTimes(9);
    expect(make.mock.calls.every(([, , o]) => o.refs[0] === 'https://ref/frame.png')).toBe(true);
    expect(out.filter((x) => typeof x === 'string')).toHaveLength(8);
    expect(out[8]).toBeInstanceOf(Error);
    await expect(sb.shotBoard({}, 'blob:x')).rejects.toThrow(/saved online/);
  });
});

describe('elements', () => {
  beforeEach(() => els.__resetElementsCache());
  it('saves, rejects duplicate handles and resolves mentions', async () => {
    const a = await els.saveElement({ name: 'Old Barn', category: 'location', description: 'red wooden barn', images: ['https://i/1.png'] });
    expect(a.handle).toBe('Old_Barn');
    await expect(els.saveElement({ name: 'old barn' })).rejects.toThrow(/already exists/);
    const r = els.resolveMentions('Wide shot of @old_barn at dusk, @Nobody too', await els.listElements());
    expect(r.text).toBe('Wide shot of Old Barn (red wooden barn) at dusk, @Nobody too');
    expect(r.refs).toEqual(['https://i/1.png']);
    await els.deleteElement(a.id);
    expect(await els.listElements()).toEqual([]);
  });
});
