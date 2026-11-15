/**
 * "Leads & alerts" tab: for the published video, the leads people left, the alerts that were raised (retarget alerts included), whether
 * each one reached the owner's phone or desktop, and the top follow-up suggestion: one place instead of four. Plain DOM like the other
 * Projects views; every value from the database is escaped before it is shown.
 */
import { enablePush } from '../../../../features/personalization/shared/personalization/notify/pushClient';
import { loadVideoAlerts } from './alertsData.js';
import { leadAnswers, pushHeadline, pushStatus, summarizeAlerts, typeLabel } from './alertsModel.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = (t) => { const d = new Date(t); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(); };
const wrap = (panel, html) => { panel.innerHTML = `<div class="sv-analytics sv-editor">${html}</div>`; return panel.firstElementChild; };

export function leadsAlertsTab(deps) {
  return (panel, ctx) => {
    let alive = true;
    const load = async () => {
      wrap(panel, '<div class="prj-skel" aria-busy="true"><i></i></div>');
      try {
        const client = await deps.getClient();
        const d = await (deps.loadFn || loadVideoAlerts)(client, ctx.project.videoId);
        if (!alive) return;
        const pctx = { pushedKnown: d.pushedKnown, configured: d.server.configured, devices: d.server.devices, now: d.now };
        const sum = summarizeAlerts(d.notes, pctx); const head = pushHeadline(d.server);
        const root = wrap(panel, `
          <div class="sv-heading"><div><div class="sv-breadcrumb">${esc(ctx.project.name || 'This video')}</div><h1>Leads &amp; alerts</h1></div></div>
          <div class="sv-card" data-testid="la-summary"><h3>At a glance</h3>
            <p class="sv-subtitle"><strong>${esc(d.leads.count)}</strong> lead${d.leads.count === 1 ? '' : 's'} &middot; <strong>${esc(sum.unread)}</strong> unread alert${sum.unread === 1 ? '' : 's'} &middot; ${esc(sum.pushed)} sent to your devices</p>
            <p class="sv-hint" data-testid="la-push">${esc(head.text)}</p>
            ${head.state === 'no-device' || head.state === 'on' ? `<button type="button" class="sv-secondary-btn" data-enable>${head.state === 'on' ? 'Turn on for this device too' : 'Turn on notifications on this device'}</button> <span class="sv-hint" data-enable-msg role="status"></span>` : ''}
          </div>
          <div class="sv-card" data-testid="la-leads"><h3>Leads</h3>
            ${d.leads.error ? `<p class="sv-subtitle" role="alert">${esc(d.leads.error)}</p>` : d.leads.rows.length ? d.leads.rows.map((l) => `<div class="sv-opportunity" style="cursor:default"><span class="sv-op-content"><strong>${esc(l.kind === 'list-builder' ? 'List Builder sign-up' : 'Lead form')} &middot; ${esc(when(l.created_at))}</strong>${leadAnswers(l.data).map((a) => `<span>${esc(a)}</span>`).join('')}</span></div>`).join('') : '<p class="sv-subtitle">No leads yet. They appear here as soon as someone fills in the form on your published video.</p>'}
            ${d.leads.count > d.leads.rows.length ? `<p class="sv-hint">Showing the latest ${esc(d.leads.rows.length)} of ${esc(d.leads.count)}.</p>` : ''}
            <button type="button" class="sv-secondary-btn" data-open-leads>Open all leads</button>
          </div>
          <div class="sv-card" data-testid="la-alerts"><h3>Alerts</h3>
            ${d.notes.length ? d.notes.map((n) => { const s = pushStatus(n, pctx); return `<div class="sv-opportunity" data-n="${esc(n.id)}" style="cursor:default"><span class="sv-op-content"><strong>${n.read_at ? '' : '&#9679; '}${esc(n.title)}</strong><span>${esc(n.summary)}</span><span class="sv-hint">${esc(typeLabel(n.type))} &middot; ${esc(when(n.created_at))}</span><span class="sv-hint" data-push="${esc(s.state)}" title="${esc(s.reason)}"><strong>${esc(s.label)}</strong>: ${esc(s.reason)}</span></span></div>`; }).join('') : '<p class="sv-subtitle">No alerts yet. You are told when someone submits a form, clicks a button, or keeps coming back.</p>'}
            <button type="button" class="sv-secondary-btn" data-open-alerts>Open alert history and settings</button>
          </div>
          ${d.topRecommendation ? `<div class="sv-card" data-testid="la-retarget"><h3>Suggested follow-up</h3><p class="sv-subtitle"><strong>${esc(d.topRecommendation.title)}</strong></p><p class="sv-hint">${esc(d.topRecommendation.observed)} ${esc(d.topRecommendation.suggestion)}</p><button type="button" class="sv-secondary-btn" data-open-retarget>See retarget suggestions</button></div>` : ''}`);
        root.querySelector('[data-open-leads]')?.addEventListener('click', () => deps.openLeads?.());
        root.querySelector('[data-open-alerts]')?.addEventListener('click', () => ctx.openTab('notifications'));
        root.querySelector('[data-open-retarget]')?.addEventListener('click', () => ctx.openTab('retarget'));
        root.querySelector('[data-enable]')?.addEventListener('click', async (e) => {
          const btn = e.currentTarget; const msg = root.querySelector('[data-enable-msg]'); btn.disabled = true;
          const r = await (deps.enableFn || enablePush)(d.server.publicKey, undefined, 'This browser');
          if (!alive) return;
          if (r.ok) { msg.textContent = 'Notifications are on for this device.'; load(); } else { msg.textContent = r.message; btn.disabled = false; }
        });
      } catch (err) {
        if (alive) wrap(panel, `<div class="sv-card" role="alert"><h3>Could not load leads and alerts</h3><p class="sv-subtitle">${esc(err.message)}</p></div>`);
      }
    };
    load();
    return () => { alive = false; };
  };
}
