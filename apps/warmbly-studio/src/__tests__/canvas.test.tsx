// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor, cleanup, act } from '@testing-library/react';
import { WarmblyStudio, createLocalAdapter, buildSeed } from '../index';
import { reduce } from '../api/reducer';
import { runPending, fireAutomations } from '../api/engine';
import { insertAt, newAction, newDelay, newCondition, newTrigger } from '../domain/flow';
import type { Automation } from '../types';

afterEach(cleanup);
const setup = (view: string) => { const adapter = createLocalAdapter({ persist: false, seed: () => buildSeed(new Date()) }); render(<WarmblyStudio adapter={adapter} initialView={view as never} />); return adapter; };
const ready = () => screen.findByLabelText('Warmbly navigation');

describe('campaign steps canvas', () => {
  const open = async () => { const a = setup('campaigns'); await ready(); fireEvent.click(await screen.findByText('Founders outreach Q4')); fireEvent.click(await screen.findByRole('tab', { name: 'Steps' })); return a; };
  it('renders start, emails and delay pills from the sequence', async () => {
    await open(); const cv = await screen.findByTestId('flow-canvas');
    expect(within(cv).getByText('Contact enters the campaign')).toBeInTheDocument(); expect(within(cv).getByText('Intro')).toBeInTheDocument();
    expect(within(cv).getByText('Follow-up 1')).toBeInTheDocument(); expect(within(cv).getByText('3 days')).toBeInTheDocument();
  });
  it('selecting a step edits it in the inspector and autosaves', async () => {
    const a = await open(); fireEvent.click(await screen.findByRole('button', { name: /Intro/ }));
    const subj = await screen.findByLabelText('Step 1 subject'); fireEvent.change(subj, { target: { value: 'New subject' } });
    await waitFor(async () => expect((await a.load()).campaigns.find(c => c.id === 'camp_1')!.steps[0].subject).toBe('New subject'), { timeout: 2000 });
    expect(await screen.findByText('✓ Saved')).toBeInTheDocument();
  });
  it('adds a step with + and supports undo/redo', async () => {
    const a = await open(); const before = (await a.load()).campaigns.find(c => c.id === 'camp_1')!.steps.length;
    fireEvent.click(screen.getAllByRole('button', { name: 'Add step' }).at(-1)!); fireEvent.click(await screen.findByRole('menuitem', { name: 'Create a task' }));
    await waitFor(async () => expect((await a.load()).campaigns.find(c => c.id === 'camp_1')!.steps.length).toBe(before + 1), { timeout: 2000 });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(async () => expect((await a.load()).campaigns.find(c => c.id === 'camp_1')!.steps.length).toBe(before), { timeout: 2000 });
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    await waitFor(async () => expect((await a.load()).campaigns.find(c => c.id === 'camp_1')!.steps.length).toBe(before + 1), { timeout: 2000 });
  });
  it('deletes a step from the inspector', async () => {
    const a = await open(); const before = (await a.load()).campaigns.find(c => c.id === 'camp_1')!.steps.length;
    fireEvent.click(await screen.findByRole('button', { name: /Follow-up 2/ })); fireEvent.click(await screen.findByRole('button', { name: 'Delete step' }));
    await waitFor(async () => expect((await a.load()).campaigns.find(c => c.id === 'camp_1')!.steps.length).toBe(before - 1), { timeout: 2000 });
  });
  it('zoom controls change the zoom level', async () => {
    await open(); const lvl = () => screen.getByLabelText('Zoom level').textContent; const start = lvl();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' })); expect(lvl()).not.toBe(start);
  });
  it('stop-on-reply switch persists', async () => {
    const a = await open(); fireEvent.click(screen.getByRole('switch'));
    await waitFor(async () => expect((await a.load()).campaigns.find(c => c.id === 'camp_1')!.stopOnReply).toBe(false), { timeout: 2000 });
  });
  it('schedule and settings tabs save', async () => {
    const a = await open(); fireEvent.click(screen.getByRole('tab', { name: 'Schedule' })); fireEvent.change(screen.getByLabelText('Max emails per day'), { target: { value: '12' } });
    await waitFor(async () => expect((await a.load()).campaigns.find(c => c.id === 'camp_1')!.dailyCap).toBe(12), { timeout: 2000 });
    fireEvent.click(screen.getByRole('tab', { name: 'Settings' })); fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Renamed' } });
    await waitFor(async () => expect((await a.load()).campaigns.find(c => c.id === 'camp_1')!.name).toBe('Renamed'), { timeout: 2000 });
  });
});

describe('automation canvas editor', () => {
  const openFirst = async () => { const a = setup('automations'); await ready(); fireEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]); await screen.findByLabelText('Automation name'); return a; };
  it('shows the branch with Yes/No labels', async () => {
    await openFirst(); const cv = screen.getByTestId('flow-canvas'); expect(within(cv).getByText('Yes')).toBeInTheDocument(); expect(within(cv).getByText('No')).toBeInTheDocument();
    expect(within(cv).getByText('A reply is received')).toBeInTheDocument();
  });
  it('adds an action on the No branch and edits its value', async () => {
    const a = await openFirst(); const plusses = screen.getAllByRole('button', { name: 'Add step' });
    fireEvent.click(plusses.at(-1)!); fireEvent.click(await screen.findByRole('menuitem', { name: 'Add tag to contact' }));
    fireEvent.change(await screen.findByLabelText('Action value'), { target: { value: 'cold' } });
    await waitFor(async () => { const au = (await a.load()).automations[0]; expect(JSON.stringify(au.flow)).toContain('"value":"cold"'); }, { timeout: 2000 });
  });
  it('blocks activating an invalid automation', async () => {
    const a = setup('automations'); await ready(); fireEvent.click(await screen.findByText('+ New automation'));
    await screen.findByLabelText('Automation name');
    fireEvent.click(screen.getByRole('button', { name: 'Label the thread' })); fireEvent.change(await screen.findByLabelText('Action value'), { target: { value: '' } });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Active' }));
    expect(((await a.load()).automations.at(-1)!).enabled).toBe(false);
  });
  it('test panel highlights the taken path and lists actions', async () => {
    await openFirst(); fireEvent.click(screen.getByRole('button', { name: /Test/ }));
    fireEvent.change(screen.getByLabelText('Sample reply'), { target: { value: 'Sounds good, send me more details' } }); fireEvent.click(screen.getByRole('button', { name: 'Run test' }));
    const res = await screen.findByRole('status', { name: '' }).catch(() => null); void res;
    expect(await screen.findByText('Create a deal (6000)')).toBeInTheDocument();
    expect(document.querySelectorAll('.wb-cn.hot').length).toBeGreaterThan(2);
  });
  it('history restores an earlier version', async () => {
    const a = await openFirst(); fireEvent.change(screen.getByLabelText('Automation name'), { target: { value: 'Changed' } });
    fireEvent.click(screen.getByRole('button', { name: /History/ })); fireEvent.click(await screen.findByRole('menuitem', { name: /Opened/ }));
    await waitFor(async () => expect((await a.load()).automations[0].name).not.toBe('Changed'), { timeout: 2000 });
  });
});

describe('automation engine: delays and branches', () => {
  const base = () => buildSeed(new Date('2026-03-12T12:00:00'), 7, 7);
  it('queues post-delay actions and runs them when due', () => {
    let ws = base(); const th = ws.threads.find(t => t.messages.some(m => m.direction === 'in'))!;
    let flow = newTrigger(); flow = insertAt(flow, flow.id, 'next', { ...newAction('tag', 'now'), id: 'a1' }); flow = insertAt(flow, 'a1', 'next', { ...newDelay(60), id: 'd1' }); flow = insertAt(flow, 'd1', 'next', { ...newAction('tag', 'later'), id: 'a2' });
    const au: Automation = { id: 'x', name: 'x', enabled: true, trigger: 'reply-received', flow, runs: 0, createdAt: '' };
    ws = { ...ws, automations: [au] }; const now = new Date('2026-03-12T12:00:00');
    ws = fireAutomations(ws, { trigger: 'reply-received', contactId: th.contactId, threadId: th.id }, now);
    const tags = () => ws.contacts.find(c => c.id === th.contactId)!.tags;
    expect(tags()).toContain('now'); expect(tags()).not.toContain('later'); expect(ws.pending).toHaveLength(1);
    ws = runPending(ws, new Date(now.getTime() + 30 * 60_000)); expect(tags()).not.toContain('later');
    ws = runPending(ws, new Date(now.getTime() + 61 * 60_000)); expect(tags()).toContain('later'); expect(ws.pending).toHaveLength(0);
  });
  it('takes only the matching branch', () => {
    let ws = base(); const th = ws.threads.find(t => t.messages.some(m => m.direction === 'in'))!; const c = ws.contacts.find(x => x.id === th.contactId)!;
    const cond = newCondition(); cond.id = 'c'; cond.conditions = [{ field: 'company', op: 'equals', value: c.company }];
    let flow = newTrigger(); flow = insertAt(flow, flow.id, 'next', cond); flow = insertAt(flow, 'c', 'yes', newAction('tag', 'yes-tag')); flow = insertAt(flow, 'c', 'no', newAction('tag', 'no-tag'));
    ws = { ...ws, automations: [{ id: 'y', name: 'y', enabled: true, trigger: 'reply-received', flow, runs: 0, createdAt: '' }] };
    ws = fireAutomations(ws, { trigger: 'reply-received', contactId: c.id, threadId: th.id }, new Date());
    const tags = ws.contacts.find(x => x.id === c.id)!.tags; expect(tags).toContain('yes-tag'); expect(tags).not.toContain('no-tag');
  });
  it('migrates a persisted legacy workspace', async () => {
    const legacy = base() as never as { automations: unknown[]; pending?: unknown };
    legacy.automations = [{ id: 'old', name: 'Old', enabled: true, trigger: 'reply-received', conditions: [], actions: [{ id: 'z', kind: 'tag', value: 'legacy' }], runs: 0, createdAt: '' }]; delete legacy.pending;
    localStorage.setItem('wb-legacy', JSON.stringify(legacy));
    const a = createLocalAdapter({ storageKey: 'wb-legacy' }); const ws = await a.load();
    expect(ws.pending).toEqual([]); expect(ws.automations[0].flow.next!.action).toBe('tag'); void reduce; void act;
  });
});
