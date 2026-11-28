// src/components/outreach/ShareModal.js
//
// Share one prospect's video (Sendspark's share window): Link, GIF and Embed tabs.
//   Link   their personal page: copy, open
//   GIF    their thumbnail: Copy GIF (the clickable thumbnail, pastes into Gmail and Outlook on the web),
//          Download GIF, Download Outlook still (Outlook on Windows shows only a GIF's first frame)
//   Link also has the phone's Share sheet (only where navigator.share exists) and a QR code (SVG preview, PNG and SVG downloads)
//   Embed  code for email platforms: an HTML5 video with their GIF as poster and fallback (embedSnippet)
//
// openShareModal({ name, link, thumbnailUrl, stillUrl, videoUrl, tab, actions: { download(kind) }, onClose })
//   → { close }
import { thumbnailHtml, embedSnippet } from '../../lib/outreach/email.js';
import { qrSvg, qrPngBlob, downloadBlob } from '../../lib/outreach/qrPack.js';
import { safeFileName } from '../../lib/outreach/zipStore.js';

const el = (tag, cls = '', txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt !== undefined) n.textContent = txt; return n; };
const LOOK = {
  plain: 'border border-white/[0.08] bg-transparent text-white/70 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.18]',
  primary: 'border border-white/[0.12] border-l-2 border-l-primary bg-transparent text-white/90 hover:text-white hover:bg-white/[0.06]',
  selected: 'border border-primary/25 bg-primary/[0.08] text-white/90',
};
function btn(label, { primary = false, selected = false, attr = '' } = {}) {
  const b = el('button', `inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors disabled:opacity-40 ${LOOK[selected ? 'selected' : primary ? 'primary' : 'plain']}`, label);
  b.type = 'button';
  if (attr) b.setAttribute(attr, '');
  return b;
}
const isGifUrl = (u) => /\.gif(\?|$)/i.test(String(u || ''));

async function copyText(text, b, done = 'Copied') {
  const was = b.textContent;
  try { await navigator.clipboard.writeText(text); b.textContent = done; } catch { window.prompt('Copy this:', text); }
  setTimeout(() => { b.textContent = was; }, 1800);
}

async function copyHtml(html, plain, b, done) {
  const was = b.textContent;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([plain], { type: 'text/plain' }) })]);
    b.textContent = done;
  } catch { window.prompt('Copy this:', plain); }
  setTimeout(() => { b.textContent = was; }, 2200);
}

// The phone/desktop share sheet. Sends the link only (a text and a URL), never a file.
async function nativeShare({ title, text, url }, b, link) {
  const data = { title, text, url };
  try {
    if (navigator.canShare && !navigator.canShare(data)) throw new Error('not shareable');
    await navigator.share(data);
  } catch (e) {
    if (e?.name === 'AbortError') return;
    const note = b.closest('[data-share-modal]')?.querySelector('[data-share-note]');
    if (note) note.textContent = 'Sharing did not work here, so the link was copied instead.';
    try { await navigator.clipboard.writeText(link); } catch { window.prompt('Copy this:', link); }
  }
}

function qrSection(link, name) {
  const wrap = el('div', 'flex flex-col gap-2 border-t border-white/10 pt-3');
  wrap.setAttribute('data-share-qr', '');
  wrap.appendChild(el('h3', 'text-xs font-bold uppercase tracking-wide text-white/60', 'QR code'));
  const note = (t) => el('p', 'text-[11px] text-white/45', t);
  qrSvg(link).then((svg) => {
    const prev = el('div', 'h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-white p-1 [&>svg]:h-full [&>svg]:w-full');
    prev.setAttribute('data-share-qr-svg', ''); prev.innerHTML = svg;
    const row = el('div', 'flex flex-wrap gap-2');
    const file = safeFileName(`${name || 'prospect'}-qr`, 'qr');
    const png = btn('Download PNG', { attr: 'data-share-qr-png' });
    png.addEventListener('click', async () => { const b = await qrPngBlob(link); if (b) downloadBlob(b, `${file}.png`); });
    const sv = btn('Download SVG', { attr: 'data-share-qr-svg-download' });
    sv.addEventListener('click', () => downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${file}.svg`));
    row.append(png, sv);
    const side = el('div', 'flex min-w-0 flex-col gap-2');
    side.append(row, note('The QR holds only their personal link. Print it or put it on a card.'));
    const flex = el('div', 'flex flex-wrap items-center gap-3');
    flex.append(prev, side);
    wrap.appendChild(flex);
  }).catch(() => { wrap.appendChild(note('A QR code needs a secure (https) link.')); });
  return wrap;
}

export function openShareModal({ name = '', link, thumbnailUrl = '', stillUrl = '', videoUrl = '', tab = 'link', actions = {}, onClose = () => {} } = {}) {
  let current = tab;
  const overlay = el('div', 'fixed inset-0 z-[1000] flex justify-center overflow-y-auto bg-black/70 p-4');
  overlay.setAttribute('data-share-modal', '');
  const box = el('div', 'my-auto flex w-full max-w-xl flex-col gap-4 rounded-3xl border border-white/10 bg-[#0b0c10] p-6 text-white shadow-2xl');
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', `Share ${name || 'video'}`);
  const head = el('div', 'flex items-center justify-between');
  const x = el('button', 'rounded-lg px-2 py-1 text-xl leading-none text-white/60 hover:text-white', '×');
  x.type = 'button'; x.setAttribute('aria-label', 'Close');
  head.append(el('h2', 'text-lg font-extrabold', name ? `Share with ${name}` : 'Share'), x);
  const tabs = el('div', 'flex gap-1 rounded-xl border border-white/10 p-1');
  tabs.setAttribute('role', 'tablist');
  const body = el('div', 'flex flex-col gap-3');
  box.append(head, tabs, body);
  overlay.appendChild(box);

  const TABS = [['link', 'Link'], ['gif', isGifUrl(thumbnailUrl) ? 'GIF' : 'Thumbnail'], ['embed', 'Embed']];
  function paint() {
    tabs.replaceChildren(...TABS.map(([k, label]) => {
      const t = el('button', `flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${k === current ? 'bg-primary/[0.1] text-white ring-1 ring-primary/40' : 'text-white/60 hover:text-white'}`, label);
      t.type = 'button'; t.setAttribute('role', 'tab'); t.setAttribute('aria-selected', String(k === current)); t.setAttribute('data-share-tab', k);
      t.addEventListener('click', () => { current = k; paint(); });
      return t;
    }));
    body.replaceChildren();
    if (current === 'link') {
      const field = el('input', 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/85');
      field.readOnly = true; field.value = link; field.setAttribute('data-share-link', '');
      const row = el('div', 'flex flex-wrap gap-2');
      const copy = btn('Copy link', { primary: true, attr: 'data-share-copy-link' });
      copy.addEventListener('click', () => { copyText(link, copy); actions.sent?.(); });
      const open = btn('Open');
      open.addEventListener('click', () => window.open(link, '_blank', 'noopener'));
      row.append(copy, open);
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        const sh = btn('Share', { attr: 'data-share-native' });
        sh.addEventListener('click', () => { nativeShare({ title: name ? `Video for ${name}` : 'Video', text: name ? `A video for ${name}` : 'A video for you', url: link }, sh, link); actions.sent?.(); });
        row.appendChild(sh);
      }
      const msg = el('p', 'text-[11px] text-amber-300/80 empty:hidden'); msg.setAttribute('data-share-note', ''); msg.setAttribute('role', 'status');
      body.append(field, row, msg, el('p', 'text-[11px] text-white/45', 'Their personal page: your video with their greeting, their name and your booking button.'), qrSection(link, name));
    } else if (current === 'gif') {
      if (!thumbnailUrl) {
        body.appendChild(el('p', 'text-sm text-white/60', 'No thumbnail yet. Make thumbnails on Generate & share (Design thumbnail).'));
      } else {
        const img = el('img', 'w-full rounded-xl border border-white/10');
        img.src = thumbnailUrl; img.alt = `Thumbnail for ${name}`; img.setAttribute('data-share-preview', '');
        const row = el('div', 'flex flex-wrap gap-2');
        const gif = isGifUrl(thumbnailUrl);
        const copy = btn(gif ? 'Copy GIF' : 'Copy thumbnail', { primary: true, attr: 'data-share-copy-gif' });
        copy.addEventListener('click', () => { copyHtml(thumbnailHtml({ link, thumbnailUrl }), thumbnailUrl, copy, 'Copied: paste into your email'); actions.sent?.(); });
        const dl = btn(gif ? 'Download GIF' : 'Download image', { attr: 'data-share-download' });
        dl.addEventListener('click', () => actions.download?.('main', dl));
        row.append(copy, dl);
        if (gif && stillUrl) {
          const still = btn('Download Outlook still', { attr: 'data-share-download-still' });
          still.addEventListener('click', () => actions.download?.('still', still));
          row.appendChild(still);
        }
        body.append(img, row, el('p', 'text-[11px] text-white/45', gif
          ? 'Copy GIF pastes the playing thumbnail, linked to their page, into Gmail, Outlook on the web and most email tools. Outlook on Windows shows a GIF’s first frame: use the Outlook still there.'
          : 'Copy thumbnail pastes the picture, linked to their page, into your email.'));
      }
    } else {
      const code = embedSnippet({ link, thumbnailUrl, name, videoUrl });
      const area = el('textarea', 'h-36 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] p-3 font-mono text-[11px] text-white/80');
      area.readOnly = true; area.value = code; area.setAttribute('data-share-embed-code', '');
      const copy = btn('Copy code snippet', { primary: true, attr: 'data-share-copy-embed' });
      copy.addEventListener('click', () => { copyText(code, copy); actions.sent?.(); });
      body.append(area, copy, el('p', 'text-[11px] text-white/45', 'For email platforms that take HTML (HubSpot, Mailchimp, lemlist, Instantly…). Inboxes that play video (Apple Mail, iPhone) show a muted preview; every other inbox shows the GIF. Either way, a click opens their page.'));
    }
  }
  paint();

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() { overlay.remove(); document.removeEventListener('keydown', onKey, true); onClose(); }
  x.addEventListener('click', close);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(overlay);
  return { close };
}
