// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/monetizationIntegration.js', () => ({ openMonetizationHub: vi.fn() }));
const { Sidebar } = await import('../Sidebar.js');
const { setFavorites, toggleFavorite } = await import('../../lib/onboarding/store.js');

const key = 'smartvideo-app-onboarding-v1:guest';
const mount = (answers) => {
  localStorage.clear(); document.body.innerHTML = '';
  if (answers) localStorage.setItem(key, JSON.stringify(answers));
  const { sidebar: el } = Sidebar(vi.fn());
  document.body.appendChild(el);
  return el;
};
const yours = () => [...document.querySelectorAll('[data-sidebar-yours-item]')].map((n) => n.getAttribute('data-sidebar-yours-item'));

describe('Sidebar: Your studios', () => {
  beforeEach(() => { window.location.hash = ''; });

  it('has no group without picks', () => {
    mount(null);
    expect(document.querySelector('[data-sidebar-group="Your studios"]')).toBeNull();
    expect(yours()).toEqual([]);
  });

  it('lists the picked studios, primary first, right after the first group, without duplicating the menu entries', () => {
    const el = mount({ step: 6, tools: ['image', 'avatar'], primaryTool: 'avatar' });
    expect(yours()).toEqual(['avatar', 'image']);
    const headings = [...el.querySelectorAll('[data-sidebar-group]')].map((n) => n.dataset.sidebarGroup);
    expect(headings[0]).toBe('Your studios'); // the first (home) group has no heading, so this is the first one
    expect(el.querySelectorAll('[data-sidebar-item="avatar"]')).toHaveLength(1); // the real entry is still unique
  });

  it('follows the favorites event, caps at 8, and highlights every copy of the open studio', () => {
    const el = mount({ step: 6, tools: ['image'], primaryTool: 'image' });
    window.location.hash = '#/image';
    el.dispatchEvent(new CustomEvent('route-changed', { detail: { page: 'image' } }));
    const active = () => [...el.querySelectorAll('[aria-current="page"]')].map((n) => n.dataset.sidebarItem || n.dataset.sidebarYoursItem);
    expect(active().sort()).toEqual(['image', 'image']);
    toggleFavorite('', 'video', { persist: false });
    expect(yours()).toEqual(['image', 'video']);
    setFavorites('', ['image', 'video', 'cinema', 'animate', 'effects', 'edit', 'upscale', 'character', 'commercial', 'viral'], { persist: false });
    expect(yours()).toHaveLength(8);
    setFavorites('', [], { persist: false });
    expect(document.querySelector('[data-sidebar-group="Your studios"]')).toBeNull();
    expect(yours()).toEqual([]);
  });
});
