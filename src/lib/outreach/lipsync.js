// src/lib/outreach/lipsync.js
//
// Optional lip-sync for the greeting: your mouth says each contact's name. The greeting part of
// the recording is cut out once; each contact's greeting audio is padded to the same length and
// lip-synced onto it with a MuAPI lip-sync model (one paid request per distinct greeting). The
// campaign then plays that contact's synced intro (clip.aiPerContact, the per-contact video the
// published player already supports) with the greeting audio on top, so lips and voice match.

export const LIPSYNC_MODEL = 'sync-lipsync';

/** Length of the intro window: the longest greeting plus a short tail, within the recording. */
export function introSeconds(draft, variants = {}) {
  const longest = Math.max(
    Number(draft.voice?.fallbackDuration) || 0,
    ...Object.values(variants).map((v) => Number(v?.duration) || 0),
  );
  const video = Number(draft.video?.duration) || 0;
  const s = Math.max(1, Math.ceil((longest + 0.4) * 10) / 10);
  return video ? Math.min(s, Math.max(1, video - 0.5)) : s;
}

/** One lip-sync job per distinct greeting audio. → [{ audioUrl, contactIds }] */
export function lipsyncJobs(variants = {}) {
  const byUrl = new Map();
  for (const [cid, v] of Object.entries(variants)) {
    if (!v?.url) continue;
    if (!byUrl.has(v.url)) byUrl.set(v.url, []);
    byUrl.get(v.url).push(cid);
  }
  return [...byUrl].map(([audioUrl, contactIds]) => ({ audioUrl, contactIds }));
}

/** Samples padded (or cut) with silence to exactly `seconds`. */
export function padSamples(samples, sampleRate, seconds) {
  const out = new Float32Array(Math.round(seconds * sampleRate));
  out.set(samples.subarray(0, out.length));
  return out;
}

/** The first `seconds` of a video as MP4 (mediabunny, in the browser). */
export async function cutIntro(videoUrl, seconds) {
  const { Input, Output, Conversion, ALL_FORMATS, UrlSource, BufferTarget, Mp4OutputFormat } = await import('mediabunny');
  const input = new Input({ formats: ALL_FORMATS, source: new UrlSource(videoUrl) });
  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  const conversion = await Conversion.init({ input, output, trim: { start: 0, end: seconds } });
  if (!conversion.isValid) throw new Error('This browser cannot cut the greeting out of your video.');
  await conversion.execute();
  return new Blob([output.target.buffer], { type: 'video/mp4' });
}

/** A greeting's audio padded with silence to `seconds`, as WAV. */
export async function padAudio(url, seconds) {
  const { mixToMono, encodeWavBuffer } = await import('./voiceSample.js');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load a greeting (HTTP ${res.status}).`);
  const Ctx = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  const ctx = new Ctx(1, 1, 24000);
  const audio = await ctx.decodeAudioData(await res.arrayBuffer());
  const samples = padSamples(mixToMono(audio), audio.sampleRate, seconds);
  return new Blob([encodeWavBuffer(samples, audio.sampleRate)], { type: 'audio/wav' });
}

/** When you start speaking: the end of the silence at the very start of the recording (0 if there is none). */
export function speechStart(silences = []) {
  const first = [...silences].sort((a, b) => a.start - b.start)[0];
  return first && first.start <= 0.15 ? first.end : 0;
}

/**
 * A warning when the greeting window runs into your first words: the lip-synced intro replaces the start of the
 * recording (muted, the greeting plays there), so words said inside it are not heard. null when the pause is long enough.
 */
export function pauseWarning(seconds, start) {
  if (!(start >= 0) || seconds <= start + 0.15) return null;
  return `Your video's opening pause is ${start.toFixed(1)}s, but the longest greeting needs ${seconds.toFixed(1)}s: the first ${(seconds - start).toFixed(1)}s of what you say after the pause won't be heard on lip-synced videos. Re-record with a longer pause, or shorten the greeting.`;
}

export const JOB_TIMEOUT_MS = 6 * 60 * 1000;
export const CONCURRENCY = 3;

const stopped = () => Object.assign(new Error('Stopped'), { name: 'AbortError' });

/** A signal that fires when `outer` does or after `ms`; `.done()` clears the timer. */
function jobSignal(outer, ms) {
  const ctrl = new AbortController();
  const onOuter = () => ctrl.abort(outer.reason);
  if (outer?.aborted) ctrl.abort(outer.reason); else outer?.addEventListener?.('abort', onOuter, { once: true });
  const timer = setTimeout(() => ctrl.abort(Object.assign(new Error('Lip-sync took too long'), { name: 'TimeoutError' })), ms);
  ctrl.signal.done = () => { clearTimeout(timer); outer?.removeEventListener?.('abort', onOuter); };
  return ctrl.signal;
}

/** Saved lip-sync results are keyed by the recording, the window and the greeting audio. */
export const introKey = (videoUrl, seconds) => `intro|${videoUrl}|${seconds}`;
export const clipKey = (videoUrl, seconds, audioUrl) => `clip|${videoUrl}|${seconds}|${audioUrl}`;

/** Download a finished clip and store it with us, so the link never depends on MuAPI's storage. */
export async function copyClip(url, upload, { fetchImpl = fetch, signal } = {}) {
  const res = await fetchImpl(url, { signal });
  if (!res.ok) throw new Error(`Could not download the lip-synced clip (HTTP ${res.status}).`);
  const blob = await res.blob();
  return upload(new File([blob], 'greeting-lipsync.mp4', { type: blob.type || 'video/mp4' }));
}

/** How many paid lip-sync requests a Generate would make (greetings already synced are reused). */
export function paidJobCount(draft, variants, cache = {}) {
  const seconds = introSeconds(draft, variants);
  return lipsyncJobs(variants).filter((j) => !cache[clipKey(draft.video?.url, seconds, j.audioUrl)]).length;
}

/**
 * Lip-sync every voiced contact. Failures don't stop the rest: those contacts keep the plain
 * intro with their voiced greeting (their reason is in `errors`). Up to CONCURRENCY jobs run at
 * once, each with its own time limit. Results already in `cache` are reused for free; new ones
 * are added to it (the caller saves it with the draft).
 * @param o.lipSync({ video_url, audio_url, signal }) → Promise<{ url }>
 * @param o.upload(File) → Promise<url>
 * @param o.deps.renderIntro(videoUrl, seconds) → Promise<Blob>  used when the quick cut fails
 * @returns {{ introUrl, seconds, clips: { [contactId]: url }, failed: string[], errors: { [contactId]: string }, error?: string, paid: number }}
 */
export async function lipsyncContacts({ draft, variants, upload, lipSync, signal, onProgress, cache = {}, concurrency = CONCURRENCY, timeoutMs = JOB_TIMEOUT_MS, deps = {} }) {
  const cut = deps.cutIntro || cutIntro;
  const pad = deps.padAudio || padAudio;
  const copy = deps.copyClip || ((url, s) => copyClip(url, upload, { signal: s }));
  const videoUrl = draft.video.url;
  const seconds = introSeconds(draft, variants);
  const jobs = lipsyncJobs(variants);
  const all = jobs.flatMap((j) => j.contactIds);
  const clips = {};
  const errors = {};

  // The greeting window of the recording: the quick in-browser cut, else a full render (H.264 MP4).
  let introUrl = cache[introKey(videoUrl, seconds)] || '';
  if (!introUrl) {
    let blob = null;
    let why = '';
    try { blob = await cut(videoUrl, seconds); } catch (err) { if (signal?.aborted) throw stopped(); why = err?.message || String(err); }
    if (!blob && deps.renderIntro) {
      try { blob = await deps.renderIntro(videoUrl, seconds); } catch (err) { if (signal?.aborted) throw stopped(); why = err?.message || String(err); }
    }
    if (!blob) {
      const error = `Lip-sync was skipped: the greeting could not be cut out of your video (${why || 'unknown reason'}).`;
      all.forEach((cid) => { errors[cid] = 'The greeting could not be cut out of your video'; });
      return { introUrl: '', seconds, clips, failed: all, errors, error, paid: 0 };
    }
    introUrl = await upload(new File([blob], 'greeting-intro.mp4', { type: 'video/mp4' }));
    cache[introKey(videoUrl, seconds)] = introUrl;
  }

  let done = 0;
  let paid = 0;
  onProgress?.({ done, total: jobs.length });
  const runJob = async (job) => {
    const key = clipKey(videoUrl, seconds, job.audioUrl);
    let url = cache[key];
    if (!url) {
      const s = jobSignal(signal, timeoutMs);
      try {
        const audioUrl = await upload(new File([await pad(job.audioUrl, seconds)], 'greeting-padded.wav', { type: 'audio/wav' }));
        paid += 1;
        const out = await lipSync({ video_url: introUrl, audio_url: audioUrl, signal: s });
        if (!out?.url) throw new Error('No video came back');
        // Keep our own copy; if that fails, MuAPI's link still works for now.
        url = await copy(out.url, s).catch(() => out.url);
        cache[key] = url;
      } catch (err) {
        if (signal?.aborted) throw stopped();
        const why = s.aborted && s.reason?.name === 'TimeoutError' ? 'Lip-sync took too long' : (err?.message || 'Lip-sync failed');
        job.contactIds.forEach((cid) => { errors[cid] = why; });
      } finally { s.done(); }
    }
    if (url) job.contactIds.forEach((cid) => { clips[cid] = url; });
    done += 1;
    onProgress?.({ done, total: jobs.length });
  };
  const queue = [...jobs];
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) }, async () => {
    while (queue.length) {
      if (signal?.aborted) throw stopped();
      await runJob(queue.shift());
    }
  });
  await Promise.all(workers);
  const failed = all.filter((cid) => !clips[cid]);
  return { introUrl, seconds, clips, failed, errors, paid };
}
