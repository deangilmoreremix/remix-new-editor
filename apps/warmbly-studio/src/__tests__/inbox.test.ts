import { describe, it, expect } from 'vitest';
import { buildSeed } from '../api/seed';
import { reduce } from '../api/reducer';
import { runScheduled } from '../api/engine';
import { FOLDERS, folderCounts, groupByDay, inFolder, labelCounts, listDrafts, listThreads, previewOf, relativeTime, snoozeOptions, tagCounts } from '../domain/inbox';

const NOW = new Date('2026-03-12T12:00:00');
const ws0 = () => buildSeed(NOW, 7, 7);

describe('inbox folders', () => {
  const ws = ws0();
  it('every folder is populated in the seed', () => {
    const c = folderCounts(ws, NOW);
    for (const f of FOLDERS) expect(c[f.id], f.id).toBeGreaterThan(0);
  });
  it('inbox excludes archived, snoozed, spam and trash; unread is a subset of inbox', () => {
    const inbox = listThreads(ws, 'inbox', NOW); const ids = new Set(inbox.map(t => t.id));
    for (const t of ws.threads) { if (t.archived || t.spam || t.trashed || (t.snoozedUntil && t.snoozedUntil > NOW.toISOString())) expect(ids.has(t.id)).toBe(false); }
    for (const t of listThreads(ws, 'unread', NOW)) { expect(ids.has(t.id)).toBe(true); expect(t.unread).toBe(true); }
  });
  it('awaiting reply = we sent last after they wrote', () => {
    for (const t of listThreads(ws, 'awaiting', NOW)) { expect(t.messages.at(-1)!.direction).toBe('out'); expect(t.messages.some(m => m.direction === 'in')).toBe(true); }
  });
  it('snoozed threads return to the inbox once the snooze passes', () => {
    const t = ws.threads.find(x => x.snoozedUntil)!; expect(inFolder(t, 'snoozed', NOW)).toBe(true); expect(inFolder(t, 'inbox', NOW)).toBe(false);
    const later = new Date(NOW.getTime() + 48 * 3_600_000); expect(inFolder(t, 'snoozed', later)).toBe(false); expect(inFolder(t, 'inbox', later)).toBe(true);
  });
  it('filters by mailbox, label, tag and query', () => {
    const lead = ws.labels.find(l => l.name === 'Lead')!;
    const leads = listThreads(ws, 'all', NOW, { labelId: lead.id }); expect(leads.length).toBeGreaterThan(0); expect(leads.every(t => t.labelIds!.includes(lead.id))).toBe(true);
    expect(listThreads(ws, 'all', NOW, { tag: 'vip' }).length).toBe(1);
    const one = ws.mailboxes[0].id; expect(listThreads(ws, 'all', NOW, { mailboxIds: [one] }).every(t => t.mailboxId === one)).toBe(true);
    expect(listThreads(ws, 'all', NOW, { query: 'benchmarks' }).length).toBe(1); expect(listThreads(ws, 'all', NOW, { query: 'zzzzqqq' })).toEqual([]);
  });
  it('sorts and groups', () => {
    const l = listThreads(ws, 'all', NOW); expect(l[0].updatedAt >= l.at(-1)!.updatedAt).toBe(true);
    expect(listThreads(ws, 'all', NOW, {}, 'oldest')[0].updatedAt <= l[0].updatedAt).toBe(true);
    const g = groupByDay(l, NOW); expect(g.map(x => x.title)).toEqual([...new Set(g.map(x => x.title))]);
  });
  it('label and tag counts', () => { expect(Object.keys(labelCounts(ws, NOW)).length).toBeGreaterThan(1); expect(tagCounts(ws, NOW).some(([t]) => t === 'vip')).toBe(true); });
  it('helpers', () => { expect(relativeTime(new Date(NOW.getTime() - 10 * 3_600_000).toISOString(), NOW)).toBe('10h'); expect(relativeTime(new Date(NOW.getTime() - 26 * 3_600_000).toISOString(), NOW)).toBe('1d');
    expect(previewOf({ messages: [{ body: 'x'.repeat(200) }] } as never, 20).length).toBe(20); const o = snoozeOptions(NOW); expect(o.every(x => x.until > NOW.toISOString())).toBe(true); });
  it('drafts vs scheduled', () => { expect(listDrafts(ws, false, NOW).length).toBe(1); expect(listDrafts(ws, true, NOW).length).toBe(1); });
});

describe('inbox actions', () => {
  it('moves threads between folders', () => {
    let ws = ws0(); const t = listThreads(ws, 'inbox', NOW)[0];
    ws = reduce(ws, { type: 'thread/bulk', ids: [t.id], patch: { archived: true } }, NOW); expect(inFolder(ws.threads.find(x => x.id === t.id)!, 'archive', NOW)).toBe(true);
    ws = reduce(ws, { type: 'thread/bulk', ids: [t.id], patch: { archived: false, trashed: true } }, NOW); expect(inFolder(ws.threads.find(x => x.id === t.id)!, 'trash', NOW)).toBe(true);
    ws = reduce(ws, { type: 'thread/purge', ids: [t.id] }, NOW); expect(ws.threads.some(x => x.id === t.id)).toBe(false);
  });
  it('purge only removes trashed threads', () => { const ws = ws0(); const t = listThreads(ws, 'inbox', NOW)[0]; expect(reduce(ws, { type: 'thread/purge', ids: [t.id] }, NOW).threads.some(x => x.id === t.id)).toBe(true); });
  it('snoozes, labels and tags in bulk', () => {
    let ws = ws0(); const ids = listThreads(ws, 'inbox', NOW).slice(0, 2).map(t => t.id);
    ws = reduce(ws, { type: 'thread/bulk', ids, patch: { snoozedUntil: new Date(NOW.getTime() + 3_600_000).toISOString() } }, NOW); expect(ws.threads.filter(t => ids.includes(t.id)).every(t => inFolder(t, 'snoozed', NOW))).toBe(true);
    ws = reduce(ws, { type: 'thread/labels', ids, labelId: 'lbl_customer' }, NOW); expect(ws.threads.filter(t => ids.includes(t.id)).every(t => t.labelIds!.includes('lbl_customer'))).toBe(true);
    ws = reduce(ws, { type: 'thread/labels', ids, labelId: 'lbl_customer', remove: true }, NOW); expect(ws.threads.filter(t => ids.includes(t.id)).every(t => !t.labelIds!.includes('lbl_customer'))).toBe(true);
    ws = reduce(ws, { type: 'thread/tags', ids, tag: 'q1' }, NOW); expect(ws.threads.find(t => t.id === ids[0])!.tags).toContain('q1');
  });
  it('removing a label strips it from threads', () => { const ws = reduce(ws0(), { type: 'label/remove', id: 'lbl_lead' }, NOW); expect(ws.labels.some(l => l.id === 'lbl_lead')).toBe(false); expect(ws.threads.some(t => t.labelIds?.includes('lbl_lead'))).toBe(false); });
  it('composes to a new address: creates contact + thread in Sent', () => {
    let ws = ws0(); const nc = ws.contacts.length;
    ws = reduce(ws, { type: 'draft/send', draft: { id: '', kind: 'compose', mailboxId: ws.mailboxes[0].id, to: 'Jane.Doe@newco.io', subject: 'Hello', body: 'Hi Jane', createdAt: '' } }, NOW);
    expect(ws.contacts.length).toBe(nc + 1); const c = ws.contacts.at(-1)!; expect(c.email).toBe('jane.doe@newco.io'); expect(c.firstName).toBe('Jane'); expect(c.lastName).toBe('Doe');
    const t = ws.threads.find(x => x.contactId === c.id)!; expect(inFolder(t, 'sent', NOW)).toBe(true); expect(t.messages[0].subject).toBe('Hello');
  });
  it('compose to an existing contact reuses it; reply draft appends to the thread', () => {
    let ws = ws0(); const t = listThreads(ws, 'inbox', NOW)[0]; const c = ws.contacts.find(x => x.id === t.contactId)!; const nc = ws.contacts.length; const len = t.messages.length;
    ws = reduce(ws, { type: 'draft/send', draft: { id: '', kind: 'reply', mailboxId: t.mailboxId, to: c.email, subject: `Re: ${t.subject}`, body: 'Thanks!', threadId: t.id, createdAt: '' } }, NOW);
    expect(ws.contacts.length).toBe(nc); expect(ws.threads.find(x => x.id === t.id)!.messages.length).toBe(len + 1); expect(inFolder(ws.threads.find(x => x.id === t.id)!, 'awaiting', NOW)).toBe(true);
  });
  it('scheduled drafts stay scheduled, then send when due and leave Scheduled', () => {
    let ws = ws0(); const at = new Date(NOW.getTime() + 2 * 3_600_000).toISOString();
    ws = reduce(ws, { type: 'draft/send', draft: { id: '', kind: 'compose', mailboxId: ws.mailboxes[0].id, to: 'later@x.io', subject: 'S', body: 'B', scheduledAt: at, createdAt: '' } }, NOW);
    expect(listDrafts(ws, true, NOW).some(d => d.to === 'later@x.io')).toBe(true); expect(ws.threads.some(t => t.messages.some(m => m.to === 'later@x.io'))).toBe(false);
    ws = runScheduled(ws, new Date(NOW.getTime() + 3 * 3_600_000)); expect(listDrafts(ws, true, NOW).some(d => d.to === 'later@x.io')).toBe(false); expect(ws.threads.some(t => t.messages.some(m => m.to === 'later@x.io'))).toBe(true);
  });
  it('saves and deletes drafts', () => {
    let ws = ws0(); ws = reduce(ws, { type: 'draft/save', draft: { id: '', kind: 'compose', mailboxId: ws.mailboxes[0].id, to: 'd@x.io', subject: 's', body: 'b', createdAt: NOW.toISOString() } }, NOW);
    const d = ws.drafts.find(x => x.to === 'd@x.io')!; expect(d.id).toBeTruthy(); ws = reduce(ws, { type: 'draft/delete', id: d.id }, NOW); expect(ws.drafts.some(x => x.id === d.id)).toBe(false);
  });
});
