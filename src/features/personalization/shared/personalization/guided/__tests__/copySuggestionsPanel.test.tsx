// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { createRoot } from 'react-dom/client';
import { CopySuggestionsPanel } from '../CopySuggestionsPanel';

beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
const mounted: { root: ReturnType<typeof createRoot>; el: HTMLElement }[] = [];
function mount(ui: React.ReactElement) {
  const el = document.createElement('div'); document.body.appendChild(el);
  const root = createRoot(el); mounted.push({ root, el }); act(() => { root.render(ui); }); return el;
}
afterEach(() => { for (const { root, el } of mounted.splice(0)) { act(() => root.unmount()); el.remove(); } });
const click = (el: Element | null) => act(() => { (el as HTMLElement).click(); });

describe('CopySuggestionsPanel', () => {
  const client = { businessName: "Joe's Plumbing", industry: 'Plumber', location: 'Tampa, FL', phone: '813-555-0100', website: 'joesplumbing.com' };

  it('is collapsed until asked, then lists suggestions built from the details', () => {
    const el = mount(<CopySuggestionsPanel client={client} onPick={vi.fn()} />);
    expect(el.querySelector('[data-testid="copy-pick-headlines"]')).toBeNull();
    click(el.querySelector('[data-testid="copy-suggest-toggle"]'));
    expect(el.textContent).toContain("Meet Joe's Plumbing");
    expect(el.textContent).toContain('Visit joesplumbing.com');
    expect(el.textContent).toContain('no offers, prices or claims');
  });
  it('fills the right field and layer when a suggestion is picked, and nothing before that', () => {
    const onPick = vi.fn();
    const el = mount(<CopySuggestionsPanel client={client} onPick={onPick} />);
    expect(onPick).not.toHaveBeenCalled();
    click(el.querySelector('[data-testid="copy-suggest-toggle"]'));
    click(el.querySelectorAll('[data-testid="copy-pick-headlines"]')[1]);
    expect(onPick).toHaveBeenCalledWith('ctaHeadline', "Meet Joe's Plumbing", 'headline');
    click(el.querySelector('[data-testid="copy-pick-ctas"]'));
    expect(onPick).toHaveBeenLastCalledWith('callToAction', 'Visit joesplumbing.com', 'cta');
  });
  it('asks for details when there is nothing to build from', () => {
    const el = mount(<CopySuggestionsPanel client={{}} onPick={vi.fn()} />);
    click(el.querySelector('[data-testid="copy-suggest-toggle"]'));
    expect(el.textContent).toContain('Add the business name');
  });
});
