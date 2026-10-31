import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPromptComposer, createPill, createMoreMenu, createSegmented, openComposerPopover, closeComposerPopover, controlClassName } from '../components/studio/promptComposer.js';
import { createResultsGallery } from '../components/studio/resultsGallery.js';
import { createEmptyState } from '../components/studio/emptyState.js';
import { mountGenerationNotifications, notifyGeneration, __resetGenerationNotifications } from '../components/studio/generationNotifications.js';

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  closeComposerPopover();
});

describe('prompt composer', () => {
  it('submits on Generate and on Ctrl/Cmd+Enter, not on plain Enter', () => {
    const onSubmit = vi.fn();
    const c = createPromptComposer({ onSubmit });
    document.body.appendChild(c.root);
    c.action.click();
    c.textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    c.textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
    c.textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }));
    expect(onSubmit).toHaveBeenCalledTimes(3);
  });

  it('disables the action while generating and offers retry after a failure', () => {
    const onSubmit = vi.fn();
    const c = createPromptComposer({ onSubmit });
    c.setGenerating(true);
    expect(c.action.disabled).toBe(true);
    expect(c.action.textContent).toContain('Generating');
    c.textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }));
    expect(onSubmit).not.toHaveBeenCalled();
    c.setRetry();
    expect(c.action.disabled).toBe(false);
    expect(c.action.textContent).toContain('Retry');
    c.setGenerating(false);
    expect(c.action.textContent).toContain('Generate');
  });

  it('shows and clears an inline error', () => {
    const c = createPromptComposer();
    c.showError('Upload an image first');
    expect(c.status.classList.contains('hidden')).toBe(false);
    expect(c.status.textContent).toBe('Upload an image first');
    c.clearError();
    expect(c.status.classList.contains('hidden')).toBe(true);
  });

  it('keeps pills on the 38px contract and toggles the active style', () => {
    const pill = createPill({ label: '16:9', icon: 'aspect' });
    expect(pill.className).toContain('h-[38px]');
    expect(pill.textContent).toContain('16:9');
    pill.setActive(true);
    expect(pill.className).toContain('text-primary');
    expect(controlClassName({ iconOnly: true })).toContain('w-[38px]');
  });

  it('opens a checkmarked popover above a pill and closes it on selection', () => {
    const wrap = document.createElement('div');
    const pill = createPill({ label: '1:1' });
    wrap.appendChild(pill);
    document.body.appendChild(wrap);
    const onSelect = vi.fn();
    openComposerPopover(pill, { title: 'Aspect ratio', items: [{ label: '1:1', selected: true }, { label: '16:9', onSelect }] });
    const rows = wrap.querySelectorAll('[role="menuitemradio"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute('aria-checked')).toBe('true');
    rows[1].click();
    expect(onSelect).toHaveBeenCalled();
    expect(wrap.querySelector('[role="menu"]')).toBeNull();
  });

  it('puts studio extras in a single ⋯ menu', () => {
    const wrap = document.createElement('div');
    const aiPick = vi.fn();
    const more = createMoreMenu([{ label: 'AI Pick', onSelect: aiPick }, { label: 'Personalize', onSelect: vi.fn() }]);
    wrap.appendChild(more);
    document.body.appendChild(wrap);
    more.click();
    const labels = [...wrap.querySelectorAll('[role="menuitemradio"]')].map((r) => r.textContent);
    expect(labels).toEqual(['AI Pick', 'Personalize']);
    wrap.querySelector('[role="menuitemradio"]').click();
    expect(aiPick).toHaveBeenCalled();
  });

  it('segmented control reports changes and marks the selected option', () => {
    const onChange = vi.fn();
    const seg = createSegmented([{ value: 'image', label: 'Image' }, { value: 'video', label: 'Video' }], 'image', onChange);
    seg.querySelectorAll('button')[1].click();
    expect(onChange).toHaveBeenCalledWith('video');
    expect(seg.querySelectorAll('button')[1].getAttribute('aria-pressed')).toBe('true');
  });
});

describe('results gallery', () => {
  it('is hidden when empty and renders cards with prompt and model chip', () => {
    const g = createResultsGallery({ kind: 'image' });
    expect(g.root.classList.contains('hidden')).toBe(true);
    g.addItem({ id: '1', url: 'https://cdn/a.png', prompt: 'a cat', model: 'flux-dev', aspect_ratio: '1:1' });
    expect(g.root.classList.contains('hidden')).toBe(false);
    const card = g.root.querySelector('[data-result-card]');
    expect(card.textContent).toContain('a cat');
    expect(card.textContent).toContain('flux dev');
    expect(card.querySelectorAll('[data-action]').length).toBe(4);
  });

  it('deletes only after the user confirms', () => {
    const onDelete = vi.fn();
    const g = createResultsGallery({ kind: 'image', onDelete });
    document.body.appendChild(g.root);
    g.addItem({ id: '1', url: 'https://cdn/a.png', prompt: 'p' });
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    g.root.querySelector('[data-action="delete"]').click();
    expect(g.items).toHaveLength(1);
    g.root.querySelector('[data-action="delete"]').click();
    expect(g.items).toHaveLength(0);
    expect(onDelete).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('shows a pending card while generating', () => {
    const g = createResultsGallery({ kind: 'video' });
    const pending = g.addPending('Rendering…');
    expect(g.root.querySelector('[data-pending-card]').textContent).toContain('Rendering');
    expect(g.isEmpty()).toBe(false);
    pending.remove();
    expect(g.root.querySelector('[data-pending-card]')).toBeNull();
  });

  it('renders video results as hover-play videos', () => {
    const g = createResultsGallery({ kind: 'video' });
    g.addItem({ url: 'https://cdn/clip.mp4', prompt: 'p' });
    const video = g.root.querySelector('video');
    expect(video).not.toBeNull();
    expect(video.muted).toBe(true);
  });
});

describe('empty state', () => {
  it('renders up to four tilted samples and the highlighted model name', () => {
    const el = createEmptyState({ heading: 'Start creating with', highlight: 'Flux Dev', samples: ['a.png', 'b.png', 'c.png', 'd.png', 'e.png'] });
    expect(el.querySelectorAll('img')).toHaveLength(4);
    expect(el.querySelector('[data-empty-highlight]').textContent).toBe('Flux Dev');
    el.setHighlight('Nano Banana');
    expect(el.querySelector('[data-empty-highlight]').textContent).toBe('Nano Banana');
  });
});

describe('generation notifications', () => {
  beforeEach(() => __resetGenerationNotifications());

  it('shows a running card, then a success card with an Open link', () => {
    const navigate = vi.fn();
    const host = mountGenerationNotifications(navigate);
    notifyGeneration({ phase: 'start', id: 'j1', studio: 'image', label: 'Image Studio' });
    expect(host.querySelector('[data-notification="running"]')).not.toBeNull();
    notifyGeneration({ phase: 'success', id: 'j1', studio: 'image', label: 'Image Studio' });
    expect(host.querySelector('[data-notification="running"]')).toBeNull();
    const open = host.querySelector('[data-notification="success"] button');
    open.click();
    expect(navigate).toHaveBeenCalledWith('image');
  });

  it('keeps at most three cards and persists them', () => {
    const host = mountGenerationNotifications(vi.fn());
    for (let i = 0; i < 5; i++) notifyGeneration({ phase: 'error', id: `e${i}`, studio: 'video', label: `Job ${i}` });
    expect(host.querySelectorAll('[data-notification="error"]')).toHaveLength(3);
    expect(JSON.parse(localStorage.getItem('smartvideo_generation_notifications'))).toHaveLength(3);
  });
});
