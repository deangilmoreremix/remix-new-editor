// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderEditorTools, TABS } from '../EditorTools.js';
import { blankEdit, normalizeEdit } from '../../../lib/outreach/editTools.js';

function mount(tab, extra = {}) {
  let edit = normalizeEdit(blankEdit());
  const calls = [];
  const actions = {
    removeSilences: vi.fn(), applyBackground: vi.fn(), upload: vi.fn(async () => 'https://cdn.x/music.mp3'), picture: vi.fn(async () => 'https://cdn.x/logo.png'),
    waveform: vi.fn(async () => [0.2, 1, 0.5]), makeCaptions: vi.fn(), captionsFile: vi.fn(), makeChapters: vi.fn(), mediaDuration: vi.fn(async () => 42),
  };
  const o = {
    tab, setTab: vi.fn(), get edit() { return edit; },
    update: (fn, opts) => { fn(edit); edit = normalizeEdit(edit); calls.push(opts || {}); },
    now: () => 3, seconds: 20, lines: [], chapters: [], setChapters: vi.fn(), actions, cutPanel: document.createElement('div'), ...extra,
  };
  const node = renderEditorTools(o);
  document.body.replaceChildren(node);
  return { o, actions, calls, edit: () => edit };
}
const $ = (s) => document.querySelector(s);

describe('Video Outreach editor tools', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('shows every tab and switches', () => {
    const { o } = mount('cut');
    expect([...document.querySelectorAll('[data-tools-tab]')].map((b) => b.dataset.toolsTab)).toEqual(TABS.map(([k]) => k));
    $('[data-tools-tab="look"]').click();
    expect(o.setTab).toHaveBeenCalledWith('look');
  });

  it('cut: remove silences and transitions', () => {
    const { actions, edit } = mount('cut');
    $('[data-silence="normal"]').click();
    expect(actions.removeSilences).toHaveBeenCalledWith('normal');
    $('[data-transition="fade"]').click();
    expect(edit().transition).toBe('fade');
  });

  it('look: shape, rotate, flip and colour sliders (dragging only refreshes the preview)', () => {
    const { edit, calls } = mount('look');
    $('[data-look-aspect="9:16"]').click();
    $('[data-look-rotate]').click();
    $('[data-look-fliph]').click();
    const sat = $('[data-look-saturation]');
    sat.value = '1.4'; sat.dispatchEvent(new Event('input'));
    expect(calls[calls.length - 1]).toEqual({ soft: true });
    sat.dispatchEvent(new Event('change'));
    expect(edit().look).toMatchObject({ aspect: '9:16', rotate: 90, flipH: true, saturation: 1.4 });
  });

  it('background: pick a mode; it is applied with Apply edits (no separate button)', () => {
    const { edit } = mount('background');
    expect($('[data-bg-apply]')).toBeNull();
    $('[data-bg-mode="blur"]').click();
    expect(edit().background.mode).toBe('blur');
  });

  it('audio: waveform, volume, louder, music', async () => {
    const { edit, actions } = mount('audio');
    await Promise.resolve(); await Promise.resolve();
    expect(document.querySelectorAll('[data-waveform] span').length).toBe(3);
    $('[data-audio-louder]').click();
    expect(edit().audio.louder).toBe(true);
    const f = $('[data-music-file]');
    Object.defineProperty(f, 'files', { value: [new File(['x'], 'song.mp3', { type: 'audio/mpeg' })] });
    f.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    expect(actions.upload).toHaveBeenCalled();
    expect(edit().audio.music).toMatchObject({ src: 'https://cdn.x/music.mp3', name: 'song.mp3', duration: 42 });
  });

  it('captions: asks for captions first, then style, burn-in and files', () => {
    const first = mount('captions');
    $('[data-tools-make-captions]').click();
    expect(first.actions.makeCaptions).toHaveBeenCalled();
    const { edit, actions } = mount('captions', { lines: [{ startMs: 0, endMs: 1000, text: 'Hi' }] });
    $('[data-captions-burn]').click();
    $('[data-captions-style="tiktok"]').click();
    $('[data-captions-srt]').click();
    expect(edit().captions).toMatchObject({ burn: true, preset: 'tiktok' });
    expect(actions.captionsFile).toHaveBeenCalledWith('srt');
  });

  it('text & graphics: text, name and title, sticker at the current time; logos go through the picture tools', async () => {
    const { edit, actions } = mount('add');
    $('[data-add-text]').click();
    $('[data-add-lower]').click();
    $('[data-add-sticker="rocket"]').click();
    expect(edit().overlays.map((x) => [x.kind, x.start])).toEqual([['text', 3], ['lower', 3], ['sticker', 3]]);
    $('[data-add-remove-bg]').click();
    const f = $('[data-add-logo]');
    Object.defineProperty(f, 'files', { value: [new File(['x'], 'logo.png', { type: 'image/png' })] });
    f.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    expect(actions.picture).toHaveBeenCalledWith(expect.any(File), expect.objectContaining({ removeBackground: true, maxSize: 600 }));
    expect(edit().overlays[3]).toMatchObject({ kind: 'logo', src: 'https://cdn.x/logo.png', start: 0, end: 20 });
  });

  it('the name strap uses the sender, texts land apart, and an overlap can be fixed', () => {
    const { edit, o } = mount('add', { sender: { name: 'Alex Morgan', title: 'Head of Growth' } });
    $('[data-add-lower]').click();
    expect(edit().overlays[0]).toMatchObject({ kind: 'lower', text: 'Alex Morgan', title: 'Head of Growth' });
    $('[data-add-text]').click();
    $('[data-add-text]').click();
    const [, a, b] = edit().overlays;
    expect(a.top).not.toBe(b.top);
    // Put the second text on the first: the card warns, and Fix position moves it.
    o.update((e) => { e.overlays[2].top = e.overlays[1].top; });
    document.body.replaceChildren(renderEditorTools(o));
    expect(document.querySelector('[data-overlaps]').textContent).toMatch(/Overlaps the text/);
    document.querySelector('[data-fix-position]').click();
    expect(edit().overlays[2].top).not.toBe(edit().overlays[1].top);
    document.body.replaceChildren(renderEditorTools(o));
    const size = document.querySelector('[data-overlay-size]');
    size.value = '7'; size.dispatchEvent(new Event('change'));
    expect(edit().overlays.find((x) => x.kind === 'text').size).toBe(7);
  });

  it('B-roll: their website, full screen or in a corner', () => {
    const { edit } = mount('broll');
    $('[data-broll-website]').click();
    expect(edit().broll[0]).toMatchObject({ kind: 'website', start: 3, mode: 'full' });
  });

  it('chapters and export', () => {
    const ch = mount('chapters', { lines: [{ startMs: 0, endMs: 1000, text: 'Hi' }], chapters: [{ startMs: 0, title: 'Intro' }, { startMs: 9000, title: 'Demo' }] });
    expect(document.querySelectorAll('[data-chapter]').length).toBe(2);
    $('[data-chapters-make]').click();
    expect(ch.actions.makeChapters).toHaveBeenCalled();
    const ex = mount('export');
    $('[data-export-quality="small"]').click();
    expect(ex.edit().quality).toBe('small');
  });

  describe('saved overlay presets', () => {
    beforeEach(() => { localStorage.clear(); });
    it('saves what is on the video, then adds it to another one, and deletes it', () => {
      const first = mount('add');
      expect($('[data-preset-save]').disabled).toBe(true); // nothing to save yet
      $('[data-add-text]').click();
      first.o.update(() => {});
      document.body.replaceChildren(renderEditorTools(first.o));
      expect($('[data-preset-save]').disabled).toBe(false);
      const prompt = vi.spyOn(window, 'prompt').mockReturnValue('My intro kit');
      $('[data-preset-save]').click();
      expect(document.querySelector('[data-overlay-presets] [role="status"]').textContent).toContain('Saved “My intro kit”');
      prompt.mockRestore();
      // a different video
      const second = mount('add');
      expect(second.edit().overlays).toHaveLength(0);
      expect($('[data-preset-use]').textContent).toContain('My intro kit');
      $('[data-preset-use]').click();
      expect(second.edit().overlays.map((x) => x.kind)).toEqual(['text']);
      expect(second.edit().overlays[0].start).toBe(3); // where the preview is now
      $('[data-preset-delete]').click();
      expect(JSON.parse(localStorage.getItem('outreach-overlay-presets-v1'))).toEqual([]);
    });
    it('says why a preset could not be saved', () => {
      const { o } = mount('add');
      $('[data-add-text]').click();
      document.body.replaceChildren(renderEditorTools(o));
      const prompt = vi.spyOn(window, 'prompt').mockReturnValue('   ');
      $('[data-preset-save]').click();
      expect(document.querySelector('[data-overlay-presets] [role="status"]').textContent).toMatch(/name/);
      prompt.mockRestore();
    });
  });
});
