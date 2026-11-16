// src/components/outreach/ThumbnailDesigner.js
//
// The thumbnail designer (Sendspark's thumbnail tool, in SmartVideo's style): a full-screen page opened from the
// video editor's toolbar and from Generate & share. On the left the live picture for one prospect (the GIF plays
// its 3 seconds in a loop); on the right what goes on it: animated GIF or still, the moment from your video, what
// is behind your camera bubble (their website, your video, or an image of yours), the words with their name and
// company, the play button and their logo. Settings are saved on the dynamic video (draft.email.thumb / thumbText);
// "Make thumbnails" renders every prospect's picture (src/lib/outreach/thumbnail.js).
import * as T from '../../lib/outreach/thumbnail.js';

const el = (tag, cls = '', txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt !== undefined) n.textContent = txt;
  return n;
};
// Outlined, never filled: chosen options get the light lime tint, the main action a lime left edge.
const PILL = (on) => `rounded-[10px] border px-3 py-1.5 text-xs font-bold transition-colors ${on ? 'border-primary/45 bg-primary/[0.08] text-white' : 'border-white/10 text-white/70 hover:border-white/20 hover:text-white'}`;
const MAIN = 'rounded-[10px] border border-white/[0.14] border-l-2 border-l-primary bg-transparent px-4 py-2 text-sm font-bold text-white hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40';
const PLAIN = 'rounded-[10px] border border-white/10 bg-transparent px-4 py-2 text-sm font-bold text-white/80 hover:border-white/20 hover:text-white disabled:opacity-40';
const SAMPLE = Object.freeze({ id: 'sample', firstName: 'Mike', lastName: 'Ross', company: 'Acme', jobTitle: 'Head of Sales', website: '' });
const VARS = [['First name', '{{firstname}}'], ['Company', '{{company}}'], ['Job title', '{{jobtitle}}']];

/**
 * openThumbnailDesigner({ draft, save(), websiteFor(contact), logoFor(contact), upload(file) -> url,
 *   onMake() | null, makeLabel, onClose() }) -> { close }
 */
export function openThumbnailDesigner({ draft, save = () => {}, websiteFor = () => '', logoFor = () => '', upload = null, onMake = null, makeLabel = 'Make thumbnails', onClose = () => {} } = {}) {
  const t = () => draft.email?.thumb || {};
  const setThumb = (patch) => { draft.email = { ...draft.email, thumb: { ...t(), ...patch } }; save(); };
  const contacts = (draft.contacts || []).length ? draft.contacts : [SAMPLE];
  let who = contacts[0];

  const overlay = el('div', 'fixed inset-0 z-[1000] flex flex-col overflow-y-auto bg-app-bg text-white');
  overlay.setAttribute('data-thumb-designer', '');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Thumbnail');
  const head = el('div', 'flex flex-wrap items-center gap-3 border-b border-white/10 px-5 py-4 md:px-8');
  const titles = el('div', 'mr-auto min-w-0');
  titles.append(el('h2', 'text-xl font-extrabold', 'Thumbnail'), el('p', 'text-xs text-white/55', 'The picture in your emails. Each prospect gets their own: their name, their website and their logo.'));
  const done = el('button', PLAIN, 'Done');
  done.type = 'button';
  done.setAttribute('data-thumb-done', '');
  head.appendChild(titles);
  let make = null;
  if (onMake) {
    make = el('button', MAIN, makeLabel);
    make.type = 'button';
    make.setAttribute('data-thumb-make', '');
    head.appendChild(make);
  }
  head.appendChild(done);

  const body = el('div', 'grid flex-1 gap-6 p-5 md:p-8 lg:grid-cols-[1fr_400px]');
  // ---- Left: the live picture.
  const left = el('div', 'flex min-w-0 flex-col gap-3');
  const canvas = el('canvas', 'w-full rounded-2xl border border-white/10 bg-black');
  canvas.width = T.THUMB_W; canvas.height = T.THUMB_H;
  canvas.setAttribute('data-thumb-canvas', '');
  const under = el('div', 'flex flex-wrap items-center gap-3 text-xs text-white/60');
  const whoSel = el('select', 'rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-white');
  whoSel.setAttribute('aria-label', 'Preview for');
  whoSel.setAttribute('data-thumb-who', '');
  contacts.slice(0, 200).forEach((c) => { const o = el('option', 'bg-neutral-900', [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || 'Prospect'); o.value = c.id; whoSel.appendChild(o); });
  const download = el('button', PLAIN, 'Download this picture');
  download.type = 'button';
  download.setAttribute('data-thumb-download', '');
  under.append(el('span', '', 'Preview for'), whoSel, el('span', 'flex-1'), download);
  const note = el('p', 'text-[11px] text-white/45', contacts[0] === SAMPLE ? 'This preview uses a sample prospect (Mike at Acme). Add your prospects to see theirs.' : 'GIFs play 3 seconds of your video in a loop. Most email apps show them; Outlook on Windows shows the first frame.');
  left.append(canvas, under, note);

  // ---- Right: what goes on it.
  const right = el('div', 'flex flex-col gap-5');
  const section = (label, ...kids) => { const s = el('div', 'flex flex-col gap-2'); s.appendChild(el('div', 'text-xs font-bold uppercase tracking-wider text-white/50', label)); s.append(...kids); return s; };
  const row = () => el('div', 'flex flex-wrap items-center gap-2');

  const typeRow = row();
  const types = [['gif', 'Animated GIF'], ['static', 'Still image']].map(([type, label]) => {
    const b = el('button', '', label); b.type = 'button'; b.setAttribute('data-thumb-type', type);
    b.addEventListener('click', () => { setThumb({ type }); paintControls(); seekPreview(); });
    typeRow.appendChild(b); return [type, b];
  });

  const start = el('input', 'flex-1 accent-[#d9ff00]');
  start.type = 'range'; start.min = '0'; start.step = '0.1';
  start.setAttribute('aria-label', 'Moment from your video');
  start.setAttribute('data-thumb-start', '');
  const startLabel = el('span', 'w-12 text-right text-xs tabular-nums text-white/60');
  start.addEventListener('input', () => { setThumb({ start: Number(start.value) }); startLabel.textContent = `${Number(start.value).toFixed(1)}s`; seekPreview(); });
  const startRow = row(); startRow.append(start, startLabel);

  const bgRow = row();
  const bgs = [['auto', 'As in the video'], ['video', 'Just my video'], ['image', 'An image']].map(([bg, label]) => {
    const b = el('button', '', label); b.type = 'button'; b.setAttribute('data-thumb-bg', bg);
    b.addEventListener('click', () => { if (bg === 'image' && !t().image) { file.click(); return; } setThumb({ background: bg }); paintControls(); loadImages(); });
    bgRow.appendChild(b); return [bg, b];
  });
  const file = el('input'); file.type = 'file'; file.accept = 'image/*'; file.hidden = true;
  file.setAttribute('data-thumb-image-file', '');
  const imageNote = el('p', 'text-[11px] text-white/45');
  file.addEventListener('change', async () => {
    const f = file.files?.[0]; file.value = '';
    if (!f || !upload) return;
    imageNote.textContent = 'Uploading your image…';
    try { const url = await upload(f); setThumb({ background: 'image', image: url }); imageNote.textContent = ''; paintControls(); loadImages(); }
    catch (err) { imageNote.textContent = err?.message || 'The image could not be uploaded.'; }
  });
  const changeImg = el('button', 'text-xs font-semibold text-primary hover:underline', 'Choose another image');
  changeImg.type = 'button'; changeImg.addEventListener('click', () => file.click());
  const bgHelp = el('p', 'text-[11px] text-white/45');

  const text = el('input', 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-primary/60');
  text.value = draft.email?.thumbText ?? 'Hi {{firstname}}, this is for you';
  text.placeholder = 'Hi {{firstname}}, this is for you';
  text.maxLength = 80;
  text.setAttribute('aria-label', 'Words on the picture');
  text.setAttribute('data-thumb-text', '');
  text.addEventListener('input', () => { draft.email = { ...draft.email, thumbText: text.value }; save(); draw(); });
  const chips = row();
  VARS.forEach(([label, token]) => {
    const c = el('button', 'rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary hover:bg-primary/20', label);
    c.type = 'button';
    c.addEventListener('click', () => {
      const at = text.selectionStart ?? text.value.length;
      text.value = `${text.value.slice(0, at)}${token}${text.value.slice(text.selectionEnd ?? at)}`.slice(0, 80);
      text.dispatchEvent(new Event('input')); text.focus();
    });
    chips.appendChild(c);
  });

  const playOn = el('input'); playOn.type = 'checkbox'; playOn.setAttribute('data-thumb-play', '');
  const playStyle = el('select', 'rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-white');
  playStyle.setAttribute('aria-label', 'Play button style');
  [['solid', 'Solid'], ['outline', 'Outline'], ['glass', 'Glass']].forEach(([v, l]) => { const o = el('option', 'bg-neutral-900', l); o.value = v; playStyle.appendChild(o); });
  const playColor = el('input', 'h-7 w-10 rounded border border-white/10 bg-transparent'); playColor.type = 'color'; playColor.setAttribute('aria-label', 'Play button colour');
  const playOpacity = el('input', 'w-24 accent-[#d9ff00]'); playOpacity.type = 'range'; playOpacity.min = '0.2'; playOpacity.max = '1'; playOpacity.step = '0.05';
  playOpacity.setAttribute('aria-label', 'Play button opacity');
  const syncPlay = () => { setThumb({ play: { show: playOn.checked, style: playStyle.value, color: playColor.value, opacity: Number(playOpacity.value) } }); draw(); };
  [playStyle, playColor, playOpacity].forEach((i) => i.addEventListener('input', syncPlay));
  playOn.addEventListener('change', syncPlay);
  const playLbl = el('label', 'flex items-center gap-1.5 text-xs'); playLbl.append(playOn, el('span', '', 'Show'));
  const playRow = row(); playRow.append(playLbl, playStyle, playColor, el('span', 'text-xs text-white/50', 'Opacity'), playOpacity);

  const logoOn = el('input'); logoOn.type = 'checkbox'; logoOn.setAttribute('data-thumb-logo', '');
  logoOn.addEventListener('change', () => { setThumb({ logo: logoOn.checked }); loadImages(); });
  const logoLbl = el('label', 'flex items-center gap-2 text-xs text-white/75'); logoLbl.append(logoOn, el('span', '', 'Show each prospect’s company logo (found on their website)'));

  right.append(
    section('Type', typeRow),
    section('Moment from your video', startRow),
    section('Behind your camera bubble', bgRow, changeImg, imageNote, bgHelp, file),
    section('Words on the picture', text, chips),
    section('Play button', playRow),
    section('Logo', logoLbl),
  );
  body.append(left, right);
  overlay.append(head, body);

  function paintControls() {
    const s = T.thumbSettings(t());
    types.forEach(([type, b]) => { b.className = PILL(s.type === type); b.setAttribute('aria-pressed', String(s.type === type)); });
    bgs.forEach(([bg, b]) => { b.className = PILL(s.background === bg); b.setAttribute('aria-pressed', String(s.background === bg)); });
    changeImg.hidden = s.background !== 'image';
    bgHelp.textContent = s.background === 'auto' ? 'Their website behind you when your video uses it, otherwise your video.' : s.background === 'video' ? 'Your recording fills the picture.' : 'Your image behind your camera bubble, for every prospect.';
    const dur = draft.video?.duration || 3;
    start.max = String(Math.max(0, dur - (s.type === 'gif' ? T.GIF_SECONDS : 0.1)));
    start.value = String(Math.min(s.start, Number(start.max)));
    startLabel.textContent = `${Number(start.value).toFixed(1)}s`;
    const p = s.play;
    playOn.checked = p.show; playStyle.value = p.style; playColor.value = p.color; playOpacity.value = String(p.opacity);
    logoOn.checked = s.logo;
  }

  // ---- The live picture: the video plays behind it (a GIF loops its 3 seconds), redrawn on every frame.
  let video = null; let siteImg = null; let logoImg = null; let loopStart = 0; let gone = false;
  const draw = () => {
    if (gone) return;
    const s = T.thumbSettings(t());
    const progress = s.type === 'gif' && video ? Math.max(0, Math.min(1, (video.currentTime - loopStart) / T.GIF_SECONDS)) : 0;
    T.drawThumbnail(canvas.getContext('2d'), { frame: video && video.readyState >= 2 ? video : null, site: siteImg, logo: s.logo ? logoImg : null, text: T.thumbnailText(draft.email?.thumbText, who, draft.fallbacks || {}), play: s.play, progress });
  };
  const loadImg = (src, set) => { if (!src) { set(null); draw(); return; } const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => { set(img); draw(); }; img.onerror = () => { set(null); draw(); }; img.src = src; };
  function loadImages() {
    const s = T.thumbSettings(t());
    loadImg(T.thumbBackground(s, websiteFor(who)), (v) => { siteImg = v; });
    loadImg(s.logo ? logoFor(who) : '', (v) => { logoImg = v; });
  }
  function seekPreview() {
    if (!video) { draw(); return; }
    const s = T.thumbSettings(t());
    const dur = video.duration || draft.video?.duration || 0;
    loopStart = s.type === 'gif' ? Math.max(0, Math.min(s.start, dur - T.GIF_SECONDS)) : Math.min(s.start, Math.max(0, dur - 0.05));
    try { video.currentTime = loopStart; } catch { /* not loaded yet */ }
    if (s.type === 'gif') video.play().catch(() => {}); else video.pause();
  }
  if (draft.video?.url) {
    video = el('video'); video.muted = true; video.playsInline = true; video.preload = 'auto';
    video.addEventListener('loadedmetadata', seekPreview, { once: true });
    video.addEventListener('seeked', draw);
    video.addEventListener('timeupdate', () => { draw(); if (T.thumbSettings(t()).type === 'gif' && video.currentTime >= loopStart + T.GIF_SECONDS) video.currentTime = loopStart; });
    video.src = draft.video.url;
  }
  whoSel.addEventListener('change', () => { who = contacts.find((c) => c.id === whoSel.value) || who; loadImages(); });

  // ---- Download the picture for the prospect shown (the same render the campaign uses).
  download.addEventListener('click', async () => {
    if (!draft.video?.url) { note.textContent = 'Add your video first.'; return; }
    download.disabled = true; download.textContent = 'Making it…';
    try {
      const s = T.thumbSettings(t());
      const still = s.type === 'static';
      const frames = await T.grabFrames(draft.video.url, T.frameTimes(s, draft.video.duration || Infinity), still ? { width: T.THUMB_W, height: T.THUMB_H } : {});
      const blob = await T.renderThumbnail({ frames, siteUrl: T.thumbBackground(s, websiteFor(who)), logoUrl: s.logo ? logoFor(who) : '', text: T.thumbnailText(draft.email?.thumbText, who, draft.fallbacks || {}), settings: s });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `thumbnail-${String(who.firstName || 'prospect').replace(/[^\w-]+/g, '_')}.${still ? 'jpg' : 'gif'}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (err) { note.textContent = err?.message || 'The picture could not be made.'; }
    download.disabled = false; download.textContent = 'Download this picture';
  });

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() {
    if (gone) return;
    gone = true;
    document.removeEventListener('keydown', onKey, true);
    try { video?.pause(); video?.removeAttribute('src'); video?.load?.(); } catch { /* gone */ }
    overlay.remove();
    onClose();
  }
  done.addEventListener('click', close);
  make?.addEventListener('click', () => { close(); onMake(); });
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(overlay);
  paintControls();
  loadImages();
  draw();
  return { close };
}
