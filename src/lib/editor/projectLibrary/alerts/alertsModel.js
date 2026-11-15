/**
 * "Leads & alerts" model: pure functions that turn owner alerts, saved leads and the push set-up into plain-language facts.
 * No I/O. The push rules mirror the database function push_claim_for_video (migration 20261117000000): only alerts someone acted on are
 * pushed (not digests or milestones), only within 10 minutes, never when already read, and nothing is sent when no device is subscribed.
 */
import { NOTIFICATION_TYPES } from '../tabsData.js';

export const PUSHABLE_TYPES = Object.freeze(['new_lead', 'pricing_cta', 'contact_cta', 'high_interest', 'returning_engagement']);
export const PUSH_WINDOW_MINUTES = 10;
const TYPE_LABEL = Object.fromEntries(NOTIFICATION_TYPES);
export const typeLabel = (t) => TYPE_LABEL[t] || 'Alert';

/**
 * ctx: { pushedKnown: false when the pushed_at column could not be read, configured: true|false|null (null = unknown),
 *        devices: number|null (null = unknown), now: ms }
 * @returns {{state:'pushed'|'not-pushed'|'in-app-only'|'unknown', label:string, reason:string}}
 */
export function pushStatus(n, ctx = {}) {
  if (!n || !PUSHABLE_TYPES.includes(n.type)) return { state: 'in-app-only', label: 'App only', reason: 'This kind of alert is shown in the app only. It is never sent as a phone or desktop notification.' };
  if (ctx.pushedKnown === false) return { state: 'unknown', label: 'Unknown', reason: 'Whether this was sent is not available for this account yet.' };
  if (n.pushed_at) return { state: 'pushed', label: 'Sent', reason: 'A notification was sent to your devices.' };
  if (ctx.configured === false) return { state: 'not-pushed', label: 'Not sent', reason: 'Push notifications are not set up on this server yet.' };
  if (ctx.configured === true && ctx.devices === 0) return { state: 'not-pushed', label: 'Not sent', reason: 'No device had notifications turned on.' };
  if (n.read_at) return { state: 'not-pushed', label: 'Not sent', reason: 'You had already read it in the app.' };
  const ageMin = (Number(ctx.now) - Date.parse(n.created_at)) / 60000;
  if (Number.isFinite(ageMin) && ageMin > PUSH_WINDOW_MINUTES) return { state: 'not-pushed', label: 'Not sent', reason: `It was not sent within ${PUSH_WINDOW_MINUTES} minutes of happening, so it stayed in the app only.` };
  return { state: 'not-pushed', label: 'Not sent', reason: 'It was not sent. A device may have been unreachable.' };
}

export function summarizeAlerts(notes, ctx = {}) {
  const list = Array.isArray(notes) ? notes : [];
  const byType = {};
  let unread = 0; let pushed = 0; let notPushed = 0;
  for (const n of list) {
    if (!n.read_at) { unread += 1; byType[n.type] = (byType[n.type] || 0) + 1; }
    const s = pushStatus(n, ctx).state;
    if (s === 'pushed') pushed += 1; else if (s === 'not-pushed') notPushed += 1;
  }
  return { total: list.length, unread, unreadByType: byType, pushed, notPushed };
}

/** Where push stands for this owner, in words. */
export function pushHeadline(server = {}) {
  if (server.configured === false) return { state: 'off-server', text: 'Phone and desktop alerts are not set up on this server yet.' };
  if (server.configured === null || server.configured === undefined) return { state: 'unknown', text: server.error || 'Phone and desktop alerts could not be checked right now.' };
  if (!server.devices) return { state: 'no-device', text: 'No device has notifications turned on. Turn them on to get an alert the moment someone acts.' };
  return { state: 'on', text: `Notifications are on for ${server.devices} device${server.devices === 1 ? '' : 's'}.` };
}

const clip = (v, n) => { const s = String(v ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
/** The first few answers of a lead form, as short "label: value" pairs (never throws on odd data). */
export function leadAnswers(data, max = 3) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  return Object.entries(data).filter(([k, v]) => k && v !== null && v !== undefined && String(v).trim()).slice(0, max).map(([k, v]) => `${clip(k, 40)}: ${clip(v, 80)}`);
}
