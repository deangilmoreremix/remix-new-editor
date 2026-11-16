const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let token = localStorage.getItem('wb_token') || '';
async function api(method, path, body) {
  const r = await fetch('/api' + path, { method, headers: { authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401 && path !== '/login') { token = ''; localStorage.removeItem('wb_token'); render(); throw new Error('unauthorized'); }
  const d = await r.json(); if (!r.ok) throw new Error(d.error || r.statusText); return d;
}
const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '–');
const NAV = [['dashboard', 'Dashboard'], ['campaigns', 'Campaigns'], ['mailboxes', 'Mailboxes & Warmup'], ['inbox', 'Unified Inbox'], ['crm', 'CRM'], ['deliverability', 'Deliverability'], ['developers', 'API & Webhooks']];
const stat = (n, l) => `<div class="card stat"><b>${n}</b><span>${l}</span></div>`;
const form = (id, fields, label) => `<form id="${id}" class="card"><div class="row">${fields}</div><button>${label}</button> <span class="err" id="${id}-e"></span></form>`;
const onForm = (id, fn) => { const f = $('#' + id); f?.addEventListener('submit', async (e) => { e.preventDefault(); try { await fn(Object.fromEntries(new FormData(f))); render(); } catch (x) { $('#' + id + '-e').textContent = x.message; } }); };
const input = (name, ph, extra = '') => `<input name="${name}" placeholder="${ph}" ${extra}>`;

const pages = {
  async dashboard() {
    const d = await api('GET', '/dashboard'); const days = {};
    d.daily.forEach((r) => { if (r.type === 'sent') days[r.d] = r.n; }); const vals = Object.entries(days), max = Math.max(1, ...vals.map((v) => v[1]));
    return `<h1>Dashboard</h1><div class="sub">Outreach performance at a glance</div>
    <div class="grid">${stat(d.sent, 'Emails sent')}${stat(pct(d.opens, d.sent), 'Open rate')}${stat(pct(d.clicks, d.sent), 'Click rate')}${stat(pct(d.replies, d.sent), 'Reply rate')}${stat(d.bounces, 'Bounces')}${stat(d.contacts, 'Contacts')}${stat(d.activeCampaigns, 'Active campaigns')}${stat('$' + d.pipelineValue.toLocaleString(), 'Open pipeline')}</div>
    <div class="card"><h2>Sends, last 14 days</h2><div class="bars">${vals.map(([k, v]) => `<i title="${k}: ${v}" style="height:${(v / max) * 100}%"></i>`).join('') || '<span class="muted">No sends yet</span>'}</div></div>
    <button id="tick">Run scheduler now</button>`;
  },
  async campaigns() {
    const [cs, mbs] = await Promise.all([api('GET', '/campaigns'), api('GET', '/mailboxes')]);
    return `<h1>Campaigns</h1><div class="sub">Multi-step sequences with per-mailbox caps. Variables: {{first_name|there}}, {{company}}, {{title}}</div>
    <form id="nc" class="card"><div class="row">${input('name', 'Campaign name', 'required')}<select name="mb" multiple size="3" title="Mailboxes">${mbs.map((m) => `<option value="${m.id}">${esc(m.email)}</option>`).join('')}</select></div>
    ${[0, 1, 2].map((i) => `<div class="row">${input('s' + i + 'subject', 'Step ' + (i + 1) + ' subject')}${i ? input('s' + i + 'delay', 'Wait (days)', 'type=number value=3') : ''}</div><textarea name="s${i}body" placeholder="Step ${i + 1} body (leave blank to skip)"></textarea><br><br>`).join('')}
    <button>Create campaign</button> <span class="err" id="nc-e"></span></form>
    <div class="card"><table><tr><th>Name</th><th>Status</th><th>Enrolled</th><th>Sent</th><th>Open</th><th>Reply</th><th></th></tr>
    ${cs.map((c) => `<tr><td>${esc(c.name)}<div class="muted">${c.steps.length} steps</div></td><td><span class="pill ${c.status}">${c.status}</span></td><td>${c.enrolled}</td><td>${c.sent}</td><td>${pct(c.opens, c.sent)}</td><td>${pct(c.replies, c.sent)}</td>
    <td><button class="ghost" data-camp="${c.id}" data-s="${c.status === 'active' ? 'paused' : 'active'}">${c.status === 'active' ? 'Pause' : 'Launch'}</button></td></tr>`).join('') || '<tr><td class="muted">No campaigns yet</td></tr>'}</table></div>`;
  },
  async mailboxes() {
    const ms = await api('GET', '/mailboxes');
    return `<h1>Mailboxes &amp; Warmup</h1><div class="sub">Connect SMTP mailboxes. Warmup ramps volume daily across your pool. Without SMTP host (or nodemailer installed) sends are simulated.</div>
    ${form('nm', input('email', 'mailbox@domain.com', 'required') + input('name', 'Sender name') + input('smtp_host', 'SMTP host') + input('smtp_port', 'Port', 'type=number') + input('smtp_user', 'SMTP user') + input('smtp_pass', 'SMTP password', 'type=password') + input('daily_cap', 'Daily cap', 'type=number value=40'), 'Add mailbox')}
    <div class="card"><table><tr><th>Mailbox</th><th>Today</th><th>Warmup day</th><th>Health</th><th>Warmup</th></tr>
    ${ms.map((m) => `<tr><td>${esc(m.email)}<div class="muted">${esc(m.smtp_host || 'simulated')}</div></td><td>${m.sent_today}/${m.daily_cap}</td><td>${m.warmup ? m.warmup_day + ' (quota ' + m.warmup_quota + ')' : '–'}</td><td>${m.health}%</td>
    <td><button class="ghost" data-mb="${m.id}" data-w="${m.warmup ? 0 : 1}">${m.warmup ? 'Stop' : 'Start'}</button></td></tr>`).join('') || '<tr><td class="muted">No mailboxes</td></tr>'}</table></div>`;
  },
  async inbox() {
    const m = await api('GET', '/inbox');
    return `<h1>Unified Inbox</h1><div class="sub">Replies across all mailboxes. Log a reply (or POST /api/replies from your IMAP/webhook bridge) to stop the sequence.</div>
    ${form('rp', input('contact_id', 'Contact ID', 'type=number required') + input('body', 'Reply text'), 'Log reply')}
    ${m.map((x) => `<div class="card"><b>${esc(x.first_name || '')} ${esc(x.last_name || '')}</b> <span class="muted">${esc(x.from_addr)} · ${esc(x.company || '')} · ${new Date(x.created_at).toLocaleString()}</span><p>${esc(x.body)}</p></div>`).join('') || '<div class="card muted">No replies yet</div>'}`;
  },
  async crm() {
    const [cs, ds, ts] = await Promise.all([api('GET', '/contacts'), api('GET', '/deals'), api('GET', '/tasks')]);
    const stages = ['new', 'qualified', 'meeting', 'won', 'lost'];
    return `<h1>CRM</h1><div class="sub">Contacts, deal pipeline and tasks</div>
    ${form('ncn', input('email', 'email', 'required') + input('first_name', 'First') + input('last_name', 'Last') + input('company', 'Company') + input('title', 'Title'), 'Add contact')}
    <form id="imp" class="card"><h2>Bulk import (CSV: email,first_name,last_name,company,title)</h2><textarea name="csv"></textarea><br><br><button>Import</button> <span id="imp-e" class="err"></span></form>
    ${form('nd', input('title', 'Deal title', 'required') + input('value', 'Value', 'type=number') + `<select name="contact_id"><option value="">Contact…</option>${cs.map((c) => `<option value="${c.id}">${esc(c.email)}</option>`).join('')}</select>`, 'Add deal')}
    <div class="kanban">${stages.map((s) => `<div class="col"><h3>${s}</h3>${ds.filter((d) => d.stage === s).map((d) => `<div class="deal">${esc(d.title)}<div class="muted">$${d.value} · ${esc(d.email || '')}</div>
    <select data-deal="${d.id}">${stages.map((x) => `<option ${x === s ? 'selected' : ''}>${x}</option>`).join('')}</select></div>`).join('')}</div>`).join('')}</div><br>
    <div class="card"><h2>Contacts (${cs.length})</h2><table><tr><th>ID</th><th>Email</th><th>Name</th><th>Company</th><th>Stage</th></tr>${cs.map((c) => `<tr><td>${c.id}</td><td>${esc(c.email)}</td><td>${esc(c.first_name + ' ' + c.last_name)}</td><td>${esc(c.company)}</td><td><span class="pill">${esc(c.stage)}</span></td></tr>`).join('')}</table></div>
    ${form('nt', input('title', 'New task', 'required') + input('due', '', 'type=date'), 'Add task')}
    <div class="card">${ts.map((t) => `<label style="display:block"><input type="checkbox" style="width:auto" data-task="${t.id}" ${t.done ? 'checked' : ''}> ${esc(t.title)} <span class="muted">${esc(t.due || '')}</span></label>`).join('') || '<span class="muted">No tasks</span>'}</div>`;
  },
  async deliverability() {
    const s = await api('GET', '/suppressions');
    return `<h1>Deliverability</h1><div class="sub">Bounces, unsubscribes and manual blocks are suppressed automatically and never emailed again.</div>
    ${form('ns', input('email', 'email to suppress', 'required') + input('reason', 'Reason'), 'Suppress')}
    <div class="card"><table><tr><th>Email</th><th>Reason</th><th>Added</th><th></th></tr>${s.map((x) => `<tr><td>${esc(x.email)}</td><td><span class="pill ${x.reason}">${esc(x.reason)}</span></td><td>${new Date(x.created_at).toLocaleDateString()}</td><td><button class="ghost" data-unsup="${esc(x.email)}">Remove</button></td></tr>`).join('') || '<tr><td class="muted">Empty</td></tr>'}</table></div>`;
  },
  async developers() {
    const [k, w] = await Promise.all([api('GET', '/keys'), api('GET', '/webhooks')]);
    return `<h1>API &amp; Webhooks</h1><div class="sub">Authenticate REST calls with <code>X-API-Key</code>. Webhooks receive sent, open, click, reply, bounce, unsubscribe events.</div>
    <div class="card"><button id="nk">Create API key</button><div id="newkey" class="muted"></div><table>${k.map((x) => `<tr><td><code>${esc(x.key)}</code></td><td><button class="ghost" data-delkey="${esc(x.key)}">Revoke</button></td></tr>`).join('')}</table></div>
    ${form('nw', input('url', 'https://example.com/hook', 'required') + input('events', 'events (comma list or *)', 'value=*'), 'Add webhook')}
    <div class="card">${w.map((x) => `<div><code>${esc(x.url)}</code> <span class="muted">${esc(x.events)}</span></div>`).join('') || '<span class="muted">No webhooks</span>'}</div>`;
  },
};

function bind() {
  $('#tick')?.addEventListener('click', async () => { await api('POST', '/tick'); render(); });
  onForm('nc', async (f) => {
    const fd = new FormData($('#nc')); const steps = [0, 1, 2].map((i) => ({ subject: f['s' + i + 'subject'], body: f['s' + i + 'body'], delay_days: +f['s' + i + 'delay'] || 3 })).filter((s) => s.body);
    if (!steps.length) throw new Error('add at least one step body');
    await api('POST', '/campaigns', { name: f.name, steps, mailbox_ids: fd.getAll('mb').map(Number) });
  });
  document.querySelectorAll('[data-camp]').forEach((b) => b.onclick = async () => { try { await api('PATCH', `/campaigns/${b.dataset.camp}`, { status: b.dataset.s }); render(); } catch (e) { alert(e.message); } });
  onForm('nm', (f) => api('POST', '/mailboxes', { ...f, smtp_port: +f.smtp_port || null, daily_cap: +f.daily_cap || 40 }));
  document.querySelectorAll('[data-mb]').forEach((b) => b.onclick = async () => { await api('PATCH', `/mailboxes/${b.dataset.mb}`, { warmup: b.dataset.w === '1' }); render(); });
  onForm('rp', (f) => api('POST', '/replies', { contact_id: +f.contact_id, body: f.body }));
  onForm('ncn', (f) => api('POST', '/contacts', f));
  onForm('imp', async (f) => {
    const [h, ...rows] = f.csv.trim().split('\n').map((l) => l.split(',').map((x) => x.trim())); const keys = h.map((x) => x.toLowerCase());
    await api('POST', '/contacts', { contacts: rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i]]))) });
  });
  onForm('nd', (f) => api('POST', '/deals', { title: f.title, value: +f.value || 0, contact_id: f.contact_id ? +f.contact_id : null }));
  document.querySelectorAll('[data-deal]').forEach((s) => s.onchange = async () => { await api('PATCH', `/deals/${s.dataset.deal}`, { stage: s.value }); render(); });
  onForm('nt', (f) => api('POST', '/tasks', f));
  document.querySelectorAll('[data-task]').forEach((c) => c.onchange = () => api('PATCH', `/tasks/${c.dataset.task}`, { done: c.checked }));
  onForm('ns', (f) => api('POST', '/suppressions', f));
  document.querySelectorAll('[data-unsup]').forEach((b) => b.onclick = async () => { await api('DELETE', '/suppressions/' + encodeURIComponent(b.dataset.unsup)); render(); });
  $('#nk')?.addEventListener('click', async () => { const r = await api('POST', '/keys', {}); $('#newkey').textContent = 'New key (copy now): ' + r.key; });
  document.querySelectorAll('[data-delkey]').forEach((b) => b.onclick = async () => { await api('DELETE', '/keys/' + b.dataset.delkey); render(); });
  onForm('nw', (f) => api('POST', '/webhooks', f));
}

async function render() {
  const root = $('#root');
  if (!token) {
    root.innerHTML = `<form class="card login" id="lg"><div class="logo">warm<span>bly</span></div><input type="password" name="password" placeholder="Admin password" autofocus><br><br><button>Sign in</button> <div class="err" id="lg-e"></div></form>`;
    $('#lg').onsubmit = async (e) => { e.preventDefault(); try { token = (await api('POST', '/login', { password: new FormData(e.target).get('password') })).token; localStorage.setItem('wb_token', token); render(); } catch (x) { $('#lg-e').textContent = x.message; } };
    return;
  }
  const page = (location.hash.slice(1) || 'dashboard'); const fn = pages[page] || pages.dashboard;
  root.innerHTML = `<div class="app"><nav><div class="logo">warm<span>bly</span></div>${NAV.map(([k, l]) => `<a href="#${k}" class="${k === page ? 'active' : ''}">${l}</a>`).join('')}<a href="#" id="out">Sign out</a></nav><main>Loading…</main></div>`;
  $('#out').onclick = () => { localStorage.removeItem('wb_token'); token = ''; render(); };
  try { $('main').innerHTML = await fn(); bind(); } catch (e) { $('main').innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}
addEventListener('hashchange', render); render();
