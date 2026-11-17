import type * as T from '../types';
import type { Action } from './actions';
import { dedupeContacts } from '../domain/campaign';
import { addSuppression } from '../domain/deliverability';
import { mailboxHealth, warmupVolume } from '../domain/warmup';
import { fireAutomations, rollDay, sendDraft, tick, uid } from './engine';

const nowISO = () => new Date().toISOString();
const upsert = <X extends { id: string }>(list: X[], item: X) => list.some(x => x.id === item.id) ? list.map(x => x.id === item.id ? item : x) : [...list, item];

export function reduce(ws: T.Workspace, a: Action, now: Date = new Date()): T.Workspace {
  switch (a.type) {
    case 'mailbox/add': {
      const m: T.Mailbox = { id: uid('mb'), email: a.email.trim().toLowerCase(), name: a.name, provider: a.provider, status: 'connected', dailyLimit: a.dailyLimit ?? 40, sentToday: 0, minGapMinutes: 5,
        warmup: { enabled: false, day: 0, target: 40, sentToday: 0, replyRate: 0 }, health: 50, spf: false, dkim: false, dmarc: false, createdAt: nowISO() };
      if (ws.mailboxes.some(x => x.email === m.email)) return ws;
      return { ...ws, mailboxes: [...ws.mailboxes, { ...m, health: mailboxHealth(m) }] };
    }
    case 'mailbox/update': return { ...ws, mailboxes: ws.mailboxes.map(m => m.id === a.id ? { ...m, ...a.patch } : m) };
    case 'mailbox/remove': return { ...ws, mailboxes: ws.mailboxes.filter(m => m.id !== a.id), campaigns: ws.campaigns.map(c => ({ ...c, mailboxIds: c.mailboxIds.filter(id => id !== a.id) })) };
    case 'mailbox/warmup': return { ...ws, mailboxes: ws.mailboxes.map(m => {
      if (m.id !== a.id) return m;
      const target = a.target ?? m.warmup.target;
      const day = a.enabled ? Math.max(1, m.warmup.day) : m.warmup.day;
      const warmup = { ...m.warmup, enabled: a.enabled, target, day, startedAt: m.warmup.startedAt ?? (a.enabled ? now.toISOString() : undefined), sentToday: a.enabled ? warmupVolume(day, target) : 0 };
      return { ...m, warmup, status: a.enabled ? 'warming' : (m.status === 'warming' ? 'connected' : m.status), health: mailboxHealth({ ...m, warmup }) };
    }) };
    case 'mailbox/verifyDns': return { ...ws, mailboxes: ws.mailboxes.map(m => m.id === a.id ? (() => { const v = { ...m, spf: true, dkim: true, dmarc: true }; return { ...v, health: mailboxHealth(v) }; })() : m) };
    case 'contact/import': {
      const { added } = dedupeContacts(ws.contacts, a.rows);
      return { ...ws, contacts: [...ws.contacts, ...added.map(c => ({ ...c, id: uid('c'), createdAt: nowISO() }))] };
    }
    case 'contact/update': return { ...ws, contacts: ws.contacts.map(c => c.id === a.id ? { ...c, ...a.patch } : c) };
    case 'contact/remove': return { ...ws, contacts: ws.contacts.filter(c => !a.ids.includes(c.id)), campaigns: ws.campaigns.map(c => ({ ...c, contactIds: c.contactIds.filter(id => !a.ids.includes(id)) })) };
    case 'contact/tag': return { ...ws, contacts: ws.contacts.map(c => !a.ids.includes(c.id) ? c : { ...c, tags: a.remove ? c.tags.filter(t => t !== a.tag) : c.tags.includes(a.tag) ? c.tags : [...c.tags, a.tag] }) };
    case 'campaign/save': return { ...ws, campaigns: upsert(ws.campaigns, a.campaign.id ? a.campaign : { ...a.campaign, id: uid('camp') }) };
    case 'campaign/status': return { ...ws, campaigns: ws.campaigns.map(c => c.id === a.id ? { ...c, status: a.status } : c) };
    case 'campaign/remove': return { ...ws, campaigns: ws.campaigns.filter(c => c.id !== a.id), events: ws.events.filter(e => e.campaignId !== a.id) };
    case 'campaign/duplicate': {
      const c = ws.campaigns.find(x => x.id === a.id); if (!c) return ws;
      return { ...ws, campaigns: [...ws.campaigns, { ...c, id: uid('camp'), name: `${c.name} (copy)`, status: 'draft', createdAt: nowISO(), steps: c.steps.map(s => ({ ...s, id: uid('st') })) }] };
    }
    case 'thread/update': return { ...ws, threads: ws.threads.map(t => t.id === a.id ? { ...t, ...a.patch } : t) };
    case 'thread/reply': {
      const t = ws.threads.find(x => x.id === a.id); if (!t || !a.body.trim()) return ws;
      const mb = ws.mailboxes.find(m => m.id === t.mailboxId); const c = ws.contacts.find(x => x.id === t.contactId);
      const msg: T.Message = { id: uid('msg'), threadId: t.id, direction: 'out', from: mb?.email ?? '', to: c?.email ?? '', subject: `Re: ${t.subject.replace(/^Re:\s*/i, '')}`, body: a.body, at: now.toISOString() };
      return { ...ws, threads: ws.threads.map(x => x.id === t.id ? { ...x, messages: [...x.messages, msg], unread: false, draft: undefined, updatedAt: msg.at } : x) };
    }
    case 'thread/bulk': return { ...ws, threads: ws.threads.map(t => a.ids.includes(t.id) ? { ...t, ...a.patch } : t) };
    case 'thread/labels': return { ...ws, threads: ws.threads.map(t => !a.ids.includes(t.id) ? t : { ...t, labelIds: a.remove ? (t.labelIds ?? []).filter(l => l !== a.labelId) : (t.labelIds ?? []).includes(a.labelId) ? t.labelIds : [...(t.labelIds ?? []), a.labelId] }) };
    case 'thread/tags': return { ...ws, threads: ws.threads.map(t => !a.ids.includes(t.id) ? t : { ...t, tags: a.remove ? (t.tags ?? []).filter(g => g !== a.tag) : (t.tags ?? []).includes(a.tag) ? t.tags : [...(t.tags ?? []), a.tag] }) };
    case 'thread/purge': return { ...ws, threads: ws.threads.filter(t => !(a.ids.includes(t.id) && t.trashed)) };
    case 'label/save': return { ...ws, labels: upsert(ws.labels, a.label.id ? a.label : { ...a.label, id: uid('lbl') }) };
    case 'label/remove': return { ...ws, labels: ws.labels.filter(l => l.id !== a.id), threads: ws.threads.map(t => t.labelIds?.includes(a.id) ? { ...t, labelIds: t.labelIds.filter(l => l !== a.id) } : t) };
    case 'draft/save': return { ...ws, drafts: upsert(ws.drafts, a.draft.id ? a.draft : { ...a.draft, id: uid('dr') }) };
    case 'draft/delete': return { ...ws, drafts: ws.drafts.filter(d => d.id !== a.id) };
    case 'draft/send': {
      const d = a.draft.id ? a.draft : { ...a.draft, id: uid('dr') };
      if (d.scheduledAt && d.scheduledAt > now.toISOString()) return { ...ws, drafts: upsert(ws.drafts, d) };
      return sendDraft({ ...ws, drafts: ws.drafts.filter(x => x.id !== d.id) }, d, now);
    }
    case 'deal/save': return { ...ws, deals: upsert(ws.deals, a.deal.id ? a.deal : { ...a.deal, id: uid('deal') }) };
    case 'deal/move': return { ...ws, deals: ws.deals.map(d => d.id === a.id ? { ...d, stageId: a.stageId } : d) };
    case 'deal/close': return { ...ws, deals: ws.deals.map(d => d.id === a.id ? { ...d, status: a.status } : d) };
    case 'deal/remove': return { ...ws, deals: ws.deals.filter(d => d.id !== a.id) };
    case 'task/save': return { ...ws, tasks: upsert(ws.tasks, a.task.id ? a.task : { ...a.task, id: uid('task') }) };
    case 'task/toggle': return { ...ws, tasks: ws.tasks.map(t => t.id === a.id ? { ...t, done: !t.done } : t) };
    case 'task/remove': return { ...ws, tasks: ws.tasks.filter(t => t.id !== a.id) };
    case 'meeting/save': {
      const isNew = !a.meeting.id; const meeting = isNew ? { ...a.meeting, id: uid('mtg') } : a.meeting;
      const next = { ...ws, meetings: upsert(ws.meetings, meeting) };
      return isNew ? fireAutomations(next, { trigger: 'meeting-booked', contactId: meeting.contactId }, now) : next;
    }
    case 'meeting/remove': return { ...ws, meetings: ws.meetings.filter(m => m.id !== a.id) };
    case 'automation/save': return { ...ws, automations: upsert(ws.automations, a.automation.id ? a.automation : { ...a.automation, id: uid('auto') }) };
    case 'automation/toggle': return { ...ws, automations: ws.automations.map(x => x.id === a.id ? { ...x, enabled: !x.enabled } : x) };
    case 'automation/remove': return { ...ws, automations: ws.automations.filter(x => x.id !== a.id) };
    case 'webhook/save': return { ...ws, webhooks: upsert(ws.webhooks, a.webhook.id ? a.webhook : { ...a.webhook, id: uid('wh'), secret: `whsec_${Math.random().toString(36).slice(2, 14)}` }) };
    case 'webhook/remove': return { ...ws, webhooks: ws.webhooks.filter(x => x.id !== a.id) };
    case 'webhook/test': return { ...ws, webhooks: ws.webhooks.map(x => x.id === a.id ? { ...x, lastStatus: /^https:\/\//.test(x.url) ? 200 : 400 } : x) };
    case 'apikey/create': return { ...ws, apiKeys: [...ws.apiKeys, { id: uid('key'), name: a.name, prefix: `wb_${Math.random().toString(36).slice(2, 10)}`, createdAt: nowISO(), scopes: a.scopes }] };
    case 'apikey/revoke': return { ...ws, apiKeys: ws.apiKeys.filter(k => k.id !== a.id) };
    case 'integration/toggle': return { ...ws, integrations: ws.integrations.map(i => i.id === a.id ? { ...i, connected: !i.connected } : i) };
    case 'suppression/add': return { ...ws, suppression: addSuppression(ws.suppression, a.email, 'manual', now.toISOString()) };
    case 'suppression/remove': return { ...ws, suppression: ws.suppression.filter(s => s.id !== a.id) };
    case 'template/save': return { ...ws, templates: upsert(ws.templates, a.template.id ? a.template : { ...a.template, id: uid('tpl') }) };
    case 'template/remove': return { ...ws, templates: ws.templates.filter(t => t.id !== a.id) };
    case 'team/invite': return ws.team.some(m => m.email === a.email) ? ws : { ...ws, team: [...ws.team, { id: uid('u'), name: a.email.split('@')[0], email: a.email, role: a.role, online: false }] };
    case 'team/remove': return { ...ws, team: ws.team.filter(m => !(m.id === a.id && m.role !== 'owner')) };
    case 'settings/update': return { ...ws, settings: { ...ws.settings, ...a.patch } };
    case 'sim/tick': return tick(ws, new Date(a.now), a.rand !== undefined ? () => a.rand! : Math.random);
    case 'sim/nextDay': return rollDay(ws);
  }
}
