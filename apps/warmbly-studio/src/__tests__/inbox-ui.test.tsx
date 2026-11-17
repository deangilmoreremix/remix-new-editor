// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor, cleanup } from '@testing-library/react';
import { WarmblyStudio, createLocalAdapter, buildSeed } from '../index';
import { listThreads, inFolder } from '../domain/inbox';

afterEach(cleanup);
const setup = () => { const adapter = createLocalAdapter({ persist: false, seed: () => buildSeed(new Date()) }); render(<WarmblyStudio adapter={adapter} initialView="inbox" />); return adapter; };
const rail = () => within(screen.getByRole('navigation', { name: 'Mail folders' }));
const folder = async (name: RegExp) => { fireEvent.click(await rail().findByRole('button', { name })); };
const rows = () => screen.getAllByRole('button').filter(b => b.classList.contains('wb-ib-item'));
const row = (txt: RegExp) => screen.getAllByRole('button', { name: txt }).find(b => b.classList.contains('wb-ib-item'))!;
const now = () => new Date();

describe('inbox UI', () => {
  it('shows the folder rail with counts, labels, mailboxes and tags', async () => {
    setup(); await screen.findByTestId('inbox'); const r = rail();
    for (const f of ['All mail', 'Inbox', 'Unread', 'Awaiting reply', 'Agent drafts', 'Drafts', 'Snoozed', 'Sent', 'Scheduled', 'Archive', 'Spam', 'Trash']) expect(r.getByRole('button', { name: new RegExp(f) })).toBeInTheDocument();
    expect(r.getByRole('button', { name: /Lead/ })).toBeInTheDocument(); expect(r.getByRole('button', { name: /vip/ })).toBeInTheDocument(); expect(r.getByLabelText('Filter mailboxes')).toBeInTheDocument();
  });
  it('opening a conversation shows its messages and marks it read', async () => {
    const a = setup(); await screen.findByTestId('inbox'); const ws = await a.load(); const t = listThreads(ws, 'unread', now())[0]; expect(t.unread).toBe(true);
    fireEvent.click(row(new RegExp(t.subject.slice(0, 20)))); await waitFor(async () => expect((await a.load()).threads.find(x => x.id === t.id)!.unread).toBe(false));
    expect(await screen.findByRole('button', { name: /Reply/ })).toBeInTheDocument(); expect(screen.getAllByRole('article').length).toBe(t.messages.length);
  });
  it('archives, then finds it in Archive and can move it back', async () => {
    const a = setup(); await screen.findByTestId('inbox'); const t = listThreads(await a.load(), 'inbox', now())[0];
    fireEvent.click(rows()[0]); fireEvent.click(await screen.findByRole('button', { name: 'Archive' }));
    await waitFor(async () => expect(inFolder((await a.load()).threads.find(x => x.id === t.id)!, 'archive', now())).toBe(true));
    await folder(/^Archive/); fireEvent.click(row(new RegExp(t.subject.slice(0, 15)))); fireEvent.click(await screen.findByRole('button', { name: 'Move to inbox' }));
    await waitFor(async () => expect(inFolder((await a.load()).threads.find(x => x.id === t.id)!, 'inbox', now())).toBe(true));
  });
  it('trash → restore, and delete forever only from Trash', async () => {
    const a = setup(); await screen.findByTestId('inbox'); const t = listThreads(await a.load(), 'inbox', now())[0];
    fireEvent.click(rows()[0]); fireEvent.click(await screen.findByRole('button', { name: 'Move to trash' }));
    await waitFor(async () => expect((await a.load()).threads.find(x => x.id === t.id)!.trashed).toBe(true));
    await folder(/^Trash/); fireEvent.click(row(new RegExp(t.subject.slice(0, 15)))); fireEvent.click(await screen.findByRole('button', { name: 'Delete forever' }));
    await waitFor(async () => expect((await a.load()).threads.some(x => x.id === t.id)).toBe(false));
  });
  it('bulk-selects and archives several conversations', async () => {
    const a = setup(); await screen.findByTestId('inbox'); const before = listThreads(await a.load(), 'inbox', now()).length;
    fireEvent.click(screen.getByRole('button', { name: 'Select' })); const boxes = screen.getAllByRole('checkbox', { name: /^Select / }); fireEvent.click(boxes[0]); fireEvent.click(boxes[1]);
    const bar = await screen.findByRole('toolbar', { name: 'Bulk actions' }); expect(within(bar).getByText('2 selected')).toBeInTheDocument(); fireEvent.click(within(bar).getByRole('button', { name: 'Archive' }));
    await waitFor(async () => expect(listThreads(await a.load(), 'inbox', now()).length).toBe(before - 2));
  });
  it('snoozes a conversation (it leaves Inbox and shows in Snoozed)', async () => {
    const a = setup(); await screen.findByTestId('inbox'); const t = listThreads(await a.load(), 'inbox', now())[0];
    fireEvent.click(rows()[0]); fireEvent.click(await screen.findByRole('button', { name: 'Snooze' })); fireEvent.click(await screen.findByRole('menuitem', { name: /Tomorrow/ }));
    await waitFor(async () => expect(inFolder((await a.load()).threads.find(x => x.id === t.id)!, 'snoozed', now())).toBe(true));
    await folder(/^Snoozed/); expect(row(new RegExp(t.subject.slice(0, 15)))).toBeInTheDocument();
  });
  it('filters by label, tag, mailbox and search; and clears', async () => {
    setup(); await screen.findByTestId('inbox'); await folder(/^All mail/); const all = rows().length;
    fireEvent.click(rail().getByRole('button', { name: /vip/ })); await waitFor(() => expect(rows().length).toBe(1)); fireEvent.click(screen.getByRole('button', { name: 'Clear' })); await waitFor(() => expect(rows().length).toBe(all));
    fireEvent.click(rail().getByRole('button', { name: /Lead/ })); await waitFor(() => expect(rows().length).toBeLessThan(all)); fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    fireEvent.change(screen.getByLabelText('Search inbox'), { target: { value: 'benchmarks' } }); await waitFor(() => expect(rows().length).toBe(1));
    fireEvent.change(screen.getByLabelText('Search inbox'), { target: { value: 'zzzqqq' } }); expect(await screen.findByText('No conversations match your search.')).toBeInTheDocument();
  });
  it('replies inline with an AI draft; the thread moves to Awaiting reply', async () => {
    const a = setup(); await screen.findByTestId('inbox'); const t = listThreads(await a.load(), 'inbox', now())[0]; const len = t.messages.length;
    fireEvent.click(rows()[0]); fireEvent.click(await screen.findByRole('button', { name: /Reply/ })); fireEvent.click(await screen.findByRole('button', { name: /AI draft/ }));
    expect((screen.getByLabelText('Reply') as HTMLTextAreaElement).value).toMatch(/^Hi /); fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));
    await waitFor(async () => { const x = (await a.load()).threads.find(y => y.id === t.id)!; expect(x.messages.length).toBe(len + 1); expect(inFolder(x, 'awaiting', now())).toBe(true); });
  });
  it('uses the agent draft banner', async () => {
    const a = setup(); await screen.findByTestId('inbox'); await folder(/^Agent drafts/); const t = listThreads(await a.load(), 'agent', now())[0];
    fireEvent.click(row(new RegExp(t.subject.slice(0, 12)))); fireEvent.click(await screen.findByRole('button', { name: 'Use draft' }));
    expect((screen.getByLabelText('Reply') as HTMLTextAreaElement).value).toContain('Good question');
  });
  it('composes: validates the address, sends, and schedules', async () => {
    const a = setup(); await screen.findByTestId('inbox'); fireEvent.click(rail().getByRole('button', { name: /Compose/ })); let dlg = await screen.findByRole('dialog');
    const send = within(dlg).getByRole('button', { name: 'Send' }); expect(send).toBeDisabled();
    fireEvent.change(within(dlg).getByLabelText('To'), { target: { value: 'nope' } }); expect(within(dlg).getByText('Enter a valid email address')).toBeInTheDocument(); expect(send).toBeDisabled();
    fireEvent.change(within(dlg).getByLabelText('To'), { target: { value: 'new.person@fresh.io' } }); fireEvent.change(within(dlg).getByLabelText('Subject'), { target: { value: 'Hello there' } }); expect(send).toBeEnabled(); fireEvent.click(send);
    await waitFor(async () => expect((await a.load()).threads.some(t => t.subject === 'Hello there' && inFolder(t, 'sent', now()))).toBe(true));
    fireEvent.click(rail().getByRole('button', { name: /Compose/ })); dlg = await screen.findByRole('dialog');
    fireEvent.change(within(dlg).getByLabelText('To'), { target: { value: 'later@fresh.io' } }); fireEvent.click(within(dlg).getByLabelText('Send later')); fireEvent.click(within(dlg).getByRole('button', { name: 'Schedule send' }));
    await waitFor(async () => expect((await a.load()).drafts.some(d => d.to === 'later@fresh.io' && !!d.scheduledAt)).toBe(true));
    await folder(/^Scheduled/); expect(await screen.findByText('later@fresh.io')).toBeInTheDocument();
  });
  it('rejects scheduling in the past', async () => {
    setup(); await screen.findByTestId('inbox'); fireEvent.click(rail().getByRole('button', { name: /Compose/ })); const dlg = await screen.findByRole('dialog');
    fireEvent.change(within(dlg).getByLabelText('To'), { target: { value: 'x@y.io' } }); fireEvent.click(within(dlg).getByLabelText('Send later'));
    fireEvent.change(within(dlg).getByLabelText('Send at'), { target: { value: '2020-01-01T10:00' } }); expect(within(dlg).getByText('Pick a time in the future')).toBeInTheDocument(); expect(within(dlg).getByRole('button', { name: 'Schedule send' })).toBeDisabled();
  });
  it('opens a saved draft and discards it', async () => {
    const a = setup(); await screen.findByTestId('inbox'); await folder(/^Drafts/); fireEvent.click(await screen.findByText('Introduction from Acme'));
    const dlg = await screen.findByRole('dialog'); fireEvent.click(within(dlg).getByRole('button', { name: 'Discard' }));
    await waitFor(async () => expect((await a.load()).drafts.some(d => d.id === 'dr_seed_1')).toBe(false));
  });
  it('keyboard: j selects next, e archives, / focuses search', async () => {
    const a = setup(); await screen.findByTestId('inbox'); const list = listThreads(await a.load(), 'inbox', now());
    fireEvent.keyDown(window, { key: 'j' }); await waitFor(() => expect(document.querySelector('.wb-ib-item.on')).toBeTruthy());
    fireEvent.keyDown(window, { key: 'e' }); await waitFor(async () => expect(listThreads(await a.load(), 'inbox', now()).length).toBe(list.length - 1));
    fireEvent.keyDown(window, { key: '/' }); expect(document.activeElement).toBe(screen.getByLabelText('Search inbox'));
  });
  it('assigns a teammate and adds a tag', async () => {
    const a = setup(); await screen.findByTestId('inbox'); fireEvent.click(rows()[0]); fireEvent.click(await screen.findByRole('button', { name: 'Assign' })); fireEvent.click(await screen.findByRole('menuitemradio', { name: /Marcus Lee/ }));
    const id = listThreads(await a.load(), 'inbox', now())[0].id; await waitFor(async () => expect((await a.load()).threads.find(t => t.id === id)!.assigneeId).toBe('u_3'));
    fireEvent.click(screen.getByRole('button', { name: 'Labels and tags' })); const tag = await screen.findByLabelText('Add tag'); fireEvent.change(tag, { target: { value: 'priority' } }); fireEvent.keyDown(tag, { key: 'Enter' });
    await waitFor(async () => expect((await a.load()).threads.find(t => t.id === id)!.tags).toContain('priority'));
  });
  it('creates a label from the rail', async () => {
    const a = setup(); await screen.findByTestId('inbox'); fireEvent.click(screen.getByRole('button', { name: 'Add label' })); const n = screen.getByLabelText('New label name'); fireEvent.change(n, { target: { value: 'Partner' } }); fireEvent.keyDown(n, { key: 'Enter' });
    await waitFor(async () => expect((await a.load()).labels.some(l => l.name === 'Partner')).toBe(true));
  });
  it('sort toggles oldest first', async () => {
    setup(); await screen.findByTestId('inbox'); await folder(/^All mail/); const first = rows()[0].textContent; fireEvent.click(screen.getByRole('button', { name: /Sort: newest first/ }));
    await waitFor(() => expect(rows()[0].textContent).not.toBe(first));
  });
});
