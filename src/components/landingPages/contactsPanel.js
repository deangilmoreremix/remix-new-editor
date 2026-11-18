// Contacts tab of the Video Pages studio: import a CSV, get one personalized
// link per contact, see who watched, export the links.

import { parseCsv, guessMapping, buildContacts, exportLinksCsv, contactLabel, CONTACT_FIELDS, MAX_CONTACTS_PER_IMPORT } from '../../lib/landingPages/csv.js';
import { syncPanel } from './syncPanel.js';
import { addContacts, listContacts, removeContact, fetchContactStats, personalUrl } from '../../lib/landingPages/client.js';

const INPUT = 'rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:outline-none focus:border-primary/50';
const BTN = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white hover:border-primary/60 hover:text-primary transition-colors disabled:opacity-50';
const BTN_SM = 'rounded-lg border border-white/15 px-2.5 py-1 text-xs font-bold text-white hover:border-primary/60 hover:text-primary transition-colors';

const FIELD_LABELS = {
  '': 'Ignore',
  firstname: 'First name',
  lastname: 'Last name',
  company: 'Company',
  companylogo: 'Company logo (https image link)',
  role: 'Role',
  city: 'City',
  email: 'Email (kept private)',
  custom1: 'Custom 1',
  custom2: 'Custom 2',
  custom3: 'Custom 3',
};

const FILTERS = [
  ['all', 'All'],
  ['viewed', 'Viewed'],
  ['not-viewed', 'Not viewed yet'],
  ['no-cta', 'Watched, no click'],
];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = el('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * @param {object} o { page, getClient(): Promise<supabase>, toast(msg, type), copy(text, label) }
 * @returns {HTMLElement}
 */
export function contactsPanel({ page, getClient, toast, copy }) {
  const root = el('div', 'flex flex-col gap-4');
  const state = { contacts: [], stats: new Map(), filter: 'all' };

  const notice = el('p', 'text-xs text-secondary');
  const bar = el('div', 'flex flex-wrap items-center gap-2');
  const importBtn = el('button', BTN, 'Import CSV');
  importBtn.type = 'button';
  const file = el('input', 'sr-only');
  file.type = 'file';
  file.accept = '.csv,text/csv,text/plain';
  const exportBtn = el('button', BTN, 'Export CSV with links');
  exportBtn.type = 'button';
  const filterSel = el('select', INPUT);
  filterSel.setAttribute('aria-label', 'Filter contacts');
  FILTERS.forEach(([v, l]) => { const o = el('option', '', l); o.value = v; filterSel.appendChild(o); });
  bar.append(importBtn, file, exportBtn, filterSel);

  const importArea = el('div');
  const tableArea = el('div', 'rounded-2xl border border-white/10 bg-panel-bg overflow-x-auto');
  const sync = syncPanel({ page, getContacts: () => state.contacts, getClient, toast });
  root.append(notice, bar, importArea, tableArea, sync);

  const refreshNotice = () => {
    notice.textContent = page.published
      ? `Each contact gets their own link. Their name and company fill the {{tokens}} on the page; email stays private. Up to ${MAX_CONTACTS_PER_IMPORT} per import.`
      : 'Publish this page first: personal links only work once the page is live.';
  };

  async function load() {
    tableArea.replaceChildren(el('p', 'p-4 text-sm text-secondary', 'Loading contacts…'));
    try {
      const client = await getClient();
      const [contacts, stats] = await Promise.all([
        listContacts(client, page.id),
        fetchContactStats(client, page.id).catch(() => []),
      ]);
      state.contacts = contacts;
      state.stats = new Map(stats.map((s) => [s.contactId, s]));
      drawTable();
    } catch (err) {
      tableArea.replaceChildren(el('p', 'p-4 text-sm text-red-300', err.message || 'Could not load contacts.'));
    }
  }

  function visible() {
    return state.contacts.filter((c) => {
      const s = state.stats.get(c.id);
      if (state.filter === 'viewed') return !!s?.views;
      if (state.filter === 'not-viewed') return !s?.views;
      if (state.filter === 'no-cta') return !!s?.plays && !s?.ctaClicks;
      return true;
    });
  }

  function drawTable() {
    exportBtn.disabled = !state.contacts.length;
    const rows = visible();
    if (!state.contacts.length) {
      tableArea.replaceChildren(el('p', 'p-6 text-sm text-secondary text-center', 'No contacts yet. Import a CSV with a name, company or email column to create personal links.'));
      return;
    }
    const table = el('table', 'w-full text-sm');
    const head = el('tr', 'text-left text-[11px] uppercase tracking-wide text-secondary');
    ['Contact', 'Company', 'Views', 'Watched', 'CTA', 'Leads', 'Last seen', ''].forEach((h) => head.appendChild(el('th', 'px-3 py-2 font-bold whitespace-nowrap', h)));
    const thead = el('thead');
    thead.appendChild(head);
    const tbody = el('tbody');
    rows.forEach((c) => {
      const s = state.stats.get(c.id) || {};
      const tr = el('tr', 'border-t border-white/5');
      const name = el('td', 'px-3 py-2');
      name.append(el('div', 'font-bold', contactLabel(c)));
      if (c.fields?.email) name.append(el('div', 'text-xs text-secondary', c.fields.email));
      const cells = [
        c.fields?.company || '',
        String(s.views || 0),
        s.maxProgress ? `${s.maxProgress}%` : (s.plays ? 'Started' : '—'),
        String(s.ctaClicks || 0),
        String(s.leads || 0),
        s.lastSeen ? new Date(s.lastSeen).toLocaleString() : '—',
      ];
      tr.appendChild(name);
      cells.forEach((v) => tr.appendChild(el('td', 'px-3 py-2 whitespace-nowrap', v)));
      const actions = el('td', 'px-3 py-2 whitespace-nowrap text-right');
      const link = el('button', BTN_SM, 'Copy link');
      link.type = 'button';
      link.addEventListener('click', () => copy(personalUrl(page.id, c.id), 'Personal link'));
      const del = el('button', `${BTN_SM} ml-2 text-red-300`, 'Remove');
      del.type = 'button';
      del.addEventListener('click', async () => {
        if (!window.confirm(`Remove ${contactLabel(c)}? Their link will stop personalizing.`)) return;
        try { await removeContact(await getClient(), c.id); await load(); } catch (err) { toast(err.message, 'error'); }
      });
      actions.append(link, del);
      tr.appendChild(actions);
      tbody.appendChild(tr);
    });
    table.append(thead, tbody);
    tableArea.replaceChildren(table);
    if (!rows.length) tableArea.appendChild(el('p', 'p-4 text-sm text-secondary', 'No contacts match this filter.'));
  }

  // ---- CSV import
  function showImport(text) {
    const { headers, rows } = parseCsv(text);
    if (!headers.length || !rows.length) { toast('That file has no rows.', 'warning'); return; }
    const mapping = guessMapping(headers);
    const box = el('div', 'rounded-2xl border border-white/10 bg-panel-bg p-4 flex flex-col gap-3');
    box.appendChild(el('h3', 'text-sm font-extrabold uppercase tracking-wide', `Match your columns (${rows.length} rows)`));
    const grid = el('div', 'grid gap-2 sm:grid-cols-2 lg:grid-cols-3');
    headers.forEach((h, i) => {
      const w = el('label', 'flex flex-col gap-1 text-xs font-bold text-secondary');
      w.appendChild(el('span', 'truncate', `${h || `Column ${i + 1}`}  (e.g. ${rows[0][i] || '—'})`));
      const sel = el('select', INPUT);
      ['', ...CONTACT_FIELDS].forEach((f) => {
        const o = el('option', '', FIELD_LABELS[f] || f);
        o.value = f;
        sel.appendChild(o);
      });
      sel.value = mapping[i];
      sel.addEventListener('change', () => { mapping[i] = sel.value; summarize(); });
      w.appendChild(sel);
      grid.appendChild(w);
    });
    const summary = el('p', 'text-sm text-secondary');
    const go = el('button', `${BTN} bg-primary text-black border-primary`, 'Import');
    go.type = 'button';
    const cancel = el('button', BTN, 'Cancel');
    cancel.type = 'button';
    const existing = () => new Set(state.contacts.map((c) => String(c.fields?.email || '').toLowerCase()).filter(Boolean));
    const summarize = () => {
      const { contacts, skipped } = buildContacts(rows, mapping, { existing: existing() });
      const reasons = skipped.reduce((m, s) => ({ ...m, [s.reason]: (m[s.reason] || 0) + 1 }), {});
      const why = Object.entries(reasons).map(([r, n]) => `${n} ${r}`).join(', ');
      summary.textContent = `${contacts.length} contacts will be imported${skipped.length ? `; skipped: ${why}` : ''}.`;
      go.disabled = !contacts.length;
      return contacts;
    };
    go.addEventListener('click', async () => {
      const contacts = summarize();
      go.disabled = true;
      try {
        await addContacts(await getClient(), page.id, contacts);
        toast(`${contacts.length} contacts imported`, 'success');
        importArea.replaceChildren();
        await load();
      } catch (err) {
        toast(err.message || 'Import failed', 'error');
        go.disabled = false;
      }
    });
    cancel.addEventListener('click', () => importArea.replaceChildren());
    const actions = el('div', 'flex gap-2');
    actions.append(go, cancel);
    box.append(grid, summary, actions);
    importArea.replaceChildren(box);
    summarize();
  }

  importBtn.addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast('That file is too large (5MB max).', 'warning'); return; }
    showImport(await f.text());
  });
  exportBtn.addEventListener('click', () => {
    download(`video-page-${page.id}-links.csv`, exportLinksCsv(state.contacts, page.id, window.location.origin));
  });
  filterSel.addEventListener('change', () => { state.filter = filterSel.value; drawTable(); });

  refreshNotice();
  load();
  return root;
}
