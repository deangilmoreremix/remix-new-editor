// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { BaseModal } from '../components/modals/BaseModal.jsx';
import { PromptGalleryModal } from '../components/modals/PromptGalleryModal.jsx';
import { ExtendModal } from '../components/modals/ExtendModal.jsx';
import { FillGapModal } from '../components/modals/FillGapModal.jsx';
import { MusicGenerationModal } from '../components/modals/MusicGenerationModal.jsx';

vi.mock('../lib/cinegenIntegration.js', () => ({
  CINEGEN_TOOLS: { EXTEND: 'extend', GAP_FILL: 'gap_fill' },
  runCineGenTool: vi.fn(async () => ({ success: true })),
}));

const esc = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

describe('BaseModal.refresh', () => {
  let modal;
  afterEach(() => { modal?.destroy(); document.body.innerHTML = ''; });

  it('exposes container, keeps the overlay, and keeps Escape working after refresh', () => {
    class Counter extends BaseModal {
      constructor() { super({ showFooter: false }); this.n = 0; this.renders = 0; }
      renderBody() { return `<button data-inc>${this.n}</button>`; }
      onRender() { this.renders++; this.container.querySelector('[data-inc]').onclick = () => { this.n++; this.refresh(); }; }
    }
    modal = new Counter();
    modal.open();
    const overlay = modal.container;
    expect(overlay).toBe(modal.overlay);
    overlay.querySelector('[data-inc]').click();
    overlay.querySelector('[data-inc]').click();
    expect(overlay.querySelector('[data-inc]').textContent).toBe('2');
    expect(document.querySelectorAll('.modal-overlay')).toHaveLength(1);
    expect(modal.renders).toBe(3);
    esc();
    expect(modal.state).toBe('closing');
  });
});

describe('PromptGalleryModal', () => {
  let modal;
  afterEach(() => { modal?.destroy(); document.body.innerHTML = ''; });

  it('selects prompts and builds from an edited base prompt + style', () => {
    const onPromptSelect = vi.fn();
    modal = new PromptGalleryModal({ onPromptSelect });
    modal.open();
    document.querySelector('[data-action="select-prompt"]').click();
    expect(document.querySelector('.prompt-card.selected')).toBeTruthy();

    document.querySelector('[data-tab="builder"]').click();
    const base = document.querySelector('[data-builder-base]');
    base.value = 'a cat in rain';
    base.dispatchEvent(new Event('input', { bubbles: true }));
    const style = document.querySelector('input[data-style]');
    style.value = 'noir';
    style.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.querySelector('[data-builder-base]').value).toBe('a cat in rain');

    document.querySelector('[data-builder-use]').click();
    expect(onPromptSelect).toHaveBeenCalledWith(expect.stringContaining('a cat in rain'));
    expect(onPromptSelect.mock.calls[0][0]).toContain('noir');
  });
});

describe('PromptGalleryModal shortcuts', () => {
  it('only lists shortcuts that exist', () => {
    const modal = new PromptGalleryModal({});
    modal.open();
    modal.showShortcuts = true;
    modal._refresh();
    expect([...document.querySelectorAll('.shortcut-row kbd')].map(k => k.textContent)).toEqual(['⌘/', '⌘F', 'Esc']);
    modal.destroy(); document.body.innerHTML = '';
  });
});

describe('PromptGalleryModal filters and favorites', () => {
  let modal;
  afterEach(() => { modal?.destroy(); document.body.innerHTML = ''; localStorage.clear(); });

  it('filters by category chip and source chip, and shows the result count', () => {
    modal = new PromptGalleryModal({});
    modal.open();
    const all = document.querySelectorAll('.prompt-card').length;
    expect(all).toBeGreaterThan(5);
    document.querySelector('[data-category-chip="portrait"]').click();
    const portrait = document.querySelectorAll('.prompt-card');
    expect(portrait.length).toBeGreaterThan(0);
    expect(portrait.length).toBeLessThan(all);
    expect(document.querySelector('[data-category-chip="portrait"]').classList.contains('on')).toBe(true);
    expect(document.querySelector('.cm-count').textContent).toBe(String(portrait.length));
    document.querySelector('[data-source-chip="seedance"]').click();
    for (const badge of document.querySelectorAll('.prompt-card .prompt-source-badge')) {
      expect(badge.textContent).toBe('seedance');
    }
  });

  it('favorites a prompt, shows the count on the tab, and lists it under Favorites', () => {
    modal = new PromptGalleryModal({});
    modal.open();
    document.querySelector('[data-action="toggle-favorite"]').click();
    expect(document.querySelector('[data-tab="favorites"] .tab-count').textContent).toBe('1');
    document.querySelector('[data-tab="favorites"]').click();
    expect(document.querySelectorAll('.prompt-card')).toHaveLength(1);
  });
});

describe('CineGen tool modals', () => {
  let modal;
  afterEach(() => { modal?.destroy(); document.body.innerHTML = ''; vi.clearAllMocks(); });

  it.each([
    ['Extend', ExtendModal, 'extend', 'extend'],
    ['Fill Gap', FillGapModal, 'generate', 'gap_fill'],
  ])('%s modal wires its action button through mount()', async (_n, Ctor, action, tool) => {
    const { runCineGenTool } = await import('../lib/cinegenIntegration.js');
    const onComplete = vi.fn();
    modal = new Ctor({ clipId: 'clip-1', onComplete });
    modal.open();
    document.querySelector(`[data-action="${action}"]`).click();
    await vi.waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(runCineGenTool).toHaveBeenCalledWith(tool, expect.objectContaining({ clipId: 'clip-1' }));
    // refresh() re-rendered the footer; the button must still be wired.
    document.querySelector(`[data-action="${action}"]`).click();
    await vi.waitFor(() => expect(runCineGenTool).toHaveBeenCalledTimes(2));
  });

  it('Music modal sends selected settings', async () => {
    const { runCineGenTool } = await import('../lib/cinegenIntegration.js');
    modal = new MusicGenerationModal({ clipId: 'c' });
    modal.open();
    const genre = document.querySelector('#musicGenre');
    genre.value = 'lofi';
    genre.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('[data-action="generate"]').click();
    await vi.waitFor(() => expect(runCineGenTool).toHaveBeenCalled());
    expect(runCineGenTool).toHaveBeenCalledWith('music_generation', expect.objectContaining({ genre: 'lofi', tempo: 120, instrumental: true }));
  });

  it('cancel button closes the modal', () => {
    modal = new ExtendModal({ clipId: 'x' });
    modal.open();
    document.querySelector('[data-action="cancel"]').click();
    expect(modal.state).toBe('closing');
  });
});
