/**
 * Share panel: publish the timeline as an interactive video, then copy its
 * link or embed code, see views and leads, update or unpublish it.
 */
import { watchUrl, embedCode, canonicalUrl, validateSlug, slugify } from './publishClient.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * @param {HTMLElement} container
 * @param {object} o
 *   getInfo()      → { id, title, published, view_count, updated_at } | null (current project's video)
 *   publish({ title }) → Promise<info>     (create or update)
 *   setPublished(bool) → Promise
 *   countLeads()   → Promise<number|null>
 *   copy(text)     → Promise
 *   personalLinks(link) → [{ name, email, company, link }]   one link per contact
 *   downloadCsv(rows)
 *   fetchStats()   → Promise<[{ contactId, views, plays, completes, ctaClicks, leads, lastSeen }]>
 *   contactLabel(id) → display name for a contact id
 *   defaultTitle
 *   saveLink({ business?, slug }) → Promise<info>   claim business name (if given) and set the video's slug
 *   setPrivacy('public'|'unlisted') → Promise
 *   listRevisions() → Promise<[{ revision, title, created_at }]>
 */
export function renderSharePanel(container, opts) {
  const ui = { info: null, busy: false, error: '', leads: null, copied: '', stats: null, statsError: '', revisions: null, linkMsg: '' };
  const urlOf = (info) => canonicalUrl(info);

  // Views, plays, completions, CTA clicks and leads per contact (personal
  // links carry ?c=<contactId>; plain links count as "Everyone else").
  const statsHtml = () => {
    if (!opts.fetchStats) return '';
    if (ui.statsError) return `<div class="share-stats-table pz-ui"><p class="pz-warning">${esc(ui.statsError)}</p></div>`;
    if (!ui.stats) return '<div class="share-stats-table pz-ui"><p class="pz-hint">Loading views by contact…</p></div>';
    const rows = ui.stats;
    const body = rows.length
      ? rows.map((r) => `<tr><td>${esc(r.contactId ? (opts.contactLabel?.(r.contactId) || 'Removed contact') : 'Everyone else')}</td><td>${r.views}</td><td>${r.plays}</td><td>${r.completes}</td><td>${r.ctaClicks}</td><td>${r.leads}</td></tr>`).join('')
      : '<tr><td colspan="6"><span class="pz-hint">No views yet. Send personal links to see who watched.</span></td></tr>';
    return `<div class="share-stats-table pz-ui">
      <div class="share-personal__head"><span class="pz-label" style="margin:0;flex:1">Views by contact</span><button type="button" class="pz-btn pz-btn-secondary pz-btn-xs" data-share-stats-refresh>Refresh</button></div>
      <div style="max-height:240px;overflow:auto"><table class="pz-table"><thead><tr><th>Contact</th><th>Opened</th><th>Played</th><th>Finished</th><th>Clicked</th><th>Leads</th></tr></thead><tbody>${body}</tbody></table></div>
    </div>`;
  };
  const loadStats = async () => {
    if (!opts.fetchStats || !ui.info?.published) return;
    try {
      ui.stats = await opts.fetchStats();
      ui.statsError = '';
    } catch (err) {
      ui.statsError = /video_events_by_contact|does not exist|PGRST202/i.test(String(err?.message || err?.code || ''))
        ? 'Views by contact will appear once the analytics update is installed on the database.'
        : `Couldn't load views by contact: ${err?.message || err}`;
    }
    draw();
  };

  // Personalized images a contact's link can't show.
  const rowIssue = (r) => {
    const parts = [
      ...(r.missing || []).map((m) => `no ${m}`),
      ...((r.localImages || []).length ? ['image saved only in this browser'] : []),
    ];
    return parts.length ? ` <span class="pz-chip pz-chip-warn share-personal__issue" title="Add or re-save it in the Personalize window's image finder">⚠ ${esc(parts.join(', '))}</span>` : '';
  };
  const imageNote = (rows) => {
    const n = rows.filter((r) => (r.missing || []).length || (r.localImages || []).length).length;
    return n ? `<p class="pz-warning">${n} contact${n === 1 ? "'s link is" : "s' links are"} missing a personalized image (marked ⚠). Add the image in the Personalize window's image finder, or set a fallback image on the Personalized Image.</p>` : '';
  };

  // Readable link: /v/<business>/<slug>. The database validates, reserves and
  // guarantees uniqueness; the inputs only give instant feedback.
  const linkEditorHtml = (info) => {
    if (!opts.saveLink) return '';
    const biz = info.business || '';
    const slug = info.slug || slugify(info.title, '');
    return `<div class="share-link-editor">
      <div class="addon-field"><span>Custom link</span>
        <span class="share-copy">
          ${biz ? `<code class="share-prefix">/v/${esc(biz)}/</code>` : '<input type="text" data-share-business maxlength="48" placeholder="your-business" aria-label="Business name in link" />'}
          <input type="text" data-share-slug maxlength="48" value="${esc(slug)}" placeholder="video-name" aria-label="Video name in link" />
          <button type="button" class="mini-btn" data-share-savelink>Save link</button>
        </span></div>
      <p class="addon-field__hint" data-share-linkmsg role="status">${esc(ui.linkMsg || (biz ? 'Old links keep working when you rename.' : 'Pick a business name once; it is yours alone and appears in all your links.'))}</p>
      <label class="addon-field"><span>Who can find it</span>
        <select data-share-privacy aria-label="Privacy">
          <option value="public" ${info.privacy !== 'unlisted' ? 'selected' : ''}>Public — search engines may list it</option>
          <option value="unlisted" ${info.privacy === 'unlisted' ? 'selected' : ''}>Unlisted — only people with the link</option>
        </select></label>
    </div>`;
  };
  const revisionsHtml = () => {
    if (!opts.listRevisions) return '';
    const rows = ui.revisions;
    const body = rows == null ? '<li class="pz-hint">Loading…</li>'
      : rows.length ? rows.map((r) => `<li>Revision ${Number(r.revision)} · ${esc(new Date(r.created_at).toLocaleString())}</li>`).join('')
        : '<li class="pz-hint">No published revisions yet.</li>';
    return `<details class="share-revisions" data-share-revisions><summary>Published revisions</summary><ul>${body}</ul></details>`;
  };

  // One link per Personalization Studio contact: their details fill the
  // video and their own Smart Speech line plays.
  const personalHtml = (link) => {
    const rows = opts.personalLinks?.(link) || [];
    if (!opts.personalLinks) return '';
    if (!rows.length) return '<p class="addon-field__hint">Personal links: add contacts in the Personalize window to get one link per contact.</p>';
    ui.rows = rows;
    return `<div class="share-personal pz-ui">
      <div class="share-personal__head"><strong>Personal links</strong><span>${rows.length} contact${rows.length === 1 ? '' : 's'}</span>
        <button type="button" class="mini-btn" data-share-csv>Download CSV</button></div>
      ${imageNote(rows)}
      <ul class="share-personal__list">${rows.slice(0, 100).map((r, i) => `<li><span title="${esc(r.email)}">${esc(r.name)}${rowIssue(r)}</span>
        <button type="button" class="mini-btn" data-share-personal="${i}">${ui.copied === `p${i}` ? 'Copied ✓' : 'Copy link'}</button></li>`).join('')}</ul>
      ${rows.length > 100 ? `<p class="addon-field__hint">Showing 100 of ${rows.length}. The CSV has them all.</p>` : ''}
    </div>`;
  };

  const draw = () => {
    const info = ui.info;
    const link = info ? urlOf(info) : '';
    container.innerHTML = `
      <div class="share-panel">
        <p class="addon-field__hint">Publish this timeline as an interactive video: viewers get your pauses, loops, skips, lead forms, CTA buttons and List Builder, and their leads come to you.</p>
        <label class="cap-row"><span>Title</span><input type="text" data-share-title maxlength="200" value="${esc(info?.title || opts.defaultTitle || 'Untitled video')}"/></label>
        ${ui.error ? `<p class="agent-msg agent-msg--error" role="alert">${esc(ui.error)}</p>` : ''}
        <div class="cap-actions">
          <button type="button" class="mini-btn cap-primary" data-share-publish ${ui.busy ? 'disabled' : ''}>${ui.busy ? 'Publishing…' : info ? (info.published ? 'Update published video' : 'Publish again') : 'Publish interactive video'}</button>
          ${info?.published ? '<button type="button" class="mini-btn" data-share-unpublish>Unpublish</button>' : ''}
        </div>
        ${info?.published ? `
          <div class="share-out">
            <label class="addon-field"><span>Link</span>
              <span class="share-copy"><input type="text" readonly value="${esc(link)}" data-share-link aria-label="Share link"/><button type="button" class="mini-btn" data-share-copy="link">${ui.copied === 'link' ? 'Copied ✓' : 'Copy'}</button></span></label>
            <label class="addon-field"><span>Embed code</span>
              <span class="share-copy"><textarea readonly rows="3" data-share-embed aria-label="Embed code">${esc(embedCode(info.id))}</textarea><button type="button" class="mini-btn" data-share-copy="embed">${ui.copied === 'embed' ? 'Copied ✓' : 'Copy'}</button></span></label>
            <p class="addon-field__hint">Personalize a link with the viewer's details, e.g. <code>${esc(link)}?firstname=Ann&amp;company=Acme</code> — {{tokens}} in your text fill in automatically.</p>
            <div class="share-stats"><span>👁 ${Number(info.view_count) || 0} views</span><span>✉️ ${ui.leads == null ? '–' : ui.leads} leads</span><a href="${esc(link)}" target="_blank" rel="noopener">Open ↗</a></div>
            ${linkEditorHtml(info)}
            ${personalHtml(link)}
            ${statsHtml()}
            ${revisionsHtml()}
            <p class="addon-field__hint">Changes in the editor go live when you press “Update published video”. Your editable project is never replaced by publishing.</p>
          </div>` : info ? '<p class="addon-field__hint">This video is unpublished — its link shows “not found”.</p>' : ''}
      </div>`;
  };

  const refresh = async () => {
    try {
      ui.info = await opts.getInfo?.();
      ui.leads = ui.info?.published ? await opts.countLeads?.().catch(() => null) : null;
    } catch (err) {
      ui.error = err?.message || '';
    }
    draw();
    loadStats();
  };

  const onClick = async (e) => {
    const b = e.target.closest('button');
    if (!b || !container.contains(b)) return;
    const d = b.dataset;
    if (d.sharePublish !== undefined) {
      // Read the title BEFORE redrawing: draw() rebuilds the input from saved state and would discard what was typed.
      const typedTitle = container.querySelector('[data-share-title]')?.value || opts.defaultTitle;
      ui.busy = true; ui.error = ''; draw();
      try {
        ui.info = await opts.publish({ title: typedTitle });
        ui.leads = await opts.countLeads?.().catch(() => null);
      } catch (err) {
        ui.error = err?.message || 'Publishing failed';
      }
      ui.busy = false;
      draw();
    } else if (d.shareUnpublish !== undefined) {
      try {
        await opts.setPublished(false);
        ui.info = { ...ui.info, published: false };
      } catch (err) {
        ui.error = err?.message || 'Could not unpublish';
      }
      draw();
    } else if (d.shareSavelink !== undefined) {
      const slug = container.querySelector('[data-share-slug]')?.value.trim().toLowerCase() || '';
      const business = container.querySelector('[data-share-business]')?.value.trim().toLowerCase() || null;
      const problem = validateSlug(slug) || (business ? validateSlug(business) : null);
      if (problem) { ui.linkMsg = problem; draw(); return; }
      if (!ui.info.business && !business) { ui.linkMsg = 'Choose a business name first.'; draw(); return; }
      try {
        ui.info = { ...ui.info, ...(await opts.saveLink({ business, slug })) };
        ui.linkMsg = 'Link saved. The old link still works.';
      } catch (err) {
        ui.linkMsg = err?.message || 'Could not save the link';
      }
      draw();
    } else if (d.shareStatsRefresh !== undefined) {
      ui.stats = null;
      draw();
      loadStats();
    } else if (d.shareCsv !== undefined) {
      opts.downloadCsv?.(ui.rows || []);
    } else if (d.sharePersonal !== undefined) {
      const row = (ui.rows || [])[Number(d.sharePersonal)];
      if (!row) return;
      try { await opts.copy(row.link); ui.copied = `p${d.sharePersonal}`; } catch { ui.copied = ''; }
      draw();
      setTimeout(() => { ui.copied = ''; draw(); }, 1800);
    } else if (d.shareCopy) {
      const text = d.shareCopy === 'link' ? urlOf(ui.info) : embedCode(ui.info.id);
      try { await opts.copy(text); ui.copied = d.shareCopy; } catch { ui.copied = ''; }
      draw();
      setTimeout(() => { ui.copied = ''; draw(); }, 1800);
    }
  };

  const onChange = async (e) => {
    if (e.target.matches('[data-share-privacy]')) {
      try { await opts.setPrivacy(e.target.value); ui.info = { ...ui.info, privacy: e.target.value }; ui.linkMsg = 'Privacy updated.'; } catch (err) { ui.linkMsg = err?.message || 'Could not update privacy'; }
      draw();
    }
  };
  const onToggle = async (e) => {
    if (e.target.matches('[data-share-revisions]') && e.target.open && ui.revisions == null) {
      try { ui.revisions = await opts.listRevisions(); } catch { ui.revisions = []; }
      const open = container.querySelector('[data-share-revisions]');
      draw();
      container.querySelector('[data-share-revisions]')?.setAttribute('open', '');
      void open;
    }
  };

  container.addEventListener('click', onClick);
  container.addEventListener('change', onChange);
  container.addEventListener('toggle', onToggle, true);
  draw();
  refresh();
  return {
    refresh,
    destroy() { container.removeEventListener('click', onClick); container.removeEventListener('change', onChange); container.removeEventListener('toggle', onToggle, true); },
  };
}
