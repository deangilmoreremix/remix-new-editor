// src/components/outreach/EditorTools.js
//
// The Video Outreach editor's tool panels (Record step → the scissors tool): Look, Background,
// Audio, Captions on the video, Text & graphics, B-roll, Chapters and Export. The recipe lives in
// draft.edit (src/lib/outreach/editTools.js); the studio previews it live and "Apply edits" renders it.
//
// renderEditorTools(o) → element. o:
//   tab, setTab(tab)
//   edit                     the recipe (normalized)
//   update(fn, { soft })     change the recipe: fn(edit) mutates it. soft = slider drag (refresh the
//                            preview only, no re-render of the panel)
//   now()                    the preview's current time (seconds), for where new things start
//   seconds                  length of the edited video
//   lines                    caption lines (or [])
//   chapters, setChapters(list)
//   actions                  { removeSilences(level), applyBackground(), upload(file) → url,
//                              picture(file, opts) → url, waveform() → Promise<bars>, makeCaptions(),
//                              captionsFile('srt'|'vtt'), makeChapters(), mediaDuration(file) → seconds }
//   cutPanel                 the Cut tab's element (trim, cuts, before/after), built by the studio
//   sender                   { name, title } from the Page step, for the name strap
import { ASPECTS, CAPTION_STYLES, TRANSITIONS, QUALITY, STICKERS, newOverlay, newBroll, isPersonal, placeItem, overlapsOf } from '../../lib/outreach/editTools.js';

const el = (tag, cls = '', txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt !== undefined) n.textContent = txt; return n; };
const LOOK = {
  plain: 'border border-white/[0.08] bg-transparent text-white/70 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.18]',
  primary: 'border border-white/[0.12] border-l-2 border-l-primary bg-transparent text-white/90 hover:text-white hover:bg-white/[0.06]',
  selected: 'border border-primary/25 bg-primary/[0.08] text-white/90 hover:bg-primary/[0.14]',
};
function btn(label, { primary = false, selected = false, attr = '' } = {}) {
  const b = el('button', `inline-flex items-center justify-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-40 ${LOOK[selected ? 'selected' : primary ? 'primary' : 'plain']}`, label);
  b.type = 'button';
  if (attr) b.setAttribute(attr, '');
  return b;
}
const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

export const TABS = [
  ['cut', 'Cut'], ['look', 'Look'], ['background', 'Background'], ['audio', 'Audio'], ['captions', 'Captions'],
  ['add', 'Text & graphics'], ['broll', 'B-roll'], ['chapters', 'Chapters'], ['export', 'Export'],
];

export function renderEditorTools(o) {
  const box = el('div', 'flex flex-col gap-4 rounded-xl border border-white/10 p-4');
  box.setAttribute('data-outreach-tools', o.tab);
  const tabs = el('div', 'flex flex-wrap gap-1');
  tabs.setAttribute('role', 'tablist');
  TABS.forEach(([k, label]) => {
    const t = btn(label, { selected: o.tab === k });
    t.setAttribute('role', 'tab'); t.setAttribute('aria-selected', String(o.tab === k)); t.setAttribute('data-tools-tab', k);
    t.addEventListener('click', () => o.setTab(k));
    tabs.appendChild(t);
  });
  box.appendChild(tabs);
  const body = el('div', 'flex flex-col gap-3');
  const pane = { cut, look, background, audio, captions, add, broll, chapters, exportTab }[o.tab === 'export' ? 'exportTab' : o.tab] || cut;
  pane(body, o);
  box.appendChild(body);
  return box;
}

// ---------------------------------------------------------------- controls

function slider(label, value, { min, max, step = 0.01, show = (v) => v.toFixed(2), attr }, onInput) {
  const row = el('label', 'flex items-center gap-3 text-xs');
  const r = el('input', 'flex-1 accent-[#d9ff00]');
  Object.assign(r, { type: 'range', min: String(min), max: String(max), step: String(step), value: String(value) });
  if (attr) r.setAttribute(attr, '');
  const v = el('span', 'w-14 text-right tabular-nums text-white/60', show(Number(value)));
  r.addEventListener('input', () => { v.textContent = show(Number(r.value)); onInput(Number(r.value), true); });
  r.addEventListener('change', () => onInput(Number(r.value), false));
  row.append(el('span', 'w-28 text-white/55', label), r, v);
  return row;
}

function choices(label, list, current, onPick, attr) {
  const row = el('div', 'flex flex-wrap items-center gap-2 text-xs');
  if (label) row.appendChild(el('span', 'w-28 text-white/55', label));
  list.forEach(([k, name]) => {
    const b = btn(name, { selected: current === k });
    if (attr) b.setAttribute(attr, k);
    b.addEventListener('click', () => onPick(k));
    row.appendChild(b);
  });
  return row;
}

function check(label, on, onChange, attr) {
  const l = el('label', 'flex items-center gap-2 text-xs text-white/75');
  const c = el('input', 'accent-[#d9ff00]'); c.type = 'checkbox'; c.checked = !!on;
  if (attr) c.setAttribute(attr, '');
  c.addEventListener('change', () => onChange(c.checked));
  l.append(c, el('span', '', label));
  return l;
}

function filePick(label, accept, onFile, attr) {
  const f = el('input'); f.type = 'file'; f.accept = accept; f.hidden = true;
  if (attr) f.setAttribute(attr, '');
  const b = btn(label);
  b.addEventListener('click', () => f.click());
  f.addEventListener('change', () => { const file = f.files?.[0]; f.value = ''; if (file) onFile(file); });
  const w = el('span', 'inline-flex'); w.append(b, f);
  return w;
}

const note = (t) => el('p', 'text-[11px] leading-relaxed text-white/45', t);
const heading = (t) => el('div', 'text-sm font-bold', t);

function timeRange(item, o, onChange) {
  const row = el('div', 'flex flex-wrap items-center gap-2 text-xs');
  const num = (v, key) => {
    const i = el('input', 'w-20 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-white');
    Object.assign(i, { type: 'number', step: '0.1', min: '0', value: String(v) });
    i.setAttribute(`data-time-${key}`, '');
    i.addEventListener('change', () => onChange(key, Math.max(0, Number(i.value) || 0)));
    return i;
  };
  const here = btn('Start here');
  here.addEventListener('click', () => { const t = o.now(); onChange('start', t); onChange('end', Math.max(t + 0.5, t + (item.end - item.start))); });
  row.append(el('span', 'text-white/55', 'From'), num(item.start, 'start'), el('span', 'text-white/55', 'to'), num(item.end, 'end'), el('span', 'text-white/40', 's'), here);
  return row;
}

// ---------------------------------------------------------------- panes

function cut(body, o) {
  body.appendChild(o.cutPanel);
  const sil = el('div', 'flex flex-col gap-2 border-t border-white/10 pt-3');
  sil.appendChild(heading('Remove silences'));
  sil.appendChild(note('Finds the pauses in what you say and cuts them out (Web Audio, in your browser). The pause at the start, where the greeting plays, is kept.'));
  const row = el('div', 'flex flex-wrap items-center gap-2');
  [['light', 'Long pauses only'], ['normal', 'Normal'], ['tight', 'Tight']].forEach(([k, label]) => {
    const b = btn(label, { primary: k === 'normal' });
    b.setAttribute('data-silence', k);
    b.addEventListener('click', () => o.actions.removeSilences(k));
    row.appendChild(b);
  });
  sil.appendChild(row);
  body.appendChild(sil);
  const tr = el('div', 'flex flex-col gap-2 border-t border-white/10 pt-3');
  tr.appendChild(heading('Transitions'));
  tr.appendChild(choices('Where pieces meet', TRANSITIONS, o.edit.transition, (k) => o.update((e) => { e.transition = k; }), 'data-transition'));
  body.appendChild(tr);
}

function look(body, o) {
  const l = o.edit.look;
  const set = (key) => (v, soft) => o.update((e) => { e.look[key] = v; }, { soft });
  body.append(
    choices('Shape', ASPECTS, l.aspect, (k) => o.update((e) => { e.look.aspect = k; }), 'data-look-aspect'),
    note('Same as recording keeps your whole picture with no black bars. Another shape crops the middle (zoom and the preview show what is kept).'),
  );
  const turn = el('div', 'flex flex-wrap items-center gap-2 text-xs');
  turn.appendChild(el('span', 'w-28 text-white/55', 'Rotate and flip'));
  const rot = btn(`Rotate 90° (${l.rotate}°)`); rot.setAttribute('data-look-rotate', '');
  rot.addEventListener('click', () => o.update((e) => { e.look.rotate = (e.look.rotate + 90) % 360; }));
  const fh = btn('Flip ↔', { selected: l.flipH }); fh.setAttribute('data-look-fliph', '');
  fh.addEventListener('click', () => o.update((e) => { e.look.flipH = !e.look.flipH; }));
  const fv = btn('Flip ↕', { selected: l.flipV });
  fv.addEventListener('click', () => o.update((e) => { e.look.flipV = !e.look.flipV; }));
  turn.append(rot, fh, fv);
  body.append(
    turn,
    slider('Zoom', l.zoom, { min: 1, max: 3, show: (v) => `${v.toFixed(2)}×`, attr: 'data-look-zoom' }, set('zoom')),
    slider('Brightness', l.brightness, { min: -1, max: 1, attr: 'data-look-brightness' }, set('brightness')),
    slider('Contrast', l.contrast, { min: 0.5, max: 1.5, attr: 'data-look-contrast' }, set('contrast')),
    slider('Saturation', l.saturation, { min: 0, max: 2, attr: 'data-look-saturation' }, set('saturation')),
    slider('Warmth', l.warmth, { min: -1, max: 1 }, set('warmth')),
    slider('Vignette', l.vignette, { min: 0, max: 1 }, set('vignette')),
  );
  const reset = btn('Reset look');
  reset.addEventListener('click', () => o.update((e) => { e.look = { ...e.look, rotate: 0, flipH: false, flipV: false, zoom: 1, brightness: 0, contrast: 1, saturation: 1, warmth: 0, vignette: 0 }; }));
  body.append(reset, note('Colour runs on your graphics card (Remotion effects) and is burned in when you apply.'));
}

function background(body, o) {
  const b = o.edit.background;
  body.append(
    heading('Background behind you'),
    note('MediaPipe finds you in every frame and changes what is behind you, in your browser. It is done when you click Apply edits, first, before text, captions and graphics are added, so they stay sharp. The first time takes about as long as the video plays; after that it is reused.'),
    choices('Background', [['none', 'Keep it'], ['blur', 'Blur'], ['image', 'Picture'], ['color', 'Solid colour']], b.mode, (k) => o.update((e) => { e.background.mode = k; }), 'data-bg-mode'),
  );
  if (b.mode === 'blur') body.appendChild(slider('Blur', b.blur, { min: 0, max: 1 }, (v, soft) => o.update((e) => { e.background.blur = v; }, { soft })));
  if (b.mode === 'image') {
    body.appendChild(choices('Picture', [['office', 'Office'], ['studio', 'Studio'], ['gradient', 'Gradient'], ...(/^https:/.test(b.image) ? [[b.image, 'Your picture']] : [])], b.image, (k) => o.update((e) => { e.background.image = k; })));
    body.appendChild(filePick('Upload a picture', 'image/*', async (file) => { const url = await o.actions.picture(file, { maxSize: 1920 }); if (url) o.update((e) => { e.background.image = url; }); }, 'data-bg-upload'));
  }
  if (b.mode === 'color') {
    const c = el('input', 'h-8 w-14 rounded border border-white/10 bg-transparent'); c.type = 'color'; c.value = b.color;
    c.addEventListener('change', () => o.update((e) => { e.background.color = c.value; }));
    body.appendChild(c);
  }
  if (b.mode !== 'none') body.appendChild(note('The preview shows the background once it has been applied.'));
}

function audio(body, o) {
  const a = o.edit.audio;
  const wave = el('div', 'flex h-12 items-end gap-px overflow-hidden rounded-lg bg-white/[0.03] px-1');
  wave.setAttribute('data-waveform', '');
  wave.appendChild(note('Loading the waveform…'));
  o.actions.waveform().then((bars) => {
    wave.replaceChildren();
    if (!bars?.length) { wave.appendChild(note('No sound in this video.')); return; }
    bars.forEach((v) => { const bar = el('span', 'flex-1 rounded-sm bg-primary/60'); bar.style.height = `${Math.max(4, Math.min(1, v * a.volume) * 100)}%`; wave.appendChild(bar); });
  }).catch(() => { wave.replaceChildren(note('Could not read the sound.')); });
  body.append(
    heading('Your voice'),
    wave,
    slider('Volume', a.volume, { min: 0, max: 1, show: (v) => `${Math.round(v * 100)}%`, attr: 'data-audio-volume' }, (v, soft) => o.update((e) => { e.audio.volume = v; }, { soft })),
    check('Make it louder and even (loudness to -16 LUFS with FFmpeg when you apply)', a.louder, (on) => o.update((e) => { e.audio.louder = on; }), 'data-audio-louder'),
    heading('Background music'),
  );
  if (a.music) {
    const row = el('div', 'flex flex-wrap items-center gap-2 text-xs');
    const rm = btn('Remove'); rm.addEventListener('click', () => o.update((e) => { e.audio.music = null; }));
    row.append(el('span', 'text-white/80', `♪ ${a.music.name}`), rm);
    body.append(row, slider('Music volume', a.music.volume, { min: 0, max: 1, show: (v) => `${Math.round(v * 100)}%`, attr: 'data-music-volume' }, (v, soft) => o.update((e) => { e.audio.music.volume = v; }, { soft })));
  } else {
    body.appendChild(filePick('Add music', 'audio/*', async (file) => {
      const [src, duration] = await Promise.all([o.actions.upload(file), o.actions.mediaDuration(file)]);
      if (src) o.update((e) => { e.audio.music = { src, name: file.name, volume: 0.15, duration }; });
    }, 'data-music-file'));
    body.appendChild(note('Music plays quietly under your voice. Use music you have the rights to.'));
  }
}

function captions(body, o) {
  const c = o.edit.captions;
  if (!o.lines.length) {
    body.appendChild(note('Make captions first: Whisper writes them in your browser, free.'));
    const mk = btn('Make captions', { primary: true, attr: 'data-tools-make-captions' });
    mk.addEventListener('click', () => o.actions.makeCaptions());
    body.appendChild(mk);
    return;
  }
  body.append(
    check('Show captions on the video (burned in when you apply)', c.burn, (on) => o.update((e) => { e.captions.burn = on; }), 'data-captions-burn'),
    choices('Style', CAPTION_STYLES, c.preset, (k) => o.update((e) => { e.captions.preset = k; }), 'data-captions-style'),
    choices('Position', [['bottom', 'Bottom'], ['middle', 'Middle'], ['top', 'Top']], c.position, (k) => o.update((e) => { e.captions.position = k; })),
    slider('Size', c.size, { min: 3, max: 10, step: 0.5, show: (v) => v.toFixed(1) }, (v, soft) => o.update((e) => { e.captions.size = v; }, { soft })),
  );
  const color = el('label', 'flex items-center gap-3 text-xs');
  const ci = el('input', 'h-7 w-12 rounded border border-white/10 bg-transparent'); ci.type = 'color'; ci.value = c.color;
  ci.addEventListener('change', () => o.update((e) => { e.captions.color = ci.value; }));
  color.append(el('span', 'w-28 text-white/55', 'Colour'), ci);
  const files = el('div', 'flex flex-wrap gap-2');
  const srt = btn('Download .srt'); srt.setAttribute('data-captions-srt', ''); srt.addEventListener('click', () => o.actions.captionsFile('srt'));
  const vtt = btn('Download .vtt'); vtt.addEventListener('click', () => o.actions.captionsFile('vtt'));
  files.append(srt, vtt);
  body.append(color, files, note('Edit the words in the CC tool. The transcript on the page stays either way.'));
}

const POSITIONS = [['tl', 'Top left', 4, 5], ['tc', 'Top', null, 5], ['tr', 'Top right', -4, 5], ['bl', 'Bottom left', 4, -6], ['bc', 'Bottom', null, -6], ['br', 'Bottom right', -4, -6], ['c', 'Middle', null, null]];
function place(item, key) {
  const p = POSITIONS.find(([k]) => k === key);
  if (!p) return;
  const [, , x, y] = p;
  item.left = x == null ? (100 - item.width) / 2 : x >= 0 ? x : 100 - item.width + x;
  item.top = y == null ? (100 - item.height) / 2 : y >= 0 ? y : 100 - item.height + y;
}

function add(body, o) {
  const row = el('div', 'flex flex-wrap gap-2');
  const at = () => { const t = o.now(); return { start: t, end: Math.min(o.seconds, t + 5) }; };
  // Every new item goes where it covers nothing else on screen at that time (placeItem).
  const push = (item) => o.update((e) => { e.overlays.push(placeItem(item, e)); });
  const addText = btn('+ Text', { attr: 'data-add-text' }); addText.addEventListener('click', () => push(newOverlay('text', at())));
  const sender = o.sender || {};
  const addLower = btn('+ Name and title', { attr: 'data-add-lower' });
  addLower.addEventListener('click', () => push(newOverlay('lower', { ...at(), ...(sender.name ? { text: sender.name } : {}), ...(sender.title || sender.name ? { title: sender.title || '' } : {}) })));
  row.append(addText, addLower);
  const picOpts = { removeBackground: false, sharpen: false };
  const addPic = (kind) => filePick(kind === 'logo' ? '+ Logo' : '+ Picture', 'image/*', async (file) => {
    const src = await o.actions.picture(file, { removeBackground: picOpts.removeBackground, sharpen: picOpts.sharpen ? 0.6 : 0, maxSize: kind === 'logo' ? 600 : 1600 });
    if (src) push(newOverlay(kind, { ...(kind === 'logo' ? { start: 0, end: o.seconds } : at()), src }));
  }, `data-add-${kind}`);
  row.append(addPic('logo'), addPic('image'));
  body.appendChild(row);
  const opts = el('div', 'flex flex-wrap gap-4');
  opts.append(
    check('Remove the picture’s background (BG0, in your browser)', false, (on) => { picOpts.removeBackground = on; }, 'data-add-remove-bg'),
    check('Sharpen', false, (on) => { picOpts.sharpen = on; }),
  );
  body.appendChild(opts);
  const stickers = el('div', 'flex flex-wrap items-center gap-1.5');
  stickers.appendChild(el('span', 'mr-1 text-xs text-white/55', 'Animated stickers:'));
  STICKERS.forEach((s) => {
    const b = btn(s.name); b.setAttribute('data-add-sticker', s.name);
    b.addEventListener('click', () => push(newOverlay('sticker', { ...at(), src: s.src, name: s.name, end: Math.min(o.seconds, o.now() + 3) })));
    stickers.appendChild(b);
  });
  body.append(stickers, note('Write {{firstname}} or {{company}} in a text and each prospect sees their own: those texts are added to every prospect’s video, not burned in.'));
  o.edit.overlays.forEach((item, i) => body.appendChild(overlayCard(item, i, o)));
}

function overlayCard(item, i, o) {
  const card = el('div', 'flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3');
  card.setAttribute('data-overlay', item.kind);
  const change = (fn, soft) => o.update((e) => { fn(e.overlays[i]); }, { soft });
  const head = el('div', 'flex items-center gap-2 text-xs');
  const label = { text: 'Text', lower: 'Name and title', logo: 'Logo', image: 'Picture', sticker: `Sticker: ${item.name || ''}` }[item.kind];
  head.append(el('span', 'font-bold text-white/85', label));
  if (isPersonal(item)) head.appendChild(el('span', 'rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] text-white', 'Personal'));
  const del = btn('Remove'); del.classList.add('ml-auto');
  del.addEventListener('click', () => o.update((e) => { e.overlays.splice(i, 1); }));
  head.appendChild(del);
  card.appendChild(head);
  card.appendChild(overlapNote(item, o, (e) => { e.overlays[i] = placeItem(e.overlays[i], e); }));
  if (item.kind === 'text' || item.kind === 'lower') {
    const t = el('input', 'w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white'); t.value = item.text || '';
    t.setAttribute('data-overlay-text', '');
    t.addEventListener('change', () => change((x) => { x.text = t.value.slice(0, 120); }));
    card.appendChild(t);
    if (item.kind === 'lower') {
      const s = el('input', 'w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white'); s.value = item.title || '';
      s.addEventListener('change', () => change((x) => { x.title = s.value.slice(0, 120); }));
      card.appendChild(s);
    }
    const col = el('input', 'h-7 w-12 rounded border border-white/10 bg-transparent'); col.type = 'color'; col.value = item.color || '#ffffff';
    col.addEventListener('change', () => change((x) => { x.color = col.value; }));
    const colRow = el('div', 'flex items-center gap-3 text-xs'); colRow.append(el('span', 'text-white/55', 'Colour'), col);
    if (item.kind === 'text') colRow.appendChild(check('Dark box behind', item.background, (on) => change((x) => { x.background = on; })));
    card.appendChild(colRow);
    if (item.kind === 'text') card.appendChild(slider('Text size', item.size || 5, { min: 3, max: 10, step: 0.5, show: (v) => v.toFixed(1), attr: 'data-overlay-size' }, (v, soft) => change((x) => { x.size = v; }, soft)));
  }
  if (item.kind !== 'lower') card.appendChild(choices('', POSITIONS.map(([k, n]) => [k, n]), '', (k) => change((x) => place(x, k))));
  if (item.kind !== 'lower' && item.kind !== 'text') card.appendChild(slider('Size', item.width, { min: 5, max: 60, step: 1, show: (v) => `${Math.round(v)}%` }, (v, soft) => change((x) => { const r = x.height / x.width; x.width = v; x.height = v * r; }, soft)));
  card.appendChild(timeRange(item, o, (k, v) => o.update((e) => {
    const x = e.overlays[i]; x[k] = v; if (x.end <= x.start) x.end = x.start + 0.5;
    // Moved to a time where it would cover something: find it a free spot.
    if (overlapsOf(x, e).length) e.overlays[i] = placeItem(x, e);
  })));
  return card;
}

/** "Overlaps …" with a Fix position button, or nothing. */
function overlapNote(item, o, fix) {
  const hits = overlapsOf(item, o.edit);
  const row = el('div', hits.length ? 'flex flex-wrap items-center gap-2 rounded-lg bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200' : 'hidden');
  if (!hits.length) return row;
  row.setAttribute('data-overlaps', '');
  row.appendChild(el('span', '', `Overlaps ${hits.slice(0, 2).join(' and ')}${hits.length > 2 ? ` and ${hits.length - 2} more` : ''}.`));
  const b = btn('Fix position', { attr: 'data-fix-position' });
  b.addEventListener('click', () => o.update(fix));
  row.appendChild(b);
  return row;
}

function broll(body, o) {
  const at = () => { const t = o.now(); return { start: t, end: Math.min(o.seconds, t + 4) }; };
  const push = (item) => o.update((e) => { e.broll.push(item); });
  const row = el('div', 'flex flex-wrap gap-2');
  const fixBroll = (i) => (e) => { e.broll[i] = placeItem(e.broll[i], e); };
  row.append(
    filePick('+ Clip', 'video/*', async (file) => { const src = await o.actions.upload(file); if (src) push(newBroll('video', { ...at(), src, name: file.name })); }, 'data-broll-clip'),
    filePick('+ Picture', 'image/*', async (file) => { const src = await o.actions.picture(file, { maxSize: 1920 }); if (src) push(newBroll('image', { ...at(), src, name: file.name })); }, 'data-broll-picture'),
  );
  const site = btn('+ Their website', { attr: 'data-broll-website' });
  site.addEventListener('click', () => push(newBroll('website', { ...at(), name: 'Their website' })));
  row.appendChild(site);
  body.append(row, note('B-roll shows over your video for a few seconds: full screen, or small in a corner while you keep talking. “Their website” shows each prospect their own site, scrolling (captured with Playwright when you generate).'));
  o.edit.broll.forEach((b, i) => {
    const card = el('div', 'flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3');
    card.setAttribute('data-broll', b.kind);
    const head = el('div', 'flex items-center gap-2 text-xs');
    head.append(el('span', 'font-bold text-white/85', b.kind === 'website' ? 'Their website' : b.name || (b.kind === 'video' ? 'Clip' : 'Picture')));
    if (isPersonal(b)) head.appendChild(el('span', 'rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] text-white', 'Personal'));
    const del = btn('Remove'); del.classList.add('ml-auto');
    del.addEventListener('click', () => o.update((e) => { e.broll.splice(i, 1); }));
    head.appendChild(del);
    card.append(
      head,
      overlapNote(b, o, fixBroll(i)),
      choices('', [['full', 'Full screen'], ['pip', 'In a corner']], b.mode, (k) => o.update((e) => { e.broll[i].mode = k; if (k === 'pip') e.broll[i] = placeItem(e.broll[i], e); }), 'data-broll-mode'),
      timeRange(b, o, (k, v) => o.update((e) => {
        const x = e.broll[i]; x[k] = v; if (x.end <= x.start) x.end = x.start + 0.5;
        if (overlapsOf(x, e).length) e.broll[i] = placeItem(x, e);
      })),
    );
    body.appendChild(card);
  });
}

function chapters(body, o) {
  body.appendChild(note('Chapters show under the video on the prospect’s page; clicking one jumps there. They are made from your captions (where you pause between topics).'));
  const mk = btn(o.chapters.length ? 'Make them again' : 'Make chapters', { primary: !o.chapters.length, attr: 'data-chapters-make' });
  mk.disabled = !o.lines.length;
  mk.addEventListener('click', () => o.actions.makeChapters());
  body.appendChild(mk);
  if (!o.lines.length) body.appendChild(note('Make captions first (the Captions tab).'));
  o.chapters.forEach((c, i) => {
    const row = el('div', 'flex items-center gap-2 text-xs');
    row.setAttribute('data-chapter', String(i));
    const t = el('input', 'flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white'); t.value = c.title;
    t.addEventListener('change', () => { const list = o.chapters.map((x) => ({ ...x })); list[i].title = t.value.slice(0, 80) || list[i].title; o.setChapters(list); });
    const rm = btn('Remove');
    rm.addEventListener('click', () => o.setChapters(o.chapters.filter((_, j) => j !== i)));
    row.append(el('span', 'w-12 tabular-nums text-white/55', fmt(c.startMs / 1000)), t, rm);
    body.appendChild(row);
  });
}

function exportTab(body, o) {
  body.append(
    choices('File size', QUALITY.map(([k, n]) => [k, n]), o.edit.quality, (k) => o.update((e) => { e.quality = k; }), 'data-export-quality'),
    note('Small file and High quality re-encode the result with FFmpeg in your browser (H.264 MP4); Standard keeps the render as it is.'),
  );
}
