// [remix] Effects library modal: tabs with counts, search, applied state, Escape / backdrop close, preview-only transitions.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

vi.mock('../../openchatcut/library/FxThumb', () => ({ FxThumb: ({ assetId }: { assetId: string }) => <span data-thumb={assetId} /> }));
vi.mock('../../openchatcut/library/TransitionThumb', () => ({ TransitionThumb: ({ type }: { type: string }) => <span data-thumb={type} /> }));
vi.mock('../../openchatcut/library/pluginResources', () => ({ usePluginPacks: () => [], pluginResourceItems: () => [] }));
vi.mock('@cinegen/lib/occ/user-luts', () => ({ userLutIds: () => [] }));
vi.mock('@cinegen/lib/occ/plugins', () => ({ installFromText: vi.fn(), installFromUrl: vi.fn(), removePack: vi.fn(), setPackEnabled: vi.fn() }));

import { OccLibraryModal } from '../components/edit/occ-library-modal';
import { FX_IDS, LUT_IDS } from '../../openchatcut/gl/fx/effects';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let cleanup: (() => void) | null = null;
afterEach(() => { cleanup?.(); cleanup = null; document.body.innerHTML = ''; });

function mount(props: Partial<Parameters<typeof OccLibraryModal>[0]> = {}) {
  const handlers = { onClose: vi.fn(), onPickFx: vi.fn(), onPickLut: vi.fn() };
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => { root.render(<OccLibraryModal {...handlers} {...props} />); });
  cleanup = () => { act(() => root.unmount()); host.remove(); };
  return { host, ...handlers };
}
const click = (el: Element | null) => { act(() => { (el as HTMLElement).click(); }); };
const type = (input: HTMLInputElement, value: string) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
const tabBtn = (host: Element, label: string) => [...host.querySelectorAll('[role="tab"]')].find((b) => b.textContent?.startsWith(label)) as HTMLElement;
const cards = (host: Element) => host.querySelectorAll('[data-testid^="library-card-"]');

describe('OccLibraryModal', () => {
  it('is a labelled dialog with a labelled close button and a count on every tab', () => {
    const { host } = mount();
    const dialog = host.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-label')).toBe('Effects library');
    expect(host.querySelector('button[aria-label="Close library"]')).toBeTruthy();
    expect(tabBtn(host, 'Effects').textContent).toContain(String(FX_IDS.length));
    expect(tabBtn(host, 'LUTs & looks').textContent).toContain(String(LUT_IDS.length));
    expect(tabBtn(host, 'Extensions').textContent).toContain('0');
    expect(tabBtn(host, 'Effects').getAttribute('aria-selected')).toBe('true');
  });

  it('shows every effect, picks one on click, and passes its id', () => {
    const { host, onPickFx } = mount();
    expect(cards(host)).toHaveLength(FX_IDS.length);
    click(host.querySelector(`[data-testid="library-card-${FX_IDS[0]}"]`));
    expect(onPickFx).toHaveBeenCalledWith(FX_IDS[0]);
  });

  it('LUT tab picks a look; search filters by name and shows an empty state', () => {
    const { host, onPickLut } = mount();
    click(tabBtn(host, 'LUTs & looks'));
    expect(cards(host)).toHaveLength(LUT_IDS.length);
    click(cards(host)[0]);
    expect(onPickLut).toHaveBeenCalledWith(LUT_IDS[0]);

    const input = host.querySelector('[data-testid="library-search"]') as HTMLInputElement;
    type(input, 'zzzz-no-such-look');
    expect(cards(host)).toHaveLength(0);
    expect(host.querySelector('[data-testid="library-empty"]')!.textContent).toContain('zzzz-no-such-look');
    // Switching tab clears the query.
    click(tabBtn(host, 'Effects'));
    expect((host.querySelector('[data-testid="library-search"]') as HTMLInputElement).value).toBe('');
    expect(cards(host)).toHaveLength(FX_IDS.length);
  });

  it('marks effects already on the clip as applied, and counts them in the footer', () => {
    const { host } = mount({ appliedFx: [FX_IDS[1], FX_IDS[2]], appliedLut: LUT_IDS[0], clipName: 'real.webm' });
    expect(host.querySelectorAll('.cg-card.is-applied')).toHaveLength(2);
    expect(host.querySelector(`[data-testid="library-card-${FX_IDS[1]}"]`)!.classList.contains('is-applied')).toBe(true);
    expect(host.querySelector('[data-testid="library-applied-count"]')!.textContent).toContain('2 applied');
    expect(host.querySelector('.cg-modal__chip')!.textContent).toBe('real.webm');
    click(tabBtn(host, 'LUTs & looks'));
    expect(host.querySelectorAll('.cg-card.is-applied')).toHaveLength(1);
    expect(host.querySelector(`[data-testid="library-card-${LUT_IDS[0]}"]`)!.classList.contains('is-applied')).toBe(true);
  });

  it('transitions are preview-only without a handler and say where to apply them', () => {
    const { host, onPickFx, onPickLut } = mount();
    click(tabBtn(host, 'Transitions'));
    expect(cards(host).length).toBeGreaterThan(5);
    expect(host.querySelector('.cg-modal__footer')!.textContent).toContain('choose a transition in the inspector');
    click(cards(host)[0]);
    expect(onPickFx).not.toHaveBeenCalled();
    expect(onPickLut).not.toHaveBeenCalled();
    expect(host.querySelectorAll('.cg-card.is-applied')).toHaveLength(0);
  });

  it('closes on Escape, on the close button and on a backdrop click, but not on a click inside', () => {
    const a = mount();
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(a.onClose).toHaveBeenCalledTimes(1);
    click(a.host.querySelector('button[aria-label="Close library"]'));
    expect(a.onClose).toHaveBeenCalledTimes(2);
    act(() => { a.host.querySelector('.cg-modal')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    expect(a.onClose).toHaveBeenCalledTimes(2);
    act(() => { a.host.querySelector('.cg-modal__backdrop')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    expect(a.onClose).toHaveBeenCalledTimes(3);
  });

  it('"/" focuses the search box unless typing in a field', () => {
    const { host } = mount();
    const input = host.querySelector('[data-testid="library-search"]') as HTMLInputElement;
    act(() => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true })); });
    expect(document.activeElement).toBe(input);
  });

  it('Extensions tab keeps the install controls and test ids', () => {
    const { host } = mount();
    click(tabBtn(host, 'Extensions'));
    expect(host.querySelector('[data-testid="extensions-panel"]')).toBeTruthy();
    expect(host.querySelector('input[aria-label="Pack URL"]')).toBeTruthy();
    expect(host.querySelector('input[aria-label="Expected SHA-256 (optional)"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="extension-file"]')).toBeTruthy();
    expect(host.textContent).toContain('No extensions installed.');
    expect(host.querySelector('[data-testid="library-search"]')).toBeNull();
  });
});
