/**
 * Share panel: publish the timeline as an interactive video, then copy its
 * link or embed code, see views and leads, update or unpublish it.
 */
import { watchUrl, embedCode } from './publishClient.js';

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
 *   defaultTitle
 */
export function renderSharePanel(container, opts) {
  const ui = { info: null, busy: false, error: '', leads: null, copied: '' };

  // One link per Personalization Studio contact: their details fill the
  // video and their own Smart Speech line plays.
  const personalHtml = (link) => {
    const rows = opts.personalLinks?.(link) || [];
    if (!opts.personalLinks) return '';
    if (!rows.length) return '<p class="addon-field__hint">Personal links: add contacts in the Personalize window to get one link per contact.</p>';
    ui.rows = rows;
    return `<div class="share-personal">
      <div class="share-personal__head"><strong>Personal links</strong><span>${rows.length} contact${rows.length === 1 ? '' : 's'}</span>
        <button type="button" class="mini-btn" data-share-csv>Download CSV</button></div>
      <ul class="share-personal__list">${rows.slice(0, 100).map((r, i) => `<li><span title="${esc(r.email)}">${esc(r.name)}</span>
        <button type="button" class="mini-btn" data-share-personal="${i}">${ui.copied === `p${i}` ? 'Copied ✓' : 'Copy link'}</button></li>`).join('')}</ul>
      ${rows.length > 100 ? `<p class="addon-field__hint">Showing 100 of ${rows.length}. The CSV has them all.</p>` : ''}
    </div>`;
  };

  const draw = () => {
    const info = ui.info;
    const link = info ? watchUrl(info.id) : '';
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
            ${personalHtml(link)}
            <p class="addon-field__hint">Changes in the editor go live when you press “Update published video”.</p>
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
  };

  const onClick = async (e) => {
    const b = e.target.closest('button');
    if (!b || !container.contains(b)) return;
    const d = b.dataset;
    if (d.sharePublish !== undefined) {
      ui.busy = true; ui.error = ''; draw();
      try {
        ui.info = await opts.publish({ title: container.querySelector('[data-share-title]')?.value || opts.defaultTitle });
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
    } else if (d.shareCsv !== undefined) {
      opts.downloadCsv?.(ui.rows || []);
    } else if (d.sharePersonal !== undefined) {
      const row = (ui.rows || [])[Number(d.sharePersonal)];
      if (!row) return;
      try { await opts.copy(row.link); ui.copied = `p${d.sharePersonal}`; } catch { ui.copied = ''; }
      draw();
      setTimeout(() => { ui.copied = ''; draw(); }, 1800);
    } else if (d.shareCopy) {
      const text = d.shareCopy === 'link' ? watchUrl(ui.info.id) : embedCode(ui.info.id);
      try { await opts.copy(text); ui.copied = d.shareCopy; } catch { ui.copied = ''; }
      draw();
      setTimeout(() => { ui.copied = ''; draw(); }, 1800);
    }
  };

  container.addEventListener('click', onClick);
  draw();
  refresh();
  return {
    refresh,
    destroy() { container.removeEventListener('click', onClick); },
  };
}
