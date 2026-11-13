// "Send to MailerLite" box on the Contacts tab: save a token, pick a group,
// send contacts (with their personal link in a "video page url" field) or the
// page's lead-form submissions.

import { callSync, getSyncKey, setSyncKey, contactsToPush, leadsToPush, pushInBatches } from '../../lib/landingPages/syncClient.js';

const INPUT = 'rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:outline-none focus:border-primary/50';
const BTN = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white hover:border-primary/60 hover:text-primary transition-colors disabled:opacity-50';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * @param {object} o { page, getContacts(): rows, getClient(): Promise<supabase>, toast }
 */
export function syncPanel({ page, getContacts, getClient, toast }) {
  const box = el('details', 'rounded-2xl border border-white/10 bg-panel-bg p-4');
  box.appendChild(el('summary', 'cursor-pointer text-sm font-extrabold uppercase tracking-wide', 'Send to MailerLite'));
  const body = el('div', 'flex flex-col gap-3 mt-3');
  box.appendChild(body);

  body.appendChild(el('p', 'text-xs text-secondary',
    'Uses your own MailerLite API token (MailerLite → Integrations → API). It is saved in this browser only and sent securely with each request; SmartVid never stores it. Each contact gets a “video page url” field holding their personal link, so your email can include it. Kit is not supported yet.'));

  const keyRow = el('div', 'flex flex-wrap items-center gap-2');
  const key = el('input', `${INPUT} flex-1 min-w-[14rem]`);
  key.type = 'password';
  key.autocomplete = 'off';
  key.placeholder = 'MailerLite API token';
  key.setAttribute('aria-label', 'MailerLite API token');
  key.value = getSyncKey();
  const connect = el('button', BTN, 'Connect');
  connect.type = 'button';
  const forget = el('button', BTN, 'Forget token');
  forget.type = 'button';
  keyRow.append(key, connect, forget);

  const groupSel = el('select', INPUT);
  groupSel.setAttribute('aria-label', 'MailerLite group');
  const none = el('option', '', 'No group (just add subscribers)');
  none.value = '';
  groupSel.appendChild(none);
  const sendContacts = el('button', BTN, 'Send contacts with links');
  const sendLeads = el('button', BTN, 'Send lead-form leads');
  [sendContacts, sendLeads].forEach((b) => { b.type = 'button'; b.disabled = true; });
  const actions = el('div', 'flex flex-wrap items-center gap-2');
  actions.append(groupSel, sendContacts, sendLeads);

  const status = el('p', 'text-sm text-secondary min-h-[1.25rem]');
  status.setAttribute('role', 'status');
  body.append(keyRow, actions, status);

  const setConnected = (on) => { sendContacts.disabled = sendLeads.disabled = !on; };
  const say = (msg) => { status.textContent = msg; };

  async function connectNow() {
    const token = key.value.trim();
    if (!token) { say('Paste your MailerLite API token first.'); return; }
    setSyncKey(token);
    connect.disabled = true;
    say('Checking…');
    try {
      await callSync('check', {}, { key: token });
      const { groups } = await callSync('groups', {}, { key: token });
      groupSel.replaceChildren(none);
      groups.forEach((g) => { const o = el('option', '', g.name); o.value = g.id; groupSel.appendChild(o); });
      setConnected(true);
      say(`Connected. ${groups.length} group${groups.length === 1 ? '' : 's'} found.`);
    } catch (err) {
      setConnected(false);
      say(err.message || 'Could not connect.');
    } finally {
      connect.disabled = false;
    }
  }

  async function send(rows, label) {
    if (!rows.length) { say(`No ${label} with an email address to send.`); return; }
    setConnected(false);
    say(`Sending ${rows.length} ${label}…`);
    try {
      const out = await pushInBatches(rows, {
        groupId: groupSel.value || null,
        onProgress: (done, total) => say(`Sent ${done} of ${total}…`),
      });
      const parts = [`${out.pushed} sent`];
      if (out.failed.length) parts.push(`${out.failed.length} not sent`);
      if (out.rateLimited) parts.push(`MailerLite is rate limiting; try again in ${out.retryAfter || 60}s`);
      say(parts.join(', ') + '.');
      toast(out.rateLimited || out.failed.length ? 'Sync finished with some contacts not sent' : `${out.pushed} contacts sent to MailerLite`, out.failed.length ? 'warning' : 'success');
    } catch (err) {
      say(err.message || 'Sync failed.');
    } finally {
      setConnected(true);
    }
  }

  connect.addEventListener('click', connectNow);
  forget.addEventListener('click', () => {
    setSyncKey('');
    key.value = '';
    setConnected(false);
    say('Token removed from this browser.');
  });
  sendContacts.addEventListener('click', () => send(contactsToPush(getContacts(), page.id, window.location.origin), 'contacts'));
  sendLeads.addEventListener('click', async () => {
    try {
      const client = await getClient();
      const { data, error } = await client.from('video_leads').select('data, created_at').eq('project_id', page.id).order('created_at', { ascending: false }).limit(1000);
      if (error) throw error;
      await send(leadsToPush(data || []), 'leads');
    } catch (err) {
      say(err.message || 'Could not load leads.');
    }
  });

  if (getSyncKey()) connectNow();
  return box;
}
