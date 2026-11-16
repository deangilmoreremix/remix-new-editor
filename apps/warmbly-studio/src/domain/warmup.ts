import type { Mailbox } from '../types';

/** Daily warmup volume ramp: starts at `start`, grows `growth`%/day, capped at `target`. */
export function warmupVolume(day: number, target: number, start = 2, growth = 0.22): number {
  if (day <= 0) return 0;
  return Math.min(target, Math.max(start, Math.round(start * Math.pow(1 + growth, day - 1))));
}
export function warmupSchedule(days: number, target: number) {
  return Array.from({ length: days }, (_, i) => ({ day: i + 1, volume: warmupVolume(i + 1, target) }));
}
export function daysToTarget(target: number): number {
  let d = 1; while (warmupVolume(d, target) < target && d < 365) d++; return d;
}

/** Mailbox health 0–100 from auth records, reply rate and warmup progress. */
export function mailboxHealth(m: Pick<Mailbox, 'spf' | 'dkim' | 'dmarc' | 'warmup' | 'status'>, bounceRate = 0, complaintRate = 0): number {
  let h = 40;
  if (m.spf) h += 10; if (m.dkim) h += 10; if (m.dmarc) h += 10;
  h += Math.min(20, Math.round(m.warmup.day / 30 * 20));
  h += Math.round(Math.min(1, m.warmup.replyRate) * 10);
  h -= Math.round(bounceRate * 200); h -= Math.round(complaintRate * 1000);
  if (m.status === 'error') h -= 30;
  return Math.max(0, Math.min(100, h));
}

/** How many campaign emails this mailbox may still send today (warmup shares the quota). */
export function remainingSendCapacity(m: Mailbox): number {
  const warm = m.warmup.enabled ? m.warmup.sentToday : 0;
  return Math.max(0, m.dailyLimit - m.sentToday - warm);
}

/** Advance warmup by one day (called by the daily tick). */
export function advanceWarmupDay(m: Mailbox): Mailbox {
  if (!m.warmup.enabled) return m;
  const day = m.warmup.day + 1;
  const replyRate = Math.min(0.45, m.warmup.replyRate + 0.01);
  const next = { ...m, sentToday: 0, warmup: { ...m.warmup, day, sentToday: warmupVolume(day, m.warmup.target), replyRate } };
  return { ...next, health: mailboxHealth(next) };
}
