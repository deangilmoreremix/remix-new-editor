// [remix] The Library lists every category, searches, and calls the right action (with a message back) on click.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { LibraryPanel, LIBRARY_CATEGORIES, type LibraryActions } from '../components/edit/library-panel';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })));
});

function mount(overrides: Partial<LibraryActions> = {}) {
  const actions: LibraryActions = {
    onAddOverlay: vi.fn(() => 'Added.'), onAddTemplate: vi.fn(), onAddMg: vi.fn(),
    onApplyFx: vi.fn(() => 'Select a clip first.'), onApplyLut: vi.fn(), onApplyTransition: vi.fn(), onAddSound: vi.fn(),
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
  it('has the six categories', () => {
    const { host, cleanup } = mount();
    expect(LIBRARY_CATEGORIES.map((c) => c.id)).toEqual(['animations', 'effects', 'transitions', 'looks', 'overlays', 'sounds']);
    for (const c of LIBRARY_CATEGORIES) expect(host.querySelector(`[data-testid="library-cat-${c.id}"]`)).not.toBeNull();
    cleanup();
  });

  it('overlays & forms: clicking Lead Generator calls onAddOverlay and shows the message', async () => {
    const { host, actions, cleanup } = mount();
    click(host.querySelector('[data-testid="library-cat-overlays"]'));
    click(host.querySelector('[data-testid="library-overlay-lead-form"]'));
    await flush();
    expect(actions.onAddOverlay).toHaveBeenCalledWith('lead-form');
    expect(host.querySelector('.library-panel__note')?.textContent).toBe('Added.');
    cleanup();
  });

  it('search filters the overlay cards', () => {
    const { host, cleanup } = mount();
    click(host.querySelector('[data-testid="library-cat-overlays"]'));
    const before = host.querySelectorAll('[data-testid^="library-overlay-"]').length;
    const input = host.querySelector('input[aria-label="Search the library"]') as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, 'sticker');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const after = host.querySelectorAll('[data-testid^="library-overlay-"]').length;
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
