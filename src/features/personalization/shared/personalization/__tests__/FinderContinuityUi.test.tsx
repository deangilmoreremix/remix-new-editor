// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { HiddenBar, LooksWrongMenu, SavedSearchesPanel } from '../FinderContinuityUi';

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { document.body.innerHTML = ''; });

const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
function mount(node: React.ReactElement) { const el = document.createElement('div'); document.body.appendChild(el); act(() => { createRoot(el).render(node); }); return el; }
const type = (input: HTMLInputElement, value: string) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
const search = { id: 's1', name: 'Tampa pizza', niche: 'restaurants-food', location: 'Tampa, FL', radius_miles: 25, include_chains: false };

describe('SavedSearchesPanel', () => {
  const base = { current: { niche: 'restaurants-food', location: 'Tampa, FL', radiusMiles: 15 }, defaultName: 'Restaurants · Tampa', searches: [], nicheLabel: (k: string) => k, onRun: vi.fn(), onDelete: vi.fn() };
  it('cannot save until the form is complete', () => {
    const el = mount(<SavedSearchesPanel {...base} current={null} onSave={vi.fn()} />);
    expect((q(el, 'save-search-open') as HTMLButtonElement).disabled).toBe(true);
  });
  it('suggests a name, saves it, and confirms', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    const el = mount(<SavedSearchesPanel {...base} onSave={onSave} />);
    act(() => { q(el, 'save-search-open')!.click(); });
    expect((q(el, 'save-search-name') as HTMLInputElement).value).toBe('Restaurants · Tampa');
    await act(async () => { q(el, 'save-search-confirm')!.click(); });
    expect(onSave).toHaveBeenCalledWith('Restaurants · Tampa');
    expect(q(el, 'save-search-message')!.textContent).toBe('Saved.');
    expect(q(el, 'save-search-name')).toBeNull();
  });
  it('refuses an empty name and shows the server error (e.g. the 25-search cap) without closing', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: false, error: 'You have reached the limit. Remove one first.' });
    const el = mount(<SavedSearchesPanel {...base} onSave={onSave} />);
    act(() => { q(el, 'save-search-open')!.click(); });
    type(q(el, 'save-search-name') as HTMLInputElement, '   ');
    await act(async () => { q(el, 'save-search-confirm')!.click(); });
    expect(onSave).not.toHaveBeenCalled();
    expect(q(el, 'save-search-message')!.textContent).toContain('Give the search a name');
    type(q(el, 'save-search-name') as HTMLInputElement, 'Tampa');
    await act(async () => { q(el, 'save-search-confirm')!.click(); });
    expect(q(el, 'save-search-message')!.textContent).toContain('limit');
    expect(q(el, 'save-search-name')).not.toBeNull();
  });
  it('lists saved searches with run and delete', async () => {
    const onRun = vi.fn(); const onDelete = vi.fn().mockResolvedValue({ ok: true });
    const el = mount(<SavedSearchesPanel {...base} searches={[search]} onSave={vi.fn()} onRun={onRun} onDelete={onDelete} />);
    expect(q(el, 'saved-search-item')!.textContent).toContain('Tampa pizza');
    expect(q(el, 'saved-search-item')!.textContent).toContain('25 mi');
    act(() => { q(el, 'saved-search-run')!.click(); });
    expect(onRun).toHaveBeenCalledWith(search);
    await act(async () => { q(el, 'saved-search-delete')!.click(); });
    expect(onDelete).toHaveBeenCalledWith('s1');
  });
});

describe('LooksWrongMenu', () => {
  it('opens the fixed reasons and flags with the chosen one, then closes', async () => {
    const onFlag = vi.fn().mockResolvedValue({ ok: true });
    const el = mount(<LooksWrongMenu businessName="Joe's" flagged={false} onFlag={onFlag} />);
    expect(q(el, 'looks-wrong-menu')).toBeNull();
    act(() => { q(el, 'looks-wrong-open')!.click(); });
    expect(el.querySelectorAll('[role="menuitem"]')).toHaveLength(6);
    await act(async () => { q(el, 'looks-wrong-is_a_chain')!.click(); });
    expect(onFlag).toHaveBeenCalledWith('is_a_chain');
    expect(q(el, 'looks-wrong-menu')).toBeNull();
  });
  it('keeps the menu open and shows the error when the flag fails', async () => {
    const el = mount(<LooksWrongMenu businessName="Joe's" flagged={false} onFlag={vi.fn().mockResolvedValue({ ok: false, error: 'Sign in to use this.' })} />);
    act(() => { q(el, 'looks-wrong-open')!.click(); });
    await act(async () => { q(el, 'looks-wrong-closed')!.click(); });
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('Sign in');
    expect(q(el, 'looks-wrong-menu')).not.toBeNull();
  });
  it('renders nothing for an already-flagged business and labels the button for screen readers', () => {
    expect(mount(<LooksWrongMenu businessName="Joe's" flagged onFlag={vi.fn()} />).textContent).toBe('');
    const el = mount(<LooksWrongMenu businessName="Joe's" flagged={false} onFlag={vi.fn()} />);
    expect(q(el, 'looks-wrong-open')!.getAttribute('aria-label')).toContain("Joe's");
  });
});

describe('HiddenBar', () => {
  it('is absent with nothing hidden; otherwise counts, toggles and undoes', () => {
    expect(mount(<HiddenBar hiddenCount={0} showing={false} onToggle={vi.fn()} onUndoAll={vi.fn()} />).textContent).toBe('');
    const onToggle = vi.fn(); const onUndoAll = vi.fn();
    const el = mount(<HiddenBar hiddenCount={2} showing={false} onToggle={onToggle} onUndoAll={onUndoAll} />);
    expect(q(el, 'hidden-bar')!.textContent).toContain('2 hidden');
    act(() => { q(el, 'hidden-toggle')!.click(); q(el, 'hidden-undo')!.click(); });
    expect(onToggle).toHaveBeenCalled(); expect(onUndoAll).toHaveBeenCalled();
  });
});
