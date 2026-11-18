// "Leads" tab of a landing page: who filled in the form (matched to their personal link), the page's conversion,
// a CSV, and where each lead is delivered (webhooks, e-mail, Kit / MailerLite), the same settings the timeline
// editor's List Builder has. Delivery settings are owner-only (never in the public page config).

import { fetchLeadRows, leadsToCsv, runWebhookTest, webhookTestMessage, fetchDeliveries, deliveriesSummary, fetchSigningSecret, ESP_PROVIDERS, espListLabel } from '../../lib/editor/addons/leadClient.js';
import { fetchPageStats, listContacts, loadFormSettings, saveFormSettings } from '../../lib/landingPages/client.js';
import { defaultFormSettings, sanitizeFormSettings, activeWebhooks } from '../../lib/landingPages/formSettings.js';

const INPUT = 'rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:outline-none focus:border-primary/50';
const BTN = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white hover:border-primary/60 hover:text-primary';
const PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-black text-black hover:bg-white';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** The contact's name for a personal link, or "Direct visit". */
export function contactLabel(contactId, byId) {
  if (!contactId) return 'Direct visit';
  const f = byId.get(contactId)?.fields || {};
  return [f.firstname, f.lastname].filter(Boolean).join(' ') || f.company || `Link ${String(contactId).slice(0, 6)}`;
}

export const KIND_LABEL = { 'lead-form': 'Lead Generator', 'list-builder': 'List Builder', personalizer: 'Personalizer' };

/** Rows for the table and the CSV: when, who, which form type, then every answer. */
export function leadTableRows(rows, byId) {
  return rows.map((r) => ({
    id: r.id, when: r.createdAt, kind: r.kind || 'lead-form', contactId: r.source?.contactId || null, who: contactLabel(r.source?.contactId, byId),
    page: r.source?.page || '', answers: r.data || {},
  }));
}

export function leadsPanel({ page, getClient, toast }) {
  const box = el('div', 'flex flex-col gap-4');
  box.appendChild(el('p', 'text-sm text-secondary', 'Loading…'));

  (async () => {
    const client = await getClient();
    const [leads, stats, contacts] = await Promise.all([
      fetchLeadRows(client, { projectId: page.id }),
      fetchPageStats(client, page.id).catch(() => null),
      listContacts(client, page.id).catch(() => []),
    ]);
    const byId = new Map(contacts.map((c) => [c.id, c]));
    const rows = leadTableRows(leads.rows, byId);
    box.replaceChildren();

    // KPIs
    const views = stats?.views || 0;
    const kpis = el('div', 'grid gap-3 grid-cols-2 md:grid-cols-6');
    const personal = rows.filter((r) => r.contactId).length;
    const byKind = (k) => rows.filter((r) => r.kind === k).length;
    [['Leads', rows.length], ['Lead Generator', byKind('lead-form')], ['List Builder', byKind('list-builder')], ['Personalizer', byKind('personalizer')], ['From personal links', personal], ['Of viewers signed up', views ? `${Math.min(100, Math.round((rows.length / views) * 100))}%` : '—']].forEach(([k, v]) => {
      const c = el('div', 'rounded-xl border border-white/10 bg-panel-bg p-4');
      c.append(el('div', 'text-[11px] uppercase tracking-wide text-secondary', k), el('div', 'text-2xl font-black', String(v)));
      kpis.appendChild(c);
    });
    box.appendChild(kpis);
    if (!leads.ok) box.appendChild(el('p', 'text-xs text-amber-300', `${leads.error} (sign in to see leads).`));
    if (!page.published) box.appendChild(el('p', 'text-xs text-secondary', 'Publish the page to start collecting leads.'));

    // Table
    const card = el('section', 'rounded-2xl border border-white/10 bg-panel-bg p-4 flex flex-col gap-3');
    const head = el('div', 'flex flex-wrap items-center gap-2');
    head.appendChild(el('h3', 'text-sm font-extrabold uppercase tracking-wide flex-1', 'Leads from this page'));
    const search = el('input', `${INPUT} w-48`); search.placeholder = 'Search'; search.type = 'search';
    const csv = el('button', BTN, 'Download CSV'); csv.type = 'button'; csv.disabled = !rows.length;
    head.append(search, csv);
    const table = el('div', 'overflow-x-auto');
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const shown = rows.filter((r) => !q || `${r.who} ${Object.values(r.answers).join(' ')}`.toLowerCase().includes(q));
      const cols = Array.from(new Set(shown.flatMap((r) => Object.keys(r.answers)))).slice(0, 8);
      if (!shown.length) { table.replaceChildren(el('p', 'text-sm text-secondary', rows.length ? 'No leads match.' : 'No leads yet. Form answers appear here, matched to the personal link they came from.')); return; }
      const t = el('table', 'w-full text-sm text-left');
      const th = el('tr', 'text-[11px] uppercase tracking-wide text-secondary');
      ['When', 'Who', 'Type', ...cols].forEach((c) => th.appendChild(el('th', 'px-2 py-1 whitespace-nowrap', c)));
      t.appendChild(el('thead')).appendChild(th);
      const tb = el('tbody');
      shown.forEach((r) => {
        const tr = el('tr', 'border-t border-white/5');
        tr.appendChild(el('td', 'px-2 py-1 whitespace-nowrap text-secondary', r.when ? new Date(r.when).toLocaleString() : ''));
        tr.appendChild(el('td', 'px-2 py-1 whitespace-nowrap', r.who));
        tr.appendChild(el('td', 'px-2 py-1 whitespace-nowrap text-secondary', KIND_LABEL[r.kind] || r.kind));
        cols.forEach((c) => tr.appendChild(el('td', 'px-2 py-1', String(r.answers[c] ?? ''))));
        tb.appendChild(tr);
      });
      t.appendChild(tb); table.replaceChildren(t);
    };
    search.addEventListener('input', draw); draw();
    csv.addEventListener('click', () => {
      const out = leadsToCsv(rows.map((r) => ({ When: r.when, Who: r.who, Type: KIND_LABEL[r.kind] || r.kind, 'Personal link': r.contactId || '', ...r.answers })));
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out], { type: 'text/csv' })); a.download = `leads-${page.id}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });
    card.append(head, table);
    box.appendChild(card);

    box.appendChild(deliveryCard({ page, client, toast }));
  })().catch((err) => box.replaceChildren(el('p', 'text-sm text-red-300', err?.message || 'Could not load leads.')));

  return box;
}

/** Webhooks, notification e-mails and the e-mail list, saved to the owner-only settings row. */
export function deliveryCard({ page, client, toast }) {
  const card = el('details', 'rounded-2xl border border-white/10 bg-panel-bg p-4');
  card.appendChild(el('summary', 'cursor-pointer text-sm font-extrabold uppercase tracking-wide', 'Where leads go'));
  const body = el('div', 'flex flex-col gap-3 mt-3');
  card.appendChild(body);
  body.appendChild(el('p', 'text-xs text-secondary', 'Every lead is saved here first. These optional extras run after it is saved. Addresses are private to you and never appear on the public page.'));
  let s = defaultFormSettings();
  const field = (label, key, placeholder, type = 'text') => {
    const wrap = el('label', 'flex flex-col gap-1 text-xs text-secondary');
    wrap.appendChild(el('span', '', label));
    const i = el('input', INPUT); i.type = type; i.placeholder = placeholder || ''; i.value = s[key] || '';
    i.addEventListener('input', () => { s[key] = i.value; }); i.dataset.key = key;
    wrap.appendChild(i); return wrap;
  };
  const toggle = (label, key) => {
    const wrap = el('label', 'flex items-center gap-2 text-sm');
    const c = el('input'); c.type = 'checkbox'; c.checked = !!s[key]; c.dataset.key = key;
    c.addEventListener('change', () => { s[key] = c.checked; });
    wrap.append(c, el('span', '', label)); return wrap;
  };
  const status = el('p', 'text-xs text-secondary', '');
  const redraw = () => {
    body.querySelectorAll('[data-form]').forEach((n) => n.remove());
    const form = el('div', 'flex flex-col gap-3'); form.dataset.form = '1';
    form.append(
      toggle('Send each lead to a webhook', 'webhookEnabled'),
      field('Webhook address (https)', 'webhook', 'https://hooks.example.com/…', 'url'), field('Webhook address 2 (optional)', 'webhook2', '', 'url'), field('Webhook address 3 (optional)', 'webhook3', '', 'url'),
      toggle('E-mail me each lead', 'emailEnabled'),
      field('Notify (person 1)', 'emailAddress', 'you@example.com', 'email'), field('Notify (person 2, optional)', 'emailAddress2', '', 'email'), field('Notify (person 3, optional)', 'emailAddress3', '', 'email'),
    );
    const espWrap = el('label', 'flex flex-col gap-1 text-xs text-secondary'); espWrap.appendChild(el('span', '', 'Add leads to an email list'));
    const sel = el('select', INPUT);
    ESP_PROVIDERS.forEach(([id, name]) => { const o = el('option', '', name); o.value = id; if (id === s.espProvider) o.selected = true; sel.appendChild(o); });
    sel.addEventListener('change', () => { s.espProvider = sel.value; redraw(); });
    espWrap.appendChild(sel); form.appendChild(espWrap);
    if (s.espProvider) form.appendChild(field(espListLabel(s.espProvider), 'espListId', ''));
    const actions = el('div', 'flex flex-wrap gap-2');
    const save = el('button', PRIMARY, 'Save'); save.type = 'button';
    save.addEventListener('click', async () => {
      try { s = await saveFormSettings(client, page.id, s); status.textContent = 'Saved.'; toast?.('Delivery settings saved'); redraw(); }
      catch (err) { status.textContent = err?.message || 'Could not save.'; }
    });
    const test = el('button', BTN, 'Test webhook'); test.type = 'button';
    test.addEventListener('click', async () => {
      const urls = activeWebhooks(sanitizeFormSettings(s));
      if (!urls.length) { status.textContent = 'Switch the webhook on and enter a valid https address first.'; return; }
      status.textContent = 'Sending a test…';
      status.textContent = webhookTestMessage(await runWebhookTest(client, urls, { projectId: page.id, clipId: 'landing-page', kind: 'lead-form', data: { Email: 'test@example.com', Name: 'Test lead' } }));
    });
    const log = el('button', BTN, 'Recent deliveries'); log.type = 'button';
    log.addEventListener('click', async () => { status.textContent = deliveriesSummary(await fetchDeliveries(client)) || 'No deliveries yet.'; });
    const secret = el('button', BTN, 'Show signing secret'); secret.type = 'button';
    secret.addEventListener('click', async () => { const r = await fetchSigningSecret(client); status.textContent = r?.secret ? `Signing secret: ${r.secret}` : (r?.error || 'No signing secret is set up on the server.'); });
    actions.append(save, test, log, secret);
    form.append(actions, status);
    body.appendChild(form);
  };
  redraw();
  loadFormSettings(client, page.id).then((loaded) => { s = loaded; redraw(); }).catch(() => { /* the form stays at its defaults; saving still works */ });
  return card;
}
