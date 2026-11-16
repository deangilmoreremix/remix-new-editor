import type { Campaign, CampaignEvent, Contact, Mailbox, SequenceStep } from '../types';
import { remainingSendCapacity } from './warmup';

export interface ContactProgress { contactId: string; stepIndex: number; nextAt: number | null; done: boolean; reason?: string }

export function validateCampaign(c: Campaign, mailboxes: Mailbox[]): string[] {
  const errs: string[] = [];
  if (!c.name.trim()) errs.push('Give the campaign a name');
  if (!c.steps.some(s => s.kind === 'email')) errs.push('Add at least one email step');
  if (c.steps[0] && c.steps[0].kind !== 'email') errs.push('The sequence must start with an email');
  c.steps.forEach((s, i) => {
    if (s.kind === 'email' && (!s.subject?.trim() && i === 0)) errs.push(`Step ${i + 1}: subject is required`);
    if (s.kind === 'email' && !s.body?.trim()) errs.push(`Step ${i + 1}: body is empty`);
    if (s.kind === 'wait' && !(s.waitDays && s.waitDays > 0)) errs.push(`Step ${i + 1}: wait must be at least 1 day`);
  });
  if (!c.mailboxIds.length) errs.push('Select at least one mailbox');
  if (c.mailboxIds.some(id => !mailboxes.find(m => m.id === id))) errs.push('A selected mailbox no longer exists');
  if (!c.contactIds.length) errs.push('Add at least one contact');
  if (c.schedule.endHour <= c.schedule.startHour) errs.push('Sending window end must be after start');
  if (!c.schedule.days.length) errs.push('Pick at least one sending day');
  return errs;
}

/** Is `date` inside the campaign's sending window? */
export function inSendWindow(c: Campaign, date: Date): boolean {
  return c.schedule.days.includes(date.getDay()) && date.getHours() >= c.schedule.startHour && date.getHours() < c.schedule.endHour;
}

/** Next moment at/after `from` that falls in the sending window. */
export function nextSendSlot(c: Campaign, from: Date): Date {
  const d = new Date(from.getTime());
  for (let i = 0; i < 24 * 8; i++) {
    if (inSendWindow(c, d)) return d;
    d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1);
  }
  return from;
}

/** Round-robin mailbox pick, skipping mailboxes with no capacity or in error/paused state. */
export function pickMailbox(mailboxes: Mailbox[], cursor: number): { mailbox: Mailbox; cursor: number } | null {
  const usable = mailboxes.filter(m => (m.status === 'connected' || m.status === 'warming') && remainingSendCapacity(m) > 0);
  if (!usable.length) return null;
  return { mailbox: usable[cursor % usable.length], cursor: cursor + 1 };
}

/** Which step (if any) a contact should receive next, given events so far. */
export function nextStep(c: Campaign, contactId: string, events: CampaignEvent[]): { step: SequenceStep; index: number } | { done: true; reason: string } {
  const mine = events.filter(e => e.campaignId === c.id && e.contactId === contactId);
  if (c.stopOnReply && mine.some(e => e.type === 'replied')) return { done: true, reason: 'replied' };
  if (mine.some(e => ['bounced', 'unsubscribed', 'complaint'].includes(e.type))) return { done: true, reason: 'suppressed' };
  const sentSteps = new Set(mine.filter(e => e.type === 'sent').map(e => e.stepId));
  for (let i = 0; i < c.steps.length; i++) {
    const s = c.steps[i];
    if (s.kind === 'email') { if (!sentSteps.has(s.id)) return { step: s, index: i }; continue; }
    if (s.kind === 'condition' && s.condition) {
      const met = mine.some(e => e.type === (s.condition === 'opened' ? 'opened' : s.condition === 'clicked' ? 'clicked' : 'replied'));
      if (s.negate ? met : !met) return { done: true, reason: 'condition-not-met' };
    }
  }
  return { done: true, reason: 'sequence-complete' };
}

/** Sum of `wait` steps before step index `i` (days). */
export function delayBeforeStep(c: Campaign, i: number): number {
  let d = 0; for (let k = 0; k < i; k++) if (c.steps[k].kind === 'wait') d += c.steps[k].waitDays ?? 0; return d;
}

export function estimateCompletion(c: Campaign): { days: number; perDay: number } {
  const perDay = Math.max(1, c.dailyCap);
  const emails = c.contactIds.length * c.steps.filter(s => s.kind === 'email').length;
  const sendDays = Math.ceil(emails / perDay);
  const lastEmail = c.steps.map((s, i) => (s.kind === 'email' ? i : -1)).filter(i => i >= 0).pop() ?? 0;
  return { days: Math.max(sendDays, delayBeforeStep(c, lastEmail) + 1), perDay };
}

export interface CampaignStats { sent: number; opened: number; clicked: number; replied: number; bounced: number; unsubscribed: number;
  openRate: number; clickRate: number; replyRate: number; bounceRate: number }
export function campaignStats(events: CampaignEvent[], campaignId?: string): CampaignStats {
  const ev = campaignId ? events.filter(e => e.campaignId === campaignId) : events;
  const uniq = (t: CampaignEvent['type']) => new Set(ev.filter(e => e.type === t).map(e => e.contactId)).size;
  const sent = ev.filter(e => e.type === 'sent').length;
  const opened = uniq('opened'), clicked = uniq('clicked'), replied = uniq('replied'), bounced = uniq('bounced'), unsubscribed = uniq('unsubscribed');
  const reached = new Set(ev.filter(e => e.type === 'sent').map(e => e.contactId)).size || 1;
  return { sent, opened, clicked, replied, bounced, unsubscribed, openRate: opened / reached, clickRate: clicked / reached, replyRate: replied / reached, bounceRate: bounced / reached };
}

export function dedupeContacts(existing: Contact[], incoming: Omit<Contact, 'id' | 'createdAt'>[]) {
  const seen = new Set(existing.map(c => c.email.toLowerCase()));
  const added: typeof incoming = [], skipped: string[] = [];
  for (const c of incoming) {
    const k = c.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(k)) { skipped.push(`${c.email} (invalid)`); continue; }
    if (seen.has(k)) { skipped.push(`${c.email} (duplicate)`); continue; }
    seen.add(k); added.push({ ...c, email: k });
  }
  return { added, skipped };
}
