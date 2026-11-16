import type { CampaignEvent, Mailbox, SuppressionEntry } from '../types';

export interface DeliverabilityReport {
  score: number; bounceRate: number; complaintRate: number; level: 'excellent' | 'good' | 'at-risk' | 'critical';
  alerts: { severity: 'info' | 'warn' | 'critical'; message: string }[];
}
export function levelFor(score: number): DeliverabilityReport['level'] {
  return score >= 85 ? 'excellent' : score >= 65 ? 'good' : score >= 40 ? 'at-risk' : 'critical';
}
export function mailboxReport(m: Mailbox, events: CampaignEvent[]): DeliverabilityReport {
  const mine = events.filter(e => e.mailboxId === m.id);
  const sent = mine.filter(e => e.type === 'sent').length || 1;
  const bounceRate = mine.filter(e => e.type === 'bounced').length / sent;
  const complaintRate = mine.filter(e => e.type === 'complaint').length / sent;
  const alerts: DeliverabilityReport['alerts'] = [];
  if (!m.spf) alerts.push({ severity: 'critical', message: 'SPF record missing: add it to your DNS' });
  if (!m.dkim) alerts.push({ severity: 'critical', message: 'DKIM not configured' });
  if (!m.dmarc) alerts.push({ severity: 'warn', message: 'No DMARC policy published' });
  if (bounceRate > 0.05) alerts.push({ severity: 'critical', message: `Bounce rate ${(bounceRate * 100).toFixed(1)}% is above 5%` });
  else if (bounceRate > 0.02) alerts.push({ severity: 'warn', message: `Bounce rate ${(bounceRate * 100).toFixed(1)}% is above 2%` });
  if (complaintRate > 0.003) alerts.push({ severity: 'critical', message: 'Complaint rate exceeds 0.3%' });
  if (m.warmup.enabled && m.warmup.day < 14) alerts.push({ severity: 'info', message: `Warmup day ${m.warmup.day}: keep volume low until day 14` });
  if (!m.warmup.enabled && m.warmup.day < 14) alerts.push({ severity: 'warn', message: 'Warmup is off on a young mailbox' });
  let score = m.health;
  score -= Math.round(bounceRate * 300); score -= Math.round(complaintRate * 2000);
  score = Math.max(0, Math.min(100, score));
  return { score, bounceRate, complaintRate, level: levelFor(score), alerts };
}
/** Should this mailbox be auto-paused? */
export function shouldAutoPause(r: DeliverabilityReport): boolean {
  return r.bounceRate > 0.08 || r.complaintRate > 0.005;
}
export function addSuppression(list: SuppressionEntry[], email: string, reason: SuppressionEntry['reason'], at = new Date().toISOString()): SuppressionEntry[] {
  const e = email.trim().toLowerCase();
  return list.some(s => s.email === e) ? list : [...list, { id: `sup_${list.length + 1}_${e}`, email: e, reason, at }];
}
export const isSuppressed = (list: SuppressionEntry[], email: string) => list.some(s => s.email === email.trim().toLowerCase());

/** DNS records a user needs to publish for a sending domain. */
export function dnsChecklist(domain: string) {
  return [
    { type: 'TXT', host: domain, value: 'v=spf1 include:_spf.google.com include:spf.protection.outlook.com ~all', purpose: 'SPF' },
    { type: 'TXT', host: `selector1._domainkey.${domain}`, value: 'v=DKIM1; k=rsa; p=<public-key>', purpose: 'DKIM' },
    { type: 'TXT', host: `_dmarc.${domain}`, value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}`, purpose: 'DMARC' },
  ];
}
