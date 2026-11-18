// [remix] The empty-project start screen: three buttons, each asks for the right thing.
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { EmptyStart } from '../components/edit/empty-start';
import { IMPORT_MEDIA_EVENT, OPEN_GENERATOR_EVENT } from '../components/edit/start-events';
import { OPEN_ADD_MODAL_EVENT, peekPendingAddTab, clearPendingAddTab } from '../components/edit/add-to-timeline-registry';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const mount = () => { const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host); act(() => { root.render(<EmptyStart />); }); return { host, cleanup: () => { act(() => root.unmount()); host.remove(); } }; };
const click = (el: Element | null) => { act(() => { (el as HTMLElement).click(); }); };

describe('EmptyStart', () => {
  it('shows three ways to start', () => {
    const { host, cleanup } = mount();
    expect(['import', 'videos', 'generator'].every((id) => host.querySelector(`[data-testid="empty-start-${id}"]`))).toBe(true);
    cleanup();
  });
  it('Add your video asks the left panel to import', () => {
    const { host, cleanup } = mount();
    const on = vi.fn(); window.addEventListener(IMPORT_MEDIA_EVENT, on);
    click(host.querySelector('[data-testid="empty-start-import"]'));
    window.removeEventListener(IMPORT_MEDIA_EVENT, on);
    expect(on).toHaveBeenCalledTimes(1);
    cleanup();
  });
  it('Pick a template video opens the Add window on the Template videos tab', () => {
    const { host, cleanup } = mount();
    const seen: Array<string | undefined> = [];
    const on = (e: Event) => { e.preventDefault(); seen.push(peekPendingAddTab()); };
    window.addEventListener(OPEN_ADD_MODAL_EVENT, on);
    click(host.querySelector('[data-testid="empty-start-videos"]'));
    window.removeEventListener(OPEN_ADD_MODAL_EVENT, on);
    clearPendingAddTab();
    expect(seen).toEqual(['videos']);
    cleanup();
  });
  it('Make a video for me asks the editor to open the Template Generator', () => {
    const { host, cleanup } = mount();
    const on = vi.fn(); window.addEventListener(OPEN_GENERATOR_EVENT, on);
    click(host.querySelector('[data-testid="empty-start-generator"]'));
    window.removeEventListener(OPEN_GENERATOR_EVENT, on);
    expect(on).toHaveBeenCalledTimes(1);
    cleanup();
  });
});
