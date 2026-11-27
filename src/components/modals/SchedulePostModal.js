// "Schedule post": a window opened from the button beside any studio result's Download link
// (src/components/studio/socialPostAttach.js). Pick the platforms, let the AI write the caption and
// hashtags (or write your own), choose when, and save it to your queue. It is built once and updated in
// place, so typing never loses focus.
import { lockScroll, unlockScroll } from '../../lib/landingPages/scrollLock.js';
import { POST_PLATFORMS, POST_TONES, captionLimit, normalizeHashtags, writePostWithAI } from '../../lib/social/postWriter.js';
import { savePost, whenFor, postProblem } from '../../lib/social/scheduledPosts.js';
import { showToast } from '../../lib/loading.js';

const WHEN_PRESETS = [['1h', 'In 1 hour'], ['tomorrow', 'Tomorrow 9 AM'], ['custom', 'Pick date & time']];
const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Dutch', 'Japanese', 'Korean', 'Chinese', 'Hindi', 'Arabic'];

const el = (tag, cls = '', text = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
const chip = (on) => `px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${on ? 'border-primary text-primary bg-primary/10' : 'border-white/10 text-secondary hover:text-white hover:border-white/30'}`;
const field = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors';

let closeCurrent = null; // closes the window that is open now (and releases its scroll lock)

/**
 * Open the window for one result: { url, type: 'video'|'image', prompt?, studio? }.
 * `deps` lets tests replace the AI and the queue.
 */
export function openSchedulePost(item, deps = {}) {
  closeCurrent?.();
  const write = deps.write || writePostWithAI;
  const save = deps.save || savePost;
  const toast = deps.toast || showToast;

  const state = { platforms: ['instagram'], tone: 'Friendly', language: 'English', topic: String(item?.prompt || '').slice(0, 200), caption: '', hashtags: [], mode: '1h', date: '', time: '09:00', writing: false, saving: false };

  lockScroll();
  const overlay = el('div', 'fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-xl p-2 md:p-6');
  overlay.style.zIndex = '2300';
  overlay.dataset.schedulePost = '';
  const dialog = el('div', 'w-full max-w-4xl max-h-[94vh] flex flex-col rounded-2xl border border-white/10 bg-panel-bg overflow-hidden text-white');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Schedule post');
  dialog.tabIndex = -1;

  const head = el('div', 'flex items-center gap-3 px-4 md:px-6 py-3 border-b border-white/5');
  head.append(el('h2', 'text-sm font-black uppercase tracking-widest flex-1', 'Schedule post'));
  const closeBtn = el('button', 'rounded-xl border border-white/15 px-4 py-2 text-sm font-bold hover:border-primary/60 transition-colors', '✕');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  head.appendChild(closeBtn);

  const body = el('div', 'flex-1 min-h-0 overflow-y-auto p-4 md:p-6 grid gap-6 md:grid-cols-[240px_1fr]');

  // Left: the picture or video being posted.
  const mediaBox = el('div', 'rounded-xl overflow-hidden bg-black/40 border border-white/10 self-start');
  if (item?.type === 'video') {
    const v = el('video', 'w-full block'); v.src = item.url; v.controls = true; v.muted = true; v.playsInline = true; v.preload = 'metadata';
    mediaBox.appendChild(v);
  } else {
    const i = el('img', 'w-full block'); i.src = item?.url || ''; i.alt = 'The result you are posting';
    mediaBox.appendChild(i);
  }

  const form = el('div', 'flex flex-col gap-5 min-w-0');

  // Platforms
  const platWrap = el('div');
  platWrap.append(el('div', 'text-[11px] font-black uppercase tracking-widest text-white/40 mb-2', 'Platforms'));
  const platRow = el('div', 'flex flex-wrap gap-2');
  const platBtns = {};
  POST_PLATFORMS.forEach((p) => {
    const b = el('button', chip(state.platforms.includes(p.id)), p.name);
    b.type = 'button'; b.dataset.platform = p.id; b.setAttribute('aria-pressed', String(state.platforms.includes(p.id)));
    b.onclick = () => {
      state.platforms = state.platforms.includes(p.id) ? state.platforms.filter((x) => x !== p.id) : [...state.platforms, p.id];
      refresh();
    };
    platBtns[p.id] = b; platRow.appendChild(b);
  });
  platWrap.appendChild(platRow);

  // AI writer
  const ai = el('div', 'rounded-xl border border-white/10 bg-white/[0.03] p-3 flex flex-col gap-3');
  ai.append(el('div', 'text-[11px] font-black uppercase tracking-widest text-white/40', 'Write with AI'));
  const topic = el('input', field); topic.type = 'text'; topic.placeholder = 'What is it about? (optional)'; topic.value = state.topic; topic.setAttribute('aria-label', 'What the post is about');
  topic.oninput = () => { state.topic = topic.value; };
  const aiRow = el('div', 'flex flex-wrap gap-2 items-center');
  const tone = el('select', 'bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none'); tone.setAttribute('aria-label', 'Tone');
  POST_TONES.forEach((t) => { const o = el('option', '', t); o.value = t; tone.appendChild(o); });
  tone.onchange = () => { state.tone = tone.value; };
  const lang = el('select', 'bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none'); lang.setAttribute('aria-label', 'Language');
  LANGUAGES.forEach((l) => { const o = el('option', '', l); o.value = l; lang.appendChild(o); });
  lang.onchange = () => { state.language = lang.value; };
  const writeBtn = el('button', 'px-4 py-2 rounded-xl text-xs font-bold bg-primary text-black hover:opacity-90 transition-opacity disabled:opacity-50', 'Write with AI');
  writeBtn.type = 'button'; writeBtn.dataset.action = 'write-with-ai';
  aiRow.append(tone, lang, writeBtn);
  ai.append(topic, aiRow);

  // Caption + hashtags
  const capWrap = el('div');
  const capHead = el('div', 'flex items-center justify-between mb-2');
  capHead.append(el('div', 'text-[11px] font-black uppercase tracking-widest text-white/40', 'Caption'));
  const counter = el('span', 'text-[11px] text-white/40');
  capHead.appendChild(counter);
  const caption = el('textarea', `${field} min-h-[110px] resize-y`); caption.placeholder = 'Write a caption, or let the AI write one'; caption.setAttribute('aria-label', 'Caption');
  caption.oninput = () => { state.caption = caption.value; updateCounter(); };
  const tags = el('input', `${field} mt-2`); tags.type = 'text'; tags.placeholder = 'Hashtags, separated by spaces: #launch #newvideo'; tags.setAttribute('aria-label', 'Hashtags');
  tags.oninput = () => { state.hashtags = normalizeHashtags(tags.value); updateCounter(); };
  capWrap.append(capHead, caption, tags);

  // When
  const whenWrap = el('div');
  whenWrap.append(el('div', 'text-[11px] font-black uppercase tracking-widest text-white/40 mb-2', 'When'));
  const whenRow = el('div', 'flex flex-wrap gap-2');
  const whenBtns = {};
  WHEN_PRESETS.forEach(([id, label]) => {
    const b = el('button', chip(id === state.mode), label); b.type = 'button'; b.dataset.when = id; b.setAttribute('aria-pressed', String(id === state.mode));
    b.onclick = () => { state.mode = id; refresh(); };
    whenBtns[id] = b; whenRow.appendChild(b);
  });
  const dtRow = el('div', 'flex gap-2 mt-2');
  const dateIn = el('input', field); dateIn.type = 'date'; dateIn.setAttribute('aria-label', 'Date'); dateIn.oninput = () => { state.date = dateIn.value; };
  const timeIn = el('input', field); timeIn.type = 'time'; timeIn.value = state.time; timeIn.setAttribute('aria-label', 'Time'); timeIn.oninput = () => { state.time = timeIn.value; };
  dtRow.append(dateIn, timeIn);
  whenWrap.append(whenRow, dtRow);

  const error = el('div', 'text-xs text-red-400 min-h-[16px]'); error.setAttribute('role', 'alert');
  form.append(platWrap, ai, capWrap, whenWrap, error);
  body.append(mediaBox, form);

  const foot = el('div', 'flex flex-wrap items-center gap-3 px-4 md:px-6 py-3 border-t border-white/5');
  foot.append(el('div', 'flex-1 text-[11px] text-white/40 min-w-[200px]', 'Posts are saved to your queue. Connecting your accounts to publish automatically comes next.'));
  const cancelBtn = el('button', 'px-4 py-2 rounded-xl text-xs font-bold border border-white/10 text-secondary hover:text-white', 'Cancel'); cancelBtn.type = 'button';
  const draftBtn = el('button', 'px-4 py-2 rounded-xl text-xs font-bold border border-white/10 text-white hover:border-primary/60', 'Save draft'); draftBtn.type = 'button'; draftBtn.dataset.action = 'save-draft';
  const saveBtn = el('button', 'px-5 py-2 rounded-xl text-xs font-bold bg-primary text-black hover:opacity-90 disabled:opacity-50', 'Schedule'); saveBtn.type = 'button'; saveBtn.dataset.action = 'schedule';
  foot.append(cancelBtn, draftBtn, saveBtn);

  dialog.append(head, body, foot);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  function updateCounter() {
    const limit = captionLimit(state.platforms);
    const used = state.caption.length + state.hashtags.reduce((n, t) => n + t.length + 2, 0);
    counter.textContent = `${used}/${limit}`;
    counter.className = `text-[11px] ${used > limit ? 'text-red-400' : 'text-white/40'}`;
  }
  function refresh() {
    POST_PLATFORMS.forEach((p) => { const on = state.platforms.includes(p.id); platBtns[p.id].className = chip(on); platBtns[p.id].setAttribute('aria-pressed', String(on)); });
    WHEN_PRESETS.forEach(([id]) => { whenBtns[id].className = chip(id === state.mode); whenBtns[id].setAttribute('aria-pressed', String(id === state.mode)); });
    dtRow.style.display = state.mode === 'custom' ? '' : 'none';
    writeBtn.disabled = state.writing; writeBtn.textContent = state.writing ? 'Writing…' : 'Write with AI';
    saveBtn.disabled = draftBtn.disabled = state.saving;
    updateCounter();
  }

  let ctrl = null;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    ctrl?.abort();
    overlay.remove();
    unlockScroll();
    if (closeCurrent === close) closeCurrent = null;
  };
  closeCurrent = close;
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  closeBtn.onclick = close;
  cancelBtn.onclick = close;
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });

  writeBtn.onclick = async () => {
    if (state.writing) return;
    if (!state.platforms.length) { error.textContent = 'Pick at least one platform first.'; return; }
    error.textContent = '';
    state.writing = true; ctrl = new AbortController(); refresh();
    try {
      const out = await write({ platforms: state.platforms, tone: state.tone, language: state.language, topic: state.topic, media: { type: item?.type, prompt: item?.prompt } }, { signal: ctrl.signal });
      state.caption = out.caption; state.hashtags = out.hashtags;
      caption.value = out.caption; tags.value = out.hashtags.map((t) => `#${t}`).join(' ');
    } catch (e) {
      if (e?.name !== 'AbortError') error.textContent = e?.message || 'The AI could not write the post. Try again.';
    } finally { state.writing = false; refresh(); }
  };

  const submit = async (draft) => {
    const post = { mediaUrl: item?.url, mediaType: item?.type, studio: item?.studio || '', platforms: state.platforms, caption: state.caption, hashtags: state.hashtags, status: draft ? 'draft' : 'scheduled', scheduledFor: draft ? null : whenFor(state.mode, { date: state.date, time: state.time }) };
    const problem = postProblem(post);
    if (problem) { error.textContent = problem; return; }
    error.textContent = '';
    state.saving = true; refresh();
    try {
      const { saved } = await save(post);
      const where = saved === 'cloud' ? 'saved to your queue' : 'saved in this browser (sign in to keep it on your account)';
      toast(draft ? `Draft ${where}.` : `Post scheduled for ${post.scheduledFor.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}, ${where}.`, 'success');
      close();
    } catch (e) {
      error.textContent = e?.message || 'Could not save the post.';
      state.saving = false; refresh();
    }
  };
  saveBtn.onclick = () => { void submit(false); };
  draftBtn.onclick = () => { void submit(true); };

  refresh();
  caption.focus();
  return overlay;
}
