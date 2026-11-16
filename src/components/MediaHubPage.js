// Media Hub — download video/audio from 1000+ sites (yt-dlp), transcribe with speaker labels,
// then summarize / translate / chat with the transcript. Backend: /api/media-hub (backend/services/mediaHub).
// Themed with the SmartVideo tokens (--color-primary neon yellow-green on near-black).
import { mountStudioChrome } from '../lib/studioChrome.js';
import { showToast } from '../lib/loading.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';

const API = (() => {
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL)
    || (typeof window !== 'undefined' && window.__BACKEND_URL__) || '';
  return `${String(base).replace(/\/$/, '')}/api/media-hub`;
})();

const SETTINGS_KEY = 'mediaHub.settings.v1';
const ACTIVE = ['queued', 'downloading', 'processing'];
const QUALITIES = [['best', 'Best'], ['2160', '4K'], ['1440', '1440p'], ['1080', '1080p'], ['720', '720p'], ['480', '480p'], ['360', '360p']];
const AI_ACTIONS = [['summarize', 'Summarize'], ['keypoints', 'Key points'], ['chapters', 'Chapters'], ['faq', 'FAQ'], ['mindmap', 'Mind map'], ['cleanup', 'Clean up']];
const STATUS_LABEL = { queued: 'Queued', downloading: 'Downloading', processing: 'Processing', completed: 'Ready', failed: 'Failed', paused: 'Paused', canceled: 'Canceled' };

// ───────── tiny DOM + format helpers ─────────
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtBytes = (n) => (n == null ? '' : n > 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);
const fmtClock = (s) => { s = Math.max(0, Math.floor(s || 0)); const m = Math.floor(s / 60); return `${m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` : m}:${String(s % 60).padStart(2, '0')}`; };
const parseClock = (t) => t.split(':').map(Number).reduce((a, n) => a * 60 + n, 0);

// Minimal, escape-first markdown → HTML (headings, bold, bullets, [mm:ss] seek links).
function md(text) {
  const out = []; let list = false;
  for (const raw of String(text || '').split('\n')) {
    const l = esc(raw)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[((?:\d+:)?\d{1,2}:\d{2})\]/g, '<a href="#" data-seek="$1" class="mh-ts">[$1]</a>');
    const b = /^\s*(?:[-*•]|\d+\.)\s+(.*)/.exec(l);
    if (b) { if (!list) { out.push('<ul>'); list = true; } out.push(`<li>${b[1]}</li>`); continue; }
    if (list) { out.push('</ul>'); list = false; }
    const hd = /^#{1,4}\s+(.*)/.exec(l);
    out.push(hd ? `<h4>${hd[1]}</h4>` : l.trim() ? `<p>${l}</p>` : '');
  }
  if (list) out.push('</ul>');
  return out.join('');
}

function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { /* ignore */ }
  return { kind: 'openai', baseUrl: '', model: '', apiKey: '', language: '', ...s };
}

async function authHeader() {
  try {
    const { getSupabaseAccessToken } = await import('../lib/supabase.js');
    const t = await getSupabaseAccessToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(await authHeader()) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json().catch(() => ({})) : await res.text();
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

const STYLE = `
.mh{--mh-line:var(--border-color,#27272a)}
.mh .card{background:var(--bg-card,#141414);border:1px solid var(--mh-line);border-radius:14px}
.mh .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;font-size:13px;font-weight:600;border:1px solid var(--mh-line);background:transparent;color:#e4e4e7;cursor:pointer;transition:.15s}
.mh .btn:hover:not(:disabled){border-color:var(--color-primary);color:var(--color-primary)}
.mh .btn:disabled{opacity:.45;cursor:not-allowed}
.mh .btn-primary{background:var(--color-primary);color:var(--color-on-primary,#000);border-color:var(--color-primary)}
.mh .btn-primary:hover:not(:disabled){background:var(--color-primary-hover);color:#000}
.mh .btn-sm{padding:4px 9px;font-size:12px;border-radius:8px}
.mh input,.mh select,.mh textarea{background:var(--bg-app,#050505);border:1px solid var(--mh-line);border-radius:10px;color:#fff;padding:8px 10px;font-size:13px;width:100%;outline:none}
.mh input:focus,.mh select:focus,.mh textarea:focus{border-color:var(--color-primary);box-shadow:0 0 0 3px var(--primary-soft,rgba(217,255,0,.12))}
.mh label.lbl{display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-secondary,#a1a1aa);margin-bottom:4px}
.mh .pill{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;border:1px solid var(--mh-line);color:#a1a1aa}
.mh .pill.ok{color:var(--color-primary);border-color:var(--color-primary);background:var(--primary-soft,rgba(217,255,0,.12))}
.mh .pill.bad{color:#ef4444;border-color:#ef4444}
.mh .bar{height:4px;background:#27272a;border-radius:99px;overflow:hidden}.mh .bar>i{display:block;height:100%;background:var(--color-primary);transition:width .4s}
.mh .tab{padding:8px 14px;font-size:13px;font-weight:600;color:#a1a1aa;border-bottom:2px solid transparent;background:none;border-top:0;border-left:0;border-right:0;cursor:pointer}
.mh .tab.on{color:var(--color-primary);border-bottom-color:var(--color-primary)}
.mh .job{padding:10px;border-radius:12px;border:1px solid transparent;cursor:pointer}
.mh .job:hover{background:rgba(255,255,255,.03)}.mh .job.sel{border-color:var(--color-primary);background:var(--primary-soft,rgba(217,255,0,.12))}
.mh .seg{display:flex;gap:10px;padding:7px 8px;border-radius:8px;cursor:pointer;font-size:14px;line-height:1.5}
.mh .seg:hover{background:rgba(255,255,255,.04)}.mh .seg.now{background:var(--primary-soft,rgba(217,255,0,.12));box-shadow:inset 2px 0 var(--color-primary)}
.mh .seg .t{color:#71717a;font-variant-numeric:tabular-nums;flex:none;width:46px;font-size:12px;padding-top:2px}
.mh .spk{font-weight:700;color:var(--color-primary)}
.mh .out{font-size:14px;line-height:1.6;color:#e4e4e7}.mh .out ul{margin:6px 0 6px 18px;list-style:disc}.mh .out h4{margin:12px 0 4px;font-weight:700;color:#fff}
.mh .out p{margin:4px 0}.mh .out code{background:#27272a;padding:0 4px;border-radius:4px}.mh .mh-ts{color:var(--color-primary);font-weight:600;text-decoration:none}
.mh .bubble{max-width:85%;padding:8px 12px;border-radius:12px;font-size:14px}
.mh .bubble.me{align-self:flex-end;background:var(--color-primary);color:#000}.mh .bubble.ai{align-self:flex-start;background:#1c1c1f;border:1px solid var(--mh-line)}
`;

export function MediaHubPage() {
  const container = document.createElement('div');
  container.className = 'mh w-full h-full flex flex-col bg-app-bg text-white relative overflow-y-auto';
  mountStudioChrome(container, { currentRoute: 'media-hub' });
  container.append(h('style', {}, STYLE));

  const S = {
    jobs: [], sel: null, status: null, settings: loadSettings(), tab: 'transcript',
    link: {}, transcripts: {}, ai: {}, chat: {}, query: '', busy: {}, lastStatus: {},
  };
  const selected = () => S.jobs.find((j) => j.id === S.sel) || null;

  // ───────── layout ─────────
  const statusChip = h('span', { class: 'pill' }, 'checking engine…');
  const header = h('div', { class: 'flex items-center justify-between gap-3 px-6 pt-6 pb-2 flex-wrap' },
    h('div', {},
      h('h1', { class: 'text-2xl font-bold', style: 'letter-spacing:-.01em' }, 'Media ', h('span', { style: 'color:var(--color-primary)' }, 'Hub')),
      h('p', { class: 'text-sm', style: 'color:#a1a1aa' }, 'Download from 1000+ sites · transcribe with speaker labels · summarize, translate & chat')),
    h('div', { class: 'flex items-center gap-2' }, statusChip, h('button', { class: 'btn btn-sm', onClick: () => openSettings() }, '⚙ AI settings')));

  // add form
  const urls = h('textarea', { rows: 3, placeholder: 'Paste one or more links (YouTube, TikTok, X, Vimeo, SoundCloud, direct files…)', spellcheck: 'false' });
  const mode = h('select', {}, h('option', { value: 'video' }, 'Video'), h('option', { value: 'audio' }, 'Audio only'));
  const quality = h('select', {}, QUALITIES.map(([v, l]) => h('option', { value: v }, l)));
  const containerSel = h('select', {}, ['auto', 'mp4', 'mkv', 'webm'].map((v) => h('option', { value: v }, v === 'auto' ? 'Auto (MP4/MKV)' : v.toUpperCase())));
  const audioFmt = h('select', { style: 'display:none' }, ['mp3', 'm4a', 'opus', 'wav', 'flac'].map((v) => h('option', { value: v }, v.toUpperCase())));
  const subs = h('input', { type: 'checkbox', style: 'width:auto' });
  const playlist = h('input', { type: 'checkbox', style: 'width:auto' });
  const addBtn = h('button', { class: 'btn btn-primary', style: 'width:100%;justify-content:center' }, 'Add to queue');
  mode.addEventListener('change', () => {
    const a = mode.value === 'audio';
    quality.parentElement.style.display = a ? 'none' : '';
    containerSel.style.display = a ? 'none' : '';
    audioFmt.style.display = a ? '' : 'none';
  });
  const form = h('div', { class: 'card p-4 flex flex-col gap-3' },
    urls,
    h('div', { class: 'grid grid-cols-2 gap-3' },
      h('div', {}, h('label', { class: 'lbl' }, 'Type'), mode),
      h('div', {}, h('label', { class: 'lbl' }, 'Quality'), quality),
      h('div', {}, h('label', { class: 'lbl' }, 'Container / format'), containerSel, audioFmt)),
    h('div', { class: 'flex gap-4 text-sm', style: 'color:#d4d4d8' },
      h('label', { class: 'flex items-center gap-2' }, subs, 'Subtitles'),
      h('label', { class: 'flex items-center gap-2' }, playlist, 'Whole playlist')),
    addBtn);
  addBtn.addEventListener('click', async () => {
    const list = urls.value.split(/\s+/).map((u) => u.trim()).filter(Boolean);
    if (!list.length) return showToast('Paste at least one link', 'error');
    addBtn.disabled = true;
    try {
      const r = await api('/jobs', { method: 'POST', body: { urls: list, options: { mode: mode.value, quality: quality.value, container: containerSel.value, audioFormat: audioFmt.value, subtitles: subs.checked, playlist: playlist.checked } } });
      urls.value = '';
      S.sel = r.jobs[0]?.id || S.sel;
      await refresh();
      showToast(`Queued ${r.jobs.length} download${r.jobs.length > 1 ? 's' : ''}`, 'success');
    } catch (e) { showToast(e.message, 'error'); } finally { addBtn.disabled = false; }
  });

  const queueEl = h('div', { class: 'flex flex-col gap-1' });
  const left = h('div', { class: 'flex flex-col gap-4', style: 'min-width:0' }, form,
    h('div', { class: 'card p-2' }, h('div', { class: 'flex items-center justify-between px-2 py-2' }, h('b', { class: 'text-sm' }, 'Library & queue'), h('span', { class: 'text-xs', style: 'color:#71717a' }, 'saved on the server')), queueEl));
  const detailEl = h('div', { class: 'card', style: 'min-height:420px;min-width:0' });
  const body = h('div', { class: 'grid gap-5 px-6 pb-8 pt-4', style: 'grid-template-columns:minmax(300px,420px) minmax(0,1fr);align-items:start' }, left, detailEl);
  const mq = window.matchMedia?.('(max-width: 900px)');
  const applyLayout = () => { body.style.gridTemplateColumns = mq?.matches ? '1fr' : 'minmax(300px,420px) minmax(0,1fr)'; };
  applyLayout(); mq?.addEventListener?.('change', applyLayout);
  container.append(header, body);

  // ───────── queue ─────────
  function renderQueue() {
    queueEl.replaceChildren();
    if (!S.jobs.length) queueEl.append(h('p', { class: 'text-sm px-3 py-6 text-center', style: 'color:#71717a' }, 'Nothing here yet — paste a link above.'));
    for (const j of S.jobs) {
      const act = ACTIVE.includes(j.status);
      const meta = act ? [j.progress ? `${j.progress.toFixed(0)}%` : '', j.speed ? `${fmtBytes(j.speed)}/s` : '', j.eta ? `${j.eta}s left` : ''].filter(Boolean).join(' · ') : (j.status === 'failed' ? j.error : [fmtBytes(j.size), j.duration ? fmtClock(j.duration) : ''].filter(Boolean).join(' · '));
      queueEl.append(h('div', { class: `job ${j.id === S.sel ? 'sel' : ''}`, onClick: () => { S.sel = j.id; S.tab = j.hasTranscript ? 'transcript' : S.tab; renderQueue(); renderDetail(); } },
        h('div', { class: 'flex gap-3' },
          j.thumbnail ? h('img', { src: j.thumbnail, referrerpolicy: 'no-referrer', style: 'width:72px;height:48px;object-fit:cover;border-radius:8px;flex:none;background:#27272a' }) : h('div', { style: 'width:72px;height:48px;border-radius:8px;flex:none;background:#27272a;display:grid;place-items:center;color:#71717a' }, j.options.mode === 'audio' ? '♪' : '▶'),
          h('div', { style: 'min-width:0;flex:1' },
            h('div', { class: 'text-sm font-semibold', style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, j.title),
            h('div', { class: 'flex items-center gap-2 mt-1' }, h('span', { class: `pill ${j.status === 'completed' ? 'ok' : j.status === 'failed' ? 'bad' : ''}` }, STATUS_LABEL[j.status] || j.status), j.hasTranscript ? h('span', { class: 'pill ok' }, 'Transcript') : null,
              h('span', { class: 'text-xs', style: 'color:#71717a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, meta)))),
        act ? h('div', { class: 'bar mt-2' }, h('i', { style: `width:${j.progress || 3}%` })) : null,
        h('div', { class: 'flex gap-2 mt-2', onClick: (e) => e.stopPropagation() },
          act && j.status !== 'processing' ? h('button', { class: 'btn btn-sm', onClick: () => jobAction(j, 'pause') }, 'Pause') : null,
          ['paused', 'failed', 'canceled'].includes(j.status) ? h('button', { class: 'btn btn-sm', onClick: () => jobAction(j, 'resume') }, j.status === 'failed' ? 'Retry' : 'Resume') : null,
          act ? h('button', { class: 'btn btn-sm', onClick: () => jobAction(j, 'cancel') }, 'Cancel') : null,
          !act ? h('button', { class: 'btn btn-sm', onClick: () => removeJob(j) }, 'Remove') : null)));
    }
  }
  async function jobAction(j, act) { try { await api(`/jobs/${j.id}/${act}`, { method: 'POST' }); await refresh(); } catch (e) { showToast(e.message, 'error'); } }
  async function removeJob(j) {
    const files = j.hasFile && window.confirm('Also delete the downloaded file and transcript from the server?');
    try { await api(`/jobs/${j.id}?files=${files ? 1 : 0}`, { method: 'DELETE' }); if (S.sel === j.id) S.sel = null; await refresh(); } catch (e) { showToast(e.message, 'error'); }
  }

  // ───────── detail ─────────
  let player = null;
  const seek = (t) => { if (player) { player.currentTime = t; player.play?.().catch(() => {}); } };
  detailEl.addEventListener('click', (e) => { const a = e.target.closest?.('[data-seek]'); if (a) { e.preventDefault(); seek(parseClock(a.dataset.seek)); } });

  async function ensureLink(j) {
    const c = S.link[j.id];
    if (c && c.exp > Date.now()) return c;
    const r = await api(`/jobs/${j.id}/link`);
    return (S.link[j.id] = { ...r, url: `${API.replace(/\/api\/media-hub$/, '')}${r.url}`, downloadUrl: `${API.replace(/\/api\/media-hub$/, '')}${r.downloadUrl}`, exp: Date.now() + 50 * 60e3 });
  }
  async function ensureTranscript(j) {
    if (!j.hasTranscript) return null;
    if (!S.transcripts[j.id]) S.transcripts[j.id] = (await api(`/jobs/${j.id}/transcript`)).transcript;
    return S.transcripts[j.id];
  }

  async function renderDetail() {
    const j = selected();
    player = null;
    detailEl.replaceChildren();
    if (!j) { detailEl.append(h('div', { class: 'p-10 text-center', style: 'color:#71717a' }, h('div', { class: 'text-4xl mb-2', style: 'color:var(--color-primary)' }, '⬇'), 'Select an item to play it, transcribe it and chat with it.')); return; }
    detailEl.append(h('div', { class: 'p-4 flex items-start justify-between gap-3' }, h('div', { style: 'min-width:0' }, h('div', { class: 'font-bold', style: 'overflow:hidden;text-overflow:ellipsis' }, j.title), h('div', { class: 'text-xs', style: 'color:#71717a' }, [j.uploader, j.url.replace(/^https?:\/\//, '').slice(0, 60)].filter(Boolean).join(' · ')))));
    if (j.status !== 'completed') {
      detailEl.append(h('p', { class: 'px-4 pb-6 text-sm', style: 'color:#a1a1aa' }, j.status === 'failed' ? `Download failed: ${j.error}` : 'Available once the download finishes.'));
      return;
    }
    let link;
    try { link = await ensureLink(j); } catch (e) { detailEl.append(h('p', { class: 'p-4 text-sm' }, e.message)); return; }
    if (selected()?.id !== j.id) return;
    const isAudio = j.options.mode === 'audio';
    player = h(isAudio ? 'audio' : 'video', { src: link.url, controls: true, preload: 'metadata', style: isAudio ? 'width:100%' : 'width:100%;max-height:340px;background:#000;border-radius:10px' });
    player.addEventListener('timeupdate', highlightNow);
    const tabs = h('div', { class: 'flex px-2', style: 'border-bottom:1px solid var(--mh-line)' }, ['transcript', 'ai'].map((t) => h('button', { class: `tab ${S.tab === t ? 'on' : ''}`, onClick: () => { S.tab = t; renderDetail(); } }, t === 'ai' ? 'AI · Summary & chat' : 'Transcript')));
    const pane = h('div', { class: 'p-4' });
    detailEl.append(h('div', { class: 'px-4' }, player), h('div', { class: 'px-4 py-3 flex gap-2' }, h('a', { class: 'btn btn-sm', href: link.downloadUrl }, 'Save to this computer'), h('span', { class: 'pill' }, link.filename.slice(-40))), tabs, pane);
    if (S.tab === 'ai') renderAi(j, pane); else renderTranscript(j, pane);
  }

  function highlightNow() {
    if (!player) return;
    const t = player.currentTime;
    let cur = null;
    detailEl.querySelectorAll('.seg').forEach((el) => { const on = t >= +el.dataset.s && t < +el.dataset.e; el.classList.toggle('now', on); if (on) cur = el; });
    if (cur && !player.paused) { const box = cur.parentElement; if (box && box.scrollHeight > box.clientHeight) box.scrollTop = cur.offsetTop - box.clientHeight / 3; }
  }

  async function renderTranscript(j, pane) {
    const tr = await ensureTranscript(j).catch((e) => { showToast(e.message, 'error'); return null; });
    if (selected()?.id !== j.id || S.tab !== 'transcript') return;
    pane.replaceChildren();
    if (j.transcribing) { pane.append(h('p', { class: 'text-sm' }, `Transcribing… ${j.transcribeProgress ?? ''}${j.transcribeProgress != null ? '%' : ''}`)); return; }
    if (!tr) { pane.append(transcribeForm(j)); return; }

    const names = tr.speakerNames || {};
    const search = h('input', { placeholder: 'Search text or speaker…', value: S.query });
    const list = h('div', { style: 'max-height:380px;overflow:auto' });
    const draw = () => {
      list.replaceChildren();
      const q = S.query.toLowerCase();
      tr.segments.forEach((s) => {
        const who = s.speaker ? names[s.speaker] || s.speaker : '';
        if (q && !(s.text.toLowerCase().includes(q) || who.toLowerCase().includes(q))) return;
        list.append(h('div', { class: 'seg', 'data-s': s.start, 'data-e': s.end, onClick: () => seek(s.start) }, h('span', { class: 't' }, fmtClock(s.start)), h('span', {}, who ? h('span', { class: 'spk' }, `${who}: `) : null, s.text)));
      });
      if (!list.children.length) list.append(h('p', { class: 'text-sm p-3', style: 'color:#71717a' }, 'No matches.'));
    };
    search.addEventListener('input', () => { S.query = search.value; draw(); });
    const speakers = Object.keys(names);
    pane.append(
      h('div', { class: 'flex gap-2 items-center mb-3 flex-wrap' }, h('div', { style: 'flex:1;min-width:180px' }, search),
        ['txt', 'md', 'srt', 'vtt', 'json'].map((f) => h('button', { class: 'btn btn-sm', onClick: () => exportTranscript(j, f) }, f.toUpperCase()))),
      speakers.length ? h('div', { class: 'flex gap-2 flex-wrap mb-3 items-center' }, h('span', { class: 'text-xs', style: 'color:#71717a' }, 'Speakers:'),
        speakers.map((k) => { const inp = h('input', { value: names[k], style: 'width:120px;padding:4px 8px', 'aria-label': `Rename ${k}` }); inp.addEventListener('change', async () => { try { S.transcripts[j.id] = (await api(`/jobs/${j.id}/transcript`, { method: 'PUT', body: { speakerNames: { [k]: inp.value } } })).transcript; renderDetail(); } catch (e) { showToast(e.message, 'error'); } }); return inp; })) : null,
      list,
      h('div', { class: 'text-xs mt-3', style: 'color:#71717a' }, `${tr.provider === 'local' ? 'Local Whisper' : tr.model}${tr.language ? ` · ${tr.language}` : ''}${tr.diarized ? ' · speaker labels' : ''}`),
      h('button', { class: 'btn btn-sm mt-3', onClick: () => { delete S.transcripts[j.id]; j.hasTranscript = false; renderDetail(); } }, 'Re-transcribe'));
    draw();
  }

  function transcribeForm(j) {
    const provider = h('select', {}, h('option', { value: 'openai' }, 'Cloud (OpenAI-compatible API)'), h('option', { value: 'local', disabled: !S.status?.localWhisper }, S.status?.localWhisper ? 'Local Whisper (on the server)' : 'Local Whisper (not installed on server)'));
    const diarize = h('input', { type: 'checkbox', checked: true, style: 'width:auto' });
    const lang = h('input', { placeholder: 'auto-detect (e.g. en, es, de)', value: S.settings.language });
    const go = h('button', { class: 'btn btn-primary' }, 'Transcribe');
    go.addEventListener('click', async () => {
      go.disabled = true; go.textContent = 'Transcribing…';
      S.settings.language = lang.value.trim(); saveSettings();
      try {
        const r = await api(`/jobs/${j.id}/transcribe`, { method: 'POST', body: { provider: provider.value, diarize: diarize.checked && provider.value === 'openai', language: lang.value.trim() || undefined, ...endpoint() } });
        S.transcripts[j.id] = r.transcript; j.hasTranscript = true; showToast('Transcript ready', 'success'); renderQueue(); renderDetail();
      } catch (e) { showToast(e.message, 'error'); go.disabled = false; go.textContent = 'Transcribe'; }
    });
    return h('div', { class: 'flex flex-col gap-3', style: 'max-width:460px' },
      h('p', { class: 'text-sm', style: 'color:#a1a1aa' }, 'Create a timestamped transcript. Cloud mode uses your API key (AI settings) and can label who is speaking.'),
      h('div', {}, h('label', { class: 'lbl' }, 'Engine'), provider), h('div', {}, h('label', { class: 'lbl' }, 'Language'), lang),
      h('label', { class: 'flex items-center gap-2 text-sm' }, diarize, 'Label speakers (cloud only)'), go);
  }

  async function exportTranscript(j, fmt) {
    try {
      const res = await fetch(`${API}/jobs/${j.id}/transcript?format=${fmt}`, { headers: await authHeader() });
      if (!res.ok) throw new Error('Export failed');
      const a = h('a', { href: URL.createObjectURL(await res.blob()), download: `${j.title.slice(0, 60).replace(/[^\w.-]+/g, '_')}.${fmt}` });
      document.body.append(a); a.click(); a.remove();
    } catch (e) { showToast(e.message, 'error'); }
  }

  // ───────── AI ─────────
  function provider() { const { kind, baseUrl, model, apiKey } = S.settings; return { kind, baseUrl: baseUrl || undefined, model: model || undefined, apiKey: apiKey || apiKeyManager.getOpenAIKey?.() || undefined }; }
  function endpoint() { const p = provider(); return { baseUrl: p.kind === 'openai' ? p.baseUrl : undefined, apiKey: p.kind === 'openai' ? p.apiKey : undefined }; }

  function renderAi(j, pane) {
    if (!j.hasTranscript) { pane.append(h('p', { class: 'text-sm', style: 'color:#a1a1aa' }, 'Transcribe this item first — the AI works from the transcript.'), h('button', { class: 'btn btn-sm mt-3', onClick: () => { S.tab = 'transcript'; renderDetail(); } }, 'Go to transcript')); return; }
    const out = h('div', { class: 'out card p-4 mt-3', style: 'min-height:80px' });
    out.innerHTML = S.ai[j.id] ? md(S.ai[j.id]) : '<p style="color:#71717a">Pick an action to generate output.</p>';
    const lang = h('input', { placeholder: 'Language, e.g. Spanish', style: 'width:150px' });
    const run = async (action, label, extra = {}) => {
      out.innerHTML = `<p style="color:#a1a1aa">${esc(label)}…</p>`;
      try { S.ai[j.id] = (await api(`/jobs/${j.id}/ai`, { method: 'POST', body: { action, provider: provider(), ...extra } })).text; out.innerHTML = md(S.ai[j.id]); } catch (e) { out.innerHTML = `<p style="color:#ef4444">${esc(e.message)}</p>`; }
    };
    const chatLog = h('div', { class: 'flex flex-col gap-2 mt-2', style: 'max-height:260px;overflow:auto' });
    const draw = () => { chatLog.replaceChildren(...(S.chat[j.id] || []).map((m) => { const b = h('div', { class: `bubble ${m.role === 'user' ? 'me' : 'ai out'}` }); if (m.role === 'user') b.textContent = m.content; else b.innerHTML = md(m.content); return b; })); chatLog.scrollTop = 1e9; };
    const q = h('input', { placeholder: 'Ask about this video…' });
    const send = async () => {
      const text = q.value.trim(); if (!text) return;
      const msgs = (S.chat[j.id] ||= []); msgs.push({ role: 'user', content: text }); q.value = ''; draw();
      try { msgs.push({ role: 'assistant', content: (await api(`/jobs/${j.id}/ai`, { method: 'POST', body: { action: 'chat', messages: msgs, provider: provider() } })).text }); } catch (e) { msgs.push({ role: 'assistant', content: `⚠ ${e.message}` }); }
      draw();
    };
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    pane.append(
      h('div', { class: 'flex gap-2 flex-wrap items-center' }, AI_ACTIONS.map(([a, l]) => h('button', { class: 'btn btn-sm', onClick: () => run(a, l) }, l)),
        lang, h('button', { class: 'btn btn-sm', onClick: () => (lang.value.trim() ? run('translate', 'Translating', { lang: lang.value.trim() }) : showToast('Enter a target language', 'error')) }, 'Translate')),
      out, h('div', { class: 'mt-5 mb-1 text-xs', style: 'letter-spacing:.06em;text-transform:uppercase;color:#a1a1aa' }, 'Chat with the transcript'), chatLog,
      h('div', { class: 'flex gap-2 mt-2' }, q, h('button', { class: 'btn btn-primary', onClick: send }, 'Send')));
    draw();
  }

  // ───────── settings modal ─────────
  function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(S.settings)); } catch { /* ignore */ } }
  function openSettings() {
    const s = S.settings;
    const kind = h('select', {}, h('option', { value: 'openai' }, 'OpenAI-compatible (OpenAI, Groq, DeepSeek, OpenRouter, Ollama, LM Studio…)'), h('option', { value: 'anthropic' }, 'Anthropic'));
    kind.value = s.kind;
    const baseUrl = h('input', { placeholder: 'Default (provider)', value: s.baseUrl });
    const model = h('input', { placeholder: s.kind === 'anthropic' ? 'claude-sonnet-5-5' : 'gpt-4o-mini', value: s.model });
    const key = h('input', { type: 'password', placeholder: 'Stored in this browser only', value: s.apiKey, autocomplete: 'off' });
    const close = () => overlay.remove();
    const overlay = h('div', { style: 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:1000;display:grid;place-items:center;padding:16px', onClick: (e) => e.target === overlay && close() },
      h('div', { class: 'card p-5 flex flex-col gap-3', style: 'width:min(520px,100%);background:#0a0a0a' },
        h('h3', { class: 'font-bold text-lg' }, 'AI provider'),
        h('p', { class: 'text-xs', style: 'color:#a1a1aa' }, 'Used for transcription (OpenAI-compatible only), summaries, translation and chat. Your key is kept in this browser and sent only with your own requests.'),
        h('div', {}, h('label', { class: 'lbl' }, 'Provider'), kind), h('div', {}, h('label', { class: 'lbl' }, 'Base URL (optional)'), baseUrl),
        h('div', {}, h('label', { class: 'lbl' }, 'Model (optional)'), model), h('div', {}, h('label', { class: 'lbl' }, 'API key'), key),
        h('div', { class: 'flex justify-end gap-2' }, h('button', { class: 'btn', onClick: close }, 'Cancel'), h('button', { class: 'btn btn-primary', onClick: () => { Object.assign(S.settings, { kind: kind.value, baseUrl: baseUrl.value.trim(), model: model.value.trim(), apiKey: key.value.trim() }); saveSettings(); close(); showToast('AI settings saved', 'success'); } }, 'Save'))));
    container.append(overlay);
  }

  // ───────── polling ─────────
  let timer = null, alive = true;
  async function refresh() {
    try {
      const { jobs } = await api('/jobs');
      S.jobs = jobs;
      if (!S.sel && jobs.length) S.sel = jobs[0].id;
      renderQueue();
      const j = selected();
      const key = j ? `${j.status}|${j.hasTranscript}|${j.transcribing}` : '';
      if (key !== S.lastStatus.sel || j?.id !== S.lastStatus.id) { S.lastStatus = { sel: key, id: j?.id }; renderDetail(); }
    } catch (e) {
      if (!S.jobs.length) queueEl.replaceChildren(h('p', { class: 'text-sm px-3 py-6 text-center', style: 'color:#ef4444' }, e.message));
    }
    clearTimeout(timer);
    if (alive) timer = setTimeout(refresh, S.jobs.some((x) => ACTIVE.includes(x.status) || x.transcribing) ? 1200 : 6000);
  }
  api('/status').then((s) => {
    S.status = s;
    statusChip.textContent = s.downloads ? `yt-dlp ${s.ytDlp}` : `Engine missing: ${[!s.ytDlp && 'yt-dlp', !s.ffmpeg && 'ffmpeg'].filter(Boolean).join(' + ')}`;
    statusChip.className = `pill ${s.downloads ? 'ok' : 'bad'}`;
  }).catch((e) => { statusChip.textContent = e.message; statusChip.className = 'pill bad'; });
  refresh();

  container.cleanup = () => { alive = false; clearTimeout(timer); };
  return container;
}

export default MediaHubPage;
