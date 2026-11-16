import type { CampaignEvent, EventType } from '../types';

export function dailySeries(events: CampaignEvent[], type: EventType, days: number, now = new Date()) {
  const out: { date: string; value: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, value: events.filter(e => e.type === type && e.at.slice(0, 10) === key).length });
  }
  return out;
}
export function pct(n: number, digits = 1) { return `${(n * 100).toFixed(digits)}%`; }
export function funnel(events: CampaignEvent[]) {
  const u = (t: EventType) => new Set(events.filter(e => e.type === t).map(e => e.contactId)).size;
  return [{ label: 'Contacted', value: u('sent') }, { label: 'Opened', value: u('opened') }, { label: 'Clicked', value: u('clicked') }, { label: 'Replied', value: u('replied') }];
}
export function pipelineValue<T extends { value: number; status: string }>(deals: T[]) {
  return { open: deals.filter(d => d.status === 'open').reduce((s, d) => s + d.value, 0), won: deals.filter(d => d.status === 'won').reduce((s, d) => s + d.value, 0) };
}
export function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
}
export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(c => c.trim())) rows.push(row); row = []; }
    else cur += ch;
  }
  row.push(cur); if (row.some(c => c.trim())) rows.push(row);
  const [head, ...rest] = rows; if (!head) return [];
  const keys = head.map(h => h.trim());
  return rest.map(r => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}
