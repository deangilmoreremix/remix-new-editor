/**
 * The shared result bar: "Download MP4", "Get link" and (optionally) "Publish to Social" for a studio result.
 *
 *   const bar = createResultBar({ kind: 'video', filename: 'cinema-shot', studio: 'cinema' });
 *   container.appendChild(bar.el);
 *   bar.setUrl(videoUrl, { filename: 'cinema-shot-12', title: 'My prompt' });   // on every new result
 *   bar.setUrl(captionedUrl);                                                    // after captions: ALL buttons follow
 *
 * Download is free and never uploads. "Get link" copies the result into our storage on demand and shows a permanent
 * file link (and, for videos, a /watch page link). Everything is built with textContent/setAttribute: a result
 * address is never put into innerHTML.
 */
import { downloadMedia } from '../../lib/resultActions/download.js';
import { getLink } from '../../lib/resultActions/getLink.js';
import { resolveKind, downloadLabel } from '../../lib/resultActions/mediaKind.js';
import { openSocialPublish } from '../../lib/socialPublishHelpers.js';

const BTN = 'bg-white/10 hover:bg-white/20 px-6 py-2.5 rounded-2xl text-xs font-bold transition-all border border-white/5 backdrop-blur-lg text-white disabled:opacity-60 disabled:cursor-wait';
const BTN_PRIMARY = 'btn-secondary-modern px-6 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-glow active:scale-95 disabled:opacity-60 disabled:cursor-wait';
const BTN_SOCIAL = 'bg-gradient-to-r from-[#6d5efc] to-[#a855f7] text-white px-6 py-2.5 rounded-2xl text-xs font-bold transition-all hover:shadow-glow';
const isWebUrl = (u) => /^https?:\/\//i.test(String(u || ''));

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * @param {object} o {
 *   url, kind ('video'|'image'|'audio', detected when omitted), filename (base name), title,
 *   studio (for logging), showLink (default true), showSocial (default true for video/image),
 *   extraActions [{ id, label, className?, onClick(currentUrl), when?(kind) }], onLink(result), deps (tests) }
 */
export function createResultBar(o = {}) {
  const state = { url: o.url || '', kind: resolveKind(o.kind, o.url), filename: o.filename || 'result', title: o.title || '', busy: false, gen: 0 };
  const root = el('div', 'flex flex-col items-center gap-2');
  root.setAttribute('data-result-bar', '');
  const row = el('div', 'flex flex-wrap items-center justify-center gap-3');
  const status = el('p', 'text-xs text-white/70 text-center min-h-[1rem]');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const links = el('div', 'w-full max-w-xl flex flex-col gap-2');
  root.append(row, status, links);

  const extraButtons = (o.extraActions || []).map((a) => {
    const b = el('button', a.className || BTN, a.label);
    b.type = 'button';
    if (a.id) b.id = a.id;
    b.addEventListener('click', () => a.onClick?.(state.url));
    return { a, b };
  });
  const downloadBtn = el('button', BTN_PRIMARY, downloadLabel(state.kind));
  downloadBtn.type = 'button';
  const linkBtn = el('button', BTN, 'Get link');
  linkBtn.type = 'button';
  linkBtn.title = 'Save this result to your library and get a link you can share';
  const socialBtn = el('button', BTN_SOCIAL, 'Publish to Social');
  socialBtn.type = 'button';
  extraButtons.forEach(({ b }) => row.appendChild(b));
  row.appendChild(downloadBtn);
  if (o.showLink !== false) row.appendChild(linkBtn);
  if (o.showSocial !== false) row.appendChild(socialBtn);

  const say = (text) => { status.textContent = text || ''; };
  function render() {
    downloadBtn.textContent = downloadLabel(state.kind);
    const has = !!state.url;
    [downloadBtn, linkBtn, socialBtn].forEach((b) => { b.disabled = !has || state.busy; });
    socialBtn.hidden = state.kind === 'audio';
    extraButtons.forEach(({ a, b }) => { b.hidden = typeof a.when === 'function' ? !a.when(state.kind) : false; });
  }

  // When the browser would not download or open the file by itself: a real link the person clicks.
  function manualRow(url, message) {
    const r = el('div', 'flex items-center gap-2 justify-center');
    const open = el('a', 'bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-xs font-bold text-white', 'Open file');
    open.href = url;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    r.appendChild(open);
    say(message);
    return r;
  }

  function linkRow(label, url) {
    const r = el('div', 'flex items-center gap-2');
    const l = el('span', 'text-[11px] font-bold text-white/70 w-24 shrink-0 text-left', label);
    const input = el('input', 'flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white');
    input.readOnly = true;
    input.value = url;
    input.setAttribute('aria-label', label);
    const copy = el('button', 'bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl text-xs font-bold text-white', 'Copy');
    copy.type = 'button';
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(url); copy.textContent = 'Copied'; } catch { input.select(); copy.textContent = 'Press Ctrl+C'; }
      setTimeout(() => { copy.textContent = 'Copy'; }, 1800);
    });
    r.append(l, input, copy);
    if (isWebUrl(url)) {
      const open = el('a', 'bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl text-xs font-bold text-white', 'Open');
      open.href = url;
      open.target = '_blank';
      open.rel = 'noopener noreferrer';
      r.appendChild(open);
    }
    return r;
  }

  downloadBtn.addEventListener('click', async () => {
    if (!state.url || state.busy) return;
    const gen = state.gen;
    state.busy = true; render();
    links.replaceChildren();
    // Status text from a download that belongs to an earlier result is ignored.
    const sayIfCurrent = (text) => { if (gen === state.gen) say(text); };
    try {
      const res = await downloadMedia(state.url, { filename: state.filename, kind: state.kind, onStatus: sayIfCurrent });
      if (gen === state.gen && res.method === 'manual' && res.openUrl && isWebUrl(res.openUrl)) links.replaceChildren(manualRow(res.openUrl, res.message));
    } finally { if (gen === state.gen) { state.busy = false; render(); } }
  });

  linkBtn.addEventListener('click', async () => {
    if (!state.url || state.busy) return;
    const gen = state.gen;
    state.busy = true; render();
    const original = linkBtn.textContent;
    linkBtn.textContent = 'Working…';
    say(state.kind === 'video' ? 'Saving to your library and building a page link…' : 'Saving to your library…');
    links.replaceChildren();
    try {
      const res = await getLink({ url: state.url, kind: state.kind, title: state.title || state.filename, deps: o.deps });
      // The result changed while this ran (captions, another video): these links belong to the old one. Drop them.
      if (gen !== state.gen) return;
      links.append(linkRow('File link', res.fileUrl));
      if (res.watchUrl) links.append(linkRow('Watch page', res.watchUrl));
      if (res.canonicalUrl) links.append(linkRow('Your link', res.canonicalUrl));
      say(res.pageError || (res.reused ? 'Link ready (already saved).' : 'Link ready.'));
      o.onLink?.(res);
    } catch (err) {
      if (gen === state.gen) say(err?.message || 'Could not create a link. You can still download the file.');
    } finally { if (gen === state.gen) { state.busy = false; linkBtn.textContent = original; render(); } }
  });

  socialBtn.addEventListener('click', () => {
    if (!state.url) return;
    openSocialPublish({ mediaUrl: state.url, mediaType: state.kind === 'image' ? 'image' : 'video', title: state.title || undefined });
  });

  render();
  return {
    el: root,
    /** The one place the result changes. Download, Get link and Publish all read the current value. */
    setUrl(url, next = {}) {
      state.gen += 1; // anything still running for the previous result is now ignored
      state.busy = false;
      linkBtn.textContent = 'Get link';
      state.url = url || '';
      state.kind = resolveKind(next.kind || o.kind, state.url);
      if (next.filename) state.filename = next.filename;
      if (next.filenameSuffix && !state.filename.endsWith(next.filenameSuffix)) state.filename = `${state.filename}${next.filenameSuffix}`;
      if (next.title != null) state.title = next.title;
      links.replaceChildren();
      say('');
      render();
    },
    getUrl: () => state.url,
    setBusy(b) { state.busy = !!b; render(); },
    destroy() { state.gen += 1; root.remove(); },
  };
}
