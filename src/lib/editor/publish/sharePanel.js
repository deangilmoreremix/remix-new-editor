/**
 * Share panel: publish the timeline as an interactive video, then copy its
 * link or embed code, see views and leads, update or unpublish it.
 */
import { watchUrl, embedCode, canonicalUrl, validateSlug, slugify, personalizedUrl } from './publishClient.js';
import { effectiveVariables } from './personalLinksClient.js';

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
 *   links          stored personal links (?p=<id>), optional; without it (or before the database update) the panel
 *                  falls back to the older address-carried links from personalLinks():
 *     list() → Promise<[link]>            sync() → Promise<{ links, created, updated }>   one link per contact
 *     update(id, { overrides?, revoked? }) → Promise<link>   regenerate(id) → Promise<link>   remove(id)
 *     tokens() → [key]   label(key) → name   contact(contactId) → { name, email, company }
 *   (a link is { id, contactId, name, variables, overrides, revoked })
 */
export function renderSharePanel(container, opts) {
  const ui = { info: null, busy: false, error: '', leads: null, copied: '', stats: null, statsError: '', revisions: null, linkMsg: '', links: null, linksUnavailable: false, linksMsg: '', linksBusy: false, editing: null, confirm: null };
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

  // ---- stored personal links (?p=<id>): the owner can change what each one shows, give it a new
  // address, turn it off, or remove it.
  const useStored = () => !!opts.links && !ui.linksUnavailable;
  const linkUrl = (l) => personalizedUrl(ui.info, l.id);
  const rowChips = (l) => [
    l.revoked ? '<span class="pz-chip pz-chip-warn">Off</span>' : '',
    Object.keys(l.overrides || {}).length ? '<span class="pz-chip" title="This link shows values you edited">Edited</span>' : '',
  ].join(' ');
  const editorFor = (l) => {
    const eff = effectiveVariables(l);
    const keys = [...new Set([...(opts.links.tokens?.() || []), ...Object.keys(eff).filter((k) => !/__(f|l)$/.test(k))])];
    return `<div class="share-link-edit pz-ui" data-link-edit-form="${esc(l.id)}">
      <p class="addon-field__hint">What ${esc(l.name || 'this person')}'s link shows. The address stays the same. Clear a field to go back to the contact's own value.</p>
      ${keys.map((k) => {
        const own = (l.overrides || {})[k];
        return `<label class="addon-field"><span>${esc(opts.links.label?.(k) || k)}${own !== undefined ? ' <em>(edited)</em>' : ''}</span>
          <input type="text" data-link-field="${esc(k)}" value="${esc(eff[k] ?? '')}" placeholder="${esc((l.variables || {})[k] ?? '')}" maxlength="500" /></label>`;
      }).join('')}
      <div class="cap-actions">
        <button type="button" class="mini-btn cap-primary" data-link-save="${esc(l.id)}">Save changes</button>
        <button type="button" class="mini-btn" data-link-reset="${esc(l.id)}">Back to contact's details</button>
        <button type="button" class="mini-btn" data-link-cancel>Cancel</button>
      </div></div>`;
  };
  const storedHtml = () => {
    if (ui.links == null) return '<div class="share-personal pz-ui"><p class="pz-hint">Loading personal links…</p></div>';
    const rows = ui.links;
    const sure = (kind, id, label, sureLabel) => `<button type="button" class="mini-btn${ui.confirm === `${kind}:${id}` ? ' cap-primary' : ''}" data-link-${kind}="${esc(id)}">${ui.confirm === `${kind}:${id}` ? esc(sureLabel) : esc(label)}</button>`;
    return `<div class="share-personal pz-ui">
      <div class="share-personal__head"><strong>Personal links</strong><span>${rows.length} link${rows.length === 1 ? '' : 's'}</span>
        <button type="button" class="mini-btn" data-link-sync ${ui.linksBusy ? 'disabled' : ''}>${ui.linksBusy ? 'Working…' : rows.length ? 'Add links for new contacts / refresh details' : 'Create a link for each contact'}</button>
        ${rows.length ? '<button type="button" class="mini-btn" data-share-csv>Download CSV</button>' : ''}</div>
      ${ui.linksMsg ? `<p class="addon-field__hint" role="status">${esc(ui.linksMsg)}</p>` : '<p class="addon-field__hint">Each link opens this video filled with that person\'s details. Edit what a link shows, give it a new address (the old one stops working), turn it off, or remove it.</p>'}
      <ul class="share-personal__list">${rows.slice(0, 100).map((l) => `<li><span title="${esc(l.contactId || '')}">${esc(l.name || 'Link')} ${rowChips(l)}</span>
        <button type="button" class="mini-btn" data-link-copy="${esc(l.id)}" ${l.revoked ? 'disabled' : ''}>${ui.copied === `l${l.id}` ? 'Copied ✓' : 'Copy link'}</button>
        <button type="button" class="mini-btn" data-link-edit="${esc(l.id)}">${ui.editing === l.id ? 'Close' : 'Edit'}</button>
        ${sure('new', l.id, 'New link', 'Sure? Old link stops')}
        <button type="button" class="mini-btn" data-link-revoke="${esc(l.id)}">${l.revoked ? 'Turn on' : 'Turn off'}</button>
        ${sure('remove', l.id, 'Remove', 'Sure? Remove')}</li>${ui.editing === l.id ? `<li class="share-personal__editor">${editorFor(l)}</li>` : ''}`).join('')}</ul>
      ${rows.length > 100 ? `<p class="addon-field__hint">Showing 100 of ${rows.length}. The CSV has them all.</p>` : ''}
    </div>`;
  };
  const loadLinks = async (keepMsg = false) => {
    if (!opts.links || !ui.info?.published) return;
    try {
      ui.links = await opts.links.list();
      if (!keepMsg) ui.linksMsg = '';
    } catch (err) {
      if (err?.code === 'links_unavailable') ui.linksUnavailable = true;
      else { ui.links = ui.links || []; ui.linksMsg = err?.message || 'Could not load personal links'; }
    }
    draw();
  };
  const linkAction = async (fn, okMsg) => {
    ui.linksBusy = true; ui.linksMsg = ''; draw();
    try { await fn(); if (okMsg) ui.linksMsg = okMsg; } catch (err) { ui.linksMsg = err?.message || 'That did not work'; }
    ui.linksBusy = false; ui.confirm = null;
    await loadLinks(true);
  };

  // One link per Personalization Studio contact: their details fill the
  // video and their own Smart Speech line plays.
  const personalHtml = (link) => {
    if (useStored()) return storedHtml();
    const rows = opts.personalLinks?.(link) || [];
    if (!opts.personalLinks) return '';
    const note = ui.linksUnavailable ? '<p class="pz-hint">Saved personal links (editable, with a new address option) turn on once the database update is installed. These links carry the details in the address.</p>' : '';
    if (!rows.length) return `${note}<p class="addon-field__hint">Personal links: add contacts in the Personalize window to get one link per contact.</p>`;
    ui.rows = rows;
    return `<div class="share-personal pz-ui">${note}
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
    loadLinks();
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
      opts.downloadCsv?.(useStored() && ui.links
        ? ui.links.map((l) => { const c = opts.links.contact?.(l.contactId) || {}; return { name: l.name || c.name || '', email: c.email || '', company: c.company || '', link: linkUrl(l) }; })
        : (ui.rows || []));
    } else if (d.linkSync !== undefined) {
      await linkAction(async () => {
        const r = await opts.links.sync();
        ui.linksMsg = `${r.created} new link${r.created === 1 ? '' : 's'}, ${r.updated} refreshed.`;
      });
    } else if (d.linkCopy) {
      const l = (ui.links || []).find((x) => x.id === d.linkCopy);
      if (!l) return;
      try { await opts.copy(linkUrl(l)); ui.copied = `l${l.id}`; } catch { ui.copied = ''; }
      draw();
      setTimeout(() => { ui.copied = ''; draw(); }, 1800);
    } else if (d.linkEdit) {
      ui.editing = ui.editing === d.linkEdit ? null : d.linkEdit;
      draw();
    } else if (d.linkCancel !== undefined) {
      ui.editing = null;
      draw();
    } else if (d.linkSave || d.linkReset) {
      const id = d.linkSave || d.linkReset;
      const overrides = {};
      if (d.linkSave) {
        const l = (ui.links || []).find((x) => x.id === id);
        container.querySelectorAll('[data-link-field]').forEach((input) => {
          const key = input.dataset.linkField;
          const value = input.value.trim();
          if (value && value !== String((l?.variables || {})[key] ?? '')) overrides[key] = value;
        });
      }
      await linkAction(async () => { await opts.links.update(id, { overrides }); ui.editing = null; }, d.linkReset ? 'Back to the contact\'s own details.' : 'Saved. The link now shows your changes.');
    } else if (d.linkRevoke) {
      const l = (ui.links || []).find((x) => x.id === d.linkRevoke);
      if (l) await linkAction(() => opts.links.update(l.id, { revoked: !l.revoked }), l.revoked ? 'Link turned on.' : 'Link turned off. It shows “no longer active”.');
    } else if (d.linkNew || d.linkRemove) {
      const kind = d.linkNew ? 'new' : 'remove';
      const id = d.linkNew || d.linkRemove;
      if (ui.confirm !== `${kind}:${id}`) { ui.confirm = `${kind}:${id}`; draw(); return; }
      await linkAction(
        () => (kind === 'new' ? opts.links.regenerate(id) : opts.links.remove(id)),
        kind === 'new' ? 'New link made. Copy it; the old link no longer works.' : 'Link removed.',
      );
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
