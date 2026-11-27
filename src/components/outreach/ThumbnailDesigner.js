// src/components/outreach/ThumbnailDesigner.js
//
// The thumbnail designer (Sendspark's thumbnail tool, in SmartVideo's style): a full-screen page opened from the
// video editor's toolbar and from Generate & share. On the left the live picture for one prospect (the GIF plays
// its 3 seconds in a loop); on the right Sendspark's three tabs: Thumbnail (the words with their name, company and
// job title, the fallbacks, and the logo: each prospect's, one you search or upload, or none), Edit Preview (animated
// GIF or still, the moment from your video, what is behind your camera bubble) and Edit Styles (text and banner
// colours, the play button, the duration badge). Settings are saved on the dynamic video (draft.email.thumb / thumbText);
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
export function openThumbnailDesigner({ draft, save = () => {}, websiteFor = () => '', logoFor = () => '', findLogo = null, upload = null, onMake = null, makeLabel = 'Make thumbnails', onClose = () => {} } = {}) {
  const t = () => draft.email?.thumb || {};
  const setThumb = (patch) => { draft.email = { ...draft.email, thumb: { ...t(), ...patch } }; save(); };
  const contacts = (draft.contacts || []).length ? draft.contacts : [SAMPLE];
  let who = contacts[0];

  const overlay = el('div', 'fixed inset-0 z-[1000] flex justify-center overflow-y-auto bg-black/70 p-3 text-white sm:p-4');
  const modal = el('div', 'my-auto flex w-full max-w-[480px] flex-col rounded-3xl border border-white/10 bg-[#0b0c10] p-4 shadow-2xl sm:p-6');
  overlay.setAttribute('data-thumb-designer', '');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Edit Thumbnail');
  const head = el('div', 'relative mb-4 flex items-center justify-center');
  const closeX = el('button', 'absolute right-0 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-xl leading-none text-white/60 hover:bg-white/10 hover:text-white', '×');
  closeX.type = 'button'; closeX.setAttribute('aria-label', 'Close'); closeX.setAttribute('data-thumb-close', '');
  head.append(el('h2', 'text-base font-extrabold', 'Edit Thumbnail'), closeX);
  const done = el('button', 'rounded-full bg-primary px-5 py-2 text-sm font-bold text-black hover:brightness-110', 'Done');
  done.type = 'button';
  done.setAttribute('data-thumb-done', '');
  let make = null;
  if (onMake) {
    make = el('button', `${MAIN} rounded-full`, makeLabel);
    make.type = 'button';
    make.setAttribute('data-thumb-make', '');
  }

  const body = el('div', 'flex min-w-0 flex-col gap-5');
  // ---- The live picture, with the logo's remove badge on its corner.
  const stage = el('div', 'relative');
  const canvas = el('canvas', 'block w-full rounded-2xl border border-white/10 bg-black');
  canvas.width = T.THUMB_W; canvas.height = T.THUMB_H;
  canvas.setAttribute('data-thumb-canvas', '');
  const removeLogo = el('button', 'absolute right-[2%] top-[3%] flex h-5 w-5 items-center justify-center rounded-full bg-black text-[11px] font-bold leading-none text-white ring-1 ring-white/60 hover:bg-neutral-800', '×');
  removeLogo.type = 'button'; removeLogo.hidden = true;
  removeLogo.setAttribute('aria-label', 'Remove the logo'); removeLogo.setAttribute('data-thumb-logo-remove', '');
  removeLogo.addEventListener('click', () => { setThumb({ logoMode: 'none' }); paintControls(); loadImages(); });
  stage.append(canvas, removeLogo);
  const note = el('p', 'text-[11px] text-white/45', contacts[0] === SAMPLE ? 'This preview uses a sample prospect (Mike at Acme). Add your prospects to see theirs.' : 'GIFs play 3 seconds of your video in a loop. Most email apps show them; Outlook on Windows shows the first frame.');

  const section = (label, ...kids) => { const s = el('div', 'flex flex-col gap-2'); s.appendChild(el('div', 'text-xs font-bold uppercase tracking-wider text-white/50', label)); s.append(...kids); return s; };
  const row = () => el('div', 'flex flex-wrap items-center gap-2');
  const LINE = 'w-full border-0 border-b border-white/25 bg-transparent px-0 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-primary';
  const field = (label, ...kids) => { const f = el('div', 'flex flex-col'); f.appendChild(el('span', 'text-[11px] text-white/50', label)); f.append(...kids); return f; };

  const typeRow = row();
  const types = [['gif', 'Animated GIF'], ['static', 'Still image']].map(([type, label]) => {
    const b = el('button', '', label); b.type = 'button'; b.setAttribute('data-thumb-type', type);
    b.addEventListener('click', () => { setThumb({ type }); paintControls(); seekPreview(); });
    typeRow.appendChild(b); return [type, b];
  });

  // Select preview: the scrubber under the picture.
  const start = el('input', 'min-w-0 flex-1 accent-[#d9ff00]');
  start.type = 'range'; start.min = '0'; start.step = '0.1';
  start.setAttribute('aria-label', 'Select preview: the moment from your video');
  start.setAttribute('data-thumb-start', '');
  const startLabel = el('span', 'w-12 text-right text-xs tabular-nums text-white/60');
  start.addEventListener('input', () => { setThumb({ start: Number(start.value) }); startLabel.textContent = `${Number(start.value).toFixed(1)}s`; seekPreview(); });
  const startRow = el('div', 'flex items-center gap-3'); startRow.append(start, startLabel);
  const scrub = el('div', 'flex flex-col gap-1');
  scrub.append(el('span', 'text-[11px] text-white/50', 'Select preview'), startRow);

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
  const changeImg = el('button', 'self-start text-xs font-semibold text-primary hover:underline', 'Choose another image');
  changeImg.type = 'button'; changeImg.addEventListener('click', () => file.click());
  const bgHelp = el('p', 'text-[11px] text-white/45');

  // Show Timestamp: an on/off switch on the duration badge.
  const durOn = el('input', 'peer sr-only'); durOn.type = 'checkbox'; durOn.setAttribute('data-thumb-duration', '');
  const durLbl = el('label', 'flex cursor-pointer items-center justify-between gap-3 text-sm');
  const track = el('span', 'relative h-6 w-11 rounded-full bg-white/20 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-5 peer-checked:after:bg-black peer-focus-visible:ring-2 peer-focus-visible:ring-primary/60');
  const trackBox = el('span', 'flex items-center'); trackBox.append(durOn, track);
  durLbl.append(el('span', '', 'Show Timestamp'), trackBox);
  const durColor = el('input', 'h-7 w-10 rounded border border-white/10 bg-transparent'); durColor.type = 'color'; durColor.setAttribute('aria-label', 'Duration badge colour');
  const durOpacity = el('input', 'w-24 accent-[#d9ff00]'); durOpacity.type = 'range'; durOpacity.min = '0.2'; durOpacity.max = '1'; durOpacity.step = '0.05';
  durOpacity.setAttribute('aria-label', 'Duration badge opacity');
  const syncDur = () => { setThumb({ duration: { show: durOn.checked, color: durColor.value, opacity: Number(durOpacity.value) } }); draw(); };
  [durColor, durOpacity].forEach((i) => i.addEventListener('input', syncDur));
  durOn.addEventListener('change', syncDur);
  const durRow = row(); durRow.append(durColor, el('span', 'text-xs text-white/50', 'Opacity'), durOpacity);

  // Caption: the words, with variables and fallbacks.
  const text = el('input', LINE);
  text.value = draft.email?.thumbText ?? 'Hi {{firstname}}, this is for you';
  text.placeholder = 'Hi {{firstname}}, this is for you';
  text.maxLength = 80;
  text.setAttribute('aria-label', 'Caption: the words on the picture');
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

  // Fallbacks: what the words say when a prospect has no first name, company or job title.
  const fallbacks = el('div', 'grid gap-2 sm:grid-cols-3');
  [['firstname', 'First name', 'there'], ['company', 'Company', 'your company'], ['jobtitle', 'Job title', 'your team']].forEach(([key, label, ph]) => {
    const w = el('label', 'flex flex-col gap-1 text-[11px] text-white/50');
    const i = el('input', 'border-0 border-b border-white/25 bg-transparent px-0 py-1.5 text-xs text-white outline-none focus:border-primary');
    i.value = draft.fallbacks?.[key] ?? ''; i.placeholder = ph; i.maxLength = 40;
    i.setAttribute('data-thumb-fallback', key);
    i.addEventListener('input', () => { draft.fallbacks = { ...(draft.fallbacks || {}), [key]: i.value }; save(); draw(); });
    w.append(el('span', '', `If no ${label.toLowerCase()}`), i);
    fallbacks.appendChild(w);
  });

  // Logo: search a company, upload one, or pick each prospect's / one / none.
  const logoRow = row();
  const oneBox = el('div', 'flex flex-col gap-2');
  oneBox.setAttribute('data-thumb-one-logo', '');
  const paintLogo = (mode) => logos.forEach(([m, b]) => { b.className = PILL(m === mode); b.setAttribute('aria-pressed', String(m === mode)); });
  const logos = [['prospect', 'Each prospect’s logo'], ['one', 'One logo'], ['none', 'No logo']].map(([mode, label]) => {
    const b = el('button', '', label); b.type = 'button'; b.setAttribute('data-thumb-logo-mode', mode);
    b.addEventListener('click', () => {
      if (mode === 'one' && !t().logoUrl) { oneBox.hidden = false; paintLogo(mode); return; }
      setThumb({ logoMode: mode }); paintControls(); loadImages();
    });
    logoRow.appendChild(b); return [mode, b];
  });
  const domain = el('input', 'min-w-0 flex-1 border-0 border-b border-white/25 bg-transparent px-0 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-primary');
  domain.placeholder = 'Search a company, e.g. acme.com'; domain.setAttribute('aria-label', 'Logo Search');
  domain.setAttribute('data-thumb-logo-domain', '');
  const find = el('button', 'rounded-full border border-white/15 bg-transparent px-3 py-1 text-xs font-bold text-white/80 hover:border-white/30 hover:text-white disabled:opacity-40', 'Find logo');
  find.type = 'button'; find.setAttribute('data-thumb-logo-find', '');
  const findRow = el('div', 'flex items-end gap-2'); findRow.append(domain, find);
  const logoFile = el('input'); logoFile.type = 'file'; logoFile.accept = 'image/*'; logoFile.hidden = true;
  logoFile.setAttribute('data-thumb-logo-file', '');
  const uploadLogo = el('button', 'self-start text-xs font-semibold text-primary hover:underline', 'Upload a logo');
  uploadLogo.type = 'button'; uploadLogo.addEventListener('click', () => logoFile.click());
  const logoNote = el('p', 'text-[11px] text-white/50');
  logoNote.setAttribute('data-thumb-logo-note', '');
  // The result row: the logo in use, its name and domain; click to use it again.
  let foundDomain = '';
  const result = el('button', 'flex w-full items-center gap-3 rounded-xl border border-white/10 px-3 py-2 text-left hover:border-primary/40 hover:bg-white/[0.04]');
  result.type = 'button'; result.hidden = true; result.setAttribute('data-thumb-logo-result', '');
  const resultImg = el('img', 'h-7 w-7 rounded bg-white object-contain p-0.5'); resultImg.alt = '';
  const resultName = el('span', 'text-sm font-semibold');
  const resultDomain = el('span', 'ml-auto truncate text-xs text-white/50');
  result.append(resultImg, resultName, resultDomain);
  result.addEventListener('click', () => { if (t().logoUrl) useLogo(t().logoUrl); });
  oneBox.append(result, el('p', 'text-[11px] text-white/45', 'This one logo goes on every prospect’s thumbnail. Search above or upload your own.'));
  const prettyName = (d) => { const h = d.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0]; const n = h.split('.')[0] || h; return n.charAt(0).toUpperCase() + n.slice(1); };
  const useLogo = (url) => { setThumb({ logoMode: 'one', logoUrl: url }); logoNote.textContent = 'This logo goes on every prospect’s thumbnail.'; paintControls(); loadImages(); };
  const searchLogo = async () => {
    const d = domain.value.trim();
    if (!d) { domain.focus(); return; }
    if (!findLogo) { logoNote.textContent = 'Search is not available here. Upload a logo instead.'; return; }
    find.disabled = true; logoNote.textContent = 'Looking for the logo on that website…';
    try { const url = await findLogo(d); if (url) { foundDomain = d.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0]; useLogo(url); } else logoNote.textContent = 'No logo found on that website. Upload one instead.'; }
    catch (err) { logoNote.textContent = err?.message || 'The website could not be checked. Upload a logo instead.'; }
    find.disabled = false;
  };
  find.addEventListener('click', searchLogo);
  domain.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); searchLogo(); } });
  logoFile.addEventListener('change', async () => {
    const f = logoFile.files?.[0]; logoFile.value = '';
    if (!f || !upload) return;
    logoNote.textContent = 'Uploading your logo…';
    try { foundDomain = ''; useLogo(await upload(f)); } catch (err) { logoNote.textContent = err?.message || 'The logo could not be uploaded.'; }
  });

  // Edit Styles: colours.
  const colour = (label, key) => {
    const w = el('label', 'flex items-center gap-2 text-xs text-white/75');
    const i = el('input', 'h-7 w-10 rounded border border-white/10 bg-transparent'); i.type = 'color';
    i.setAttribute('data-thumb-color', key);
    i.addEventListener('input', () => { setThumb({ [key]: i.value }); draw(); });
    w.append(i, el('span', '', label));
    return { w, i };
  };
  const textColor = colour('Text colour', 'textColor');
  const bannerColor = colour('Banner colour', 'bannerColor');
  const colourRow = row(); colourRow.append(textColor.w, bannerColor.w);

  // Prospect preview + download.
  const whoSel = el('select', 'min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-white');
  whoSel.setAttribute('aria-label', 'Preview for');
  whoSel.setAttribute('data-thumb-who', '');
  contacts.slice(0, 200).forEach((c) => { const o = el('option', 'bg-neutral-900', [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || 'Prospect'); o.value = c.id; whoSel.appendChild(o); });
  const download = el('button', `${PLAIN} rounded-full`, 'Download this picture');
  download.type = 'button';
  download.setAttribute('data-thumb-download', '');
  const under = el('div', 'flex flex-wrap items-center gap-2 text-xs text-white/60');
  under.append(el('span', '', 'Preview for'), whoSel, el('span', 'flex-1'), download);

  // More thumbnail options: Sendspark's tabs. "Thumbnail" is the main pane above; Edit Preview and Edit Styles hold the rest.
  const tabs = el('div', 'flex gap-1 rounded-full border border-white/10 p-1');
  tabs.setAttribute('role', 'tablist');
  const panes = { main: el('div', 'flex flex-col gap-5'), preview: el('div', 'flex flex-col gap-5'), styles: el('div', 'flex flex-col gap-5') };
  const tabButtons = [['main', 'Thumbnail'], ['preview', 'Edit Preview'], ['styles', 'Edit Styles']].map(([key, label]) => {
    const b = el('button', '', label); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('data-thumb-tab', key);
    b.addEventListener('click', () => showTab(key));
    tabs.appendChild(b); return [key, b];
  });
  function showTab(key) {
    tabButtons.forEach(([k, b]) => { const on = k === key; b.className = `flex-1 rounded-full px-2 py-1.5 text-xs font-bold transition-colors ${on ? 'bg-primary/[0.12] text-white ring-1 ring-primary/40' : 'text-white/60 hover:text-white'}`; b.setAttribute('aria-selected', String(on)); });
    Object.entries(panes).forEach(([k, pane]) => { pane.hidden = k !== key; });
  }
  panes.main.append(
    durLbl,
    field('Caption', text),
    chips,
    fallbacks,
    field('Logo Search', findRow),
    logoNote,
    oneBox,
    uploadLogo,
    logoFile,
    section('Logo on the thumbnail', logoRow),
  );
  panes.preview.append(
    section('Thumbnail type', typeRow, el('p', 'text-[11px] text-white/45', 'An animated GIF plays 3 seconds from the moment you picked.')),
    section('Behind your camera bubble', bgRow, changeImg, imageNote, bgHelp, file),
  );
  panes.styles.append(
    section('Text and banner colours', colourRow),
    section('Play button', playRow),
    section('Timestamp badge', durRow),
  );
  const more = el('div', 'flex flex-col gap-4');
  more.setAttribute('data-thumb-more', '');
  more.append(el('div', 'text-xs font-bold uppercase tracking-wider text-white/50', 'More thumbnail options'), tabs, panes.main, panes.preview, panes.styles);
  const foot = el('div', 'flex flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-4');
  if (make) foot.appendChild(make);
  foot.appendChild(done);
  body.append(stage, scrub, more, under, note, foot);
  modal.append(head, body);
  overlay.appendChild(modal);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });

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
    paintLogo(s.logoMode);
    oneBox.hidden = s.logoMode !== 'one';
    result.hidden = !s.logoUrl;
    if (s.logoUrl) { resultImg.src = s.logoUrl; resultName.textContent = prettyName(foundDomain || domain.value.trim() || 'your logo'); resultDomain.textContent = foundDomain || ''; }
    textColor.i.value = s.textColor; bannerColor.i.value = s.bannerColor;
    durOn.checked = s.duration.show; durColor.value = s.duration.color; durOpacity.value = String(s.duration.opacity);
  }

  // ---- The live picture: the video plays behind it (a GIF loops its 3 seconds), redrawn on every frame.
  let video = null; let siteImg = null; let logoImg = null; let loopStart = 0; let gone = false;
  const draw = () => {
    if (gone) return;
    const s = T.thumbSettings(t());
    removeLogo.hidden = !(s.logo && logoImg);
    const progress = s.type === 'gif' && video ? Math.max(0, Math.min(1, (video.currentTime - loopStart) / T.GIF_SECONDS)) : 0;
    T.drawThumbnail(canvas.getContext('2d'), { frame: video && video.readyState >= 2 ? video : null, site: siteImg, logo: s.logo ? logoImg : null, text: T.thumbnailText(draft.email?.thumbText, who, draft.fallbacks || {}), play: s.play, progress, textColor: s.textColor, bannerColor: s.bannerColor, duration: s.duration, seconds: draft.video?.duration || 0 });
  };
  const loadImg = (src, set) => { if (!src) { set(null); draw(); return; } const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => { set(img); draw(); }; img.onerror = () => { set(null); draw(); }; img.src = src; };
  function loadImages() {
    const s = T.thumbSettings(t());
    loadImg(T.thumbBackground(s, websiteFor(who)), (v) => { siteImg = v; });
    loadImg(T.thumbLogo(s, logoFor(who)), (v) => { logoImg = v; });
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
      const blob = await T.renderThumbnail({ frames, siteUrl: T.thumbBackground(s, websiteFor(who)), logoUrl: T.thumbLogo(s, logoFor(who)), text: T.thumbnailText(draft.email?.thumbText, who, draft.fallbacks || {}), settings: s, seconds: draft.video?.duration || 0 });
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
  closeX.addEventListener('click', close);
  make?.addEventListener('click', () => { close(); onMake(); });
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(overlay);
  paintControls();
  showTab('main');
  loadImages();
  draw();
  return { close };
}
