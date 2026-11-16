// [remix] Inspector groups: sections sit in folding groups, closed state is remembered, "Find a setting" filters, and groups with nothing in them hide.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import type { Clip, Timeline } from '@cinegen/types/timeline';
import type { Asset } from '@cinegen/types/project';
import { ClipPropertiesPanel } from '../components/edit/clip-properties-panel';
import { DEFAULT_OPEN, INSPECTOR_KEY, readOpenGroups } from '../components/edit/use-inspector-groups';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => { window.localStorage.clear(); vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 }))); });

const clip = (over: Partial<Clip> = {}): Clip => ({ id: 'c1', assetId: 'a1', trackId: 'v1', name: 'Clip One', startTime: 0, duration: 10, trimStart: 0, trimEnd: 0, speed: 1, opacity: 1, volume: 1, flipH: false, flipV: false, keyframes: [], ...over } as Clip);
const asset = (type: 'video' | 'audio'): Asset => ({ id: 'a1', name: 'A', type, url: 'x', duration: 10, createdAt: '' } as Asset);
const timeline = (): Timeline => ({ id: 't', name: 'T', tracks: [], clips: [], duration: 10, transitions: [], markers: [] } as unknown as Timeline);

function mount(type: 'video' | 'audio' = 'video') {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  act(() => { root.render(<ClipPropertiesPanel clip={clip()} asset={asset(type)} onUpdateClip={() => undefined} onAddKeyframe={() => undefined} onRemoveKeyframe={() => undefined} onClose={() => undefined} onTimelineEdit={() => undefined} timeline={timeline()} currentTime={1} />); });
  return { host, cleanup: () => { act(() => root.unmount()); host.remove(); } };
}
const click = (el: Element | null) => { act(() => { (el as HTMLElement).click(); }); };
const type = (input: HTMLInputElement, value: string) => act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
const titles = (host: HTMLElement) => [...host.querySelectorAll('.clip-properties-panel__section')].filter((s) => !(s as HTMLElement).hidden && !(s.closest('.inspector-group') as HTMLElement | null)?.hidden).map((s) => s.querySelector('.clip-properties-panel__section-title')?.textContent?.trim());

describe('Inspector groups', () => {
  it('puts the sections in groups; Captions and Analyze start closed', () => {
    const { host, cleanup } = mount();
    for (const g of ['basics', 'look', 'motion', 'captions', 'analyze']) expect(host.querySelector(`[data-testid="inspector-group-${g}"]`), g).not.toBeNull();
    const expanded = (g: string) => host.querySelector(`[data-testid="inspector-group-toggle-${g}"]`)?.getAttribute('aria-expanded');
    expect([expanded('basics'), expanded('look'), expanded('motion'), expanded('captions'), expanded('analyze')]).toEqual(['true', 'true', 'true', 'false', 'false']);
    cleanup();
  });
  it('a group folds and unfolds, and the choice is remembered', () => {
    const a = mount();
    click(a.host.querySelector('[data-testid="inspector-group-toggle-basics"]'));
    expect(a.host.querySelector('#inspector-group-body-basics')?.hasAttribute('hidden')).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(INSPECTOR_KEY)!).basics).toBe(false);
    a.cleanup();
    const b = mount(); // a later visit
    expect(b.host.querySelector('#inspector-group-body-basics')?.hasAttribute('hidden')).toBe(true);
    click(b.host.querySelector('[data-testid="inspector-group-toggle-basics"]'));
    expect(b.host.querySelector('#inspector-group-body-basics')?.hasAttribute('hidden')).toBe(false);
    b.cleanup();
  });
  it('keeps closed sections mounted (nothing inside is lost by folding)', () => {
    const { host, cleanup } = mount();
    expect(host.querySelector('[data-testid="clip-captions"]')).not.toBeNull(); // Captions group is closed but its section is still there
    cleanup();
  });
  it('Find a setting: only matching sections stay, and the groups with matches open', () => {
    const { host, cleanup } = mount();
    type(host.querySelector('[data-testid="inspector-find"]') as HTMLInputElement, 'speed');
    expect(titles(host)).toEqual(['Speed']);
    type(host.querySelector('[data-testid="inspector-find"]') as HTMLInputElement, 'caption');
    expect(titles(host).some((t) => /captions/i.test(t ?? ''))).toBe(true);
    expect(host.querySelector('[data-testid="inspector-group-toggle-captions"]')?.getAttribute('aria-expanded')).toBe('true'); // opened by the search
    type(host.querySelector('[data-testid="inspector-find"]') as HTMLInputElement, 'zzzz-nothing');
    expect(titles(host)).toEqual([]);
    cleanup();
  });
  it('hides a group that has nothing in it (an audio clip has no Look group) and the motion hint', () => {
    const { host, cleanup } = mount('audio');
    expect((host.querySelector('[data-testid="inspector-group-look"]') as HTMLElement).hidden).toBe(true);
    expect((host.querySelector('[data-motion-hint]') as HTMLElement).hidden).toBe(true);
    cleanup();
  });
  it('explains Transition / Layout / Multicam when a video clip does not show them', () => {
    const { host, cleanup } = mount('video');
    expect((host.querySelector('[data-motion-hint]') as HTMLElement).hidden).toBe(false);
    cleanup();
  });
});

describe('readOpenGroups', () => {
  it('uses the defaults, and ignores junk in storage', () => {
    expect(readOpenGroups()).toEqual(DEFAULT_OPEN);
    window.localStorage.setItem(INSPECTOR_KEY, '{bad');
    expect(readOpenGroups()).toEqual(DEFAULT_OPEN);
    window.localStorage.setItem(INSPECTOR_KEY, JSON.stringify({ basics: false, look: 'x' }));
    expect(readOpenGroups()).toEqual({ ...DEFAULT_OPEN, basics: false });
  });
});
