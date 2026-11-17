import type * as T from '../types';
import { delayBeforeStep, inSendWindow, nextStep, pickMailbox } from '../domain/campaign';
import { renderEmail } from '../domain/template';
import { addSuppression, isSuppressed } from '../domain/deliverability';
import { classifyReply, draftReply } from '../domain/automation';
import { walkFlow } from '../domain/flow';
import { advanceWarmupDay, mailboxHealth, warmupVolume } from '../domain/warmup';

let n = 0;
export const uid = (p: string) => `${p}_${(++n).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export type Rand = () => number;
const DAY = 86_400_000;

const REPLIES: Record<string, string[]> = {
  interested: ["Sounds good, let's talk. Can you send over some more details?", "Interested! Tell me more about pricing."],
  question: ['Quick question: how does this work with our current setup?', 'Who else are you working with in our industry?'],
  'not-interested': ['Not interested, thanks. Please remove me from your list.', 'No thanks.'],
  'out-of-office': ['I am out of office until next Monday with limited access to email.'],
  'meeting-booked': ['Happy to chat. Does Thursday at 2pm work for a call?', 'Sure, book a time on my calendar.'],
};
function pickReplyKind(r: number): T.ThreadLabel {
  return r < 0.35 ? 'interested' : r < 0.6 ? 'question' : r < 0.78 ? 'not-interested' : r < 0.9 ? 'out-of-office' : 'meeting-booked';
}

/** Apply one automation action to the workspace. */
export function applyAction(ws: T.Workspace, act: { action: T.AutomationActionKind; value?: string }, ctx: { contactId: T.ID; threadId?: T.ID; campaignId?: T.ID }, now: Date): T.Workspace {
  const contact = ws.contacts.find(c => c.id === ctx.contactId); if (!contact) return ws;
  const thread = ws.threads.find(t => t.id === ctx.threadId);
  let next = ws;
  switch (act.action) {
    case 'label': if (thread) next = { ...next, threads: next.threads.map(t => t.id === thread.id ? { ...t, label: (act.value as T.ThreadLabel) || t.label } : t) }; break;
    case 'tag': next = { ...next, contacts: next.contacts.map(c => c.id === contact.id && act.value && !c.tags.includes(act.value) ? { ...c, tags: [...c.tags, act.value] } : c) }; break;
    case 'stop-campaign': if (ctx.campaignId) next = { ...next, campaigns: next.campaigns.map(c => c.id === ctx.campaignId ? { ...c, contactIds: c.contactIds.filter(id => id !== contact.id) } : c) }; break;
    case 'create-task': next = { ...next, tasks: [...next.tasks, { id: uid('task'), title: act.value || `Follow up with ${contact.firstName}`, contactId: contact.id, due: new Date(now.getTime() + 2 * DAY).toISOString(), done: false }] }; break;
    case 'create-deal': next = { ...next, deals: [...next.deals, { id: uid('deal'), title: `${contact.company || contact.email} opportunity`, contactId: contact.id, stageId: next.stages[0]?.id ?? '', value: Number(act.value) || 5000, status: 'open', createdAt: now.toISOString() }] }; break;
    case 'webhook': next = { ...next, webhooks: next.webhooks.map(w => w.enabled ? { ...w, lastStatus: 200 } : w) }; break;
    case 'ai-draft': if (thread) next = { ...next, threads: next.threads.map(t => t.id === thread.id ? { ...t, draft: draftReply(t, contact, next.settings.signature) } : t) }; break;
    case 'unsubscribe': next = { ...next, contacts: next.contacts.map(c => c.id === contact.id ? { ...c, status: 'unsubscribed' } : c), suppression: addSuppression(next.suppression, contact.email, 'unsubscribe', now.toISOString()) }; break;
    case 'notify': break; // surfaced in the UI via the automation run counter
  }
  return next;
}

/** Run matching automations for an event: steps before any delay run now, later steps are queued. */
export function fireAutomations(ws: T.Workspace, ctx: { trigger: T.AutomationTrigger; contactId: T.ID; threadId?: T.ID; campaignId?: T.ID }, now: Date): T.Workspace {
  const contact = ws.contacts.find(c => c.id === ctx.contactId); if (!contact) return ws;
  let next = ws; const ran = new Set<string>();
  for (const a of ws.automations) {
    if (!a.enabled || a.trigger !== ctx.trigger) continue;
    const thread = next.threads.find(t => t.id === ctx.threadId);
    const run = walkFlow(a.flow, { trigger: ctx.trigger, contact, thread });
    for (const st of run.steps) {
      if (st.kind !== 'action' || !st.action) continue;
      if (st.atMinutes <= 0) next = applyAction(next, { action: st.action, value: st.value }, ctx, now);
      else next = { ...next, pending: [...next.pending, { id: uid('pa'), automationId: a.id, action: st.action, value: st.value, contactId: ctx.contactId, threadId: ctx.threadId, campaignId: ctx.campaignId, runAt: new Date(now.getTime() + st.atMinutes * 60_000).toISOString() }] };
    }
    if (run.steps.some(st => st.kind === 'action')) ran.add(a.id);
  }
  if (ran.size) next = { ...next, automations: next.automations.map(a => ran.has(a.id) ? { ...a, runs: a.runs + 1 } : a) };
  return next;
}

/** Execute queued (post-delay) automation actions that are due. */
export function runPending(ws: T.Workspace, now: Date): T.Workspace {
  const due = ws.pending.filter(p => p.runAt <= now.toISOString());
  if (!due.length) return ws;
  let next: T.Workspace = { ...ws, pending: ws.pending.filter(p => p.runAt > now.toISOString()) };
  for (const p of due) next = applyAction(next, { action: p.action, value: p.value }, p, now);
  return next;
}

/** Send a compose/reply/forward draft: appends to its thread or starts a new one (creating the contact if unknown). */
export function sendDraft(ws: T.Workspace, d: T.Draft, now: Date): T.Workspace {
  const mb = ws.mailboxes.find(m => m.id === d.mailboxId) ?? ws.mailboxes[0]; if (!mb) return ws;
  const at = now.toISOString(); const to = d.to.trim().toLowerCase();
  let contacts = ws.contacts; let contact = contacts.find(c => c.email === to);
  if (!contact) {
    const local = to.split('@')[0] ?? to; const [f, ...l] = local.split(/[._-]/);
    contact = { id: uid('c'), email: to, firstName: (f ?? '').replace(/^./, ch => ch.toUpperCase()), lastName: l.join(' ').replace(/^./, ch => ch.toUpperCase()), company: (to.split('@')[1] ?? '').split('.')[0] ?? '', title: '', tags: [], status: 'lead', fields: {}, createdAt: at };
    contacts = [...contacts, contact];
  }
  const existing = d.threadId ? ws.threads.find(t => t.id === d.threadId) : undefined;
  const tid = existing?.id ?? uid('th');
  const msg: T.Message = { id: uid('msg'), threadId: tid, direction: 'out', from: mb.email, to, subject: d.subject, body: d.body, at };
  const threads = existing
    ? ws.threads.map(t => t.id === tid ? { ...t, messages: [...t.messages, msg], unread: false, draft: undefined, updatedAt: at } : t)
    : [...ws.threads, { id: tid, mailboxId: mb.id, contactId: contact.id, subject: d.subject || '(no subject)', messages: [msg], unread: false, starred: false, archived: false, label: 'none' as const, updatedAt: at }];
  return { ...ws, contacts, threads, drafts: ws.drafts.filter(x => x.id !== d.id), mailboxes: ws.mailboxes.map(m => m.id === mb.id ? { ...m, sentToday: m.sentToday + 1 } : m) };
}

/** Send scheduled drafts that have come due. */
export function runScheduled(ws: T.Workspace, now: Date): T.Workspace {
  const due = ws.drafts.filter(d => d.scheduledAt && d.scheduledAt <= now.toISOString()); if (!due.length) return ws;
  return due.reduce((w, d) => sendDraft(w, { ...d, scheduledAt: undefined }, now), ws);
}

/** Workspace labels applied automatically when a reply arrives. */
export function autoLabelIds(ws: T.Workspace, intent: T.ThreadLabel, contact: T.Contact): string[] {
  const by = (n: string) => ws.labels.find(l => l.name.toLowerCase() === n)?.id; const out: string[] = [];
  if (contact.status === 'customer') { const x = by('customer'); if (x) out.push(x); }
  else if (intent === 'interested' || intent === 'meeting-booked' || intent === 'question') { const x = by('lead'); if (x) out.push(x); }
  else if (intent === 'not-interested') { const x = by('churn risk'); if (x) out.push(x); }
  return out;
}

/** One simulation step: sends due emails, simulates recipient behaviour, runs warmup. Pure given (ws, now, rand). */
export function tick(ws: T.Workspace, now: Date, rand: Rand = Math.random): T.Workspace {
  let w = runScheduled(runPending(ws, now), now);
  for (const camp of ws.campaigns) {
    if (camp.status !== 'active' || !inSendWindow(camp, now)) continue;
    let sentToday = w.events.filter(e => e.campaignId === camp.id && e.type === 'sent' && e.at.slice(0, 10) === now.toISOString().slice(0, 10)).length;
    let cursor = sentToday;
    let allDone = true;
    for (const contactId of camp.contactIds) {
      const contact = w.contacts.find(c => c.id === contactId); if (!contact) continue;
      const ns = nextStep(camp, contactId, w.events);
      if ('done' in ns) continue;
      allDone = false;
      if (sentToday >= camp.dailyCap || isSuppressed(w.suppression, contact.email)) continue;
      const mySent = w.events.filter(e => e.campaignId === camp.id && e.contactId === contactId && e.type === 'sent');
      if (mySent.length) {
        const last = Math.max(...mySent.map(e => Date.parse(e.at)));
        const prevEmailIdx = camp.steps.map((s, i) => (s.kind === 'email' && i < ns.index ? i : -1)).filter(i => i >= 0).pop() ?? 0;
        const gapDays = Math.max(1, delayBeforeStep(camp, ns.index) - delayBeforeStep(camp, prevEmailIdx));
        if (now.getTime() < last + gapDays * DAY) continue;
      }
      const mbs = camp.mailboxIds.map(id => w.mailboxes.find(m => m.id === id)).filter(Boolean) as T.Mailbox[];
      const pick = pickMailbox(mbs, cursor); if (!pick) break;
      cursor = pick.cursor; const mb = pick.mailbox; sentToday++;
      const email = renderEmail({ subject: ns.step.subject || '', body: ns.step.body || '' }, contact, rand);
      const at = now.toISOString();
      const evs: T.CampaignEvent[] = [{ id: uid('ev'), campaignId: camp.id, contactId, mailboxId: mb.id, type: 'sent', stepId: ns.step.id, at }];
      let outThread = w.threads.find(t => t.contactId === contactId && t.campaignId === camp.id);
      const outMsg: T.Message = { id: uid('msg'), threadId: outThread?.id ?? '', direction: 'out', from: mb.email, to: contact.email, subject: email.subject || `Re: ${outThread?.subject ?? ''}`, body: email.body, at };
      const bounced = rand() < 0.03;
      if (bounced) evs.push({ id: uid('ev'), campaignId: camp.id, contactId, mailboxId: mb.id, type: 'bounced', stepId: ns.step.id, at });
      else {
        if (camp.trackOpens && rand() < 0.55) evs.push({ id: uid('ev'), campaignId: camp.id, contactId, mailboxId: mb.id, type: 'opened', stepId: ns.step.id, at });
        if (camp.trackClicks && rand() < 0.12) evs.push({ id: uid('ev'), campaignId: camp.id, contactId, mailboxId: mb.id, type: 'clicked', stepId: ns.step.id, at });
        if (rand() < 0.012) evs.push({ id: uid('ev'), campaignId: camp.id, contactId, mailboxId: mb.id, type: 'complaint', stepId: ns.step.id, at });
      }
      const replied = !bounced && rand() < 0.06;
      if (replied) evs.push({ id: uid('ev'), campaignId: camp.id, contactId, mailboxId: mb.id, type: 'replied', stepId: ns.step.id, at });
      // thread bookkeeping
      if (!outThread) {
        const tid = uid('th'); outMsg.threadId = tid;
        outThread = { id: tid, mailboxId: mb.id, contactId, campaignId: camp.id, subject: email.subject, messages: [], unread: false, starred: false, archived: false, label: 'none', updatedAt: at };
        w = { ...w, threads: [...w.threads, outThread] };
      }
      const tid = outThread.id; outMsg.threadId = tid;
      let msgs = [outMsg];
      let label: T.ThreadLabel = 'none';
      if (replied) {
        const kind = pickReplyKind(rand());
        const opts = REPLIES[kind] ?? REPLIES.question; const body = opts[Math.floor(rand() * opts.length)];
        msgs.push({ id: uid('msg'), threadId: tid, direction: 'in', from: contact.email, to: mb.email, subject: `Re: ${outMsg.subject}`, body, at: new Date(now.getTime() + 600_000).toISOString() });
        label = classifyReply(body);
      }
      w = { ...w,
        events: [...w.events, ...evs],
        mailboxes: w.mailboxes.map(m => m.id === mb.id ? { ...m, sentToday: m.sentToday + 1 } : m),
        threads: w.threads.map(t => t.id === tid ? { ...t, messages: [...t.messages, ...msgs], unread: replied ? true : t.unread, label: replied ? label : t.label, labelIds: replied ? [...new Set([...(t.labelIds ?? []), ...autoLabelIds(w, label, contact)])] : t.labelIds, updatedAt: at } : t),
      };
      if (bounced) w = { ...w, contacts: w.contacts.map(c => c.id === contactId ? { ...c, status: 'bounced' } : c), suppression: addSuppression(w.suppression, contact.email, 'bounce', at) };
      else if (replied) w = fireAutomations(w, { trigger: 'reply-received', contactId, threadId: tid, campaignId: camp.id }, now);
    }
    if (allDone && camp.contactIds.length) w = { ...w, campaigns: w.campaigns.map(c => c.id === camp.id ? { ...c, status: 'completed' } : c) };
  }
  // warmup traffic counters
  w = { ...w, mailboxes: w.mailboxes.map(m => m.warmup.enabled && m.warmup.sentToday < warmupVolume(m.warmup.day, m.warmup.target)
      ? { ...m, warmup: { ...m.warmup, sentToday: Math.min(warmupVolume(m.warmup.day, m.warmup.target), m.warmup.sentToday + 1 + Math.floor(rand() * 2)) } } : m) };
  return w;
}

/** Midnight rollover: reset counters, advance warmup, recompute health. */
export function rollDay(ws: T.Workspace): T.Workspace {
  return { ...ws, mailboxes: ws.mailboxes.map(m => { const r = advanceWarmupDay({ ...m, sentToday: 0 }); return { ...r, sentToday: 0, health: mailboxHealth(r) }; }) };
}
