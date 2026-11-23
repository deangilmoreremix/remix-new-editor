import { describe, it, expect } from 'vitest';
import { applyChanges, revertChanges } from '../rewrite.js';
import { listSlots, resolveSlot, persistTrayMedia } from '../contentTray.js';

const comps = { Hero: { label: 'Hero', fields: { image: { slotKind: 'image', label: 'Picture' } } } };
const data = (...ids) => ({ content: ids.map((id) => ({ type: 'Hero', props: { id, image: `https://x/${id}.png` } })) });

describe('review fixes', () => {
  it('apply skips text that was edited since the proposal', () => {
    const d = { content: [{ props: { title: 'Edited by hand' } }] };
    const out = applyChanges(d, [{ path: ['content', 0, 'props', 'title'], text: 'Old', after: 'New' }]);
    expect(out.content[0].props.title).toBe('Edited by hand');
  });
  it('undo restores only the applied text and keeps later edits', () => {
    const ch = [{ path: ['content', 0, 'props', 'title'], text: 'Old', after: 'New' }, { path: ['content', 0, 'props', 'sub'], text: 'S', after: 'T' }];
    const now = { content: [{ props: { title: 'New', sub: 'My own', image: 'https://x/new.png' } }] };
    const out = revertChanges(now, ch);
    expect(out.content[0].props).toEqual({ title: 'Old', sub: 'My own', image: 'https://x/new.png' });
  });
  it('a slot is found by its section id after sections are reordered, and is gone when removed', () => {
    const old = listSlots(data('a', 'b'), comps).find((s) => s.id === 'a');
    const moved = listSlots(data('b', 'a'), comps);
    expect(resolveSlot(moved, old).path).toEqual(['content', 1, 'props', 'image']);
    expect(resolveSlot(listSlots(data('b'), comps), old)).toBeNull();
  });
  it('a tray item used twice leaves no temporary link behind', async () => {
    const item = { url: 'https://perm.test/stored.png', origUrl: 'https://tmp.test/t.png', type: 'image', title: 'x' };
    const page = { content: [{ props: { image: 'https://tmp.test/t.png' } }, { props: { image: 'https://perm.test/stored.png' } }] };
    const out = await persistTrayMedia(page, { tray: [item], upload: async () => 'https://perm.test/never.png', isPermanent: (u) => u.startsWith('https://perm.test/') });
    expect(JSON.stringify(out.data)).not.toContain('tmp.test');
    expect(out.failed).toEqual([]);
  });
});

import { editorConfig } from '../editor/config.jsx';
describe('alt fields stay plain text', () => {
  it('no screen-reader description field is turned into a picture chooser', () => {
    const bad = [];
    for (const [name, comp] of Object.entries(editorConfig.components)) {
      const check = (fields, where) => Object.entries(fields || {}).forEach(([k, f]) => { if (/alt text|screen.?reader/i.test(f?.label || '') && f.slotKind) bad.push(`${where}.${k}`); });
      check(comp.fields, name);
      Object.entries(comp.fields || {}).forEach(([k, f]) => { if (f?.type === 'array') check(f.arrayFields, `${name}.${k}`); });
    }
    expect(bad).toEqual([]);
  });
});
