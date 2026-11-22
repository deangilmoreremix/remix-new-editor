// [remix] Email page: connect, audience, link, send, and the honest wording. The sync client is mocked, so nothing is really sent.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

vi.mock('@cinegen/components/leads/leads-tab', () => ({ LeadsTab: () => <div /> }));
vi.mock('@cinegen/components/workspace/workspace-shell', () => ({ useWorkspace: () => ({ state: { exports: [], assets: [], overlays: [] }, dispatch: () => undefined, projectId: 'p' }) }));
let published = true;
vi.mock('../components/leads/use-publish', () => ({ usePublished: () => ({ id: published ? 'vid123' : null, info: published ? { published: true } : null, signedIn: true }), getClient: async () => { throw new Error('Sign in to publish videos'); } }));
vi.mock('../components/leads/use-leads', () => ({ useLeads: () => ({ rows: [{ id: 'l1', kind: 'lead-form', clipId: 'c', createdAt: '2026-01-01T00:00:00Z', data: { EMAIL: 'lead@example.com', 'FIRST NAME': 'Lea' } }], loading: false, error: '', reload: async () => undefined, remove: async () => undefined }) }));
vi.mock('../../lib/editor/publish/publishClient.js', () => ({ watchUrl: (id: string) => `https://remix.example.com/watch/${id}` }));
const sync = { key: '', callSync: vi.fn(), pushInBatches: vi.fn() };
vi.mock('../../lib/landingPages/syncClient.js', () => ({ getSyncKey: () => sync.key, setSyncKey: (v: string) => { sync.key = v; }, callSync: (...a: unknown[]) => sync.callSync(...a), pushInBatches: (...a: unknown[]) => sync.pushInBatches(...a) }));

import { EmailPanel } from '../components/publish/email-panel';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => { window.localStorage.clear(); sync.key = ''; published = true; sync.callSync.mockReset(); sync.pushInBatches.mockReset(); });
const mount = () => { const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host); act(() => { root.render(<EmailPanel />); }); return { host, cleanup: () => { act(() => root.unmount()); host.remove(); } }; };
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const click = async (el: Element | null) => { await act(async () => { (el as HTMLElement).click(); await new Promise((r) => setTimeout(r, 0)); }); };
const type = (input: HTMLInputElement, v: string) => act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, v); input.dispatchEvent(new Event('input', { bubbles: true })); });
const q = (h: HTMLElement, id: string) => h.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

describe('EmailPanel', () => {
  it('starts blocked on connecting, says so, says Kit lists are not built, and fills the video link when published', async () => {
    const { host, cleanup } = mount(); await flush();
    expect((q(host, 'email-send') as HTMLButtonElement).disabled).toBe(true);
    expect(q(host, 'email-blocker')?.textContent).toMatch(/Connect your MailerLite/);
    expect(q(host, 'email-kit-note')?.textContent).toMatch(/not built yet/);
    expect((q(host, 'email-link') as HTMLInputElement).value).toBe('https://remix.example.com/watch/vid123');
    expect(q(host, 'email-audience')?.textContent).toMatch(/1 contact with an email/);
    cleanup();
  });
  it('a wrong token shows the error and stays blocked', async () => {
    sync.callSync.mockRejectedValue(new Error('Invalid token'));
    const { host, cleanup } = mount(); await flush();
    type(q(host, 'email-key') as HTMLInputElement, 'bad-token');
    await click(q(host, 'email-connect'));
    expect(q(host, 'email-conn-error')?.textContent).toMatch(/Invalid token/);
    expect((q(host, 'email-send') as HTMLButtonElement).disabled).toBe(true);
    cleanup();
  });
  it('connects, picks a group, sends the right rows with the link, and reports without claiming an email was sent', async () => {
    sync.callSync.mockImplementation(async (action: string) => (action === 'groups' ? { ok: true, groups: [{ id: 'g1', name: 'Video fans' }] } : { ok: true }));
    sync.pushInBatches.mockResolvedValue({ pushed: 1, failed: [], rateLimited: false, retryAfter: null });
    const { host, cleanup } = mount(); await flush();
    type(q(host, 'email-key') as HTMLInputElement, 'good-token');
    await click(q(host, 'email-connect'));
    expect(sync.key).toBe('good-token');
    expect(q(host, 'email-connected')).not.toBeNull();
    const group = host.querySelector('select[aria-label="MailerLite group"]') as HTMLSelectElement;
    act(() => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(group, 'g1'); group.dispatchEvent(new Event('change', { bubbles: true })); });
    expect((q(host, 'email-send') as HTMLButtonElement).disabled).toBe(false);
    await click(q(host, 'email-send'));
    const [rows, opts] = sync.pushInBatches.mock.calls[0];
    expect(rows).toEqual([{ email: 'lead@example.com', firstname: 'Lea', lastname: '', company: '', link: 'https://remix.example.com/watch/vid123' }]);
    expect(opts.groupId).toBe('g1');
    expect(q(host, 'email-result')?.textContent).toMatch(/1 of 1 contact added to the “Video fans” group/);
    expect(q(host, 'email-result')?.textContent).toMatch(/Nothing has been emailed yet/);
    cleanup();
  });
  it('without a published video and no link typed, Send is blocked asking for a link', async () => {
    published = false; sync.key = 'tok';
    sync.callSync.mockImplementation(async (action: string) => (action === 'groups' ? { ok: true, groups: [] } : { ok: true }));
    const { host, cleanup } = mount(); await flush(); await flush();
    expect(q(host, 'email-not-published')).not.toBeNull();
    expect(q(host, 'email-blocker')?.textContent).toMatch(/video link/);
    type(q(host, 'email-link') as HTMLInputElement, 'https://example.com/my-video');
    expect((q(host, 'email-send') as HTMLButtonElement).disabled).toBe(false);
    cleanup();
  });
  it('a failing send shows the error', async () => {
    sync.key = 'tok';
    sync.callSync.mockImplementation(async (action: string) => (action === 'groups' ? { ok: true, groups: [] } : { ok: true }));
    sync.pushInBatches.mockRejectedValue(new Error('Sync failed (HTTP 502)'));
    const { host, cleanup } = mount(); await flush(); await flush();
    await click(q(host, 'email-send'));
    expect(q(host, 'email-send-error')?.textContent).toMatch(/HTTP 502/);
    cleanup();
  });
});
