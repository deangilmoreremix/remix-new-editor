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
 *   defaultTitle
 */
export function renderSharePanel(container, opts) {
  const ui = { info: null, busy: false, error: '', leads: null, copied: '' };

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
