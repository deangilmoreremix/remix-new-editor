/**
 * Audience, Retarget and Notifications tabs for the Projects detail view.
 * Plain DOM (matching the editor panels) using the supplied analytics design
 * classes (`sv-*`) so every tab looks like the Analytics tab. All figures come
 * from owner-only RPCs; nothing here is static or demo data.
 */
import {
  getProjectVideo, loadAudience, seedInterestMap, saveInterestMap, INTEREST_TYPES, loadFollowupComparison,
  listNotifications, markRead, NOTIFICATION_TYPES, loadPreferences, savePreferences,
} from './tabsData.js';
import { recommend, SEGMENT_LABELS, SCORE_EXPLANATION } from './retarget/recommendations.js';
import { listFollowups, loadProject } from './projectStore.js';
import { launchFollowup } from './retarget/followup.js';
import { canonicalUrl } from '../publish/publishClient.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const wrap = (panel, html) => { panel.innerHTML = `<div class="sv-analytics sv-dark">${html}</div>`; return panel.firstElementChild; };
const note = (text, role = 'status') => `<div class="sv-card"><p class="sv-subtitle" role="${role}">${esc(text)}</p></div>`;
const PERIOD_LABEL = { '7d': '7 days', '30d': '30 days', '90d': '90 days' };

async function withVideo(panel, ctx, deps, render) {
  wrap(panel, '<div class="prj-skel" aria-busy="true"><i></i><i></i></div>');
  try {
    const client = await deps.getClient();
    const video = await getProjectVideo(client, ctx.project.id);
    if (!video) { wrap(panel, `<div class="sv-card"><h3>Publish this video first</h3><p class="sv-subtitle">Viewer data is collected on the published video page. Publish it from Publish &amp; Share and this tab fills in as people watch.</p></div>`); return; }
    await render(client, video);
  } catch (err) {
    wrap(panel, `<div class="sv-card" role="alert"><h3>Could not load this view</h3><p class="sv-subtitle">${esc(err.message)}</p><button type="button" class="sv-primary-btn" data-retry>Try again</button></div>`);
    panel.querySelector('[data-retry]')?.addEventListener('click', () => withVideo(panel, ctx, deps, render));
  }
}

// ---------------------------------------------------------------- Audience
export function audienceTab(deps) {
  return (panel, ctx) => {
    let alive = true; let period = '30d';
    const draw = (client, video) => (async () => {
      const root = panel.querySelector('.sv-analytics');
      const a = await loadAudience(client, video.id, period, deps.now?.());
      if (!alive) return;
      const total = (a.segments.new_viewers || 0) + (a.segments.returning_viewers || 0);
      const maxScore = Math.max(1, ...a.interests.map((i) => i.decayed_score));
      root.innerHTML = `
        <div class="sv-heading"><div><div class="sv-breadcrumb">Observed engagement</div><h1>Audience insights</h1></div>
          <div class="sv-segment" role="group" aria-label="Reporting period">${Object.entries(PERIOD_LABEL).map(([k, l]) => `<button type="button" data-p="${k}" aria-pressed="${k === period}" class="${k === period ? 'active' : ''}">${l}</button>`).join('')}</div></div>
        <p class="sv-hint">${esc(SCORE_EXPLANATION)}</p>
        ${total === 0 ? note('No viewing sessions in this period yet. Segments and interests appear as people watch.') : `
        <div class="sv-stat-grid">${Object.entries(SEGMENT_LABELS).map(([k, l]) => `<div class="sv-stat"><div class="sv-stat-label">${esc(l)}</div><div class="sv-stat-value">${a.segments[k] ?? 0}</div></div>`).join('')}</div>
        <div class="sv-card"><h3>Interest in your topics</h3><p class="sv-subtitle">Sessions, with recent activity counting more. Map sections to interests in the Retarget tab.</p>
          ${a.interests.length ? `<div class="sv-bars">${a.interests.map((i) => `<div class="sv-bar-row"><div class="sv-bar-label" title="${esc(i.interest_type)}">${esc(i.interest)}</div><div class="sv-bar-track"><div class="sv-bar-fill" style="width:${(i.decayed_score / maxScore) * 100}%"></div></div><div class="sv-bar-number" title="${i.high_interest_sessions} high-interest">${i.sessions}</div></div>`).join('')}</div>` : '<p class="sv-subtitle sv-empty">No interests scored yet. Map video sections to products or services in the Retarget tab, then publish again.</p>'}
        </div>`}`;
      root.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => { period = b.dataset.p; draw(client, video).catch(fail); }));
    })();
    const fail = (err) => { if (alive) wrap(panel, `<div class="sv-card" role="alert"><p class="sv-subtitle">${esc(err.message)}</p></div>`); };
    withVideo(panel, ctx, deps, (client, video) => draw(client, video));
    return () => { alive = false; };
  };
}

// ---------------------------------------------------------------- Retarget
export function retargetTab(deps) {
  return (panel, ctx) => {
    let alive = true;
    withVideo(panel, ctx, deps, async (client, video) => {
      // The list row omits the heavy `data` column; the mapping editor needs the project's scenes.
      const original = (await loadProject(client, ctx.project.id)) || ctx.project;
      const [aud, followups] = await Promise.all([loadAudience(client, video.id, '30d', deps.now?.()), listFollowups(client, original.id)]);
      if (!alive) return;
      const map = seedInterestMap(original.data, video.project?.interestMap || original.settings?.interestMap);
      const url = video.published ? canonicalUrl(video) : null;
      const recs = recommend({ interests: aud.interests, segments: aud.segments, project: { projectId: original.id, projectName: original.name, videoUrl: url } });
      const compare = await loadFollowupComparison(client, original, followups, deps.now?.());
      if (!alive) return;
      const root = wrap(panel, `
        <div class="sv-heading"><div><div class="sv-breadcrumb">Last 30 days</div><h1>Retarget</h1></div></div>
        <div class="sv-card"><div class="sv-panel-head"><h3>Recommended follow-ups</h3><span class="sv-pill">${recs.length}</span></div>
          <p class="sv-subtitle">Recommendations are suggestions based on observed engagement. Nothing is sent to anyone automatically.</p>
          ${recs.length ? recs.map((r, i) => `<div class="sv-opportunity" style="cursor:default"><span class="sv-op-content"><strong>${esc(r.title)}</strong><span><b>Observed:</b> ${esc(r.observed)}</span><b>Recommendation: ${esc(r.suggestion)}</b></span><button type="button" class="sv-primary-btn" data-rec="${i}">Create follow-up</button></div>`).join('') : '<p class="sv-subtitle sv-empty">No recommendations yet. They appear once viewers show interest in a mapped section, pricing or a call to action.</p>'}
        </div>
        <div class="sv-card"><h3>Map sections to interests</h3>
          <p class="sv-subtitle">Tell SmartVideo what each part of your video is about. Sections come from your timeline scenes. Changes apply to viewers after you publish the video again.</p>
          ${map.length ? `<div data-map>${map.map((m, i) => `<div class="sv-section-bar" data-row="${i}"><div><span>${esc(m.title)} <small class="sv-subtitle">${fmtTime(m.start)}–${fmtTime(m.end)}${m.clipIds.length ? ` · ${m.clipIds.length} call${m.clipIds.length === 1 ? '' : 's'} to action` : ''}</small></span></div>
              <div class="sv-custom-range"><label>Type<select data-type="${i}">${INTEREST_TYPES.map((t) => `<option value="${t}" ${(m.interest?.type || 'service') === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
              <label>Product, service or topic<input type="text" maxlength="80" data-label="${i}" value="${esc(m.interest?.label || '')}" placeholder="e.g. Roof repair" /></label></div></div>`).join('')}
            <button type="button" class="sv-primary-btn" data-save-map>Save mapping</button> <span class="sv-hint" data-map-msg role="status"></span></div>`
            : '<p class="sv-subtitle">This project has fewer than two scenes. Add scenes to the timeline to map sections to interests.</p>'}
        </div>
        ${compare.length > 1 ? `<div class="sv-card"><h3>Original vs follow-ups</h3><div style="overflow:auto"><table class="pz-table"><thead><tr><th></th><th>Plays</th><th>Completed</th><th>CTA</th><th>Leads</th></tr></thead><tbody>${compare.map((r) => `<tr><td>${esc(r.kind)}: ${esc(r.name)}</td>${r.published ? `<td>${r.plays}</td><td>${r.completion == null ? '—' : r.completion + '%'}</td><td>${r.cta}</td><td>${r.leads}</td>` : '<td colspan="4"><span class="sv-hint">Not published yet</span></td>'}</tr>`).join('')}</tbody></table></div><p class="sv-hint">Last 90 days. Counts are viewing sessions, so compare similar audiences with care.</p></div>` : ''}`);
      const flash = (m) => { const el = root.querySelector('[data-map-msg]'); if (el) el.textContent = m; };
      root.querySelector('[data-save-map]')?.addEventListener('click', async () => {
        const entries = map.map((m, i) => ({ ...m, interest: root.querySelector(`[data-label="${i}"]`).value.trim() ? { type: root.querySelector(`[data-type="${i}"]`).value, label: root.querySelector(`[data-label="${i}"]`).value } : null }));
        try { const saved = await saveInterestMap(client, original.id, original.settings, entries); original.settings = { ...(original.settings || {}), interestMap: saved }; deps.onInterestMapSaved?.(saved); flash(`Saved ${saved.length} mapping${saved.length === 1 ? '' : 's'}. Publish again to apply it to viewers.`); } catch (e) { flash(e.message); }
      });
      root.querySelectorAll('[data-rec]').forEach((b) => b.addEventListener('click', async () => {
        b.disabled = true;
        try { await launchFollowup({ client, original, followup: recs[Number(b.dataset.rec)].followup, navigate: deps.navigate, videoUrl: url }); } catch (e) { b.disabled = false; deps.onToast?.(e.message, 'error'); }
      }));
    });
    return () => { alive = false; };
  };
}

// ---------------------------------------------------------------- Notifications
export function notificationsTab(deps) {
  return (panel, ctx, opts = {}) => {
    let alive = true;
    wrap(panel, '<div class="prj-skel" aria-busy="true"><i></i></div>');
    (async () => {
      try {
        const client = await deps.getClient();
        let [notes, prefs] = await Promise.all([listNotifications(client, ctx.project.id), loadPreferences(client)]);
        if (!alive) return;
        const draw = () => {
          const typeLabel = Object.fromEntries(NOTIFICATION_TYPES);
          const root = wrap(panel, `
            <div class="sv-heading"><div><div class="sv-breadcrumb">Owner alerts</div><h1>Notifications</h1></div>${notes.some((n) => !n.read_at) ? '<button type="button" class="sv-secondary-btn" data-read-all>Mark all as read</button>' : ''}</div>
            <div class="sv-card"><h3>History</h3>
              ${notes.length ? notes.map((n) => `<div class="sv-opportunity" data-n="${esc(n.id)}" style="cursor:default"><span class="sv-op-icon"><span class="sv-icon">${n.type === 'new_lead' || n.type === 'contact_cta' ? '♧' : n.type === 'pricing_cta' || n.type === 'interest_surge' || n.type === 'milestone' ? '↗' : '↻'}</span>${n.read_at ? '' : '<span class="sv-op-unread" role="img" aria-label="Unread"></span>'}</span>
                <span class="sv-op-content"><strong>${esc(n.title)}</strong><span>${esc(n.summary)}</span>${n.interest ? `<span>Interest: ${esc(n.interest)}</span>` : ''}${n.metrics?.score ? `<span>Observed engagement score: ${esc(n.metrics.score)}</span>` : ''}<span>${esc(typeLabel[n.type] || n.type)} · ${esc(new Date(n.created_at).toLocaleString())}</span>
                  <span class="sv-toolbar-actions" style="justify-content:flex-start;flex-wrap:wrap"><button type="button" class="sv-secondary-btn" data-go="analytics">View analytics</button><button type="button" class="sv-secondary-btn" data-go="audience">View engagement</button><button type="button" class="sv-secondary-btn" data-go="retarget">Open Retarget</button>${n.interest ? '<button type="button" class="sv-secondary-btn" data-follow>Create follow-up</button>' : ''}${n.read_at ? '' : '<button type="button" class="sv-secondary-btn" data-read>Mark as read</button>'}</span></span></div>`).join('') : '<p class="sv-subtitle sv-empty">No alerts for this video yet. You will be notified about new leads, high-interest viewers, pricing and contact clicks and milestones.</p>'}
            </div>
            <form class="sv-card" data-prefs aria-label="Notification preferences"><h3>Preferences</h3>
              <p class="sv-subtitle">Applies to all of your videos.</p>
              <div class="sv-custom-range" style="flex-direction:column">${NOTIFICATION_TYPES.map(([k, l]) => `<label style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" name="type" value="${k}" ${prefs.enabled_types.includes(k) ? 'checked' : ''}/> ${esc(l)}</label>`).join('')}</div>
              <div class="sv-custom-range"><label>High-interest threshold<input type="number" name="threshold" min="10" max="500" value="${esc(prefs.interest_threshold)}"/></label>
                <label>Digest<select name="digest"><option value="off">Off</option><option value="daily" ${prefs.digest_frequency === 'daily' ? 'selected' : ''}>Daily</option><option value="weekly" ${prefs.digest_frequency === 'weekly' ? 'selected' : ''}>Weekly</option></select></label></div>
              <label style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" name="inapp" ${prefs.in_app ? 'checked' : ''}/> In-app alerts</label>
              <label style="display:flex;gap:8px;align-items:center;margin:8px 0;opacity:.6"><input type="checkbox" name="email" disabled/> Email alerts</label>
              <p class="sv-hint">Email delivery requires configuration: no email provider is connected, so alerts stay in the app. Quiet hours and email preferences take effect once one is.</p>
              <button type="submit" class="sv-primary-btn">Save preferences</button> <span class="sv-hint" data-prefs-msg role="status"></span></form>`);
          root.querySelectorAll('[data-n]').forEach((el) => {
            const n = notes.find((x) => x.id === el.dataset.n);
            el.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => ctx.openTab(b.dataset.go)));
            el.querySelector('[data-read]')?.addEventListener('click', async () => { await markRead(client, [n.id]); n.read_at = new Date().toISOString(); deps.onUnreadChanged?.(); draw(); });
            el.querySelector('[data-follow]')?.addEventListener('click', async () => {
              try { await launchFollowup({ client, original: ctx.project, followup: { interest: n.interest, interestType: n.metrics?.type || 'topic', ctaPurpose: 'learn_more', suggestedMessage: `Follow up on ${n.interest}.` }, navigate: deps.navigate }); } catch (e) { deps.onToast?.(e.message, 'error'); }
            });
            if (opts.focusId === n.id) { el.scrollIntoView?.({ block: 'center' }); if (!n.read_at) markRead(client, [n.id]).then(() => { n.read_at = new Date().toISOString(); deps.onUnreadChanged?.(); draw(); }).catch(() => {}); }
          });
          root.querySelector('[data-read-all]')?.addEventListener('click', async () => { await markRead(client, notes.filter((n) => !n.read_at).map((n) => n.id)); notes.forEach((n) => { n.read_at = n.read_at || new Date().toISOString(); }); deps.onUnreadChanged?.(); draw(); });
          root.querySelector('[data-prefs]').addEventListener('submit', async (e) => {
            e.preventDefault();
            const f = e.currentTarget;
            const msg = f.querySelector('[data-prefs-msg]');
            try {
              prefs = await savePreferences(client, { ...prefs, enabled_types: [...f.querySelectorAll('[name=type]:checked')].map((x) => x.value), interest_threshold: f.querySelector('[name=threshold]').value, digest_frequency: f.querySelector('[name=digest]').value, in_app: f.querySelector('[name=inapp]').checked, email: false });
              msg.textContent = 'Saved.';
            } catch (err) { msg.textContent = err.message; }
          });
        };
        draw();
      } catch (err) {
        if (alive) wrap(panel, `<div class="sv-card" role="alert"><h3>Could not load notifications</h3><p class="sv-subtitle">${esc(err.message)}</p></div>`);
      }
    })();
    return () => { alive = false; };
  };
}
