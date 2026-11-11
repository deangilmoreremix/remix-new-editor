// SmartVid Zack D Studio: one topic → curiosity-loop script → 3D character sheets → keyframes →
// Veo motion clips → narration + music → assembled 9:16 short.
// Adapted from https://github.com/Anil-matcha/zack-d-films-ai-video-generator (MIT).
// Backend: /api/zackd (netlify/functions/zackd.js). Assembly runs in the browser (ffmpeg.wasm).
import { mountStudioChrome } from '../../../lib/studioChrome.js';
import { saveGeneration } from '../../../lib/generationHistory.js';
import { uploadFileToSupabase } from '../../../lib/uploadService.js';
import { showToast, createProgressBar } from '../../../lib/loading.js';
import { createEmptyState } from '../../studio/emptyState.js';
import { createSegmented } from '../../studio/promptComposer.js';
import { call, runJob, pool, ZackDError } from '../../../lib/zackd/api.js';
import { runAssembly, buildSrt, DEFAULT_TRANSITION_SEC } from '../../../lib/zackd/assemble.js';
import { TEMPLATES, TEMPLATE_ATTRIBUTION, templateToProject } from '../../../lib/zackd/templates.js';
import {
  SEED_TOPICS, LOOKS, DEFAULT_LOOK, TTS_VOICES, DEFAULT_VOICE, DEFAULT_TTS_SPEED,
  CAPTION_LANGUAGES, CAPTION_THEMES, DEFAULT_CAPTION_LANGUAGE, DEFAULT_CAPTION_THEME,
  characterSheetPrompt, keyframePrompt, clipPrompt, narrationText, allShots, totalDuration,
} from '../../../../netlify/functions/_shared/zackdPrompts.js';

const STORE_KEY = 'zackd_project_v1';
const CONCURRENCY = 3;
const STAGES = [
  ['topic', 'Topic'], ['script', 'Script'], ['visuals', 'Characters & keyframes'],
  ['clips', 'Motion clips'], ['audio', 'Voice & music'], ['final', 'Final cut'],
];

const blank = () => ({
  stage: 'topic', topic: '', map: null, look: DEFAULT_LOOK, sheets: {}, shots: {},
  voice: DEFAULT_VOICE, speed: DEFAULT_TTS_SPEED, narration: null, music: null, final: null,
  captionLang: DEFAULT_CAPTION_LANGUAGE, captionTheme: DEFAULT_CAPTION_THEME, keepClipAudio: true,
});

function load() {
  try { return { ...blank(), ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}'), final: null }; } catch { return blank(); }
}

const el = (tag, cls = '', text = '') => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
};
// Shared studio look: neutral white-alpha surfaces; `primary` (neon) only on the main CTA / active step, always with black text.
const BTN = 'w-fit px-4 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_MAIN = 'w-fit bg-primary text-black px-6 py-2.5 rounded-full font-bold text-sm hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20 border border-primary/10 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100';
const CARD = 'rounded-lg border border-white/10 bg-panel-bg p-3 shadow-xl hover:border-primary/50 transition-colors';
const FIELD = 'rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-primary/45 transition-colors';
const FIELD_SM = 'rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none focus:border-primary/45 transition-colors';
const HEADING = 'text-sm font-semibold text-white';

export function ZackDStudio() {
  const container = document.createElement('div');
  container.className = 'w-full flex flex-col bg-app-bg text-white animate-fade-in-up';
  const { topbar } = mountStudioChrome(container, { title: 'Zack D Studio' });
  const status = el('span', 'text-xs text-secondary mr-3');
  status.setAttribute('aria-live', 'polite');
  topbar?.appendChild(status);

  let s = load();
  let busy = false;
  let abort = new AbortController();
  let trends = SEED_TOPICS;
  let error = '';
  let log = '';
  let progress = 0;
  let shownError = '';

  const save = () => {
    // `final` holds a Blob + object URL that die with the page; everything else survives a reload.
    try { const { final, ...rest } = s; localStorage.setItem(STORE_KEY, JSON.stringify(rest)); } catch { /* quota or private mode: keep working in memory */ }
  };
  const setStage = (stage) => { s.stage = stage; save(); render(); };
  const say = (msg) => { status.textContent = msg; };
  const fail = (e) => {
    if (e?.name === 'AbortError') return;
    error = e instanceof ZackDError ? e.message : (e?.message || 'Something went wrong.');
    showToast(error, 'error');
    render();
  };

  // Run a batch of async steps with a busy lock, progress text and a cost confirmation.
  async function batch(label, items, fn, { confirmText } = {}) {
    if (busy || !items.length) return;
    if (confirmText && !window.confirm(confirmText)) return;
    busy = true; error = ''; progress = 0; log = `${label}: 0/${items.length}`; render();
    let done = 0;
    const results = await pool(items, CONCURRENCY, async (item, i) => {
      try { return await fn(item, i); } finally { done += 1; progress = (done / items.length) * 100; log = `${label}: ${done}/${items.length}`; say(log); }
    });
    busy = false; log = ''; progress = 0; say('');
    const failed = results.filter((r) => !r.ok);
    const fatal = failed.find((r) => r.error?.code === 'need_key' || r.error?.code === 'bad_key');
    if (fatal) error = fatal.error.message;
    else if (failed.length) error = `${failed.length} of ${items.length} failed: ${String(failed[0].error?.message || 'error').replace(/[.\s]+$/, '')}. Use Regenerate to retry them.`;
    if (error) showToast(error, 'error');
    else showToast(`${label} ready`, 'success', 2500);
    save(); render();
  }

  const sheetList = () => s.map?.character_sheets || [];
  const shotList = () => (s.map ? allShots(s.map) : []);

  // ---- steps -------------------------------------------------------------------------------
  async function suggestTopics(query) {
    if (busy) return;
    busy = true; error = ''; say('Finding topics…'); render();
    try { trends = (await call({ action: 'trends', query }, { signal: abort.signal })).topics; } catch (e) { fail(e); }
    busy = false; say(''); render();
  }

  // Load an upstream template. Never calls a paid API; a finished demo also brings its keyframes and clips.
  function useTemplate(t) {
    if (busy) return;
    if (s.map && !window.confirm('Replace the current project with this template?')) return;
    s = { ...blank(), ...templateToProject(t, window.location.origin) };
    error = ''; save(); render();
  }

  async function writeScript() {
    if (busy || !s.topic.trim()) return;
    busy = true; error = ''; say('Writing the beat map…'); render();
    try {
      const out = await call({ action: 'script', topic: s.topic.trim() }, { signal: abort.signal });
      s.map = out.map; s.sheets = {}; s.shots = {}; s.narration = null; s.final = null;
      s.stage = 'script'; save();
    } catch (e) { fail(e); }
    busy = false; say(''); render();
  }

  const genSheet = async (sheet) => {
    const r = await runJob({ kind: 'image', aspect: '16:9', prompt: characterSheetPrompt(sheet, { look: s.look }) }, { signal: abort.signal });
    s.sheets[sheet.id] = { url: r.url }; save(); render();
  };
  const genKeyframe = async (shot) => {
    const r = await runJob({ kind: 'image', aspect: '9:16', prompt: keyframePrompt(shot, sheetList(), { look: s.look }) }, { signal: abort.signal });
    s.shots[shot.shot_id] = { ...(s.shots[shot.shot_id] || {}), keyframe: r.url, clip: null }; save(); render();
  };
  const genClip = async (shot) => {
    const kf = s.shots[shot.shot_id]?.keyframe;
    if (!kf) throw new ZackDError('Generate the keyframe first.', 'missing');
    const r = await runJob({ kind: 'clip', imageUrl: kf, prompt: clipPrompt(shot) }, { signal: abort.signal });
    s.shots[shot.shot_id] = { ...s.shots[shot.shot_id], clip: r.url }; save(); render();
  };
  const genNarration = async () => {
    const r = await runJob({ kind: 'tts', text: narrationText(s.map), voice: s.voice, speed: s.speed }, { signal: abort.signal });
    s.narration = r.url; save(); render();
  };
  const genMusic = async () => {
    const r = await runJob({ kind: 'music', prompt: `Underscore for a short about: ${s.topic}`, duration: Math.ceil(totalDuration(s.map)) + 5 }, { signal: abort.signal });
    s.music = r.url; save(); render();
  };

  async function assemble() {
    if (busy) return;
    const shots = shotList();
    const missing = shots.filter((x) => !s.shots[x.shot_id]?.clip);
    if (missing.length) { error = `${missing.length} shot(s) have no clip yet.`; render(); return; }
    busy = true; error = ''; render();
    try {
      const { blob, duration } = await runAssembly({
        clips: shots.map((x) => ({ url: s.shots[x.shot_id].clip, duration: x.duration_sec, zoom: x.zoom_impact })),
        narrationUrl: s.narration, musicUrl: s.music, keepClipAudio: s.keepClipAudio !== false, transition: DEFAULT_TRANSITION_SEC, signal: abort.signal,
        onProgress: (phase, p) => say(phase === 'encode' ? `Encoding ${Math.round(p * 100)}%` : phase === 'download' ? 'Downloading clips…' : 'Loading encoder…'),
      });
      if (s.final?.objectUrl) URL.revokeObjectURL(s.final.objectUrl);
      s.final = { objectUrl: URL.createObjectURL(blob), blob, duration, saved: false };
      say('Done');
    } catch (e) { fail(e); say(''); }
    busy = false; render();
  }

  // Opt-in, paid: upload the rendered cut to MuAPI, then burn animated captions in with ai-captions (Vadoo).
  async function burnCaptions() {
    if (!s.final?.blob || busy) return;
    if (!s.narration) { error = 'Captions are generated from the spoken audio. Add narration first.'; render(); return; }
    if (!window.confirm('Burn captions into the video with MuAPI AI Captions? About $0.20 minimum ($0.005 per second), and it takes a few minutes.')) return;
    busy = true; error = ''; progress = 0; log = 'Uploading the video…'; say(log); render();
    try {
      const { muapi } = await import('../../../lib/muapi.js');
      const file = new File([s.final.blob], 'zackd-cut.mp4', { type: 'video/mp4' });
      const videoUrl = await muapi.uploadFile(file, { signal: abort.signal });
      log = 'Burning captions (2-3 minutes)…'; say(log); render();
      const r = await runJob({ kind: 'captions', videoUrl, language: s.captionLang, theme: s.captionTheme }, { signal: abort.signal });
      s.final.captioned = { url: r.url, saved: false };
      showToast('Captions ready', 'success', 2500);
    } catch (e) { fail(e); }
    busy = false; log = ''; say(''); render();
  }

  function saveCaptionedToLibrary() {
    const c = s.final?.captioned;
    if (!c || c.saved) return;
    saveGeneration({ studio: 'zackd', type: 'video', url: c.url, prompt: s.topic });
    c.saved = true; showToast('Saved to your library', 'success', 2500); render();
  }

  async function saveToLibrary() {
    if (!s.final?.blob || busy) return;
    busy = true; say('Saving to your library…'); render();
    try {
      const file = new File([s.final.blob], `zackd-${(s.map?.title || 'short').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.mp4`, { type: 'video/mp4' });
      const { url } = await uploadFileToSupabase(file, { category: 'video' });
      saveGeneration({ studio: 'zackd', type: 'video', url, prompt: s.topic });
      s.final.saved = true; say('Saved to your library');
    } catch (e) { error = `Couldn't save to library (${e?.message || 'upload failed'}). You can still download it.`; say(''); }
    busy = false; render();
  }

  function download(blob, name) {
    const a = el('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ---- views -------------------------------------------------------------------------------
  const media = (kind, url, cls) => {
    const m = el(kind, cls);
    m.src = url;
    if (kind === 'video') { m.controls = true; m.muted = true; m.loop = true; m.playsInline = true; m.preload = 'metadata'; }
    if (kind === 'img') m.alt = '';
    if (kind === 'audio') m.controls = true;
    return m;
  };

  function viewTopic() {
    const box = el('div', 'flex flex-col gap-4');
    box.appendChild(createEmptyState({
      heading: 'Start creating with',
      highlight: 'Zack D Studio',
      subtitle: 'Give one curiosity-driven question. The studio turns it into a 9:16 stylized 3D explainer short.',
    }));
    const input = el('input', `w-full ${FIELD}`);
    input.type = 'text'; input.maxLength = 200; input.value = s.topic;
    input.placeholder = 'e.g. What happens when you swallow gum?';
    input.setAttribute('aria-label', 'Topic');
    input.oninput = () => { s.topic = input.value; save(); go.disabled = busy || !s.topic.trim(); };
    box.appendChild(input);
    const row = el('div', 'flex gap-2 flex-wrap');
    const go = el('button', BTN_MAIN, s.map ? 'Rewrite script' : 'Write script'); go.disabled = busy || !s.topic.trim();
    go.onclick = writeScript;
    const sug = el('button', BTN, 'Suggest topics'); sug.disabled = busy;
    sug.onclick = () => suggestTopics(input.value.trim());
    row.append(go, sug);
    if (s.map) { const keep = el('button', BTN, 'Continue current project'); keep.onclick = () => setStage('script'); row.appendChild(keep); }
    box.appendChild(row);
    box.appendChild(el('div', `${HEADING} mt-2`, 'Templates'));
    const tg = el('div', 'grid gap-3 sm:grid-cols-3 items-start');
    TEMPLATES.forEach((t) => {
      const card = el('div', `${CARD} flex flex-col gap-2`);
      if (t.demo) {
        const v = media('video', t.demo, 'w-full rounded-md bg-black'); v.muted = false; v.loop = false; v.preload = 'none'; v.poster = t.poster;
        v.style.aspectRatio = '9 / 16'; v.style.maxHeight = '320px';
        card.appendChild(v);
      }
      card.appendChild(el('div', HEADING, t.title));
      card.appendChild(el('div', 'text-xs text-white/50', t.description));
      const go = el('button', t.kind === 'finished' ? BTN_MAIN : BTN, t.kind === 'finished' ? 'Use as template' : 'Use script');
      go.disabled = busy; go.onclick = () => useTemplate(t);
      card.appendChild(go);
      tg.appendChild(card);
    });
    box.appendChild(tg);
    box.appendChild(el('p', 'text-xs text-white/40', TEMPLATE_ATTRIBUTION));
    box.appendChild(el('div', `${HEADING} mt-2`, 'Ideas'));
    const list = el('div', 'grid gap-2 sm:grid-cols-2');
    trends.forEach((t) => {
      const b = el('button', `${CARD} text-left hover:bg-primary/10`);
      b.appendChild(el('div', HEADING, t.topic));
      b.appendChild(el('div', 'text-xs text-secondary mt-1', t.hook));
      b.onclick = () => { s.topic = t.topic; save(); render(); };
      list.appendChild(b);
    });
    box.appendChild(list);
    return box;
  }

  function viewScript() {
    const box = el('div', 'flex flex-col gap-4');
    box.appendChild(el('p', 'text-sm text-secondary', `Gate 1: review the beat map. ${s.map.beats.length} beats, ${shotList().length} shots, about ${Math.round(totalDuration(s.map))}s. Edit anything, then approve.`));
    s.map.beats.forEach((b, bi) => {
      const card = el('div', `${CARD} flex flex-col gap-2`);
      card.appendChild(el('div', 'text-xs text-muted', `Beat ${bi + 1}${b.hook ? ' · Hook' : ''} · ${b.title_en}`));
      const nar = el('textarea', `w-full ${FIELD}`); nar.rows = 2; nar.maxLength = 400; nar.value = b.narration;
      nar.setAttribute('aria-label', `Narration, beat ${bi + 1}`);
      nar.oninput = () => { b.narration = nar.value; save(); };
      card.appendChild(nar);
      b.shots.forEach((sh) => {
        const r = el('div', 'flex gap-2 items-start');
        r.appendChild(el('span', 'text-xs text-muted w-24 shrink-0 pt-1', `${sh.shot_id} · ${sh.duration_sec}s${sh.zoom_impact ? ' · zoom' : ''}`));
        const d = el('textarea', `flex-1 ${FIELD_SM}`); d.rows = 2; d.maxLength = 400; d.value = sh.scene_description;
        d.setAttribute('aria-label', `Scene, ${sh.shot_id}`);
        d.oninput = () => { sh.scene_description = d.value; save(); };
        r.appendChild(d); card.appendChild(r);
      });
      box.appendChild(card);
    });
    const row = el('div', 'flex gap-2');
    const back = el('button', BTN, 'Back'); back.onclick = () => setStage('topic');
    const ok = el('button', BTN_MAIN, 'Approve script'); ok.onclick = () => setStage('visuals');
    row.append(back, ok); box.appendChild(row);
    return box;
  }

  function viewVisuals() {
    const box = el('div', 'flex flex-col gap-4');
    box.appendChild(el('p', 'text-sm text-secondary', 'Gate 2: pick a look, render character sheets (consistency anchors), then keyframes. Each image is a paid call on your MuAPI key.'));
    const lookRow = el('div', 'flex gap-3 items-center flex-wrap');
    lookRow.appendChild(el('span', HEADING, 'Look'));
    lookRow.appendChild(createSegmented(Object.entries(LOOKS).map(([value, v]) => ({ value, label: v.label })), s.look, (value) => { s.look = value; save(); }));
    box.appendChild(lookRow);

    const sheets = sheetList();
    const sheetBtn = el('button', BTN_MAIN, (sheets.filter((x) => !s.sheets[x.id]).length ? `Generate ${sheets.filter((x) => !s.sheets[x.id]).length} character sheet(s)` : 'Regenerate all character sheet(s)'));
    sheetBtn.disabled = busy;
    sheetBtn.onclick = () => {
      const todo = sheets.filter((x) => !s.sheets[x.id]);
      batch('Character sheets', todo.length ? todo : sheets, genSheet, { confirmText: `Generate ${(todo.length || sheets.length)} character sheet image(s)?` });
    };
    box.appendChild(sheetBtn);
    const sg = el('div', 'grid gap-3 sm:grid-cols-2');
    sheets.forEach((sh) => {
      const c = el('div', CARD);
      c.appendChild(el('div', HEADING, sh.id.replace(/_/g, ' ')));
      c.appendChild(el('div', 'text-xs text-secondary mb-2', sh.description));
      if (s.sheets[sh.id]?.url) c.appendChild(media('img', s.sheets[sh.id].url, 'w-full rounded-md'));
      const re = el('button', `${BTN} mt-2`, s.sheets[sh.id] ? 'Regenerate' : 'Generate'); re.disabled = busy;
      re.onclick = () => batch('Character sheet', [sh], genSheet);
      c.appendChild(re); sg.appendChild(c);
    });
    box.appendChild(sg);

    const shots = shotList();
    const todo = shots.filter((x) => !s.shots[x.shot_id]?.keyframe);
    const kfBtn = el('button', BTN_MAIN, (todo.length ? `Generate ${todo.length} keyframe(s)` : 'Regenerate all keyframe(s)')); kfBtn.disabled = busy;
    kfBtn.onclick = () => batch('Keyframes', todo.length ? todo : shots, genKeyframe, { confirmText: `Generate ${(todo.length || shots.length)} keyframe image(s)?` });
    box.appendChild(kfBtn);
    const kg = el('div', 'grid gap-3 grid-cols-2 sm:grid-cols-4');
    shots.forEach((sh) => {
      const c = el('div', CARD);
      c.appendChild(el('div', 'text-xs text-muted mb-1', sh.shot_id));
      if (s.shots[sh.shot_id]?.keyframe) c.appendChild(media('img', s.shots[sh.shot_id].keyframe, 'w-full rounded-md'));
      const re = el('button', `${BTN} mt-2 w-full`, s.shots[sh.shot_id]?.keyframe ? 'Redo' : 'Generate'); re.disabled = busy;
      re.onclick = () => batch('Keyframe', [sh], genKeyframe);
      c.appendChild(re); kg.appendChild(c);
    });
    box.appendChild(kg);

    const row = el('div', 'flex gap-2');
    const back = el('button', BTN, 'Back'); back.onclick = () => setStage('script');
    const ok = el('button', BTN_MAIN, 'Approve keyframes'); ok.disabled = busy || todo.length > 0; ok.onclick = () => setStage('clips');
    row.append(back, ok); box.appendChild(row);
    return box;
  }

  function viewClips() {
    const box = el('div', 'flex flex-col gap-4');
    const shots = shotList();
    const todo = shots.filter((x) => !s.shots[x.shot_id]?.clip);
    box.appendChild(el('p', 'text-sm text-secondary', 'Animate each keyframe with Veo 3.1 (fast, with standard as fallback). Clips take a few minutes each and are the most expensive step.'));
    const go = el('button', BTN_MAIN, (todo.length ? `Generate ${todo.length} clip(s)` : 'Regenerate all clip(s)')); go.disabled = busy || !shots.every((x) => s.shots[x.shot_id]?.keyframe);
    go.onclick = () => batch('Clips', todo.length ? todo : shots, genClip, { confirmText: `Generate ${(todo.length || shots.length)} video clip(s) with Veo 3.1? This is the most expensive step.` });
    box.appendChild(go);
    const g = el('div', 'grid gap-3 grid-cols-2 sm:grid-cols-4');
    shots.forEach((sh) => {
      const c = el('div', CARD);
      c.appendChild(el('div', 'text-xs text-white/40 mb-1', `${sh.shot_id} · ${sh.camera_move.replace(/_/g, ' ')}`));
      const e = s.shots[sh.shot_id];
      if (e?.clip) c.appendChild(media('video', e.clip, 'w-full rounded-md'));
      else if (e?.keyframe) c.appendChild(media('img', e.keyframe, 'w-full rounded-md opacity-60'));
      const re = el('button', `${BTN} mt-2 w-full`, e?.clip ? 'Redo' : 'Generate'); re.disabled = busy || !e?.keyframe;
      re.onclick = () => batch('Clip', [sh], genClip, { confirmText: 'Generate this clip?' });
      c.appendChild(re); g.appendChild(c);
    });
    box.appendChild(g);
    const row = el('div', 'flex gap-2');
    const back = el('button', BTN, 'Back'); back.onclick = () => setStage('visuals');
    const ok = el('button', BTN_MAIN, 'Continue to audio'); ok.disabled = busy || todo.length > 0; ok.onclick = () => setStage('audio');
    row.append(back, ok); box.appendChild(row);
    return box;
  }

  function viewAudio() {
    const box = el('div', 'flex flex-col gap-4');
    box.appendChild(el('p', 'text-sm text-secondary', 'Narration uses a preset MiniMax voice. Voice cloning from a sample is not supported yet. Music is optional.'));
    const nar = el('div', `${CARD} flex flex-col gap-2`);
    nar.appendChild(el('div', HEADING, 'Narration'));
    nar.appendChild(el('div', 'text-xs text-secondary', narrationText(s.map)));
    const vr = el('div', 'flex gap-2 items-center flex-wrap');
    const sel = el('select', FIELD); sel.setAttribute('aria-label', 'Voice');
    TTS_VOICES.forEach((v) => { const o = el('option', '', v.replace(/_/g, ' ')); o.value = v; o.selected = v === s.voice; sel.appendChild(o); });
    sel.onchange = () => { s.voice = sel.value; save(); };
    vr.appendChild(sel);
    const b = el('button', BTN_MAIN, s.narration ? 'Regenerate narration' : 'Generate narration'); b.disabled = busy;
    b.onclick = () => batch('Narration', [1], genNarration, { confirmText: 'Generate narration audio?' });
    vr.appendChild(b); nar.appendChild(vr);
    if (s.narration) nar.appendChild(media('audio', s.narration, 'w-full'));
    box.appendChild(nar);
    const mus = el('div', `${CARD} flex flex-col gap-2`);
    mus.appendChild(el('div', HEADING, 'Background music (optional)'));
    const mb = el('button', BTN, s.music ? 'Regenerate music' : 'Generate music'); mb.disabled = busy;
    mb.onclick = () => batch('Music', [1], genMusic, { confirmText: 'Generate a music track?' });
    mus.appendChild(mb);
    if (s.music) mus.appendChild(media('audio', s.music, 'w-full'));
    box.appendChild(mus);
    const row = el('div', 'flex gap-2');
    const back = el('button', BTN, 'Back'); back.onclick = () => setStage('clips');
    const ok = el('button', BTN_MAIN, 'Continue to final cut'); ok.disabled = busy; ok.onclick = () => setStage('final');
    row.append(back, ok); box.appendChild(row);
    return box;
  }

  function viewFinal() {
    const box = el('div', 'flex flex-col gap-4');
    box.appendChild(el('p', 'text-sm text-secondary', 'Assembly runs in your browser: crossfades and wipes between shots, impact zooms, narration with music ducked underneath. It can take a minute or two.'));
    const hasAudio = !!s.narration;
    // Keep each clip's own (Veo) sound: full volume on its own, ducked under narration.
    const keepRow = el('label', 'flex items-center gap-2 text-sm text-white/80 cursor-pointer');
    const keep = el('input'); keep.type = 'checkbox'; keep.checked = s.keepClipAudio !== false; keep.id = 'zackd-keep-clip-audio';
    keep.onchange = () => { s.keepClipAudio = keep.checked; save(); };
    keepRow.append(keep, el('span', '', "Keep the clips' own sound (Veo audio), quieter under narration"));
    box.appendChild(keepRow);
    if (!hasAudio) box.appendChild(el('p', 'text-xs text-muted', s.keepClipAudio === false ? 'No narration and clip sound is off, so the video will be silent.' : 'No narration yet. The cut will use the clips\' own sound.'));
    const go = el('button', BTN_MAIN, s.final ? 'Re-assemble' : 'Assemble video'); go.disabled = busy; go.onclick = assemble;
    box.appendChild(go);
    if (s.final) {
      const v = media('video', s.final.objectUrl, 'rounded-md bg-black'); v.muted = false; v.loop = false;
      v.style.maxHeight = '70vh'; v.style.aspectRatio = '9 / 16';
      box.appendChild(v);
      const row = el('div', 'flex gap-2 flex-wrap');
      const dl = el('button', BTN, 'Download MP4'); dl.onclick = () => download(s.final.blob, 'zackd-short.mp4');
      const cap = el('button', BTN, 'Download captions (.srt)');
      cap.onclick = () => download(new Blob([buildSrt(s.map.beats, { transition: DEFAULT_TRANSITION_SEC })], { type: 'text/plain' }), 'zackd-short.srt');
      const lib = el('button', BTN, s.final.saved ? 'Saved to library' : 'Save to library'); lib.disabled = busy || s.final.saved; lib.onclick = saveToLibrary;
      row.append(dl, cap, lib); box.appendChild(row);
      box.appendChild(el('p', 'text-xs text-muted', 'The .srt is a free, separate caption file. To burn animated captions into the video, use the option below.'));

      // Opt-in burned-in captions (MuAPI AI Captions / Vadoo)
      const capCard = el('div', `${CARD} flex flex-col gap-3`);
      capCard.appendChild(el('div', HEADING, 'Burn captions into the video'));
      capCard.appendChild(el('div', 'text-xs text-secondary', 'Animated, word-by-word captions in a viral style. Paid: about $0.20 minimum ($0.005 per second), and it takes 2-3 minutes. Needs narration.'));
      const capRow = el('div', 'flex gap-2 items-center flex-wrap');
      const lang = el('select', FIELD); lang.setAttribute('aria-label', 'Caption language');
      CAPTION_LANGUAGES.forEach((l) => { const o = el('option', '', l); o.value = l; o.selected = l === s.captionLang; lang.appendChild(o); });
      lang.onchange = () => { s.captionLang = lang.value; save(); };
      const theme = el('select', FIELD); theme.setAttribute('aria-label', 'Caption theme');
      CAPTION_THEMES.forEach((t) => { const o = el('option', '', t.label); o.value = t.value; o.selected = t.value === s.captionTheme; theme.appendChild(o); });
      theme.onchange = () => { s.captionTheme = theme.value; save(); };
      const burn = el('button', BTN_MAIN, s.final.captioned ? 'Burn again' : 'Burn captions');
      burn.disabled = busy || !s.narration; burn.onclick = burnCaptions;
      capRow.append(lang, theme, burn); capCard.appendChild(capRow);
      if (!s.narration) capCard.appendChild(el('div', 'text-xs text-muted', 'Generate narration first: captions are transcribed from the spoken audio.'));
      if (s.final.captioned) {
        const cv = media('video', s.final.captioned.url, 'rounded-md bg-black'); cv.muted = false; cv.loop = false;
        cv.style.maxHeight = '70vh'; cv.style.aspectRatio = '9 / 16';
        capCard.appendChild(cv);
        const cr = el('div', 'flex gap-2 flex-wrap');
        const open = el('a', BTN, 'Open / download captioned video'); open.href = s.final.captioned.url; open.target = '_blank'; open.rel = 'noopener noreferrer';
        const save2 = el('button', BTN, s.final.captioned.saved ? 'Saved to library' : 'Save captioned to library');
        save2.disabled = busy || s.final.captioned.saved; save2.onclick = saveCaptionedToLibrary;
        cr.append(open, save2); capCard.appendChild(cr);
      }
      box.appendChild(capCard);
    }
    const row = el('div', 'flex gap-2');
    const back = el('button', BTN, 'Back'); back.onclick = () => setStage('audio');
    const fresh = el('button', BTN, 'New project');
    fresh.onclick = () => { if (window.confirm('Start a new project? The current one will be cleared from this browser.')) { s = blank(); save(); render(); } };
    row.append(back, fresh); box.appendChild(row);
    return box;
  }

  const VIEWS = { topic: viewTopic, script: viewScript, visuals: viewVisuals, clips: viewClips, audio: viewAudio, final: viewFinal };
  const main = el('div', 'flex-1 overflow-auto p-4 sm:p-6');
  container.appendChild(main);

  function render() {
    const y = main.scrollTop;
    main.replaceChildren();
    const inner = el('div', 'max-w-4xl mx-auto flex flex-col gap-4');
    const nav = el('nav', 'flex gap-1 flex-wrap'); nav.setAttribute('aria-label', 'Steps');
    const reach = { topic: true, script: !!s.map, visuals: !!s.map, clips: !!s.map, audio: !!s.map, final: !!s.map };
    STAGES.forEach(([id, label], i) => {
      const b = el('button', `px-3 py-1.5 rounded-full text-xs transition-all disabled:opacity-40 ${id === s.stage ? 'bg-primary text-black font-bold' : 'border border-white/10 text-white/60 hover:bg-white/5'}`, `${i + 1}. ${label}`);
      b.disabled = busy || !reach[id]; if (id === s.stage) b.setAttribute('aria-current', 'step');
      b.onclick = () => setStage(id);
      nav.appendChild(b);
    });
    inner.appendChild(nav);
    if (busy && log) {
      const bar = createProgressBar(progress, 'w-full max-w-md');
      const label = bar.querySelector('.progress-label'); if (label) label.textContent = log;
      inner.appendChild(bar);
    }
    let alertEl = null;
    if (error) { alertEl = el('div', 'rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 px-3 py-2 text-sm', error); alertEl.setAttribute('role', 'alert'); inner.appendChild(alertEl); }
    inner.appendChild((s.stage !== 'topic' && !s.map ? viewTopic : VIEWS[s.stage] || viewTopic)());
    main.appendChild(inner);
    main.scrollTop = y;
    // A failure on a long step (e.g. the final cut) must not hide off-screen at the top: bring a NEW error into view once.
    if (alertEl && error !== shownError) alertEl.scrollIntoView?.({ block: 'nearest' });
    shownError = error;
  }

  render();
  container.cleanup = () => {
    abort.abort();
    if (s.final?.objectUrl) URL.revokeObjectURL(s.final.objectUrl);
  };
  return container;
}

export default ZackDStudio;
