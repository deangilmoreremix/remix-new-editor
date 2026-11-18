// [remix] Publish tab shell: sections switch and are remembered; the Social panel shows picture cards, counts, search, and an Export hint.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

vi.mock('@cinegen/components/leads/leads-tab', () => ({ LeadsTab: () => <div data-testid="leads-tab-stub" /> }));
vi.mock('@cinegen/components/workspace/workspace-shell', () => ({ useWorkspace: () => ({ state: { exports: [], assets: [{ id: 'a1', name: 'Beach clip', type: 'video', url: 'https://cdn.example.com/a.mp4', duration: 8, createdAt: '' }], overlays: [] }, dispatch: () => undefined, projectId: 'p' }) }));
const openSocialPublish = vi.fn();
vi.mock('../../lib/socialPublishHelpers.js', () => ({ openSocialPublish: (o: unknown) => openSocialPublish(o) }));
vi.mock('../../lib/hybrid-supabase.js', () => ({ uploadFileToStorage: vi.fn() }));

import { PublishTab, PUBLISH_SUB_KEY } from '../components/publish/publish-tab';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => { window.localStorage.clear(); openSocialPublish.mockClear(); });
const mount = () => { const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host); act(() => { root.render(<PublishTab />); }); return { host, cleanup: () => { act(() => root.unmount()); host.remove(); } }; };
const click = (el: Element | null) => { act(() => { (el as HTMLElement).click(); }); };
const flush = () => act(async () => { await Promise.resolve(); });
const type = (input: HTMLInputElement, v: string) => act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, v); input.dispatchEvent(new Event('input', { bubbles: true })); });

describe('PublishTab', () => {
  it('opens on Share & Leads, switches to Social, and remembers the choice', () => {
    const a = mount();
    expect(a.host.querySelector('[data-testid="leads-tab-stub"]')).not.toBeNull();
    click(a.host.querySelector('[data-testid="pub-chip-social"]'));
    expect(a.host.querySelector('[data-testid="publish-social"]')).not.toBeNull();
    expect(window.localStorage.getItem(PUBLISH_SUB_KEY)).toBe('social');
    a.cleanup();
    const b = mount();
    expect(b.host.querySelector('[data-testid="publish-social"]')).not.toBeNull(); // remembered
    b.cleanup();
  });
  it('Social: counts on the chips, picture cards, an Export hint when there are no exports, search narrows', () => {
    const { host, cleanup } = mount();
    click(host.querySelector('[data-testid="pub-chip-social"]'));
    const chip = (id: string) => host.querySelector(`[data-testid="pub-chip-${id}"] .pub-chip__count`)?.textContent;
    expect(chip('exports')).toBe('0'); expect(chip('media')).toBe('1'); expect(Number(chip('templates'))).toBeGreaterThan(100);
    expect(host.querySelector('[data-testid="social-no-exports"]')).not.toBeNull();
    expect(host.querySelectorAll('.pub-card')).toHaveLength(1); // opens on the first source that has videos (the media pool here)
    click(host.querySelector('[data-testid="pub-chip-templates"]'));
    expect(host.querySelectorAll('.pub-card').length).toBeGreaterThan(5);
    click(host.querySelector('[data-testid="pub-chip-media"]'));
    expect(host.querySelectorAll('.pub-card')).toHaveLength(1);
    type(host.querySelector('input[aria-label="Search videos"]') as HTMLInputElement, 'zzzz-nothing');
    expect(host.querySelectorAll('.pub-card')).toHaveLength(0);
    expect(host.querySelector('.pub-empty')).not.toBeNull();
    cleanup();
  });
  it('clicking a public video opens the Social Publish window with its link', async () => {
    const { host, cleanup } = mount();
    click(host.querySelector('[data-testid="pub-chip-social"]'));
    click(host.querySelector('[data-testid="pub-chip-media"]'));
    click(host.querySelector('.pub-card'));
    await flush(); await flush();
    expect(openSocialPublish).toHaveBeenCalledWith({ mediaUrl: 'https://cdn.example.com/a.mp4', mediaType: 'video', title: 'Beach clip' });
    cleanup();
  });
});
