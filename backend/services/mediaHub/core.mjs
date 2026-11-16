/**
 * Media Hub core — download (yt-dlp) · transcribe (Whisper / diarization) · AI (summarize, translate, chat).
 *
 * Framework-agnostic: `handleMediaHub(request, { userId, base })` takes a Web `Request` and returns a Web
 * `Response`, so the same file backs an Express adapter and a Next.js route handler.
 *
 * Requires a server that can spawn processes (yt-dlp + ffmpeg on PATH, or YT_DLP_PATH / FFMPEG_PATH).
 * State: in-memory queue persisted to <MEDIA_HUB_DIR>/jobs.json. Jobs are scoped to `userId`.
 *
 * Env:
 *   MEDIA_HUB_DIR                  download/transcript directory (default ~/.media-hub)
 *   MEDIA_HUB_MAX_CONCURRENT       parallel downloads (default 2)
 *   MEDIA_HUB_SECRET               HMAC secret for file links (default: random per process)
 *   MEDIA_HUB_ALLOW_PRIVATE=1      allow localhost/private-network URLs and AI endpoints (dev / self-hosted only)
 *   OPENAI_API_KEY / MEDIA_HUB_AI_KEY   server-side fallback AI key
 */
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, statSync, readdirSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import net from 'node:net';

const env = (k, d) => process.env[k] ?? d;
const YT_DLP = () => env('YT_DLP_PATH', 'yt-dlp');
const FFMPEG = () => env('FFMPEG_PATH', 'ffmpeg');
const MAX_CONCURRENT = () => Math.max(1, Number(env('MEDIA_HUB_MAX_CONCURRENT', 2)));
const ALLOW_PRIVATE = () => env('MEDIA_HUB_ALLOW_PRIVATE', '') === '1';
const DIR = () => path.resolve(env('MEDIA_HUB_DIR', path.join(homedir(), '.media-hub')));
const SECRET = env('MEDIA_HUB_SECRET', '') || crypto.randomBytes(32).toString('hex');

/* ────────────────────────── helpers ────────────────────────── */

export class HubError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

function isPrivateHost(host) {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  const kind = net.isIP(h);
  if (kind === 4) {
    const [a, b] = h.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  if (kind === 6) return h === '::1' || h === '::' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80') || h.startsWith('::ffff:');
  return false;
}

/** http(s) only, no credentials, and (unless MEDIA_HUB_ALLOW_PRIVATE=1) no private/loopback hosts. */
export function validateUrl(raw, label = 'URL') {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch { throw new HubError(`Invalid ${label}`); }
  if (!/^https?:$/.test(u.protocol)) throw new HubError(`${label} must be http(s)`);
  if (u.username || u.password) throw new HubError(`${label} must not contain credentials`);
  if (!ALLOW_PRIVATE() && isPrivateHost(u.hostname)) throw new HubError(`${label} points to a private network address`);
  return u.toString();
}

export const fmtTime = (s, sep = ',') => {
  const t = Math.max(0, Number(s) || 0);
  const ms = Math.round((t % 1) * 1000);
  const whole = Math.floor(t);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  const carry = ms === 1000 ? 1 : 0;
  const w = whole + carry;
  return `${p(Math.floor(w / 3600))}:${p(Math.floor((w % 3600) / 60))}:${p(w % 60)}${sep}${p(carry ? 0 : ms, 3)}`;
};

function run(cmd, args, { timeout = 60000, input } = {}) {
  return new Promise((resolve, reject) => {
    let out = '', err = '';
    let child;
    try { child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] }); } catch (e) { return reject(e); }
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new HubError(`${path.basename(cmd)} timed out`, 504)); }, timeout);
    child.stdout.on('data', (d) => { out += d; if (out.length > 64e6) child.kill('SIGKILL'); });
    child.stderr.on('data', (d) => { err += d; if (err.length > 1e6) err = err.slice(-5e5); });
    child.on('error', (e) => { clearTimeout(timer); reject(new HubError(e.code === 'ENOENT' ? `${path.basename(cmd)} is not installed on the server` : e.message, e.code === 'ENOENT' ? 501 : 500)); });
    child.on('close', (code) => { clearTimeout(timer); code === 0 ? resolve(out) : reject(new HubError(lastLine(err) || `${path.basename(cmd)} exited with ${code}`, 502)); });
    if (input) child.stdin.end(input); else child.stdin.end();
  });
}
const lastLine = (s) => String(s || '').trim().split('\n').filter((l) => /error/i.test(l)).pop()?.replace(/^ERROR:\s*/, '') || String(s || '').trim().split('\n').pop();

/* ────────────────────────── tools ────────────────────────── */

let toolCache = { at: 0, value: null };
export async function getStatus(force = false) {
  if (!force && toolCache.value && Date.now() - toolCache.at < 30000) return toolCache.value;
  const probe = (cmd, args) => run(cmd, args, { timeout: 8000 }).then((o) => String(o).split('\n')[0].trim()).catch(() => null);
  const [ytdlp, ffmpeg, whisper] = await Promise.all([
    probe(YT_DLP(), ['--version']),
    probe(FFMPEG(), ['-version']).then((v) => v && v.replace(/^ffmpeg version\s+/, '').split(' ')[0]),
    probe(env('WHISPER_PATH', 'whisper'), ['--help']).then((v) => (v ? 'available' : null)),
  ]);
  const value = {
    ytDlp: ytdlp, ffmpeg, localWhisper: whisper,
    downloads: Boolean(ytdlp && ffmpeg),
    cloudTranscribe: Boolean(env('OPENAI_API_KEY', '') || env('MEDIA_HUB_AI_KEY', '')),
    serverAiKey: Boolean(env('OPENAI_API_KEY', '') || env('MEDIA_HUB_AI_KEY', '')),
  };
  toolCache = { at: Date.now(), value };
  return value;
}

/* ────────────────────────── yt-dlp args ────────────────────────── */

const CONTAINERS = ['auto', 'mp4', 'mkv', 'webm'];
const AUDIO_FORMATS = ['mp3', 'm4a', 'opus', 'wav', 'flac'];
const QUALITIES = ['best', '2160', '1440', '1080', '720', '480', '360'];

export function normalizeOptions(o = {}) {
  const mode = o.mode === 'audio' ? 'audio' : 'video';
  return {
    mode,
    container: CONTAINERS.includes(o.container) ? o.container : 'auto',
    quality: QUALITIES.includes(String(o.quality)) ? String(o.quality) : 'best',
    audioFormat: AUDIO_FORMATS.includes(o.audioFormat) ? o.audioFormat : 'mp3',
    subtitles: Boolean(o.subtitles),
    embedMetadata: o.embedMetadata !== false,
    playlist: Boolean(o.playlist),
  };
}

export function buildDownloadArgs(url, opts, outDir) {
  const o = normalizeOptions(opts);
  const args = [
    '--newline', '--no-warnings', '--no-colors', '--continue', '--no-mtime',
    o.playlist ? '--yes-playlist' : '--no-playlist',
    '--restrict-filenames', '--windows-filenames',
    '-o', path.join(outDir, '%(title).120B [%(id)s].%(ext)s'),
    '--progress', '--progress-template',
    'download:MHP %(progress.status)s %(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.total_bytes_estimate)s %(progress.speed)s %(progress.eta)s',
    '--print', 'after_move:MHFILE\t%(filepath)s',
    '--print', 'before_dl:MHMETA\t%(title)s\t%(thumbnail)s\t%(duration)s\t%(uploader)s',
  ];
  if (o.mode === 'audio') {
    args.push('-f', 'ba/b', '-x', '--audio-format', o.audioFormat, '--audio-quality', '0');
  } else {
    const h = o.quality === 'best' ? '' : `[height<=${o.quality}]`;
    args.push('-f', `bv*${h}+ba/b${h}`);
    args.push('--merge-output-format', o.container === 'auto' ? 'mp4/mkv' : o.container);
  }
  if (o.embedMetadata) args.push('--embed-metadata', '--embed-chapters');
  if (o.subtitles) args.push('--write-subs', '--write-auto-subs', '--sub-langs', 'en.*,-live_chat');
  args.push('--', url);
  return args;
}

export function parseProgressLine(line) {
  const m = /^MHP (\S+) (\S+) (\S+) (\S+) (\S+) (\S+)/.exec(line);
  if (!m) return null;
  const n = (v) => (v === 'NA' || v === 'None' ? null : Number(v));
  const [, status, done, total, est, speed, eta] = m;
  const t = n(total) ?? n(est);
  return { status, downloaded: n(done), total: t, speed: n(speed), eta: n(eta), percent: t && n(done) != null ? Math.min(100, (n(done) / t) * 100) : null };
}

/* ────────────────────────── store + queue ────────────────────────── */

const hub = (globalThis.__mediaHub ||= { jobs: new Map(), running: new Map(), loaded: false, saveTimer: null });

function ensureDirs() { mkdirSync(path.join(DIR(), 'downloads'), { recursive: true }); mkdirSync(path.join(DIR(), 'work'), { recursive: true }); }

function load() {
  if (hub.loaded) return;
  hub.loaded = true;
  ensureDirs();
  try {
    const list = JSON.parse(readFileSync(path.join(DIR(), 'jobs.json'), 'utf8'));
    for (const j of list) {
      if (['queued', 'downloading', 'processing'].includes(j.status)) j.status = 'paused';
      hub.jobs.set(j.id, j);
    }
  } catch { /* first run */ }
}

function save() {
  clearTimeout(hub.saveTimer);
  hub.saveTimer = setTimeout(() => {
    try {
      const tmp = path.join(DIR(), 'jobs.json.tmp');
      writeFileSync(tmp, JSON.stringify([...hub.jobs.values()]));
      renameSync(tmp, path.join(DIR(), 'jobs.json'));
    } catch { /* best effort */ }
  }, 300);
}

const publicJob = (j) => { const { userId, outDir, ...rest } = j; return { ...rest, hasFile: Boolean(j.file), hasTranscript: Boolean(j.transcript) , file: undefined, transcript: undefined }; };

function getJob(id, userId) {
  load();
  const j = hub.jobs.get(id);
  if (!j || j.userId !== userId) throw new HubError('Not found', 404);
  return j;
}

const transcriptPath = (id) => path.join(DIR(), 'work', `${id}.transcript.json`);
const readTranscript = (id) => { try { return JSON.parse(readFileSync(transcriptPath(id), 'utf8')); } catch { return null; } };

export async function getInfo(url) {
  const safe = validateUrl(url);
  const out = await run(YT_DLP(), ['-J', '--flat-playlist', '--no-warnings', '--skip-download', '--', safe], { timeout: 60000 });
  const d = JSON.parse(out);
  const base = { url: safe, title: d.title, uploader: d.uploader || d.channel, thumbnail: d.thumbnail, duration: d.duration, site: d.extractor_key || d.ie_key };
  if (d._type === 'playlist') {
    return { ...base, isPlaylist: true, entries: (d.entries || []).slice(0, 200).map((e) => ({ id: e.id, title: e.title, url: e.url || e.webpage_url, duration: e.duration, thumbnail: e.thumbnails?.[0]?.url })) };
  }
  const heights = [...new Set((d.formats || []).map((f) => f.height).filter(Boolean))].sort((a, b) => b - a);
  return { ...base, isPlaylist: false, heights, hasAudio: (d.formats || []).some((f) => f.acodec && f.acodec !== 'none') };
}

export function createJob(userId, url, options) {
  load();
  const safe = validateUrl(url);
  const opts = normalizeOptions(options);
  const id = crypto.randomUUID();
  const job = { id, userId, url: safe, options: opts, status: 'queued', progress: 0, speed: null, eta: null, size: null, title: safe, thumbnail: null, duration: null, uploader: null, file: null, error: null, createdAt: Date.now(), updatedAt: Date.now() };
  hub.jobs.set(id, job);
  save();
  pump();
  return job;
}

function pump() {
  const active = [...hub.running.keys()].length;
  let slots = MAX_CONCURRENT() - active;
  if (slots <= 0) return;
  for (const j of [...hub.jobs.values()].sort((a, b) => a.createdAt - b.createdAt)) {
    if (slots <= 0) break;
    if (j.status === 'queued' && !hub.running.has(j.id)) { startJob(j); slots--; }
  }
}

function startJob(job) {
  ensureDirs();
  const outDir = path.join(DIR(), 'downloads', job.id);
  mkdirSync(outDir, { recursive: true });
  job.status = 'downloading'; job.error = null; job.updatedAt = Date.now();
  let child;
  try {
    child = spawn(YT_DLP(), buildDownloadArgs(job.url, job.options, outDir), { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { return failJob(job, e.message); }
  hub.running.set(job.id, child);
  let errTail = '', buf = '', finalFile = null, lastSave = 0;
  const onLine = (line) => {
    if (line.startsWith('MHFILE\t')) { finalFile = line.slice(7).trim(); return; }
    if (line.startsWith('MHMETA\t')) {
      const [, title, thumb, dur, up] = line.split('\t');
      Object.assign(job, { title: title && title !== 'NA' ? title : job.title, thumbnail: thumb && thumb !== 'NA' ? thumb : job.thumbnail, duration: dur && dur !== 'NA' ? Number(dur) : job.duration, uploader: up && up !== 'NA' ? up : job.uploader });
      return;
    }
    const p = parseProgressLine(line);
    if (p) {
      job.progress = p.percent ?? job.progress; job.speed = p.speed; job.eta = p.eta; job.size = p.total ?? job.size;
      job.status = p.status === 'finished' && job.options.mode === 'audio' ? 'processing' : 'downloading';
      job.updatedAt = Date.now();
      if (Date.now() - lastSave > 2000) { lastSave = Date.now(); save(); }
      return;
    }
    if (/^\[(Merger|ExtractAudio|VideoRemuxer|Metadata|EmbedSubtitle)/.test(line)) { job.status = 'processing'; job.speed = null; job.eta = null; }
  };
  child.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { onLine(buf.slice(0, i).replace(/\r$/, '')); buf = buf.slice(i + 1); } });
  child.stderr.on('data', (d) => { errTail = (errTail + d).slice(-4000); });
  child.on('error', (e) => { hub.running.delete(job.id); failJob(job, e.code === 'ENOENT' ? 'yt-dlp is not installed on the server' : e.message); });
  child.on('close', (code, signal) => {
    hub.running.delete(job.id);
    if (job.status === 'canceled' || job.status === 'paused') { pump(); return; }
    if (code === 0) {
      let file = finalFile && existsSync(finalFile) ? finalFile : null;
      if (!file) file = readdirSync(outDir).map((f) => path.join(outDir, f)).filter((f) => !/\.(part|ytdl|vtt|srt)$/.test(f)).sort((a, b) => statSync(b).size - statSync(a).size)[0] || null;
      if (!file) return failJob(job, 'Download finished but no file was produced');
      Object.assign(job, { status: 'completed', progress: 100, speed: null, eta: null, file, size: statSync(file).size, updatedAt: Date.now() });
    } else {
      failJob(job, lastLine(errTail) || (signal ? `terminated (${signal})` : `yt-dlp exited with ${code}`));
    }
    save(); pump();
  });
}

function failJob(job, msg) { Object.assign(job, { status: 'failed', error: String(msg).slice(0, 500), speed: null, eta: null, updatedAt: Date.now() }); save(); pump(); }

export function stopJob(job, status) {
  const child = hub.running.get(job.id);
  job.status = status; job.speed = null; job.eta = null; job.updatedAt = Date.now();
  if (child) child.kill('SIGTERM');
  save(); pump();
}

export function resumeJob(job) {
  if (!['paused', 'failed', 'canceled'].includes(job.status)) throw new HubError('Job is not resumable');
  job.status = 'queued'; job.error = null; job.updatedAt = Date.now(); save(); pump();
}

export function removeJob(job, deleteFiles) {
  if (hub.running.has(job.id)) stopJob(job, 'canceled');
  hub.jobs.delete(job.id);
  if (deleteFiles) {
    for (const p of [path.join(DIR(), 'downloads', job.id), transcriptPath(job.id)]) { try { rmSync(p, { recursive: true, force: true }); } catch { /* ignore */ } }
  }
  save();
}

/* ────────────────────────── file serving (signed links, Range) ────────────────────────── */

const sign = (id, userId, exp) => crypto.createHmac('sha256', SECRET).update(`${id}.${userId}.${exp}`).digest('hex').slice(0, 32);
export function fileToken(id, userId, ttlMs = 3600e3) { const exp = Date.now() + ttlMs; return `${exp}.${sign(id, userId, exp)}`; }
function verifyToken(id, userId, token) {
  const [exp, sig] = String(token || '').split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const want = sign(id, userId, exp);
  return sig.length === want.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want));
}

const MIME = { '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.opus': 'audio/ogg', '.wav': 'audio/wav', '.flac': 'audio/flac' };

function fileResponse(job, request, asDownload) {
  if (!job.file) throw new HubError('No file yet', 409);
  let real;
  try { real = realpathSync(job.file); } catch { throw new HubError('File no longer exists', 410); }
  const root = realpathSync(path.join(DIR(), 'downloads'));
  if (!real.startsWith(root + path.sep)) throw new HubError('Forbidden', 403);
  const size = statSync(real).size;
  const headers = { 'content-type': MIME[path.extname(real).toLowerCase()] || 'application/octet-stream', 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=3600' };
  if (asDownload) headers['content-disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(real))}`;
  const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '');
  let start = 0, end = size - 1, status = 200;
  if (m && (m[1] || m[2])) {
    if (m[1] === '') { start = Math.max(0, size - Number(m[2])); } else { start = Number(m[1]); if (m[2]) end = Math.min(end, Number(m[2])); }
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
    status = 206; headers['content-range'] = `bytes ${start}-${end}/${size}`;
  }
  headers['content-length'] = String(end - start + 1);
  return new Response(Readable.toWeb(createReadStream(real, { start, end })), { status, headers });
}

/* ────────────────────────── transcription ────────────────────────── */

const OPENAI = 'https://api.openai.com/v1';

function aiEndpoint(baseUrl) {
  const b = String(baseUrl || OPENAI).replace(/\/+$/, '');
  return b === OPENAI ? b : validateUrl(b, 'AI endpoint').replace(/\/+$/, '');
}

async function extractAudio(job, outPath, startSec) {
  const args = ['-y', '-v', 'error', '-i', job.file, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '32k'];
  if (startSec) args.splice(3, 0, '-ss', String(startSec));
  await run(FFMPEG(), [...args, outPath], { timeout: 30 * 60e3 });
}

async function probeDuration(file) {
  const out = await run(env('FFPROBE_PATH', 'ffprobe'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { timeout: 30000 }).catch(() => '');
  return parseFloat(out);
}

async function openaiTranscribe(filePath, { apiKey, baseUrl, model, language, diarize }) {
  const form = new FormData();
  form.append('file', new Blob([readFileSync(filePath)]), 'audio.mp3');
  form.append('model', model);
  if (language) form.append('language', language);
  if (diarize) { form.append('response_format', 'diarized_json'); form.append('chunking_strategy', 'auto'); }
  else { form.append('response_format', 'verbose_json'); form.append('timestamp_granularities[]', 'segment'); }
  const res = await fetch(`${aiEndpoint(baseUrl)}/audio/transcriptions`, { method: 'POST', headers: { authorization: `Bearer ${apiKey}` }, body: form, signal: AbortSignal.timeout(20 * 60e3) });
  const text = await res.text();
  if (!res.ok) throw new HubError(`Transcription failed (${res.status}): ${text.slice(0, 300)}`, 502);
  return JSON.parse(text);
}

async function localWhisper(filePath, { model = 'base', language }, workDir) {
  const args = [filePath, '--model', model, '--output_format', 'json', '--output_dir', workDir, '--fp16', 'False'];
  if (language) args.push('--language', language);
  await run(env('WHISPER_PATH', 'whisper'), args, { timeout: 2 * 3600e3 });
  return JSON.parse(readFileSync(path.join(workDir, `${path.basename(filePath, path.extname(filePath))}.json`), 'utf8'));
}

export function normalizeSegments(resp) {
  const segs = (resp.segments || []).map((s) => ({ start: Number(s.start) || 0, end: Number(s.end) || 0, text: String(s.text || '').trim(), ...(s.speaker ? { speaker: String(s.speaker) } : {}) }));
  return segs.filter((s) => s.text);
}

export async function transcribeJob(job, o = {}) {
  if (!job.file) throw new HubError('Download the file first', 409);
  if (job.transcribing) throw new HubError('Already transcribing', 409);
  const provider = o.provider === 'local' ? 'local' : 'openai';
  const diarize = provider === 'openai' && Boolean(o.diarize);
  const language = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(o.language || '') ? o.language : undefined;
  const apiKey = o.apiKey || env('MEDIA_HUB_AI_KEY', '') || env('OPENAI_API_KEY', '');
  if (provider === 'openai' && !apiKey) throw new HubError('No API key for transcription. Add one in Media Hub settings, or choose local Whisper.', 400);
  const model = o.model || (diarize ? 'gpt-4o-transcribe-diarize' : 'whisper-1');
  const workDir = path.join(DIR(), 'work', job.id);
  mkdirSync(workDir, { recursive: true });
  job.transcribing = true; job.error = null; save();
  try {
    const total = await probeDuration(job.file);
    const CHUNK = 20 * 60;
    const chunks = provider === 'openai' && total > CHUNK + 30 ? Math.ceil(total / CHUNK) : 1;
    let segments = [], language_ = language, text = [];
    for (let i = 0; i < chunks; i++) {
      const audio = path.join(workDir, `chunk-${i}.mp3`);
      const offset = i * CHUNK;
      await extractAudio(job, audio, offset);
      if (chunks > 1) {
        // trim to chunk length
        const trimmed = path.join(workDir, `chunk-${i}-t.mp3`);
        await run(FFMPEG(), ['-y', '-v', 'error', '-i', audio, '-t', String(CHUNK), '-c', 'copy', trimmed], { timeout: 120000 });
        renameSync(trimmed, audio);
      }
      const resp = provider === 'local'
        ? await localWhisper(audio, { model: o.model || 'base', language }, workDir)
        : await openaiTranscribe(audio, { apiKey, baseUrl: o.baseUrl, model, language, diarize });
      language_ ||= resp.language;
      segments.push(...normalizeSegments(resp).map((s) => ({ ...s, start: s.start + offset, end: s.end + offset })));
      text.push(resp.text || '');
      job.transcribeProgress = Math.round(((i + 1) / chunks) * 100);
    }
    const speakers = [...new Set(segments.map((s) => s.speaker).filter(Boolean))];
    const tr = { language: language_ || null, provider, model, diarized: speakers.length > 0, speakerNames: Object.fromEntries(speakers.map((s) => [s, s])), duration: Number.isFinite(total) ? total : null, segments, createdAt: Date.now() };
    writeFileSync(transcriptPath(job.id), JSON.stringify(tr));
    job.transcript = true; job.updatedAt = Date.now();
    return tr;
  } finally {
    job.transcribing = false; job.transcribeProgress = undefined;
    try { rmSync(workDir, { recursive: true, force: true }); } catch { /* ignore */ }
    save();
  }
}

export function renderTranscript(tr, format = 'txt') {
  const name = (s) => (s ? tr.speakerNames?.[s] || s : '');
  const segs = tr.segments || [];
  if (format === 'json') return JSON.stringify(tr, null, 2);
  if (format === 'srt') return segs.map((s, i) => `${i + 1}\n${fmtTime(s.start)} --> ${fmtTime(s.end)}\n${s.speaker ? `${name(s.speaker)}: ` : ''}${s.text}\n`).join('\n');
  if (format === 'vtt') return `WEBVTT\n\n${segs.map((s) => `${fmtTime(s.start, '.')} --> ${fmtTime(s.end, '.')}\n${s.speaker ? `<v ${name(s.speaker)}>` : ''}${s.text}\n`).join('\n')}`;
  if (format === 'md') {
    return segs.map((s) => `**${s.speaker ? `${name(s.speaker)} ` : ''}[${fmtTime(s.start, '.').slice(0, 8)}]** ${s.text}`).join('\n\n') + '\n';
  }
  return segs.map((s) => `${s.speaker ? `${name(s.speaker)}: ` : ''}${s.text}`).join('\n') + '\n';
}

/* ────────────────────────── AI (summarize / translate / chat) ────────────────────────── */

const LANGS = /^[A-Za-z][A-Za-z \-()]{1,40}$/;
const PROMPTS = {
  summarize: () => 'Summarize this transcript. Start with a 2-3 sentence overview, then list the key points as bullets. Mention timestamps like [mm:ss] for the most important moments.',
  keypoints: () => 'Extract the key takeaways as a concise bulleted list, each with the [mm:ss] timestamp where it occurs.',
  chapters: () => 'Split the transcript into chapters. Output one line per chapter: "[mm:ss] Title".',
  faq: () => 'Write an FAQ (6-10 questions with short answers) based only on the transcript.',
  cleanup: () => 'Rewrite the transcript with corrected grammar, punctuation and paragraphs. Remove filler words but do not change the meaning. Keep speaker labels if present.',
  translate: (lang) => `Translate the transcript into ${lang}. Keep speaker labels and [mm:ss] timestamps unchanged. Output only the translation.`,
  mindmap: () => 'Produce a mind map of the transcript as a nested markdown bullet list (max 3 levels).',
};

export function transcriptForPrompt(tr, maxChars = 120000) {
  const mm = (t) => fmtTime(t, '.').slice(3, 8);
  const lines = (tr.segments || []).map((s) => `[${mm(s.start)}] ${s.speaker ? `${tr.speakerNames?.[s.speaker] || s.speaker}: ` : ''}${s.text}`);
  let out = lines.join('\n');
  if (out.length > maxChars) out = `${out.slice(0, maxChars)}\n[transcript truncated]`;
  return out;
}

export async function runAi({ tr, action, lang, messages, provider = {} }) {
  const kind = provider.kind === 'anthropic' ? 'anthropic' : 'openai';
  const apiKey = provider.apiKey || env('MEDIA_HUB_AI_KEY', '') || (kind === 'openai' ? env('OPENAI_API_KEY', '') : '');
  if (!apiKey && !(kind === 'openai' && provider.baseUrl)) throw new HubError('No AI API key. Add a provider key in Media Hub settings.', 400);
  const model = provider.model || (kind === 'anthropic' ? 'claude-sonnet-5-5' : 'gpt-4o-mini');
  let system, convo;
  if (action === 'chat') {
    const history = Array.isArray(messages) ? messages.slice(-20).filter((m) => ['user', 'assistant'].includes(m?.role) && typeof m.content === 'string') : [];
    if (!history.length || history[history.length - 1].role !== 'user') throw new HubError('chat needs a user message');
    system = `You answer questions about a media transcript. Use only the transcript below; if the answer is not in it, say so. Cite timestamps like [mm:ss].\n\nTRANSCRIPT:\n${transcriptForPrompt(tr)}`;
    convo = history;
  } else {
    if (!PROMPTS[action]) throw new HubError('Unknown action');
    if (action === 'translate' && !LANGS.test(lang || '')) throw new HubError('Invalid target language');
    system = 'You are a precise assistant that processes media transcripts. Reply in markdown.';
    convo = [{ role: 'user', content: `${PROMPTS[action](lang)}\n\nTRANSCRIPT:\n${transcriptForPrompt(tr)}` }];
  }
  if (kind === 'anthropic') {
    const base = provider.baseUrl ? aiEndpoint(provider.baseUrl) : 'https://api.anthropic.com';
    const res = await fetch(`${base}/v1/messages`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: 4096, system, messages: convo }), signal: AbortSignal.timeout(180000) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new HubError(`AI request failed (${res.status}): ${body?.error?.message || 'error'}`, 502);
    return (body.content || []).map((c) => c.text || '').join('');
  }
  const res = await fetch(`${aiEndpoint(provider.baseUrl)}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) }, body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, ...convo] }), signal: AbortSignal.timeout(180000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new HubError(`AI request failed (${res.status}): ${body?.error?.message || 'error'}`, 502);
  return body.choices?.[0]?.message?.content || '';
}

/* ────────────────────────── HTTP router ────────────────────────── */

const readBody = async (request) => { try { return await request.json(); } catch { return {}; } };

/**
 * @param {Request} request
 * @param {{ userId: string|null, base: string }} ctx  base = mount path, e.g. "/api/media-hub"
 */
export async function handleMediaHub(request, { userId, base }) {
  try {
    const url = new URL(request.url);
    const rel = url.pathname.slice(base.length).replace(/^\/+|\/+$/g, '');
    const parts = rel ? rel.split('/').map(decodeURIComponent) : [];
    const method = request.method.toUpperCase();
    load();

    // Signed file links are the only unauthenticated path (used by <video src> / <a href>).
    if (method === 'GET' && parts[0] === 'file' && parts[1]) {
      const job = hub.jobs.get(parts[1]);
      if (!job || !verifyToken(job.id, job.userId, url.searchParams.get('t'))) throw new HubError('Invalid or expired link', 403);
      return fileResponse(job, request, url.searchParams.get('download') === '1');
    }
    if (!userId) throw new HubError('Sign in required', 401);

    if (method === 'GET' && parts[0] === 'status') return json(await getStatus(url.searchParams.get('refresh') === '1'));
    if (method === 'POST' && parts[0] === 'info') return json(await getInfo((await readBody(request)).url));

    if (parts[0] === 'jobs') {
      if (!parts[1]) {
        if (method === 'GET') return json({ jobs: [...hub.jobs.values()].filter((j) => j.userId === userId).sort((a, b) => b.createdAt - a.createdAt).map(publicJob) });
        if (method === 'POST') {
          const b = await readBody(request);
          const urls = (Array.isArray(b.urls) ? b.urls : [b.url]).filter(Boolean).slice(0, 50);
          if (!urls.length) throw new HubError('url required');
          const mine = [...hub.jobs.values()].filter((j) => j.userId === userId && ['queued', 'downloading', 'processing'].includes(j.status)).length;
          if (mine + urls.length > 100) throw new HubError('Too many active downloads', 429);
          return json({ jobs: urls.map((u) => publicJob(createJob(userId, u, b.options))) }, 201);
        }
      } else {
        const job = getJob(parts[1], userId);
        const act = parts[2];
        if (!act && method === 'GET') return json({ job: publicJob(job) });
        if (!act && method === 'DELETE') { removeJob(job, url.searchParams.get('files') === '1'); return json({ ok: true }); }
        if (act === 'pause' && method === 'POST') { stopJob(job, 'paused'); return json({ job: publicJob(job) }); }
        if (act === 'cancel' && method === 'POST') { stopJob(job, 'canceled'); return json({ job: publicJob(job) }); }
        if (act === 'resume' && method === 'POST') { resumeJob(job); return json({ job: publicJob(job) }); }
        if (act === 'link' && method === 'GET') {
          if (!job.file) throw new HubError('No file yet', 409);
          const t = fileToken(job.id, userId);
          const p = `${base}/file/${job.id}?t=${t}`;
          return json({ url: p, downloadUrl: `${p}&download=1`, filename: path.basename(job.file) });
        }
        if (act === 'transcribe' && method === 'POST') { const tr = await transcribeJob(job, await readBody(request)); return json({ transcript: tr }); }
        if (act === 'transcript') {
          const tr = readTranscript(job.id);
          if (!tr) throw new HubError('No transcript', 404);
          if (method === 'GET') {
            const fmt = url.searchParams.get('format');
            if (!fmt) return json({ transcript: tr });
            if (!['txt', 'md', 'srt', 'vtt', 'json'].includes(fmt)) throw new HubError('Bad format');
            const ext = fmt === 'md' ? 'md' : fmt;
            return new Response(renderTranscript(tr, fmt), { headers: { 'content-type': 'text/plain; charset=utf-8', 'content-disposition': `attachment; filename="transcript-${job.id.slice(0, 8)}.${ext}"` } });
          }
          if (method === 'PUT') {
            const b = await readBody(request);
            const names = {};
            for (const [k, v] of Object.entries(b.speakerNames || {})) if (k in (tr.speakerNames || {})) names[k] = String(v).slice(0, 60) || k;
            tr.speakerNames = { ...tr.speakerNames, ...names };
            writeFileSync(transcriptPath(job.id), JSON.stringify(tr));
            return json({ transcript: tr });
          }
        }
        if (act === 'ai' && method === 'POST') {
          const tr = readTranscript(job.id);
          if (!tr) throw new HubError('Transcribe first', 409);
          const b = await readBody(request);
          return json({ text: await runAi({ tr, action: b.action, lang: b.lang, messages: b.messages, provider: b.provider }) });
        }
      }
    }
    throw new HubError('Not found', 404);
  } catch (e) {
    const status = e instanceof HubError ? e.status : 500;
    if (!(e instanceof HubError)) console.error('[media-hub]', e);
    return json({ error: e instanceof HubError ? e.message : 'Internal error' }, status);
  }
}
