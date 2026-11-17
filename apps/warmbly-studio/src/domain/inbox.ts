import type { Contact, Draft, Thread, Workspace } from '../types';

export type Folder = 'all' | 'inbox' | 'unread' | 'awaiting' | 'agent' | 'drafts' | 'snoozed' | 'sent' | 'scheduled' | 'archive' | 'spam' | 'trash';
export const FOLDERS: { id: Folder; label: string; icon: string }[] = [
  { id: 'all', label: 'All mail', icon: 'inbox' }, { id: 'inbox', label: 'Inbox', icon: 'inbox' }, { id: 'unread', label: 'Unread', icon: 'mail' },
  { id: 'awaiting', label: 'Awaiting reply', icon: 'reply' }, { id: 'agent', label: 'Agent drafts', icon: 'sparkles' }, { id: 'drafts', label: 'Drafts', icon: 'draft' },
  { id: 'snoozed', label: 'Snoozed', icon: 'snooze' }, { id: 'sent', label: 'Sent', icon: 'send' }, { id: 'scheduled', label: 'Scheduled', icon: 'clock' },
  { id: 'archive', label: 'Archive', icon: 'archive' }, { id: 'spam', label: 'Spam', icon: 'spam' }, { id: 'trash', label: 'Trash', icon: 'trash' },
];

export const hasInbound = (t: Thread) => t.messages.some(m => m.direction === 'in');
export const lastMessage = (t: Thread) => t.messages[t.messages.length - 1];
export const isSnoozed = (t: Thread, now: Date) => !!t.snoozedUntil && t.snoozedUntil > now.toISOString();
const live = (t: Thread) => !t.trashed && !t.spam;

/** Whether a thread belongs in a (thread-based) folder. */
export function inFolder(t: Thread, f: Folder, now: Date): boolean {
  switch (f) {
    case 'all': return live(t);
    case 'inbox': return live(t) && hasInbound(t) && !t.archived && !isSnoozed(t, now);
    case 'unread': return live(t) && hasInbound(t) && !t.archived && !isSnoozed(t, now) && t.unread;
    case 'awaiting': return live(t) && !t.archived && hasInbound(t) && lastMessage(t)?.direction === 'out';
    case 'agent': return live(t) && !t.archived && !!t.draft;
    case 'snoozed': return !t.trashed && isSnoozed(t, now);
    case 'sent': return live(t) && t.messages.some(m => m.direction === 'out');
    case 'archive': return !t.trashed && t.archived;
    case 'spam': return !!t.spam && !t.trashed;
    case 'trash': return !!t.trashed;
    default: return false;
  }
}
export interface InboxFilters { mailboxIds?: string[]; labelId?: string | null; tag?: string | null; query?: string; assignee?: string | null }
export function matchesFilters(t: Thread, c: Contact | undefined, f: InboxFilters): boolean {
  if (f.mailboxIds?.length && !f.mailboxIds.includes(t.mailboxId)) return false;
  if (f.labelId && !(t.labelIds ?? []).includes(f.labelId)) return false;
  if (f.tag && !(t.tags ?? []).includes(f.tag)) return false;
  if (f.assignee && t.assigneeId !== f.assignee) return false;
  const q = f.query?.trim().toLowerCase();
  if (q && !`${t.subject} ${c?.email ?? ''} ${c?.firstName ?? ''} ${c?.lastName ?? ''} ${c?.company ?? ''} ${t.messages.map(m => m.body).join(' ')}`.toLowerCase().includes(q)) return false;
  return true;
}
export function listThreads(ws: Workspace, folder: Folder, now: Date, f: InboxFilters = {}, sort: 'newest' | 'oldest' = 'newest'): Thread[] {
  const out = ws.threads.filter(t => inFolder(t, folder, now) && matchesFilters(t, ws.contacts.find(c => c.id === t.contactId), f));
  return out.sort((a, b) => (sort === 'newest' ? b.updatedAt.localeCompare(a.updatedAt) : a.updatedAt.localeCompare(b.updatedAt)));
}
export function listDrafts(ws: Workspace, scheduled: boolean, now: Date): Draft[] {
  return ws.drafts.filter(d => (scheduled ? !!d.scheduledAt && d.scheduledAt > now.toISOString() : !d.scheduledAt || d.scheduledAt <= now.toISOString())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function folderCounts(ws: Workspace, now: Date): Record<Folder, number> {
  const c = Object.fromEntries(FOLDERS.map(f => [f.id, 0])) as Record<Folder, number>;
  for (const t of ws.threads) for (const f of FOLDERS) if (f.id !== 'drafts' && f.id !== 'scheduled' && inFolder(t, f.id, now)) c[f.id]++;
  c.drafts = listDrafts(ws, false, now).length; c.scheduled = listDrafts(ws, true, now).length;
  return c;
}
export function labelCounts(ws: Workspace, now: Date): Record<string, number> {
  const out: Record<string, number> = {}; for (const t of ws.threads) if (inFolder(t, 'all', now)) for (const l of t.labelIds ?? []) out[l] = (out[l] ?? 0) + 1; return out;
}
export function tagCounts(ws: Workspace, now: Date): [string, number][] {
  const out: Record<string, number> = {}; for (const t of ws.threads) if (inFolder(t, 'all', now)) for (const g of t.tags ?? []) out[g] = (out[g] ?? 0) + 1;
  return Object.entries(out).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function groupByDay<T extends { updatedAt: string }>(items: T[], now: Date): { title: string; items: T[] }[] {
  const startOf = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const today = startOf(now), DAY = 86_400_000; const groups: { title: string; items: T[] }[] = [];
  for (const it of items) {
    const t = startOf(new Date(it.updatedAt));
    const title = t >= today ? 'Today' : t >= today - DAY ? 'Yesterday' : t >= today - 6 * DAY ? 'This week' : 'Earlier';
    const g = groups.find(x => x.title === title); if (g) g.items.push(it); else groups.push({ title, items: [it] });
  }
  return groups;
}
export function relativeTime(iso: string, now: Date): string {
  const ms = now.getTime() - new Date(iso).getTime(), m = Math.round(ms / 60_000);
  if (m < 1) return 'now'; if (m < 60) return `${m}m`; const h = Math.round(m / 60); if (h < 24) return `${h}h`; const d = Math.round(h / 24); return d < 30 ? `${d}d` : new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
export function previewOf(t: Thread, n = 90): string { const b = (lastMessage(t)?.body ?? '').replace(/\s+/g, ' ').trim(); return b.length > n ? b.slice(0, n - 1) + '…' : b; }
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';
export const snoozeOptions = (now: Date) => {
  const at = (days: number, hour = 9) => { const d = new Date(now); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); return d.toISOString(); };
  const later = new Date(now.getTime() + 3 * 3_600_000); later.setMinutes(0, 0, 0);
  const nextMon = (() => { const d = new Date(now); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(9, 0, 0, 0); return d.toISOString(); })();
  return [{ label: 'Later today', until: later.toISOString() }, { label: 'Tomorrow', until: at(1) }, { label: 'This weekend', until: (() => { const d = new Date(now); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)); d.setHours(9, 0, 0, 0); return d.toISOString(); })() }, { label: 'Next week', until: nextMon }];
};
