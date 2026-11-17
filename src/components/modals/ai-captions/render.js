/**
 * AI Captions — the HTML of the tabbed shell (Create · Script & Words · Motion & Style · History), laid out like the app's
 * "Personalize this demo" modal: a section card with an uppercase title, pill chips with counts, labelled filters, a card grid.
 * Pure string builders on the modal's state `m`; the modal (AICaptionsModal.jsx) owns events and state.
 */
import { CAPITE_STYLES, CAPITE_CATEGORY_LABEL } from '../../../openchatcut/captions/capiteStyles';
import { ALL_CAPTION_STYLES, CAPTION_STYLES } from '../../../openchatcut/captions/styles';
import { CAPTION_LANGUAGES } from '../template-generator/captions.js';
import { POSITIONS, BACKGROUNDS, MIN_POS, MAX_POS, presetFor, phonePreviewHTML } from './phonePreview.js';
import { lineLabel, countWords } from './scriptOps.js';
import { formatBytes, formatDuration } from './history.js';

export const TABS = [['create', 'Create'], ['script', 'Script & Words'], ['style', 'Motion & Style'], ['history', 'History']];
/** The six looks the ai-video-captions app opens with, by their Capite ids. */
export const REFERENCE_STYLES = ['capite-hormozi', 'capite-mrbeast', 'capite-karaoke', 'capite-minimal', 'capite-bounce', 'capite-classic'];
export const SPEEDS = [0.75, 1, 1.25, 1.5];

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const styleById = Object.fromEntries(ALL_CAPTION_STYLES.map((s) => [s.id, s]));
export const styleFor = (id) => styleById[id] || styleById['capite-hormozi'];
const hint = (s) => s.bestFor || s.hint || '';
const dot = (s) => `<span class="cap-dot" style="background:linear-gradient(135deg,${esc(s.color)} 50%,${esc(s.highlightBackground || s.highlightColor)} 50%)"></span>`;

/** Style filter chips with counts: All, Popular, Capite's four categories, the editor's own looks. */
export function styleGroups() {
  const cat = (c) => CAPITE_STYLES.filter((s) => s.category === c).map((s) => s.id);
  return [
    ['all', 'All looks', ALL_CAPTION_STYLES.map((s) => s.id)],
    ['popular', 'Popular', REFERENCE_STYLES],
    ...['trending', 'clean-tech', 'editorial-film', 'pop-expressive'].map((c) => [c, CAPITE_CATEGORY_LABEL[c], cat(c)]),
    ['editor', 'Editor looks', CAPTION_STYLES.map((s) => s.id)],
  ];
}

const chip = (act, val, label, on, count) => `<button type="button" class="cap-chip${on ? ' is-on' : ''}" data-act="${act}" data-val="${esc(val)}">${esc(label)}${count != null ? `<span class="cap-count">${count}</span>` : ''}</button>`;
const sectionCard = (title, body, right = '') => `<section class="cap-card"><div class="cap-card-head"><h3>${esc(title)}</h3>${right}</div>${body}</section>`;

export function renderTabs(m) {
  return `<div class="cap-tabs" role="tablist">${TABS.map(([id, label]) => `<button type="button" role="tab" aria-selected="${m.tab === id}" class="cap-tab${m.tab === id ? ' is-on' : ''}" data-act="tab" data-val="${id}"${id !== 'script' && id !== 'style' ? '' : ''}>${label}${id === 'history' && m.historyCount ? `<span class="cap-count">${m.historyCount}</span>` : ''}</button>`).join('')}</div>`;
}

function positionControls(m) {
  const cur = presetFor(m.percent);
  return `<div class="cap-pos"><div class="cap-pos-btns">${POSITIONS.map(([id, label]) => `<button type="button" class="cap-chip${cur === id ? ' is-on' : ''}" data-act="pos" data-val="${id}">${label}</button>`).join('')}</div>`
    + `<label class="cap-slider">From the bottom <input type="range" min="${MIN_POS}" max="${MAX_POS}" value="${m.percent}" data-act="pos-range" aria-label="Caption position"><b data-testid="cap-pos-value">${m.percent}%</b></label></div>`;
}

function inputBlock(m) {
  return `<div class="cap-modes">${chip('mode', 'upload', '📁 Upload video', m.inputMode === 'upload')}${chip('mode', 'url', '🔗 Video URL', m.inputMode === 'url')}</div>${m.inputMode === 'url' ? m.renderUrlForm() : m.renderUploadForm()}`;
}

function filters(m) {
  const langs = m.engine === 'cloud'
    ? m.languages.map((l) => `<option value="${esc(l.value)}"${m.language === l.value ? ' selected' : ''}>${esc(l.label)}</option>`).join('')
    : CAPTION_LANGUAGES.map(([v, l]) => `<option value="${v}"${m.deviceLang === v ? ' selected' : ''}>${esc(l)}</option>`).join('');
  return `<div class="cap-filters">`
    + `<div class="cap-field"><label for="ai-cap-engine">Source</label><select id="ai-cap-engine"><option value="device"${m.engine === 'device' ? ' selected' : ''}>On this device (free)</option><option value="cloud"${m.engine === 'cloud' ? ' selected' : ''}>AI themes (cloud)</option></select></div>`
    + `<div class="cap-field"><label for="ai-cap-language">Language</label><select id="ai-cap-language">${langs}</select></div>`
    + (m.engine === 'device' ? `<div class="cap-field"><label for="ai-cap-model">Accuracy</label><select id="ai-cap-model">${m.models.map(([id, label]) => `<option value="${id}"${m.model === id ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select></div>` : '')
    + `</div>`;
}

/** The Create tab: video, source/language filters, look chips, description, phone preview, position. */
export function renderCreate(m) {
  const s = styleFor(m.styleId);
  const looks = m.engine === 'cloud'
    ? `<div class="cap-chips">${m.themes.map((t) => `<button type="button" class="cap-chip${m.theme === t.value ? ' is-on' : ''}" data-act="theme" data-val="${esc(t.value)}">${esc(t.label)}</button>`).join('')}</div><p class="cap-note">AI themes are drawn by the caption service in the cloud and burned into the video for you.</p>`
    : `<div class="cap-chips">${REFERENCE_STYLES.map((id) => chip('look', id, styleFor(id).label, m.styleId === id)).join('')}<select class="cap-more" id="ai-cap-more" aria-label="More looks"><option value="">More looks…</option>${ALL_CAPTION_STYLES.filter((x) => !REFERENCE_STYLES.includes(x.id)).map((x) => `<option value="${esc(x.id)}"${m.styleId === x.id ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select></div>`
    + `<div class="cap-desc" data-testid="cap-desc"><b>${esc(s.label)}</b> — ${esc(hint(s))}</div>`;
  const left = `${inputBlock(m)}${filters(m)}<div class="cap-sub">Caption look</div>${looks}`;
  const right = m.engine === 'device'
    ? `<div class="cap-side">${phonePreviewHTML(s, { percent: m.percent, background: m.bg })}${positionControls(m)}</div>` : '';
  return sectionCard('Choose a video', `<p class="cap-note">Add animated word-by-word captions to any video. ${m.engine === 'device' ? 'Everything runs in your browser; nothing is uploaded.' : 'The cloud service burns them in for you.'}</p><div class="cap-create">${`<div class="cap-create-main">${left}</div>`}${right}</div>`, `<span class="cap-meta">${m.engine === 'device' ? 'Whisper · ' + CAPTION_LANGUAGES.length + ' languages' : 'MuAPI · ' + m.themes.length + ' themes'}</span>`);
}

// ------------------------------------------------------------------ Script & Words

function lineCard(m, seg, i) {
  const on = m.activeSeg === i;
  const words = seg.words.map((w, j) => {
    if (m.editing && m.editing.s === i && m.editing.w === j) return `<input class="cap-word-input" data-edit="1" value="${esc(w.text)}" size="${Math.max(3, w.text.length + 1)}" aria-label="Edit word">`;
    const hot = on && m.activeWord === j;
    return `<span class="cap-w${hot ? ' is-hot' : ''}" data-act="word" data-s="${i}" data-w="${j}" role="button" tabindex="0" title="Click to fix spelling">${esc(w.text)}</span>`;
  }).join(' ');
  return `<div class="cap-line${on ? ' is-active' : ''}" data-seg="${i}">`
    + `<div class="cap-line-top"><button type="button" class="cap-time" data-act="seek" data-s="${i}">🕘 ${lineLabel(seg)}</button>${on ? '<span class="cap-speaking">Speaking</span>' : ''}`
    + `<span class="cap-line-tools"><button type="button" class="cap-mini" data-act="nudge" data-s="${i}" data-d="-100" title="0.1 s earlier">−0.1s</button><button type="button" class="cap-mini" data-act="nudge" data-s="${i}" data-d="100" title="0.1 s later">+0.1s</button>`
    + `<button type="button" class="cap-mini" data-act="split" data-s="${i}" title="Split this line in the middle">Split</button>${i < m.segments.length - 1 ? `<button type="button" class="cap-mini" data-act="merge" data-s="${i}" title="Join with the next line">Merge</button>` : ''}<button type="button" class="cap-mini is-danger" data-act="del" data-s="${i}" title="Delete this line" aria-label="Delete line">✕</button></span></div>`
    + `<div class="cap-words">${words}</div></div>`;
}

export function renderScript(m) {
  if (!m.segments.length) return sectionCard('Script & words', '<p class="cap-empty">No captions yet. Pick a video on the Create tab and press Generate Captions, or open a job from History.</p>');
  const q = m.findText;
  const matches = m.matchCount;
  const bar = `<div class="cap-bar"><div class="cap-find"><input id="ai-cap-find" placeholder="Find" value="${esc(q)}" aria-label="Find"><input id="ai-cap-repl" placeholder="Replace with" value="${esc(m.replText)}" aria-label="Replace with"><button type="button" class="cap-mini" data-act="replace-all">Replace${q ? ` (${matches})` : ''}</button></div>`
    + `<div class="cap-case"><button type="button" class="cap-mini" data-act="case" data-val="upper">AA</button><button type="button" class="cap-mini" data-act="case" data-val="title">Aa</button><button type="button" class="cap-mini" data-act="case" data-val="lower">aa</button></div>`
    + `<button type="button" class="cap-chip${m.autoScroll ? ' is-on' : ''}" data-act="autoscroll">Auto-scroll</button><button type="button" class="cap-mini" data-act="copy">Copy</button><button type="button" class="cap-mini is-primary" data-act="add">+ Add</button></div>`;
  const lines = `<div class="cap-lines" id="ai-cap-lines" data-testid="cap-lines">${m.segments.map((s, i) => lineCard(m, s, i)).join('')}</div>`;
  const foot = `<div class="cap-foot"><span data-testid="cap-counts">${m.segments.length} segments • ${countWords(m.segments)} words • ${esc(m.detectedLang || m.deviceLang)}</span><span>Click any word to fix spelling and typos</span></div>`;
  return `<div class="cap-split"><div class="cap-split-media">${renderPlayer(m)}${renderOutput(m)}</div><section class="cap-card cap-card-script"><div class="cap-card-head"><h3>Script &amp; words</h3></div>${bar}${lines}${foot}</section></div>`;
}

// ------------------------------------------------------------------ player + output

export function renderPlayer(m) {
  if (!m.videoUrl) return '<div class="cap-player cap-player-empty">The video is not attached. Open it again from History, or pick it on the Create tab.</div>';
  const s = styleFor(m.styleId);
  return `<div class="cap-player"><div class="cap-stage" style="background:${(BACKGROUNDS.find((b) => b[0] === m.bg) || BACKGROUNDS[0])[2]}"><video id="ai-cap-video" src="${esc(m.videoUrl)}" playsinline preload="metadata"${m.livePreview ? '' : ' data-nolive="1"'}></video>`
    + `<div class="cap-live" id="ai-cap-live" data-testid="cap-live" style="bottom:${m.percent}%"></div></div>`
    + `<div class="cap-transport"><button type="button" class="cap-play" data-act="play" aria-label="Play or pause">▶</button><span class="cap-speeds">${SPEEDS.map((v) => `<button type="button" class="cap-mini${m.speed === v ? ' is-on' : ''}" data-act="speed" data-val="${v}">${v}x</button>`).join('')}</span>`
    + `<button type="button" class="cap-chip${m.livePreview ? ' is-on' : ''}" data-act="live">Live preview: ${m.livePreview ? 'ON' : 'OFF'}</button><span class="cap-meta">Space = play / pause · ${esc(s.label)}</span></div></div>`;
}

export function renderOutput(m) {
  const busy = m.rendering;
  const canBurn = m.segments.length && m.canBurn;
  return `<div class="cap-output"><div class="cap-output-head"><b>Final captioned video</b><span class="cap-meta">${m.outputUrl ? `Burned-in subtitles · ${esc(styleFor(m.styleId).label)} · ${formatBytes(m.outputSize)}` : 'Not rendered yet'}</span></div>`
    + `<div class="cap-output-row">`
    + `<button type="button" class="cap-btn is-primary" data-act="render"${busy || !canBurn ? ' disabled' : ''} data-testid="cap-render">${busy ? `Rendering… ${Math.round((m.renderPct || 0) * 100)}%` : m.outputUrl ? 'Apply &amp; Re-render' : 'Render video'}</button>`
    + (m.outputUrl ? `<a class="cap-btn is-green" href="${esc(m.outputUrl)}" download="${esc(m.outputName)}" data-testid="cap-download-mp4">⬇ Download Video (.mp4)</a>` : '')
    + `<span class="cap-exports"><button type="button" class="cap-mini" data-act="export" data-val="srt" data-testid="cap-srt">SRT</button><button type="button" class="cap-mini" data-act="export" data-val="vtt" data-testid="cap-vtt">VTT</button><button type="button" class="cap-mini" data-act="export" data-val="txt" data-testid="cap-txt">TXT</button></span></div>`
    + `${m.renderNote ? `<p class="cap-note" role="status">${esc(m.renderNote)}</p>` : ''}${!m.canBurn ? '<p class="cap-note">This browser cannot export video here. The .srt, .vtt and .txt downloads still work.</p>' : ''}</div>`;
}

// ------------------------------------------------------------------ Motion & Style

export function renderStyle(m) {
  const groups = styleGroups();
  const group = groups.find((g) => g[0] === m.styleGroup) || groups[0];
  const ids = new Set(group[2]);
  const q = m.styleQuery.trim().toLowerCase();
  const list = ALL_CAPTION_STYLES.filter((s) => ids.has(s.id) && (!q || `${s.label} ${hint(s)}`.toLowerCase().includes(q)));
  const grid = list.length ? `<div class="cap-grid" data-testid="cap-style-grid">${list.map((s) => `<button type="button" class="cap-tile${m.styleId === s.id ? ' is-on' : ''}" data-act="look" data-val="${esc(s.id)}"><span class="cap-tile-top"><b>${esc(s.label)}</b>${dot(s)}</span><span class="cap-tile-sub">${esc(hint(s))}</span></button>`).join('')}</div>` : '<p class="cap-empty">No look matches.</p>';
  const s = styleFor(m.styleId);
  const fonts = `<div class="cap-filters"><div class="cap-field"><label for="ai-cap-case">Casing</label><select id="ai-cap-case"><option value="style"${!m.upperOverride ? ' selected' : ''}>As the look</option><option value="upper"${m.upperOverride === 'upper' ? ' selected' : ''}>UPPERCASE</option><option value="none"${m.upperOverride === 'none' ? ' selected' : ''}>Normal</option></select></div>`
    + `<div class="cap-field"><label for="ai-cap-color">Text colour</label><input id="ai-cap-color" type="color" value="${esc(toHex(m.colorOverride || s.color))}"></div>`
    + `<div class="cap-field"><label for="ai-cap-hl">Highlight colour</label><input id="ai-cap-hl" type="color" value="${esc(toHex(m.highlightOverride || s.highlightBackground || s.highlightColor))}"></div>`
    + `<div class="cap-field"><label for="ai-cap-bg">Preview background</label><select id="ai-cap-bg">${BACKGROUNDS.map(([id, label]) => `<option value="${id}"${m.bg === id ? ' selected' : ''}>${label}</option>`).join('')}</select></div>`
    + `<div class="cap-field cap-field-end"><button type="button" class="cap-mini" data-act="reset-style">Reset to default</button></div></div>`;
  const side = `<div class="cap-side">${phonePreviewHTML(m.effectiveStyle(), { percent: m.percent, background: m.bg })}${positionControls(m)}</div>`;
  const body = `<div class="cap-chips">${groups.map(([id, label, gids]) => chip('group', id, label, group[0] === id, gids.length)).join('')}</div>`
    + `<div class="cap-filters"><div class="cap-field"><label for="ai-cap-q">Search</label><input id="ai-cap-q" placeholder="Search looks…" value="${esc(m.styleQuery)}"></div></div>`
    + `<p class="cap-note">Showing ${list.length} of ${ALL_CAPTION_STYLES.length} looks</p>${grid}${fonts}`;
  return `<div class="cap-split"><section class="cap-card">${'<div class="cap-card-head"><h3>Motion style presets</h3></div>'}${body}</section><div class="cap-split-media">${side}${m.segments.length ? renderOutput(m) : ''}</div></div>`;
}

function toHex(c) { const v = String(c || '').trim(); return /^#[0-9a-f]{6}$/i.test(v) ? v : /^#[0-9a-f]{3}$/i.test(v) ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : '#ffffff'; }

// ------------------------------------------------------------------ History

export function renderHistory(m) {
  const jobs = m.jobs;
  if (!jobs.length) return sectionCard('Caption history', '<p class="cap-empty" data-testid="cap-history-empty">No caption jobs yet. They are kept in this browser only.</p>');
  const cards = jobs.map((j) => `<article class="cap-job" data-testid="cap-job" data-id="${esc(j.id)}"><div class="cap-job-title">${esc(j.title || 'Untitled video')}</div><dl class="cap-job-meta">`
    + `<div><dt>Duration</dt><dd>${formatDuration(j.durationSec)}</dd></div><div><dt>Language</dt><dd>${esc(j.language || '—')}</dd></div><div><dt>Caption style</dt><dd>${esc(styleFor(j.styleId).label)}</dd></div>`
    + `<div><dt>Caption position</dt><dd>${esc(String(j.percent ?? ''))}%</dd></div><div><dt>Processing time</dt><dd>${j.processingMs ? `${(j.processingMs / 1000).toFixed(1)}s` : '—'}</dd></div><div><dt>File size</dt><dd>${formatBytes(j.fileSize)}</dd></div>`
    + `<div><dt>Created</dt><dd>${esc(new Date(j.createdAt).toLocaleString())}</dd></div></dl>`
    + `<div class="cap-job-actions"><button type="button" class="cap-mini is-primary" data-act="job-open" data-id="${esc(j.id)}">${j.hasVideo ? 'Open &amp; edit' : 'Open script'}</button><button type="button" class="cap-mini" data-act="job-srt" data-id="${esc(j.id)}">SRT</button><button type="button" class="cap-mini is-danger" data-act="job-del" data-id="${esc(j.id)}">Delete</button></div></article>`).join('');
  return sectionCard('Caption history', `<div class="cap-jobs" data-testid="cap-jobs">${cards}</div>`, `<button type="button" class="cap-mini" data-act="job-clear">Clear all</button>`);
}

export function renderTab(m) {
  return m.tab === 'script' ? renderScript(m) : m.tab === 'style' ? renderStyle(m) : m.tab === 'history' ? renderHistory(m) : renderCreate(m);
}
