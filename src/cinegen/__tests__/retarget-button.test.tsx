import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TopTabs } from '@cinegen/components/workspace/top-tabs';
import { OPEN_RETARGET_EVENT, OPEN_VIEW_FLAG, requestRetarget } from '@cinegen/lib/leads/open-retarget';

afterEach(cleanup);

describe('header Retarget button', () => {
  it('is there on every tab (including Edit) once the shell provides it, and opens Retarget when pressed', () => {
    const open = vi.fn();
    const { rerender } = render(<TopTabs activeTab="edit" onTabChange={vi.fn()} onOpenRetarget={open} />);
    const btn = screen.getByRole('button', { name: 'Open Retarget' });
    expect(btn).toHaveTextContent('Retarget');
    fireEvent.click(btn);
    expect(open).toHaveBeenCalledTimes(1);
    for (const tab of ['elements', 'create', 'director', 'llm', 'export', 'leads', 'analytics'] as const) {
      rerender(<TopTabs activeTab={tab} onTabChange={vi.fn()} onOpenRetarget={open} />);
      expect(screen.getByRole('button', { name: 'Open Retarget' })).toBeInTheDocument();
    }
  });

  it('is not drawn when the host does not provide a handler (the header still works with just its two required props)', () => {
    render(<TopTabs activeTab="edit" onTabChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Open Retarget' })).not.toBeInTheDocument();
  });
});

describe('header layout with the Retarget button', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('measures the title group and the action group so the tabs can never sit under either, and stops measuring on unmount', () => {
    const observed: Element[] = [];
    const disconnect = vi.fn();
    class FakeResizeObserver { observe(el: Element) { observed.push(el); } unobserve() {} disconnect() { disconnect(); } constructor(public cb: () => void) {} }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const { container, unmount } = render(<TopTabs activeTab="llm" onTabChange={vi.fn()} onOpenRetarget={vi.fn()} showSkillsButton onOpenSkills={vi.fn()} />);
    const nav = container.querySelector('nav') as HTMLElement;
    expect(nav).toHaveClass('top-nav--retarget');
    expect(observed.map((el) => el.className)).toEqual(['top-nav__left', 'top-nav__actions']);
    expect(nav.style.getPropertyValue('--top-nav-left-w')).toMatch(/px$/);
    expect(nav.style.getPropertyValue('--top-nav-actions-w')).toMatch(/px$/);
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('does not observe anything (or add the layout class) when there is no Retarget button', () => {
    const observed: Element[] = [];
    class FakeResizeObserver { observe(el: Element) { observed.push(el); } unobserve() {} disconnect() {} constructor(public cb: () => void) {} }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const { container } = render(<TopTabs activeTab="edit" onTabChange={vi.fn()} />);
    expect(container.querySelector('nav')).not.toHaveClass('top-nav--retarget');
    expect(observed).toEqual([]);
  });
});

describe('requestRetarget', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); } });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('leaves the request for a tab that mounts later and tells a tab that is already open', () => {
    const heard = vi.fn();
    window.addEventListener(OPEN_RETARGET_EVENT, heard);
    requestRetarget();
    window.removeEventListener(OPEN_RETARGET_EVENT, heard);
    expect(store.get(OPEN_VIEW_FLAG)).toBe('retarget');
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('keeps working when storage is unavailable (the event still goes out)', () => {
    vi.stubGlobal('sessionStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => undefined });
    const heard = vi.fn();
    window.addEventListener(OPEN_RETARGET_EVENT, heard);
    expect(() => requestRetarget()).not.toThrow();
    window.removeEventListener(OPEN_RETARGET_EVENT, heard);
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
