// [remix] Contacts page: import a CSV, see the people, search, filter by source, export, remove.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

vi.mock('@cinegen/components/leads/leads-tab', () => ({ LeadsTab: () => <div /> }));
vi.mock('@cinegen/components/workspace/workspace-shell', () => ({ useWorkspace: () => ({ state: { exports: [], assets: [], overlays: [] }, dispatch: () => undefined, projectId: 'p' }) }));
vi.mock('../components/leads/use-publish', () => ({ usePublished: () => ({ id: 'pub1', info: {}, signedIn: true }), getClient: async () => { throw new Error('Sign in to publish videos'); } }));
vi.mock('../components/leads/use-leads', () => ({ useLeads: () => ({ rows: [{ id: 'l1', kind: 'lead-form', clipId: 'c', createdAt: '2026-01-01T00:00:00Z', data: { EMAIL: 'lead@example.com', 'FIRST NAME': 'Lea' } }], loading: false, error: '', reload: async () => undefined, remove: async () => undefined }) }));
vi.mock('../../lib/socialPublishHelpers.js', () => ({ openSocialPublish: vi.fn() }));
vi.mock('../../lib/hybrid-supabase.js', () => ({ uploadFileToStorage: vi.fn() }));

import { ContactsPanel } from '../components/publish/contacts-panel';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => { window.localStorage.clear(); });
const mount = () => { const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host); act(() => { root.render(<ContactsPanel />); }); return { host, cleanup: () => { act(() => root.unmount()); host.remove(); } }; };
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const click = (el: Element | null) => { act(() => { (el as HTMLElement).click(); }); };
const rows = (h: HTMLElement) => [...h.querySelectorAll('[data-testid="contact-row"]')].map((r) => r.textContent);
// jsdom's File has no .text() (every real browser does), so the test file brings its own
const csvFile = (text: string) => Object.assign(new File([text], 'people.csv', { type: 'text/csv' }), { text: async () => text });
const pickFile = async (host: HTMLElement, f: File) => { const input = host.querySelector('[data-testid="contacts-file"]') as HTMLInputElement; Object.defineProperty(input, 'files', { value: [f], configurable: true }); await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 10)); }); };

describe('ContactsPanel', () => {
  it('shows video leads, says the landing source could not load, and keeps going', async () => {
    const { host, cleanup } = mount(); await flush();
    expect(rows(host).join(' ')).toContain('lead@example.com');
    expect(host.querySelector('[data-testid="contacts-problem-landing"]')?.textContent).toContain('Sign in');
    cleanup();
  });
  it('imports a CSV: people appear, counts update, duplicates are skipped, a second import adds nobody new', async () => {
    const { host, cleanup } = mount(); await flush();
    await pickFile(host, csvFile('First Name,Email,Company\nAna,ana@example.com,Acme\nBob,lead@example.com,Dup\nCy,bad,Cyco'));
    expect(rows(host).join(' ')).toContain('ana@example.com');
    expect(host.querySelector('[data-testid="contacts-note"]')?.textContent).toMatch(/1 contact imported, 2 skipped/);
    expect(host.querySelector('[data-testid="pub-chip-imported"] .pub-chip__count')?.textContent).toBe('1');
    expect(host.querySelector('[data-testid="pub-chip-all"] .pub-chip__count')?.textContent).toBe('2');
    await pickFile(host, csvFile('Email\nana@example.com'));
    expect(host.querySelector('[data-testid="contacts-note"]')?.textContent).toMatch(/0 contacts imported/);
    cleanup();
  });
  it('a file with no email column imports nothing and says so', async () => {
    const { host, cleanup } = mount(); await flush();
    await pickFile(host, csvFile('Name,Notes\nAna,hi'));
    expect(host.querySelector('[data-testid="contacts-note"]')?.textContent).toMatch(/no email column/);
    cleanup();
  });
  it('filters by source and search, and removes an imported contact', async () => {
    const { host, cleanup } = mount(); await flush();
    await pickFile(host, csvFile('Email,Company\nana@example.com,Acme'));
    click(host.querySelector('[data-testid="pub-chip-leads"]'));
    expect(rows(host)).toHaveLength(1); expect(rows(host)[0]).toContain('lead@example.com');
    click(host.querySelector('[data-testid="pub-chip-imported"]'));
    expect(rows(host)).toHaveLength(1);
    click(host.querySelector('button[aria-label="Remove ana@example.com"]'));
    expect(host.querySelector('[data-testid="contacts-empty"]')).not.toBeNull();
    expect(window.localStorage.getItem('remix_contacts')).toBe('[]');
    cleanup();
  });
});
