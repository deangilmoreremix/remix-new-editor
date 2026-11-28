// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { isReusableSrc, savePreset, listPresets, deletePreset, applyPreset, presetItem, MAX_PRESETS, MAX_ITEMS, PRESETS_KEY } from '../overlayPresets.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const text = { id: 'a', kind: 'text', text: 'Hi {{firstname}}', color: '#fff', left: 15, top: 11, width: 70, height: 12, start: 2, end: 6 };
const logo = { id: 'b', kind: 'logo', src: 'https://cdn.x/logo.png', left: 82, top: 5, width: 14, height: 14, start: 0, end: 20 };

describe('overlay presets', () => {
  it('saves a set, reads it back without ids, and replaces a preset with the same name', () => {
    const s = memory();
    const r = savePreset('  My intro   kit ', [text, logo], s);
    expect(r.ok).toBe(true);
    const list = listPresets(s);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('My intro kit');
    expect(list[0].items.map((i) => i.kind)).toEqual(['text', 'logo']);
    list[0].items.forEach((i) => expect(i).not.toHaveProperty('id'));
    savePreset('my INTRO kit', [logo], s);
    expect(listPresets(s)).toHaveLength(1);
    expect(listPresets(s)[0].items).toHaveLength(1);
  });
  it('refuses empty names, nothing to save, and temporary pictures, with a reason', () => {
    const s = memory();
    expect(savePreset('', [text], s)).toMatchObject({ ok: false, reason: expect.stringMatching(/name/) });
    expect(savePreset('x', [], s)).toMatchObject({ ok: false, reason: expect.stringMatching(/Add some/) });
    expect(savePreset('x', [{ ...logo, src: 'blob:abc' }], s)).toMatchObject({ ok: false, reason: expect.stringMatching(/uploading/) });
    expect(listPresets(s)).toEqual([]);
  });
  it('skips what cannot be reused but keeps the rest, and says how many were left out', () => {
    const s = memory();
    const r = savePreset('kit', [text, { ...logo, src: 'blob:abc' }, { kind: 'nonsense' }], s);
    expect(r.ok).toBe(true);
    expect(r.skipped).toBe(2);
    expect(r.preset.items).toHaveLength(1);
  });
  it('is bounded: items per preset and number of presets', () => {
    const s = memory();
    expect(savePreset('big', Array.from({ length: 30 }, () => text), s).preset.items).toHaveLength(MAX_ITEMS);
    for (let i = 0; i < MAX_PRESETS; i += 1) savePreset(`p${i}`, [text], s);
    expect(listPresets(s)).toHaveLength(MAX_PRESETS);
    expect(savePreset('one too many', [text], s)).toMatchObject({ ok: false, reason: expect.stringMatching(/up to 20/) });
    expect(savePreset('p3', [logo], s).ok).toBe(true); // replacing one is still allowed
  });
  it('deletes a preset, and survives broken or blocked storage', () => {
    const s = memory();
    const { preset } = savePreset('kit', [text], s);
    expect(deletePreset(preset.id, s)).toBe(true);
    expect(listPresets(s)).toEqual([]);
    s.setItem(PRESETS_KEY, '{not json');
    expect(listPresets(s)).toEqual([]);
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } };
    expect(listPresets(blocked)).toEqual([]);
    expect(savePreset('kit', [text], blocked)).toMatchObject({ ok: false, reason: expect.stringMatching(/storage/) });
  });
  it('ignores damaged entries in storage', () => {
    const s = memory();
    s.setItem(PRESETS_KEY, JSON.stringify([null, { id: 1 }, { id: 'ok', name: 'Fine', items: [text, { kind: 'x' }] }, { id: 'e', name: 'Empty', items: [] }]));
    expect(listPresets(s).map((p) => p.name)).toEqual(['Fine']);
  });
});

describe('using a preset', () => {
  const preset = { id: 'p', name: 'kit', items: [presetItem(text), presetItem(logo)] };
  it('makes fresh copies that start where you are, keeping the distance between items', () => {
    const out = applyPreset(preset, { at: 10, seconds: 60 });
    expect(out).toHaveLength(2);
    expect(out.map((i) => [i.kind, i.start, i.end])).toEqual([['text', 12, 16], ['logo', 10, 30]]);
    expect(new Set(out.map((i) => i.id)).size).toBe(2);
    expect(out.every((i) => i.id !== 'a' && i.id !== 'b')).toBe(true);
  });
  it('never runs past the end of the video, and drops what would start after it', () => {
    const out = applyPreset(preset, { at: 10, seconds: 12 });
    expect(out.map((i) => i.kind)).toEqual(['logo']); // the text would start at 12, the very end: dropped
    expect(out[0].end).toBe(12);
  });
  it('does not change the saved preset, and handles nothing', () => {
    const before = JSON.stringify(preset);
    applyPreset(preset, { at: 3, seconds: 30 });
    expect(JSON.stringify(preset)).toBe(before);
    expect(applyPreset(null)).toEqual([]);
    expect(applyPreset({ items: [] })).toEqual([]);
  });
});

describe('which picture addresses a preset may keep', () => {
  it('keeps secure links and this site\'s own files, and nothing else', () => {
    ['https://cdn.x/logo.png', 'HTTPS://cdn.x/a.png', '/assets/sticker/animated-emoji/wave.json'].forEach((s) => expect(isReusableSrc(s), s).toBe(true));
    ['http://cdn.x/a.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'blob:abc', '//evil.example/a.png', 'ftp://x/a', 'https://', '', null, 5, '/a b'].forEach((s) => expect(isReusableSrc(s), String(s)).toBe(false));
  });
  it('a preset item with an unsafe picture is left out, and a text item needs no picture', () => {
    const s = memory();
    const r = savePreset('kit', [text, { ...logo, src: 'javascript:alert(1)' }, { ...logo, id: 'c', src: 'data:image/png;base64,AAAA' }], s);
    expect(r.ok).toBe(true);
    expect(r.preset.items.map((i) => i.kind)).toEqual(['text']);
    expect(r.skipped).toBe(2);
    s.setItem(PRESETS_KEY, JSON.stringify([{ id: 'x', name: 'Old', items: [{ ...logo, src: 'http://insecure.example/a.png' }, text] }]));
    expect(listPresets(s)[0].items.map((i) => i.kind)).toEqual(['text']); // also cleaned when read back
  });
});

describe('details', () => {
  it('never lets an end time pass the length of the video, even by a rounding step', () => {
    const preset = { id: 'p', name: 'kit', items: [{ ...logo, id: undefined, start: 0, end: 30 }] };
    const out = applyPreset(preset, { at: 10, seconds: 12.06 });
    expect(out[0].end).toBe(12.06);
    expect(out[0].end).toBeLessThanOrEqual(12.06);
  });
  it('survives a localStorage that throws when it is looked at', () => {
    const spy = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw Object.assign(new Error('blocked'), { name: 'SecurityError' }); });
    try {
      expect(listPresets()).toEqual([]);
      expect(savePreset('kit', [text])).toMatchObject({ ok: false, reason: expect.stringMatching(/storage/) });
      expect(deletePreset('x')).toBe(false);
    } finally { spy.mockRestore(); }
  });
});
