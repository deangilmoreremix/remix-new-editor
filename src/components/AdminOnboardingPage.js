// src/components/AdminOnboardingPage.js
//
// #/admin/onboarding: the onboarding funnel for admins. Hidden (no menu or Apps entry). It shows nothing the server
// did not return: the report comes from /api/admin/onboarding-funnel, which answers only for the Clerk users listed in
// ADMIN_CLERK_USER_IDS. Anyone else (or no sign-in, or any failure) sees one plain line, with no hint of what is here.
// Every value is written with textContent, never as HTML.
const el = (tag, cls = '', txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt !== undefined) n.textContent = txt; return n; };
const day = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86_400_000);

/** Per stage: people, share of those who started, and the drop from the stage before (only from "Started" on). */
export function funnelRows(funnel = []) {
  const started = funnel.find((s) => s.key === 'start')?.people || 0;
  let prev = null;
  return funnel.map((s) => {
    const people = Number(s.people) || 0;
    const afterStart = s.key !== 'signup';
    const pct = afterStart && started > 0 ? Math.round((people / started) * 100) : null;
    const drop = afterStart && s.key !== 'start' && prev != null && prev > 0 && people <= prev ? Math.round(((prev - people) / prev) * 100) : null;
    if (afterStart) prev = people;
    return { key: s.key, label: String(s.label || s.key), people, pct, drop };
  });
}

export const formatSeconds = (s) => {
  if (s == null) return '-';
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return '-';
  const m = Math.floor(n / 60);
  return `${m}:${String(Math.round(n % 60)).padStart(2, '0')}`;
};

const TABLES = [
  ['top_goal', 'What they wanted first'], ['top_team', 'Team size'], ['top_volume', 'Videos per month'], ['top_heard', 'Heard about us'],
  ['top_first_studio', 'First studio'], ['top_types', 'Video types'], ['top_studios', 'Studios picked'],
];

export function AdminOnboardingPage({ fetchImpl = (...a) => globalThis.fetch(...a), getToken = async () => globalThis.window?.Clerk?.session?.getToken?.() || null, now = () => new Date() } = {}) {
  const root = el('div', 'w-full h-full overflow-y-auto bg-app-bg text-white');
  root.setAttribute('data-admin-onboarding', '');
  const inner = el('div', 'mx-auto w-full max-w-5xl px-4 py-8 md:px-8 md:py-12');
  root.appendChild(inner);

  const unavailable = () => { inner.replaceChildren(el('p', 'py-24 text-center text-sm text-white/60', 'This page is not available.')); };
  let seq = 0;

  async function load(from, to) {
    const mine = ++seq;
    inner.replaceChildren(el('p', 'py-24 text-center text-sm text-white/50', 'Loading...'));
    let token = null;
    try { token = await getToken(); } catch { token = null; }
    if (!token) { if (mine === seq) unavailable(); return; }
    let body = null;
    try {
      const res = await fetchImpl(`/api/admin/onboarding-funnel?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) body = await res.json();
    } catch { body = null; }
    if (mine !== seq) return;
    if (!body || body.ok !== true || !Array.isArray(body.funnel)) { unavailable(); return; }
    draw(body, from, to);
  }

  function draw(r, from, to) {
    inner.replaceChildren();
    inner.appendChild(el('h1', 'text-3xl font-black tracking-tight', 'Onboarding funnel'));
    inner.appendChild(el('p', 'mt-1 text-sm text-white/50', 'People are counted once, by account when signed in, otherwise by browser.'));

    const controls = el('div', 'mt-6 flex flex-wrap items-center gap-2');
    const preset = (label, days) => {
      const b = el('button', 'h-9 rounded-full border border-white/15 px-4 text-sm font-semibold text-white/70 hover:text-white', label);
      b.type = 'button'; b.setAttribute('data-range-preset', String(days));
      b.addEventListener('click', () => { const end = now(); load(day(addDays(end, -days)), day(end)); });
      return b;
    };
    const fromIn = el('input', 'h-9 rounded-lg border border-white/15 bg-transparent px-2 text-sm'); fromIn.type = 'date'; fromIn.value = from; fromIn.setAttribute('aria-label', 'From'); fromIn.setAttribute('data-range-from', '');
    const toIn = el('input', 'h-9 rounded-lg border border-white/15 bg-transparent px-2 text-sm'); toIn.type = 'date'; toIn.value = to; toIn.setAttribute('aria-label', 'To'); toIn.setAttribute('data-range-to', '');
    const apply = el('button', 'h-9 rounded-full border border-primary/50 px-4 text-sm font-bold text-primary', 'Apply'); apply.type = 'button'; apply.setAttribute('data-range-apply', '');
    apply.addEventListener('click', () => { if (fromIn.value && toIn.value) load(fromIn.value, toIn.value); });
    controls.append(preset('7 days', 7), preset('30 days', 30), preset('90 days', 90), fromIn, el('span', 'text-white/40', 'to'), toIn, apply);
    inner.appendChild(controls);

    // summary
    const finished = r.funnel.find((s) => s.key === 'complete')?.people || 0;
    const started = r.funnel.find((s) => s.key === 'start')?.people || 0;
    const cards = el('div', 'mt-6 grid grid-cols-2 gap-3 md:grid-cols-4');
    const card = (label, value, attr) => { const c = el('div', 'rounded-2xl border border-white/10 p-4'); c.setAttribute(attr, ''); c.append(el('div', 'text-2xl font-black', String(value)), el('div', 'mt-1 text-xs text-white/50', label)); return c; };
    cards.append(
      card('Finished', started > 0 ? `${finished} (${Math.round((finished / started) * 100)}%)` : String(finished), 'data-card-finished'),
      card('Left for the Academy', Number(r.left_for_academy) || 0, 'data-card-academy'),
      card('Median time to finish', formatSeconds(r.median_seconds_to_complete), 'data-card-median'),
      card('Muapi keys saved / tested OK', `${Number(r.keys?.saved) || 0} / ${Number(r.keys?.tested_ok) || 0}`, 'data-card-keys'),
    );
    inner.appendChild(cards);

    // funnel
    const funnel = el('section', 'mt-8');
    funnel.setAttribute('data-funnel', '');
    funnel.appendChild(el('h2', 'mb-3 text-lg font-bold', 'Funnel'));
    const top = Math.max(1, ...funnelRows(r.funnel).map((x) => x.people));
    funnelRows(r.funnel).forEach((row) => {
      const line = el('div', 'mb-2');
      line.setAttribute('data-funnel-row', row.key);
      const head = el('div', 'flex items-baseline justify-between gap-3 text-sm');
      head.append(el('span', 'font-semibold', row.label), el('span', 'text-white/60', `${row.people}${row.pct != null ? ` · ${row.pct}%` : ''}${row.drop ? ` · -${row.drop}% from the step before` : ''}`));
      const track = el('div', 'mt-1 h-2 overflow-hidden rounded-full bg-white/10');
      const bar = el('div', 'h-full rounded-full bg-primary');
      bar.style.width = `${Math.round((row.people / top) * 100)}%`;
      track.appendChild(bar);
      line.append(head, track);
      funnel.appendChild(line);
    });
    inner.appendChild(funnel);

    // ranked tables
    const grid = el('div', 'mt-8 grid grid-cols-1 gap-4 md:grid-cols-2');
    TABLES.forEach(([key, title]) => {
      const rows = Array.isArray(r[key]) ? r[key] : [];
      const box = el('section', 'rounded-2xl border border-white/10 p-4');
      box.setAttribute('data-table', key);
      box.appendChild(el('h3', 'mb-2 text-sm font-bold text-white/80', title));
      if (!rows.length) box.appendChild(el('p', 'text-xs text-white/40', 'No answers yet.'));
      rows.forEach((x) => {
        const li = el('div', 'flex justify-between gap-3 py-0.5 text-sm');
        li.append(el('span', 'truncate text-white/80', String(x.value)), el('span', 'text-white/50', String(Number(x.count) || 0)));
        box.appendChild(li);
      });
      grid.appendChild(box);
    });
    inner.appendChild(grid);
  }

  const end = now();
  load(day(addDays(end, -30)), day(end));
  return root;
}
