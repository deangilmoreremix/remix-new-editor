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

/**
 * Lip-sync every voiced contact. Failures don't stop the rest: those contacts keep the plain
 * intro with their voiced greeting.
 * @param o.lipSync({ video_url, audio_url, signal }) → Promise<{ url }>
 * @param o.upload(File) → Promise<url>
 * @returns {{ introUrl, seconds, clips: { [contactId]: url }, failed: string[] }}
 */
export async function lipsyncContacts({ draft, variants, upload, lipSync, signal, onProgress, deps = {} }) {
  const cut = deps.cutIntro || cutIntro;
  const pad = deps.padAudio || padAudio;
  const seconds = introSeconds(draft, variants);
  const introUrl = await upload(new File([await cut(draft.video.url, seconds)], 'greeting-intro.mp4', { type: 'video/mp4' }));
  const jobs = lipsyncJobs(variants);
  const clips = {};
  const failed = [];
  for (let i = 0; i < jobs.length; i += 1) {
    if (signal?.aborted) throw Object.assign(new Error('Stopped'), { name: 'AbortError' });
    onProgress?.({ done: i, total: jobs.length });
    const job = jobs[i];
    try {
      const audioUrl = await upload(new File([await pad(job.audioUrl, seconds)], 'greeting-padded.wav', { type: 'audio/wav' }));
      const out = await lipSync({ video_url: introUrl, audio_url: audioUrl, signal });
      if (!out?.url) throw new Error('No video came back');
      job.contactIds.forEach((cid) => { clips[cid] = out.url; });
    } catch (err) {
      if (signal?.aborted || err?.name === 'AbortError') throw Object.assign(new Error('Stopped'), { name: 'AbortError' });
      failed.push(...job.contactIds);
    }
  }
  onProgress?.({ done: jobs.length, total: jobs.length });
  return { introUrl, seconds, clips, failed };
}
