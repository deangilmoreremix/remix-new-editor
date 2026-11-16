import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { WarmblyStudio, VIEWS, createLocalAdapter, buildSeed } from '../index';

afterEach(cleanup);
const setup = (view: string = 'dashboard') => {
  const adapter = createLocalAdapter({ persist: false, seed: () => buildSeed(new Date()) });
  render(<WarmblyStudio adapter={adapter} initialView={view as never} />);
  return adapter;
};
const go = async (label: string) => { fireEvent.click(await screen.findByRole('button', { name: new RegExp(label, 'i') })); };
const ready = () => screen.findByLabelText('Warmbly navigation');

describe('studio shell', () => {
  it('renders every view without crashing', async () => {
    setup(); await ready();
    for (const v of VIEWS) { await go(v.label); expect(await screen.findByRole('heading', { level: 1, name: v.label })).toBeInTheDocument(); }
  });
  it('dashboard shows stats and can simulate days', async () => {
    const a = setup(); await ready();
    const before = (await a.load()).events.length;
    fireEvent.click(await screen.findByText('Simulate +1 day'));
    await waitFor(async () => expect((await a.load()).events.length).toBeGreaterThan(before));
  });
});

describe('mailboxes', () => {
  it('connects a mailbox with validation and toggles warmup', async () => {
    const a = setup('mailboxes'); await ready();
    fireEvent.click(await screen.findByText('+ Connect mailbox'));
    const dlg = await screen.findByRole('dialog');
    const connect = within(dlg).getByRole('button', { name: 'Connect' }); expect(connect).toBeDisabled();
    fireEvent.change(within(dlg).getByLabelText('Email address'), { target: { value: 'new@brand.io' } }); expect(connect).toBeEnabled();
    fireEvent.click(connect);
    await waitFor(async () => expect((await a.load()).mailboxes.some(m => m.email === 'new@brand.io')).toBe(true));
    const row = (await screen.findByText('new@brand.io')).closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Start warmup' }));
    await waitFor(async () => expect((await a.load()).mailboxes.find(m => m.email === 'new@brand.io')!.warmup.enabled).toBe(true));
  });
  it('rejects duplicate mailbox', async () => {
    setup('mailboxes'); await ready(); fireEvent.click(await screen.findByText('+ Connect mailbox'));
    const dlg = await screen.findByRole('dialog'); fireEvent.change(within(dlg).getByLabelText('Email address'), { target: { value: 'alex@getacme.io' } });
    expect(within(dlg).getByRole('button', { name: 'Connect' })).toBeDisabled(); expect(within(dlg).getByText('Already connected')).toBeInTheDocument();
  });
});

describe('campaigns', () => {
  it('launches a valid draft and blocks an invalid one', async () => {
    const a = setup('campaigns'); await ready();
    const row = (await screen.findByText('Event follow-up (draft)')).closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Launch' }));
    await waitFor(async () => expect((await a.load()).campaigns.find(c => c.id === 'camp_3')!.status).toBe('active'));
  });
  it('builds a new campaign through the builder', async () => {
    const a = setup('campaigns'); await ready();
    fireEvent.click(await screen.findByText('+ New campaign'));
    const dlg = await screen.findByRole('dialog');
    const launch = within(dlg).getByRole('button', { name: 'Save & launch' }); expect(launch).toBeDisabled();
    fireEvent.change(within(dlg).getByLabelText('Campaign name'), { target: { value: 'My test run' } });
    fireEvent.change(within(dlg).getByLabelText('Step 1 subject'), { target: { value: 'Hello {{firstName}}' } });
    fireEvent.change(within(dlg).getByLabelText('Step 1 body'), { target: { value: 'Hi {{firstName | there}}, quick note about {{company}}.' } });
    fireEvent.click(within(dlg).getByRole('tab', { name: 'Audience & mailboxes' }));
    fireEvent.click(within(dlg).getByLabelText(/alex@getacme.io/)); fireEvent.click(within(dlg).getByText('Select all eligible'));
    expect(launch).toBeEnabled();
    fireEvent.click(within(dlg).getByRole('tab', { name: 'Preview' })); expect(await within(dlg).findByText(/Spam check/)).toBeInTheDocument();
    fireEvent.click(launch);
    await waitFor(async () => { const c = (await a.load()).campaigns.find(x => x.name === 'My test run'); expect(c?.status).toBe('active'); expect(c?.contactIds.length).toBeGreaterThan(10); });
  });
  it('shows campaign detail', async () => {
    setup('campaigns'); await ready(); fireEvent.click(await screen.findByText('Founders outreach Q4'));
    expect(await screen.findByRole('tab', { name: 'Sequence' })).toBeInTheDocument(); fireEvent.click(screen.getByRole('tab', { name: 'Contacts' }));
    expect((await screen.findAllByText(/@/)).length).toBeGreaterThan(5);
  });
});

describe('inbox', () => {
  it('opens a thread, marks read, drafts and sends a reply', async () => {
    const a = setup('inbox'); await ready();
    const ws = await a.load(); const unread = ws.threads.find(t => t.unread && t.messages.some(m => m.direction === 'in'))!;
    const c = ws.contacts.find(x => x.id === unread.contactId)!;
    fireEvent.click((await screen.findAllByText(new RegExp(`${c.firstName} ${c.lastName}`)))[0]);
    await waitFor(async () => expect((await a.load()).threads.find(t => t.id === unread.id)!.unread).toBe(false));
    fireEvent.click(screen.getByText('✨ AI draft')); expect((screen.getByLabelText('Reply') as HTMLTextAreaElement).value).toContain(`Hi ${c.firstName}`);
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));
    await waitFor(async () => expect((await a.load()).threads.find(t => t.id === unread.id)!.messages.at(-1)!.direction).toBe('out'));
  });
  it('filters by search', async () => {
    setup('inbox'); await ready(); fireEvent.change(await screen.findByLabelText('Search inbox'), { target: { value: 'zzz-no-match' } });
    expect(await screen.findByText('No conversations match.')).toBeInTheDocument();
  });
});

describe('contacts', () => {
  it('imports CSV, skipping duplicates and invalid rows', async () => {
    const a = setup('contacts'); await ready(); const before = (await a.load()).contacts.length;
    fireEvent.click(await screen.findByText('Import CSV')); const dlg = await screen.findByRole('dialog');
    fireEvent.change(within(dlg).getByLabelText('CSV text'), { target: { value: 'email,firstName,company\nnew1@x.com,Ann,X\nnew1@x.com,Dup,X\nnot-an-email,Bad,X\nnew2@x.com,Bo,Y' } });
    expect(within(dlg).getByText(/skipped/)).toBeInTheDocument(); fireEvent.click(within(dlg).getByRole('button', { name: 'Import 2' }));
    await waitFor(async () => expect((await a.load()).contacts.length).toBe(before + 2));
  });
  it('searches and bulk-tags', async () => {
    const a = setup('contacts'); await ready(); fireEvent.change(await screen.findByLabelText('Search contacts'), { target: { value: 'northwind' } });
    fireEvent.click(await screen.findByLabelText('Select all'));
    expect(await screen.findByText(/selected/)).toBeInTheDocument(); expect((await a.load()).contacts.length).toBeGreaterThan(0);
  });
});

describe('pipeline', () => {
  it('moves a deal between stages', async () => {
    const a = setup('pipeline'); await ready();
    fireEvent.change(await screen.findByLabelText('Move Fathom starter'), { target: { value: 'st_3' } });
    await waitFor(async () => expect((await a.load()).deals.find(d => d.id === 'd_4')!.stageId).toBe('st_3'));
  });
  it('adds and completes a task', async () => {
    const a = setup('pipeline'); await ready(); fireEvent.click(await screen.findByRole('tab', { name: 'Tasks' }));
    fireEvent.change(screen.getByLabelText('New task'), { target: { value: 'Call Sam' } }); fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(async () => expect((await a.load()).tasks.some(t => t.title === 'Call Sam')).toBe(true));
    fireEvent.click(await screen.findByLabelText('Complete Call Sam')); await waitFor(async () => expect((await a.load()).tasks.find(t => t.title === 'Call Sam')!.done).toBe(true));
  });
});

describe('automations', () => {
  it('toggles and creates a playbook', async () => {
    const a = setup('automations'); await ready();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Disable' }))[0]);
    await waitFor(async () => expect((await a.load()).automations.filter(x => !x.enabled).length).toBe(1));
    fireEvent.click(screen.getByText('+ New playbook')); const dlg = await screen.findByRole('dialog');
    fireEvent.change(within(dlg).getByLabelText('Name'), { target: { value: 'Tag bounced' } }); fireEvent.click(within(dlg).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await a.load()).automations.some(x => x.name === 'Tag bounced')).toBe(true));
  });
});

describe('integrations & settings', () => {
  it('connects an app, validates webhook URL, reveals API key once', async () => {
    const a = setup('integrations'); await ready();
    const card = (await screen.findAllByText('Zapier'))[0].closest('.wb-card')!; fireEvent.click(within(card as HTMLElement).getByRole('button', { name: 'Connect' }));
    await waitFor(async () => expect((await a.load()).integrations.find(i => i.id === 'zapier')!.connected).toBe(true));
    fireEvent.click(screen.getByText('+ Webhook')); let dlg = await screen.findByRole('dialog');
    fireEvent.change(within(dlg).getByLabelText('Endpoint URL'), { target: { value: 'nope' } }); expect(within(dlg).getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.change(within(dlg).getByLabelText('Endpoint URL'), { target: { value: 'https://x.io/h' } }); fireEvent.click(within(dlg).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await a.load()).webhooks.length).toBe(2));
    fireEvent.click(screen.getByText('+ API key')); dlg = await screen.findByRole('dialog'); fireEvent.change(within(dlg).getByLabelText('Name'), { target: { value: 'CI' } }); fireEvent.click(within(dlg).getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Copy your API key')).toBeInTheDocument();
  });
  it('invites a teammate and resets the demo', async () => {
    const a = setup('settings'); await ready(); fireEvent.click(await screen.findByRole('tab', { name: 'Team' }));
    fireEvent.change(screen.getByLabelText('Invite email'), { target: { value: 'new@acme.com' } }); fireEvent.click(screen.getByRole('button', { name: 'Invite' }));
    await waitFor(async () => expect((await a.load()).team.some(m => m.email === 'new@acme.com')).toBe(true));
  });
});
