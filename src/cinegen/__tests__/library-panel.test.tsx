// [remix] The Library lists every category, searches, and calls the right action (with a message back) on click.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { LibraryPanel, LIBRARY_CATEGORIES, type LibraryActions } from '../components/edit/library-panel';
import { OPEN_ADD_MODAL_EVENT, peekPendingAddTab, peekPendingAddQuery, clearPendingAddTab } from '../components/edit/add-to-timeline-registry';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })));
});

function mount(overrides: Partial<LibraryActions> = {}) {
  const actions: LibraryActions = {
    onAddOverlay: vi.fn(() => 'Added.'), onAddTemplate: vi.fn(), onAddMg: vi.fn(), onAddHf: vi.fn(),
    onApplyFx: vi.fn(() => 'Select a clip first.'), onApplyLut: vi.fn(), onApplyTransition: vi.fn(), onAddSound: vi.fn(), onAddTemplateVideo: vi.fn(() => 'Added video.'),
    ...overrides,
  };
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => { root.render(<LibraryPanel {...actions} />); });
  return { host, actions, cleanup: () => { act(() => root.unmount()); host.remove(); } };
}
const click = (el: Element | null) => { act(() => { (el as HTMLElement).click(); }); };
const flush = () => act(async () => { await Promise.resolve(); });

describe('LibraryPanel', () => {
  it('every card is a picture card, and one search shows results from several categories', () => {
    const { host, cleanup } = mount();
    const input = host.querySelector('input[aria-label="Search the library"]') as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, 'title');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const heads = [...host.querySelectorAll('.library-panel__group-head span:first-child')].map((e) => e.textContent);
    expect(heads.length).toBeGreaterThan(1); // more than one category answered
    expect(host.querySelectorAll('.lib-card').length).toBeGreaterThan(0);
    for (const c of host.querySelectorAll('.lib-card')) expect(c.querySelector('.lib-card__plus')).not.toBeNull();
    cleanup();
  });

  it('template videos: the + adds the clip straight away; clicking the card opens the big window on it', async () => {
    const { host, actions, cleanup } = mount();
    const seen: Array<[string | undefined, string | undefined]> = [];
    const onOpen = (e: Event) => { e.preventDefault(); seen.push([peekPendingAddTab(), peekPendingAddQuery()]); };
    window.addEventListener(OPEN_ADD_MODAL_EVENT, onOpen);
    click(host.querySelector('[data-testid="library-cat-videos"]'));
    const add = host.querySelector('[data-testid^="library-video-"][data-testid$="-add"]');
    click(add);
    await flush();
    expect(actions.onAddTemplateVideo).toHaveBeenCalledTimes(1);
    expect((actions.onAddTemplateVideo as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({ id: expect.any(String), videoSrc: expect.stringContaining('http') });
    expect(host.querySelector('.library-panel__note')?.textContent).toBe('Added video.');
    expect(seen).toEqual([]); // the + does not open the window
    click(host.querySelector('[data-testid^="library-video-"]:not([data-testid$="-add"])'));
    window.removeEventListener(OPEN_ADD_MODAL_EVENT, onOpen);
    expect(seen.length).toBe(1);
    expect(seen[0][0]).toBe('videos');
    clearPendingAddTab();
    cleanup();
  });

  it('a card click opens the big window on that item; the + adds without opening it', async () => {
    const { host, actions, cleanup } = mount();
    const seen: Array<[string | undefined, string | undefined]> = [];
    const onOpen = (e: Event) => { e.preventDefault(); seen.push([peekPendingAddTab(), peekPendingAddQuery()]); };
    window.addEventListener(OPEN_ADD_MODAL_EVENT, onOpen);
    click(host.querySelector('[data-testid="library-cat-overlays"]'));
    click(host.querySelector('[data-testid="library-overlay-lead-form"]'));
    expect(seen).toEqual([['overlays', 'Lead Generator']]);
    expect(actions.onAddOverlay).not.toHaveBeenCalled();
    click(host.querySelector('[data-testid="library-overlay-lead-form-add"]'));
    await flush();
    window.removeEventListener(OPEN_ADD_MODAL_EVENT, onOpen);
    expect(actions.onAddOverlay).toHaveBeenCalledWith('lead-form');
    expect(seen.length).toBe(1);
    clearPendingAddTab();
    cleanup();
  });

  it('template videos: the category opens the Add to timeline window on its Template videos tab', () => {
    const { host, cleanup } = mount();
    const seen: Array<string | undefined> = [];
    const onOpen = (e: Event) => { e.preventDefault(); seen.push(peekPendingAddTab()); };
    window.addEventListener(OPEN_ADD_MODAL_EVENT, onOpen);
    click(host.querySelector('[data-testid="library-cat-videos"]'));
    expect(host.querySelectorAll('[data-testid^="library-video-"]:not([data-testid$="-add"])').length).toBeGreaterThan(5); // real cards with posters, not a button
    click(host.querySelector('[data-testid="library-open-template-videos"]'));
    window.removeEventListener(OPEN_ADD_MODAL_EVENT, onOpen);
    expect(seen).toEqual(['videos']);
    clearPendingAddTab();
    cleanup();
  });

  it('template videos: says so when no timeline editor is mounted to open the window', async () => {
    const { host, cleanup } = mount();
    click(host.querySelector('[data-testid="library-cat-videos"]'));
    click(host.querySelector('[data-testid="library-open-template-videos"]'));
    await flush();
    expect(host.querySelector('.library-panel__note')?.textContent).toBe('Open the timeline first.');
    expect(peekPendingAddTab()).toBeUndefined(); // nothing is left waiting when no editor opened the window
    cleanup();
  });

  it('has the seven categories', () => {
    const { host, cleanup } = mount();
    expect(LIBRARY_CATEGORIES.map((c) => c.id)).toEqual(['animations', 'effects', 'transitions', 'looks', 'overlays', 'videos', 'sounds']);
    for (const c of LIBRARY_CATEGORIES) expect(host.querySelector(`[data-testid="library-cat-${c.id}"]`)).not.toBeNull();
    cleanup();
  });

  it('overlays & forms: clicking Lead Generator calls onAddOverlay and shows the message', async () => {
    const { host, actions, cleanup } = mount();
    click(host.querySelector('[data-testid="library-cat-overlays"]'));
    click(host.querySelector('[data-testid="library-overlay-lead-form-add"]')); // the + adds; clicking the card opens the big window
    await flush();
    expect(actions.onAddOverlay).toHaveBeenCalledWith('lead-form');
    expect(host.querySelector('.library-panel__note')?.textContent).toBe('Added.');
    cleanup();
  });

  it('search filters the overlay cards', () => {
    const { host, cleanup } = mount();
    click(host.querySelector('[data-testid="library-cat-overlays"]'));
    const before = host.querySelectorAll('[data-testid^="library-overlay-"]:not([data-testid$="-add"])').length;
    const input = host.querySelector('input[aria-label="Search the library"]') as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, 'sticker');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const after = host.querySelectorAll('[data-testid^="library-overlay-"]:not([data-testid$="-add"])').length;
    expect(before).toBeGreaterThan(3);
    expect(after).toBe(1);
    cleanup();
  });

  it('an action can answer with a message instead of doing nothing (effect with no clip selected)', async () => {
    const { host, actions, cleanup } = mount();
    click(host.querySelector('[data-testid="library-cat-effects"]'));
    click(host.querySelector('[data-testid^="library-card-"]'));
    await flush();
    expect(actions.onApplyFx).toHaveBeenCalledTimes(1);
    expect(host.querySelector('.library-panel__note')?.textContent).toBe('Select a clip first.');
    cleanup();
  });
});
