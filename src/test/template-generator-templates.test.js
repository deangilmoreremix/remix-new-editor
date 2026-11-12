import { describe, it, expect } from 'vitest';
import { createWizardState, toggleVideo, STEPS } from '../components/modals/template-generator/rules.js';
import { snapshotTemplate, restoreTemplate, splitDurable, createTemplateStore } from '../components/modals/template-generator/templates.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const vid = (n, extra = {}) => ({ id: `v${n}`, kind: 'video', title: `V${n}`, url: `https://x/${n}.mp4`, poster: `https://x/${n}.jpg`, duration: 6, source: 'pexels', user: 'Ann', pageURL: 'https://p', ...extra });

const wizard = () => {
  const s = createWizardState();
  s.niche = 'Real Estate';
  s.selectedScript = { id: 'tpl-1', name: 'Open House', niche: 'Real Estate' };
  s.script.text = 'Welcome home.'; s.script.cta = 'Book a tour';
  s.selectedTransition = { type: 'fade', duration: 1 };
  s.elements.title = 'Open House';
  toggleVideo(s, vid(1)); toggleVideo(s, vid(2));
  return s;
};

describe('template record', () => {
  it('snapshots the wizard and restores it on the Video step', () => {
    const rec = snapshotTemplate(wizard(), { name: 'Weekend listing' });
    expect(rec).toMatchObject({ name: 'Weekend listing', niche: 'Real Estate', scriptId: 'tpl-1', clipCount: 2, duration: 12, thumbnail: 'https://x/1.jpg' });
    const s = restoreTemplate({ ...rec, id: 'abc' }, (id) => ({ id, name: 'Open House' }));
    expect(s.step).toBe(STEPS.VIDEO);
    expect(s.started).toBe(true);
    expect(s.selectedVideos.map((v) => v.id)).toEqual(['v1', 'v2']);
    expect(s.selectedScript.id).toBe('tpl-1');
    expect(s.selectedTransition).toEqual({ type: 'fade', duration: 1 });
    expect(s.script.text).toBe('Welcome home.');
    expect(s.elements.title).toBe('Open House');
    expect(s.templateId).toBe('abc');
  });
  it('leaves out clips that will not survive a reload', () => {
    const s = wizard(); toggleVideo(s, vid(3, { url: 'blob:http://x/1' }));
    expect(splitDurable(s.selectedVideos).dropped.map((v) => v.id)).toEqual(['v3']);
    expect(snapshotTemplate(s).clipCount).toBe(2);
  });
  it('falls back to a sensible name', () => {
    expect(snapshotTemplate(wizard()).name).toBe('Open House');
    expect(snapshotTemplate(createWizardState()).name).toBe('Untitled template');
  });
});

describe('template store', () => {
  it('saves, lists newest first, updates in place, duplicates, counts uses and deletes', () => {
    const st = createTemplateStore(memory());
    const a = st.save(snapshotTemplate(wizard(), { name: 'A' }));
    const b = st.save(snapshotTemplate(wizard(), { name: 'B' }));
    expect(a.id).not.toBe(b.id);
    expect(st.list().length).toBe(2);
    const a2 = st.save({ name: 'A v2' }, { id: a.id });
    expect(a2.id).toBe(a.id); expect(a2.createdAt).toBe(a.createdAt); expect(st.list().length).toBe(2);
    expect(st.list()[0].id).toBe(a.id); // most recently edited first
    const copy = st.duplicate(a.id);
    expect(copy.name).toBe('A v2 (copy)'); expect(st.list().length).toBe(3);
    st.touch(a.id); st.touch(a.id);
    expect(st.get(a.id).uses).toBe(2);
    expect(st.remove(copy.id)).toBe(true); expect(st.remove('nope')).toBe(false);
    expect(st.list().length).toBe(2);
  });
  it('survives corrupt storage and a full disk', () => {
    const bad = { getItem: () => '{not json', setItem: () => {} };
    expect(createTemplateStore(bad).list()).toEqual([]);
    const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
    expect(() => createTemplateStore(full).save({ name: 'x' })).toThrow(/storage is full/);
  });
});
