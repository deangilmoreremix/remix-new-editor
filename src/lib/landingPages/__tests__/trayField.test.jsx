// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const uploads = vi.hoisted(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; return { upload: vi.fn() }; });
vi.mock('../../uploadService.js', () => ({ uploadFileToSupabase: uploads.upload }));
vi.mock('../../supabase.js', () => ({ supabase: {}, primeSupabaseIdentity: async () => {}, getClerkUserId: () => 'u1' }));
import { imageField, TrayRow } from '../editor/ImageField.jsx';
import { PageContext } from '../editor/context.js';
import { editorConfig } from '../editor/config.jsx';
import { EDITABLE_TEMPLATES } from '../editor/designs.js';
import { listSlots, slotsFor } from '../contentTray.js';

const STORED = 'https://x.supabase.co/storage/v1/object/public/uploads/u/a.png';
const TEMP = 'https://provider.test/tmp/b.png';
const flush = async () => { for (let i = 0; i < 8; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };
let host;
const mountField = (kind, tray, onChange, value = '') => {
  host = document.createElement('div'); document.body.appendChild(host);
  const field = imageField(kind === 'video' ? 'Video in the video slot (a video you made)' : 'Photo (https link)', kind);
  const C = field.render;
  act(() => createRoot(host).render(<PageContext.Provider value={{ page: { id: 'p', title: 'T' }, tokens: {}, handlers: {}, preview: true, getStyle: () => null, getTray: () => tray }}><C value={value} onChange={onChange} name="f" /></PageContext.Provider>));
};
const items = () => [...host.querySelectorAll('[data-tray-item]')];
beforeEach(() => {
  document.body.innerHTML = ''; uploads.upload.mockReset();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), { status: 200 })));
});

describe('"From your studio" in picture and video fields', () => {
  it('a picture field offers the tray pictures only; a video field the videos only', () => {
    const tray = [{ url: STORED, type: 'image', title: 'Pic' }, { url: 'https://cdn.test/v.mp4', type: 'video', title: 'Vid' }];
    mountField('image', tray, vi.fn());
    expect(items()).toHaveLength(1); expect(items()[0].getAttribute('aria-label')).toBe('Use Pic');
    expect(host.textContent).toContain('From your studio');
    document.body.innerHTML = '';
    mountField('video', tray, vi.fn());
    expect(items()).toHaveLength(1); expect(items()[0].getAttribute('aria-label')).toBe('Use Vid');
  });
  it('shows nothing extra when the studio sent nothing of that kind', () => {
    mountField('image', [{ url: 'https://cdn.test/v.mp4', type: 'video' }], vi.fn());
    expect(host.querySelector('[data-tray-row]')).toBeNull();
  });
  it('clicking a stored item fills the field with its link, no upload', async () => {
    const onChange = vi.fn();
    mountField('image', [{ url: STORED, type: 'image', title: 'Pic' }], onChange);
    act(() => { items()[0].click(); }); await flush();
    expect(onChange).toHaveBeenCalledWith(STORED);
    expect(uploads.upload).not.toHaveBeenCalled();
  });
  it('clicking a temporary studio link saves it first, then fills the field with the stored link', async () => {
    uploads.upload.mockResolvedValue({ url: STORED.replace('a.png', 'saved.png') });
    const onChange = vi.fn();
    const item = { url: TEMP, type: 'image', title: 'Temp' };
    mountField('image', [item], onChange);
    act(() => { items()[0].click(); }); await flush();
    expect(uploads.upload).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(STORED.replace('a.png', 'saved.png'));
    expect(item.permanent).toBe(true);                             // later uses reuse the stored copy
  });
  it('a failed save is explained next to the field and the field is left alone', async () => {
    uploads.upload.mockRejectedValue(new Error('Storage is full'));
    const onChange = vi.fn();
    mountField('image', [{ url: TEMP, type: 'image', title: 'Temp' }], onChange);
    act(() => { items()[0].click(); }); await flush();
    expect(host.querySelector('[data-tray-error]').textContent).toContain('Storage is full');
    expect(onChange).not.toHaveBeenCalled();
  });
  it('marks the item that is already in the field', () => {
    mountField('image', [{ url: STORED, type: 'image', title: 'Pic' }], vi.fn(), STORED);
    expect(items()[0].style.border).toContain('2px');
  });
  it('TrayRow alone renders a thumbnail per item', () => {
    const div = document.createElement('div'); document.body.appendChild(div);
    act(() => createRoot(div).render(<TrayRow items={[{ url: STORED, type: 'image' }, { url: 'https://cdn.test/v.mp4', type: 'video', posterUrl: 'https://cdn.test/p.jpg' }]} current="" saving="" onUse={() => {}} />));
    expect(div.querySelectorAll('[data-tray-item]')).toHaveLength(2);
    expect(div.querySelector('img[src="https://cdn.test/p.jpg"]')).toBeTruthy();
  });
});

describe('every picture and video place in the editor is a known slot', () => {
  it('each picture / video field is marked as a slot, and only those', () => {
    let marked = 0;
    for (const [name, comp] of Object.entries(editorConfig.components)) {
      for (const [key, f] of Object.entries(comp.fields || {})) {
        if (f?.slotKind) { marked += 1; expect(['image', 'video'], `${name}.${key}`).toContain(f.slotKind); expect(f.type).toBe('custom'); }
        if (f?.type === 'array') for (const [sk, sf] of Object.entries(f.arrayFields || {})) if (sf?.slotKind) { marked += 1; expect(sf.type, `${name}.${key}.${sk}`).toBe('custom'); }
      }
    }
    expect(marked).toBeGreaterThan(40);
  });

  it('every one of the designs has places for pictures, and most have a video place', () => {
    let withVideo = 0;
    for (const t of EDITABLE_TEMPLATES) {
      const slots = listSlots(t.editorData, editorConfig.components);
      expect(slotsFor(slots, 'image').length, t.id).toBeGreaterThan(0);
      if (slotsFor(slots, 'video').length) withVideo += 1;
      slots.forEach((s) => { expect(s.label, t.id).toMatch(/\S/); expect(Array.isArray(s.path)).toBe(true); });
    }
    expect(withVideo).toBeGreaterThan(EDITABLE_TEMPLATES.length * 0.6);
  });
});
