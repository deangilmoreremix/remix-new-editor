import type * as T from '../types';
import { reduce } from './reducer';
import { rollDay, tick } from './engine';
import { linearToFlow } from '../domain/flow';

export function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const FIRST = ['Ava', 'Liam', 'Noah', 'Emma', 'Mia', 'Lucas', 'Zoe', 'Ethan', 'Isla', 'Owen', 'Nora', 'Leo', 'Ivy', 'Jack', 'Ruby', 'Finn', 'Maya', 'Theo', 'Elle', 'Sam'];
const LAST = ['Reed', 'Patel', 'Nguyen', 'Garcia', 'Kim', 'Rossi', 'Muller', 'Haddad', 'Okafor', 'Silva', 'Novak', 'Berg'];
const CO = ['Northwind', 'Lumen Labs', 'Brightpath', 'Quanta', 'Helix Co', 'Orbit Media', 'Pixelforge', 'Fathom', 'Greenleaf', 'Atlas Works'];
const TITLE = ['Head of Growth', 'Founder', 'VP Marketing', 'Sales Director', 'Operations Lead', 'CMO'];

const day = (d: number, base: Date) => new Date(base.getTime() - d * 86_400_000).toISOString();

export const DEFAULT_LABELS: T.Label[] = [{ id: 'lbl_lead', name: 'Lead', color: 'warn' }, { id: 'lbl_customer', name: 'Customer', color: 'good' }, { id: 'lbl_churn', name: 'Churn risk', color: 'bad' }];

const mk = (id: string, name: string, trigger: T.AutomationTrigger, conditions: T.AutomationCondition[], actions: [T.AutomationActionKind, string][], createdAt: string): T.Automation => ({
  id, name, enabled: true, trigger, runs: 0, createdAt, flow: linearToFlow(trigger, conditions, actions.map(([kind, value]) => ({ kind, value }))) });

export function baseWorkspace(now: Date, rand: () => number): T.Workspace {
  const iso = now.toISOString();
  const mailbox = (i: number, email: string, name: string, provider: T.Provider, warmDay: number): T.Mailbox => ({
    id: `mb_${i}`, email, name, provider, status: warmDay > 0 ? 'warming' : 'connected', dailyLimit: 60, sentToday: 0, minGapMinutes: 5,
    warmup: { enabled: warmDay > 0, startedAt: warmDay > 0 ? day(warmDay, now) : undefined, day: warmDay, target: 30, sentToday: 0, replyRate: 0.28 },
    health: 80, spf: i !== 4, dkim: i !== 4, dmarc: i <= 2, createdAt: day(60, now) });
  const contacts: T.Contact[] = Array.from({ length: 60 }, (_, i) => {
    const f = FIRST[i % FIRST.length], l = LAST[(i * 7) % LAST.length], co = CO[i % CO.length];
    return { id: `c_${i + 1}`, email: `${f}.${l}@${co.toLowerCase().replace(/\s+/g, '')}.com`.toLowerCase(), firstName: f, lastName: l, company: co, title: TITLE[i % TITLE.length],
      tags: i % 5 === 0 ? ['vip'] : [], status: 'lead', fields: { industry: ['SaaS', 'Agency', 'Retail'][i % 3] }, createdAt: day(30, now) };
  });
  const step = (id: string, kind: T.StepKind, extra: Partial<T.SequenceStep>): T.SequenceStep => ({ id, kind, ...extra });
  const schedule = { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17, timezone: 'America/New_York' };
  const campaigns: T.Campaign[] = [
    { id: 'camp_1', name: 'Founders outreach Q4', status: 'active', mailboxIds: ['mb_1', 'mb_2', 'mb_3'], contactIds: contacts.slice(0, 30).map(c => c.id),
      steps: [
        step('s1', 'email', { subject: '{Quick question|Idea} for {{company}}', body: 'Hi {{firstName | there}},\n\nI noticed {{company}} is growing fast. We help teams like yours book more meetings from cold outreach without hurting deliverability.\n\nWorth a quick chat this week?\n\n{{sender}}' }),
        step('s2', 'wait', { waitDays: 3 }),
        step('s3', 'email', { subject: '', body: 'Hi {{firstName | there}},\n\nFollowing up in case this got buried. Happy to share a 2-minute walkthrough if useful.' }),
        step('s4', 'wait', { waitDays: 4 }),
        step('s5', 'email', { subject: '', body: 'Last note from me, {{firstName | there}}. If timing is off, no worries at all.' }),
      ], schedule, stopOnReply: true, trackOpens: true, trackClicks: true, dailyCap: 8, createdAt: day(14, now) },
    { id: 'camp_2', name: 'Agency partners', status: 'active', mailboxIds: ['mb_2', 'mb_4'], contactIds: contacts.slice(30, 48).map(c => c.id),
      steps: [
        step('s1', 'email', { subject: 'Partnership idea, {{firstName}}', body: 'Hi {{firstName}},\n\nWe work with agencies like {{company}} on white-label outbound. Open to a short call?\n\nBest,\n{{sender}}' }),
        step('s2', 'wait', { waitDays: 2 }),
        step('s3', 'email', { subject: '', body: 'Bumping this up, {{firstName}}. Any interest?' }),
      ], schedule, stopOnReply: true, trackOpens: true, trackClicks: false, dailyCap: 5, createdAt: day(14, now) },
    { id: 'camp_3', name: 'Event follow-up (draft)', status: 'draft', mailboxIds: ['mb_1'], contactIds: contacts.slice(48).map(c => c.id),
      steps: [step('s1', 'email', { subject: 'Great meeting you at the event', body: 'Hi {{firstName}},\n\nGreat to connect. Here is the summary we discussed.' })], schedule, stopOnReply: true, trackOpens: true, trackClicks: true, dailyCap: 15, createdAt: iso },
  ];
  return {
    mailboxes: [mailbox(1, 'alex@getacme.io', 'Alex Morgan', 'gmail', 21), mailbox(2, 'sales@acmehq.co', 'Acme Sales', 'microsoft', 14), mailbox(3, 'jo@tryacme.com', 'Jo Lin', 'gmail', 9), mailbox(4, 'hello@acme-mail.net', 'Acme Hello', 'smtp', 0)],
    contacts, campaigns, events: [], threads: [],
    stages: [{ id: 'st_1', name: 'New', probability: 10 }, { id: 'st_2', name: 'Qualified', probability: 30 }, { id: 'st_3', name: 'Proposal', probability: 60 }, { id: 'st_4', name: 'Negotiation', probability: 80 }],
    deals: [
      { id: 'd_1', title: 'Northwind pilot', contactId: 'c_1', stageId: 'st_3', value: 12000, status: 'open', closeDate: day(-20, now), createdAt: day(10, now) },
      { id: 'd_2', title: 'Quanta annual plan', contactId: 'c_4', stageId: 'st_2', value: 8400, status: 'open', createdAt: day(6, now) },
      { id: 'd_3', title: 'Orbit Media seats', contactId: 'c_6', stageId: 'st_4', value: 21000, status: 'open', createdAt: day(12, now) },
      { id: 'd_4', title: 'Fathom starter', contactId: 'c_8', stageId: 'st_1', value: 3200, status: 'open', createdAt: day(2, now) },
      { id: 'd_5', title: 'Atlas Works rollout', contactId: 'c_10', stageId: 'st_4', value: 15500, status: 'won', createdAt: day(25, now) },
    ],
    tasks: [
      { id: 't_1', title: 'Send pricing to Northwind', contactId: 'c_1', due: day(-1, now), done: false },
      { id: 't_2', title: 'Prep demo for Orbit Media', contactId: 'c_6', due: day(-3, now), done: false },
      { id: 't_3', title: 'Update CRM notes', due: day(1, now), done: true },
    ],
    meetings: [
      { id: 'm_1', title: 'Discovery call: Quanta', contactId: 'c_4', at: day(-2, now), durationMin: 30 },
      { id: 'm_2', title: 'Demo: Orbit Media', contactId: 'c_6', at: day(-4, now), durationMin: 45 },
    ],
    automations: [
      mk('auto_1', 'Interested replies → deal + task', 'reply-received', [{ field: 'label', op: 'equals', value: 'interested' }], [['create-deal', '6000'], ['create-task', 'Reply to interested lead within 24h'], ['tag', 'hot']], day(14, now)),
      mk('auto_2', 'Not interested → unsubscribe', 'reply-received', [{ field: 'label', op: 'equals', value: 'not-interested' }], [['unsubscribe', '']], day(14, now)),
      mk('auto_3', 'Questions → AI draft', 'reply-received', [{ field: 'label', op: 'equals', value: 'question' }], [['ai-draft', '']], day(10, now)),
    ],
    webhooks: [{ id: 'wh_1', url: 'https://hooks.example.com/warmbly', events: ['reply.received', 'email.bounced'], secret: 'whsec_demo123456', enabled: true, lastStatus: 200 }],
    apiKeys: [{ id: 'key_1', name: 'Zapier', prefix: 'wb_demo1234', createdAt: day(20, now), lastUsedAt: day(1, now), scopes: ['contacts:write', 'campaigns:read'] }],
    integrations: [
      { id: 'hubspot', name: 'HubSpot', connected: true, detail: 'Syncing contacts and deals' }, { id: 'pipedrive', name: 'Pipedrive', connected: false },
      { id: 'slack', name: 'Slack', connected: true, detail: '#sales-replies' }, { id: 'zapier', name: 'Zapier', connected: false },
      { id: 'make', name: 'Make', connected: false }, { id: 'calendly', name: 'Calendly', connected: false },
    ],
    suppression: [], pending: [], labels: DEFAULT_LABELS, drafts: [],
    team: [{ id: 'u_1', name: 'Alex Morgan', email: 'alex@getacme.io', role: 'owner', online: true }, { id: 'u_2', name: 'Priya Shah', email: 'priya@getacme.io', role: 'admin', online: true }, { id: 'u_3', name: 'Marcus Lee', email: 'marcus@getacme.io', role: 'member', online: false }],
    templates: [
      { id: 'tpl_1', name: 'Short intro', subject: '{Quick question|Idea} for {{company}}', body: 'Hi {{firstName | there}},\n\nQuick intro and a question about how {{company}} handles outbound today.\n\nBest,\n{{sender}}' },
      { id: 'tpl_2', name: 'Soft follow-up', subject: '', body: 'Hi {{firstName | there}}, just following up. Is this relevant for {{company}}?' },
    ],
    settings: { workspaceName: 'Acme Outbound', timezone: 'America/New_York', trackingDomain: 'track.getacme.io', unsubscribeFooter: 'Not relevant? Reply "stop" and I will not email again.', signature: 'Alex Morgan\nAcme' },
  };
}

/** Inbound conversations that cover every inbox folder, so the studio opens with a lived-in mailbox. */
export function seedInbox(ws: T.Workspace, now: Date): T.Workspace {
  const H = 3_600_000, ago = (h: number) => new Date(now.getTime() - h * H).toISOString();
  const pool = ws.contacts.slice(48); // contacts not used by the active campaigns
  const mbs = ws.mailboxes;
  let contacts = ws.contacts.map(c => c.id === pool[3]?.id ? { ...c, status: 'customer' as const } : c);
  const threads: T.Thread[] = []; let n = 0;
  const add = (ci: number, mi: number, subject: string, msgs: [('in' | 'out'), string, number][], extra: Partial<T.Thread> = {}) => {
    const c = pool[ci % pool.length], mb = mbs[mi % mbs.length], id = `th_seed_${++n}`;
    const messages: T.Message[] = msgs.map(([dir, body, h], i) => ({ id: `${id}_m${i}`, threadId: id, direction: dir, from: dir === 'in' ? c.email : mb.email, to: dir === 'in' ? mb.email : c.email, subject: i ? `Re: ${subject}` : subject, body, at: ago(h) }));
    threads.push({ id, mailboxId: mb.id, contactId: c.id, subject, messages, unread: false, starred: false, archived: false, label: 'none', updatedAt: messages[messages.length - 1].at, labelIds: [], tags: [], ...extra });
  };
  const co = (i: number) => pool[i % pool.length].company;
  add(0, 0, `Re: Quick question about ${co(0)}`, [['out', 'Hi, quick question about how you handle outbound today.', 52], ['in', 'Interested. Can you send the deliverability benchmarks you mentioned? Our current provider has been rough.', 10]], { unread: true, label: 'interested', labelIds: ['lbl_lead'], assigneeId: 'u_2' });
  add(1, 1, `Re: Partnering with ${co(1)}`, [['out', 'We work with agencies on white-label outbound. Open to a call?', 60], ['in', 'The white-label angle is compelling if the reporting can carry our branding. What does onboarding look like?', 26]], { unread: true, label: 'question', labelIds: ['lbl_lead'], tags: ['vip'], starred: true });
  add(2, 2, `Quick question about ${co(2)}`, [['out', 'Hi, quick question about your outbound setup.', 70], ['in', 'Hi, I am out of office until next Monday with limited access to email.', 50]], { label: 'out-of-office' });
  add(3, 0, `Renewal check-in, ${co(3)}`, [['out', 'Checking in ahead of your renewal next month.', 120], ['in', 'Thanks for the note, the renewal is on track. Can you send the updated invoice?', 30]], { unread: true, label: 'question', labelIds: ['lbl_customer'], tags: ['renewal'] });
  add(4, 1, `Re: Quick question about ${co(4)}`, [['out', 'Wanted to share a short idea for your team.', 150], ['in', 'Not interested, please remove me from your list.', 100]], { label: 'not-interested', labelIds: ['lbl_churn'], archived: true });
  add(5, 2, `Re: Quick question about ${co(5)}`, [['out', 'Hi, a quick question on how you source leads.', 90], ['in', 'Sounds interesting. What does pricing look like?', 40], ['out', 'Happy to share, pricing starts at $79/mo per mailbox. Want a walkthrough on Thursday?', 20]], { label: 'interested', labelIds: ['lbl_lead'] });
  add(6, 0, `How does the warmup pool work?`, [['in', 'Hi, how does your warmup pool avoid looking like a network of throwaway accounts?', 5]], { unread: true, label: 'question', draft: `Hi ${pool[6 % pool.length].firstName},\n\nGood question. Short answer: the pool is made of monitored, real mailboxes that reply like people do. Happy to walk through it live if useful.\n\n${ws.settings.signature}` });
  add(7, 1, `Following up from the webinar`, [['out', 'Thanks for joining the webinar, here are the slides.', 200], ['in', 'Great session. Let us reconnect next quarter.', 140]], { label: 'none', snoozedUntil: new Date(now.getTime() + 20 * H).toISOString() });
  add(8, 2, 'Mail Delivery Subsystem: Delivery Status Notification (Failure)', [['in', 'Your message could not be delivered. The recipient address was not found. Please check the address and try again.', 75]], { label: 'none' });
  add(9, 0, 'Boost your SEO ranking in 24h!!!', [['in', 'FREE audit, act now. Guaranteed results, click here to claim your limited time offer.', 33]], { spam: true });
  add(10, 1, 'Old thread to delete', [['in', 'Please ignore this message.', 300]], { trashed: true });
  const drafts: T.Draft[] = [
    { id: 'dr_seed_1', kind: 'compose', mailboxId: mbs[0]?.id ?? '', to: pool[11 % pool.length].email, subject: 'Introduction from Acme', body: 'Hi,\n\nI wanted to introduce myself and share a quick idea.', createdAt: ago(3) },
    { id: 'dr_seed_2', kind: 'compose', mailboxId: mbs[1]?.id ?? '', to: pool[10 % pool.length].email, subject: 'Next steps and pricing', body: 'Hi,\n\nSending over the pricing we discussed.', scheduledAt: new Date(now.getTime() + 18 * H).toISOString(), createdAt: ago(1) },
  ];
  return { ...ws, contacts, threads: [...ws.threads, ...threads], drafts: [...ws.drafts, ...drafts] };
}

/** Build a believable workspace by running the real engine over the last `days` days. */
export function buildSeed(now: Date = new Date(), days = 7, seed = 7): T.Workspace {
  const rand = mulberry32(seed);
  let ws = baseWorkspace(now, rand);
  ws = { ...ws, mailboxes: ws.mailboxes.map(m => m.warmup.enabled ? { ...m, warmup: { ...m.warmup, day: Math.max(1, m.warmup.day - days) } } : m) };
  for (let d = days; d >= 1; d--) {
    const base = new Date(now.getTime() - d * 86_400_000);
    for (let h = 9; h < 17; h++) { const t = new Date(base); t.setHours(h, 0, 0, 0); ws = tick(ws, t, rand); }
    ws = rollDay(ws);
  }
  return seedInbox(reduce(ws, { type: 'settings/update', patch: {} }), now);
}
