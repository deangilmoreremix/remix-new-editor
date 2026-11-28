// The inline "Video Pages" button every studio shows in its action row (next to Personalize where the studio has it).
// Click: opens the landing page picker with this studio's finished video or picture loaded, else the newest video or picture made this session, else your newest in the history.
// Only the studio's finished result goes along (getResult): a reference picture is never sent as the output.

import { WORKBENCH_GENERATION_EVENT } from '../../lib/workbench.js';
import { latestFromSaved } from '../VideoPagesButton.js';

// Every studio saves what it makes with saveGeneration(), which emits WORKBENCH_GENERATION_EVENT. The newest finished
// video or picture of this session is kept here, so a studio that does not know its own result URL still opens Video Pages
// with what was just made (not a history that may not have synced yet).
let sessionLatest = null;
if (typeof window !== 'undefined') {
  window.addEventListener(WORKBENCH_GENERATION_EVENT, (e) => {
    const next = latestFromSaved(e.detail?.entry);
    if (next) sessionLatest = next;
  });
}

const ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" class="text-primary"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 8h18"/><path d="M10 12.5l4 2.5-4 2.5z" fill="currentColor"/></svg>';

/**
 * @param {object} opts
 * @param {string} [opts.studioId]
 * @param {() => string} [opts.getResult] the finished output URL ('' when there is none)
 * @param {() => ({type?: string}|null)} [opts.getAsset] the studio's output type ('video' | 'image')
 * @param {() => (HTMLTextAreaElement|null)} [opts.getTextarea] supplies the prompt
 * @returns {HTMLButtonElement}
 */
export function createStudioVideoPagesButton({ studioId = '', getResult, getAsset, getTextarea } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset.studioVideoPages = '';
  btn.className = 'btn-personalize group';
  btn.setAttribute('data-tooltip', 'Put this video or picture on a landing page');
  btn.setAttribute('aria-label', 'Video Pages: put this video or picture on a landing page');
  btn.innerHTML = `${ICON}<span class="text-xs font-bold text-primary">Video Pages</span>`;
  btn.onclick = async (e) => {
    e.stopPropagation();
    let url = '';
    try { url = (typeof getResult === 'function' ? getResult() : '') || ''; } catch { url = ''; }
    const { openVideoPages } = await import('../VideoPagesButton.js');
    if (!url && sessionLatest) { openVideoPages(sessionLatest); return; }
    // the studio's own output type first (a signed storage URL has no file extension), the extension only when it is unknown
    let assetType;
    try { assetType = typeof getAsset === 'function' ? getAsset()?.type : undefined; } catch { assetType = undefined; }
    const isVideo = assetType === 'video' || (assetType !== 'image' && /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url));
    openVideoPages(latestFromSaved({ type: isVideo ? 'video' : 'image', url, prompt: getTextarea?.()?.value || '', studio: studioId }));
  };
  return btn;
}
