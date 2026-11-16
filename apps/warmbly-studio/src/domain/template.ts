import type { Contact } from '../types';

/** Pick one option from each {a|b|c} spintax group. `rand` is injectable for tests. */
export function spin(text: string, rand: () => number = Math.random): string {
  let out = text, prev = '';
  while (out !== prev) {
    prev = out;
    out = out.replace(/\{([^{}|]*\|[^{}]*)\}/g, (_, g: string) => {
      const opts = g.split('|');
      return opts[Math.min(opts.length - 1, Math.floor(rand() * opts.length))];
    });
  }
  return out;
}

const VAR = /\{\{\s*([a-zA-Z_][\w.]*)(?:\s*\|\s*([^}]*?))?\s*\}\}/g;

export function contactVars(c: Contact): Record<string, string> {
  return { firstName: c.firstName, lastName: c.lastName, fullName: `${c.firstName} ${c.lastName}`.trim(),
    email: c.email, company: c.company, title: c.title, phone: c.phone ?? '', ...c.fields };
}

/** Replace {{var}} / {{var | fallback}}. Unknown vars without fallback are left in place and reported. */
export function renderTemplate(text: string, vars: Record<string, string>) {
  const missing: string[] = [];
  const out = text.replace(VAR, (m, key: string, fallback?: string) => {
    const v = vars[key];
    if (v) return v;
    if (fallback !== undefined) return fallback.trim();
    missing.push(key); return m;
  });
  return { text: out, missing: [...new Set(missing)] };
}

export function extractVariables(text: string): string[] {
  return [...new Set([...text.matchAll(VAR)].map(m => m[1]))];
}

export function renderEmail(tpl: { subject: string; body: string }, c: Contact, rand?: () => number) {
  const vars = contactVars(c);
  const s = renderTemplate(spin(tpl.subject, rand), vars), b = renderTemplate(spin(tpl.body, rand), vars);
  return { subject: s.text, body: b.text, missing: [...new Set([...s.missing, ...b.missing])] };
}

const SPAM_WORDS = ['free', 'guarantee', 'act now', 'limited time', '100%', 'risk-free', 'winner', 'urgent', 'click here', 'buy now', '$$$'];
export interface SpamReport { score: number; issues: string[] }
/** Heuristic pre-send check. Score 0 (clean) – 100 (very spammy). */
export function spamCheck(subject: string, body: string): SpamReport {
  const issues: string[] = []; let score = 0;
  const lower = `${subject} ${body}`.toLowerCase();
  for (const w of SPAM_WORDS) if (lower.includes(w)) { score += 8; issues.push(`Spam trigger word: "${w}"`); }
  if (subject.length > 70) { score += 6; issues.push('Subject is longer than 70 characters'); }
  if (!subject.trim()) { score += 20; issues.push('Subject is empty'); }
  if (subject === subject.toUpperCase() && /[A-Z]/.test(subject)) { score += 15; issues.push('Subject is ALL CAPS'); }
  if ((subject.match(/!/g) ?? []).length > 1) { score += 8; issues.push('Multiple exclamation marks in subject'); }
  const links = (body.match(/https?:\/\//g) ?? []).length;
  if (links > 3) { score += 10; issues.push(`Too many links (${links})`); }
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  if (words > 200) { score += 6; issues.push('Body is long for a cold email (>200 words)'); }
  if (words < 15) { score += 5; issues.push('Body is very short'); }
  return { score: Math.min(100, score), issues };
}
