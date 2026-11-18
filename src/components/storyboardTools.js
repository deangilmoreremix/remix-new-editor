/**
 * DOM tools for the Storyboard Studio: script import, animatic player and pitch-deck export.
 * Logic lives in lib/storyboardPipeline.js; this file only builds UI.
 */
import {
  parseScript, buildShotList, shotsToFrames, csvToFrames, extractCharacters,
  buildAnimaticTimeline, cameraMoveTransform, animaticToVtt, buildPitchDeckHtml,
  DECK_THEMES,
} from '../lib/storyboardPipeline.js';
import { buildLookSuffix } from '../lib/storyboardEngine.js';

const MAX_SCRIPT_BYTES = 2 * 1024 * 1024;
const BTN = 'px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all disabled:opacity-50';
const PRIMARY = 'px-4 py-2 bg-primary text-black rounded-xl text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50';

function el(tag, cls = '', text = '') {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
}

function overlay(title) {
  const back = el('div', 'fixed inset-0 z-[500] bg-black/80 flex items-center justify-center p-4');
  back.setAttribute('role', 'dialog');
  back.setAttribute('aria-modal', 'true');
  back.setAttribute('aria-label', title);
  const box = el('div', 'bg-[#101014] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto p-5 flex flex-col gap-3 text-white');
  const head = el('div', 'flex items-center justify-between');
  head.append(el('h2', 'text-sm font-bold', title));
  const close = el('button', BTN, 'Close');
  close.type = 'button';
  head.append(close);
  box.append(head);
  back.append(box);
  const dispose = () => { document.removeEventListener('keydown', onKey); back.remove(); };
  const onKey = (e) => { if (e.key === 'Escape') dispose(); };
  document.addEventListener('keydown', onKey);
  close.onclick = dispose;
  back.addEventListener('click', (e) => { if (e.target === back) dispose(); });
  document.body.append(back);
  return { box, dispose };
}

function download(filename, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = el('a');
  a.href = url; a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ───────────── script import ───────────── */

/**
 * Open the script-import dialog. Accepts pasted text or a .fdx/.fountain/.txt/.csv file.
 * `onImport(frames, { scenes, characters })` is called with studio frames.
 */
export function openScriptImport({ onImport, look = {} } = {}) {
  const { box, dispose } = overlay('Import script or shot list');
  const hint = el('p', 'text-[11px] text-white/60', 'Paste a script, or upload Final Draft (.fdx), Fountain (.fountain), plain text, or a shot-list CSV.');
  const ta = el('textarea', 'w-full h-48 bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-primary/50');
  ta.setAttribute('aria-label', 'Script text');
  ta.placeholder = 'INT. COFFEE SHOP - DAY\n\nMAYA stares at her phone.\n\nMAYA\nHe never called.';

  const file = el('input');
  file.type = 'file';
  file.accept = '.fdx,.fountain,.txt,.md,.csv,text/plain,text/csv';
  file.setAttribute('aria-label', 'Upload script file');
  let fileName = '';
  file.onchange = async () => {
    const f = file.files?.[0];
    if (!f) return;
    if (f.size > MAX_SCRIPT_BYTES) { status.textContent = 'File is larger than 2 MB. Split the script and import it in parts.'; return; }
    fileName = f.name;
    ta.value = await f.text();
    refresh();
  };

  const opts = el('div', 'flex items-center gap-3 text-xs');
  const maxLbl = el('label', 'flex items-center gap-2', 'Max shots per scene');
  const max = el('input', 'w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white');
  max.type = 'number'; max.min = '1'; max.max = '12'; max.value = '6';
  maxLbl.append(max);
  opts.append(maxLbl);

  const status = el('p', 'text-[11px] text-white/70');
  status.setAttribute('role', 'status');
  const go = el('button', PRIMARY, 'Build storyboard');
  go.type = 'button';
  go.disabled = true;

  const build = () => {
    const text = ta.value.trim();
    if (!text) return null;
    if (/\.csv$/i.test(fileName) || /^\s*"?Scene"?\s*,\s*"?Shot/i.test(text)) {
      const frames = csvToFrames(text);
      return frames.length ? { frames, scenes: [], characters: [] } : null;
    }
    const scenes = parseScript(text, { fileName });
    if (!scenes.length) return null;
    const shots = buildShotList(scenes, {
      maxShotsPerScene: Math.max(1, Math.min(12, Number(max.value) || 6)),
      lookSuffix: buildLookSuffix(look),
    });
    return { frames: shotsToFrames(shots), scenes, characters: extractCharacters(scenes) };
  };

  function refresh() {
    const r = build();
    go.disabled = !r;
    if (!r) { status.textContent = ta.value.trim() ? 'Could not find any scenes or shots in this text.' : ''; return; }
    const secs = r.frames.reduce((s, f) => s + f.duration, 0);
    status.textContent = `${r.frames.length} shots${r.scenes.length ? ` across ${r.scenes.length} scenes` : ''}${r.characters.length ? `, ${r.characters.length} characters` : ''}, about ${Math.floor(secs / 60)}m ${secs % 60}s.`;
  }
  ta.addEventListener('input', refresh);
  max.addEventListener('input', refresh);
  go.onclick = () => {
    const r = build();
    if (!r) return;
    onImport?.(r.frames, { scenes: r.scenes, characters: r.characters });
    dispose();
  };
  box.append(hint, file, ta, opts, status, go);
  ta.focus();
}

/* ───────────── animatic player ───────────── */

/** Fullscreen animatic: timed frames with camera-move motion, captions and optional audio. */
export function openAnimatic(frames) {
  const { box, dispose } = overlay('Animatic');
  const tl = buildAnimaticTimeline(frames);
  const stage = el('div', 'relative w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center');
  const img = el('img', 'w-full h-full object-cover will-change-transform');
  img.alt = '';
  const empty = el('div', 'absolute inset-0 flex items-center justify-center text-white/50 text-sm');
  const cap = el('div', 'absolute bottom-0 inset-x-0 p-3 text-center text-sm bg-gradient-to-t from-black/80 to-transparent');
  const tag = el('div', 'absolute top-2 left-2 text-[10px] bg-black/60 rounded px-2 py-1');
  stage.append(img, empty, cap, tag);

  const bar = el('input', 'w-full');
  bar.type = 'range'; bar.min = '0'; bar.max = String(Math.max(1, Math.round(tl.total * 100))); bar.value = '0';
  bar.setAttribute('aria-label', 'Animatic position');
  const controls = el('div', 'flex items-center gap-2 flex-wrap');
  const play = el('button', PRIMARY, 'Play'); play.type = 'button';
  const time = el('span', 'text-xs tabular-nums text-white/70');
  const audioBtn = el('label', BTN, 'Add audio');
  const audioIn = el('input', 'hidden'); audioIn.type = 'file'; audioIn.accept = 'audio/*';
  audioBtn.append(audioIn);
  const vtt = el('button', BTN, 'Captions (.vtt)'); vtt.type = 'button';
  controls.append(play, time, audioBtn, vtt);

  let t = 0, playing = false, raf = 0, last = 0, audio = null, audioUrl = '';
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  function draw() {
    const e = tl.at(t);
    if (!e) { empty.textContent = 'No frames.'; return; }
    if (e.imageUrl && /^(https?:|data:image\/|blob:)/i.test(e.imageUrl)) {
      if (img.src !== e.imageUrl) img.src = e.imageUrl;
      img.style.display = ''; empty.textContent = '';
    } else { img.removeAttribute('src'); img.style.display = 'none'; empty.textContent = `Shot ${e.label} has no image yet`; }
    img.style.transform = cameraMoveTransform(e.move, (t - e.start) / e.duration);
    cap.textContent = e.caption;
    tag.textContent = `${e.label} · ${e.move}`;
    time.textContent = `${fmt(t)} / ${fmt(tl.total)}`;
    bar.value = String(Math.round(t * 100));
  }
  function frame(now) {
    if (!playing) return;
    t += (now - last) / 1000; last = now;
    if (t >= tl.total) { t = tl.total; setPlaying(false); }
    draw();
    if (playing) raf = requestAnimationFrame(frame);
  }
  function setPlaying(v) {
    playing = v;
    play.textContent = v ? 'Pause' : (t >= tl.total ? 'Replay' : 'Play');
    cancelAnimationFrame(raf);
    if (v) {
      if (t >= tl.total) t = 0;
      last = performance.now(); raf = requestAnimationFrame(frame);
      if (audio) { audio.currentTime = t; audio.play().catch(() => {}); }
    } else audio?.pause();
  }
  play.onclick = () => setPlaying(!playing);
  bar.oninput = () => { t = Number(bar.value) / 100; if (audio) audio.currentTime = t; draw(); };
  audioIn.onchange = () => {
    const f = audioIn.files?.[0];
    if (!f) return;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(f);
    audio = new Audio(audioUrl);
    audioBtn.firstChild.textContent = `Audio: ${f.name.slice(0, 24)}`;
  };
  vtt.onclick = () => download('animatic-captions.vtt', animaticToVtt(frames), 'text/vtt');

  box.className = box.className.replace('max-w-2xl', 'max-w-4xl');
  box.append(stage, bar, controls);
  // Clean up when the overlay is removed.
  const obs = new MutationObserver(() => {
    if (!document.body.contains(box)) { cancelAnimationFrame(raf); audio?.pause(); if (audioUrl) URL.revokeObjectURL(audioUrl); obs.disconnect(); }
  });
  obs.observe(document.body, { childList: true });
  draw();
  return { dispose };
}

/* ───────────── pitch deck ───────────── */

/** Pick a theme and open the print-ready deck in a new tab (use Print > Save as PDF). */
export function openPitchDeck({ title, logline = '', frames, characters = [] }) {
  const { box, dispose } = overlay('Pitch deck');
  const lbl = el('label', 'text-xs flex items-center gap-2', 'Theme');
  const sel = el('select', 'bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white');
  DECK_THEMES.forEach((t) => { const o = el('option', '', t); o.value = t; sel.append(o); });
  lbl.append(sel);
  const ll = el('input', 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white');
  ll.placeholder = 'Logline (optional)'; ll.value = logline; ll.setAttribute('aria-label', 'Logline');
  const open = el('button', PRIMARY, 'Open deck'); open.type = 'button';
  const save = el('button', BTN, 'Download HTML'); save.type = 'button';
  const make = () => buildPitchDeckHtml({ title: title || 'Untitled storyboard', logline: ll.value, frames, characters, theme: sel.value });
  open.onclick = () => {
    const url = URL.createObjectURL(new Blob([make()], { type: 'text/html' }));
    const w = window.open(url, '_blank', 'noopener');
    if (!w) download('pitch-deck.html', make(), 'text/html');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    dispose();
  };
  save.onclick = () => download('pitch-deck.html', make(), 'text/html');
  const row = el('div', 'flex gap-2');
  row.append(open, save);
  box.append(lbl, ll, row);
}
