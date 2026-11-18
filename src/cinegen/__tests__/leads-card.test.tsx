// [remix] Leads card: coloured status pills, tag chips, note popover, status filter chips, score pill + sort, CSV / Excel buttons.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

vi.mock('@cinegen/components/workspace/workspace-shell', () => ({ useWorkspace: () => ({ state: { exports: [], assets: [], overlays: [] }, dispatch: () => undefined, projectId: 'p' }) }));
const xlsx = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock('@cinegen/lib/leads/leads-xlsx', () => ({ downloadLeadsXlsx: (...a: unknown[]) => xlsx.download(...a) }));

import { LeadsCard } from '@cinegen/components/leads/leads-card';
import { setLeadsForm } from '@cinegen/lib/leads/leads-filter';
import type { LeadRow } from '@cinegen/lib/leads/leads';
import type { LeadsData } from '@cinegen/components/leads/use-leads';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mk = (id: string, data: Record<string, string>, extra: Partial<LeadRow> = {}): LeadRow => ({ id, kind: 'list-builder', clipId: 'list-builder', createdAt: new Date().toISOString(), data, status: 'new', notes: '', tags: [], ...extra });
const ROWS: LeadRow[] = [
  mk('low', { EMAIL: 'low@gmail.com' }),
  mk('high', { EMAIL: 'high@acme.io', PHONE: '555 123 4567', 'FIRST NAME': 'Hana' }, { kind: 'lead-form', clipId: 'c1', status: 'qualified', tags: ['vip'], notes: 'call tue' }),
  mk('won', { EMAIL: 'won@acme.io' }, { status: 'won' }),
];

let update: ReturnType<typeof vi.fn>;
const dataFor = (rows: LeadRow[]): LeadsData => ({ rows, loading: false, error: '', reload: async () => undefined, remove: async () => undefined, update: update as never });
const mount = (rows = ROWS, published = true) => {
  const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
  act(() => { root.render(<LeadsCard data={dataFor(rows)} published={published} views={10} />); });
  return { host, cleanup: () => { act(() => root.unmount()); host.remove(); } };
};
const q = (h: HTMLElement, id: string) => h.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const click = async (el: Element | null) => { await act(async () => { (el as HTMLElement).click(); await new Promise((r) => setTimeout(r, 0)); }); };
const setValue = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, v: string) => act(() => {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, v);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
});
const key = (el: Element, k: string) => act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); });
const ids = (h: HTMLElement) => Array.from(h.querySelectorAll('tbody tr')).map((tr) => tr.querySelector('[data-testid="lead-score"]')?.textContent ?? '');

beforeEach(() => { update = vi.fn(); xlsx.download.mockReset(); setLeadsForm('all'); });

describe('LeadsCard', () => {
  it('says to publish first when the video is not published (no table, no buttons)', () => {
    const { host, cleanup } = mount([], false);
    expect(q(host, 'leads-unpublished')).toBeTruthy();
    expect(q(host, 'leads-table')).toBeNull();
    expect(q(host, 'leads-xlsx')).toBeNull();
    cleanup();
  });

  it('shows a coloured status dropdown per row and saves a change for that lead', () => {
    const { host, cleanup } = mount();
    const selects = Array.from(host.querySelectorAll('select[data-testid="lead-status"]')) as HTMLSelectElement[];
    expect(selects).toHaveLength(3);
    expect(selects[1].className).toContain('leads-status--qualified');
    expect(selects[2].className).toContain('leads-status--won');
    setValue(selects[0], 'contacted');
    expect(update).toHaveBeenCalledWith('low', { status: 'contacted' });
    cleanup();
  });

  it('shows tag chips; Enter adds a cleaned tag and the x removes one', () => {
    const { host, cleanup } = mount();
    const cells = host.querySelectorAll('[data-testid="lead-tags"]');
    expect(cells[1].textContent).toContain('vip');
    const input = cells[0].querySelector('input') as HTMLInputElement;
    setValue(input, ' Big Fish ');
    key(input, 'Enter');
    expect(update).toHaveBeenCalledWith('low', { tags: ['big-fish'] });
    (host.querySelector('button[aria-label="Remove tag vip"]') as HTMLElement).click();
    expect(update).toHaveBeenCalledWith('high', { tags: [] });
    cleanup();
  });

  it('adds a tag on blur and ignores an empty one', () => {
    const { host, cleanup } = mount();
    const input = host.querySelector('[data-testid="lead-tags"] input') as HTMLInputElement;
    key(input, 'Enter');
    expect(update).not.toHaveBeenCalled();
    setValue(input, 'later');
    act(() => { input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
    expect(update).toHaveBeenCalledWith('low', { tags: ['later'] });
    cleanup();
  });

  it('opens a note popover, saves the text, and does nothing when it is unchanged', async () => {
    const { host, cleanup } = mount();
    const btns = host.querySelectorAll('[data-testid="lead-note-btn"]');
    expect(btns[1].textContent).toContain('●'); // has a note
    await click(btns[0]);
    const pop = q(host, 'lead-note-pop')!;
    expect(pop).toBeTruthy();
    setValue(pop.querySelector('textarea') as HTMLTextAreaElement, 'wants a demo');
    await click(q(host, 'lead-note-save'));
    expect(update).toHaveBeenCalledWith('low', { notes: 'wants a demo' });
    expect(q(host, 'lead-note-pop')).toBeNull();
    update.mockReset();
    await click(host.querySelectorAll('[data-testid="lead-note-btn"]')[1]);
    await click(q(host, 'lead-note-save'));
    expect(update).not.toHaveBeenCalled();
    cleanup();
  });

  it('has a status filter chip row with counts that narrows the table', async () => {
    const { host, cleanup } = mount();
    expect(q(host, 'status-chip-all')?.textContent).toBe('Any status 3');
    expect(q(host, 'status-chip-new')?.textContent).toBe('New 1');
    expect(q(host, 'status-chip-won')?.textContent).toBe('Won 1');
    await click(q(host, 'status-chip-won'));
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(host.textContent).toContain('won@acme.io');
    await click(q(host, 'status-chip-won')); // again: back to all
    expect(host.querySelectorAll('tbody tr')).toHaveLength(3);
    cleanup();
  });

  it('hides the follow-up controls when the database has no follow-up columns yet', () => {
    const { host, cleanup } = mount([{ id: 'a', kind: 'list-builder', clipId: 'list-builder', createdAt: new Date().toISOString(), data: { EMAIL: 'a@x.io' } }]);
    expect(q(host, 'leads-status-filter')).toBeNull();
    expect(q(host, 'lead-followup')).toBeNull();
    expect(q(host, 'lead-score')).toBeTruthy(); // the score needs no extra columns
    cleanup();
  });

  it('shows a score pill per row and sorts by it, highest then lowest then back', async () => {
    const { host, cleanup } = mount();
    expect(ids(host)).toEqual(['15 · Cold', '71 · Hot', '30 · Warm']); // given order
    expect(q(host, 'lead-score')?.getAttribute('title')).toBe('Personal email address');
    await click(q(host, 'leads-sort-score'));
    expect(ids(host)).toEqual(['71 · Hot', '30 · Warm', '15 · Cold']);
    expect(host.querySelector('th[aria-sort="descending"]')).toBeTruthy();
    await click(q(host, 'leads-sort-score'));
    expect(ids(host)).toEqual(['15 · Cold', '30 · Warm', '71 · Hot']);
    await click(q(host, 'leads-sort-score'));
    expect(ids(host)).toEqual(['15 · Cold', '71 · Hot', '30 · Warm']);
    cleanup();
  });

  it('downloads Excel for the filtered, sorted rows with status / tags / notes / score', async () => {
    const { host, cleanup } = mount();
    await click(q(host, 'status-chip-qualified'));
    await click(q(host, 'leads-xlsx'));
    expect(xlsx.download).toHaveBeenCalledTimes(1);
    const records = xlsx.download.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ EMAIL: 'high@acme.io', Status: 'Qualified', Tags: 'vip', Notes: 'call tue', 'Lead Score': 71, 'Lead Rating': 'Hot' });
    cleanup();
  });

  it('reports an Excel failure and recovers', async () => {
    xlsx.download.mockRejectedValueOnce(new Error('chunk failed to load'));
    const { host, cleanup } = mount();
    await click(q(host, 'leads-xlsx'));
    expect(q(host, 'leads-xlsx-error')?.textContent).toMatch(/chunk failed/);
    expect((q(host, 'leads-xlsx') as HTMLButtonElement).disabled).toBe(false);
    cleanup();
  });

  it('disables both downloads when no lead matches', async () => {
    const { host, cleanup } = mount();
    await setValue(q(host, 'leads-search') as HTMLInputElement, 'zzz-no-match');
    expect((q(host, 'leads-xlsx') as HTMLButtonElement).disabled).toBe(true);
    expect((q(host, 'leads-csv') as HTMLButtonElement).disabled).toBe(true);
    expect(q(host, 'leads-empty')?.textContent).toMatch(/No leads match/);
    cleanup();
  });
});
