// Audio settings for the recorder: the browser's voice clean-up switches, a live microphone level
// meter, mixing the computer's sound with the microphone (screen recordings), and a short mic test.

export const AUDIO_DEFAULTS = Object.freeze({
  noiseSuppression: true,   // removes steady background noise (fans, hum)
  echoCancellation: true,   // stops speaker sound coming back through the mic
  autoGainControl: true,    // evens out loud and quiet speech
  systemAudio: false,       // screen recordings: include the sound of the shared tab or screen
  voiceLeveler: false,      // gate, level and limit the voice while recording (an AudioWorklet; the take is recorded as usual if it cannot run)
});

const KEY = 'recorder-audio-settings';

export function loadAudioSettings(storage = globalThis.localStorage) {
  try { return { ...AUDIO_DEFAULTS, ...pick(JSON.parse(storage?.getItem(KEY) || '{}')) }; } catch { return { ...AUDIO_DEFAULTS }; }
}

export function saveAudioSettings(settings, storage = globalThis.localStorage) {
  try { storage?.setItem(KEY, JSON.stringify(pick(settings))); } catch { /* private mode */ }
}

function pick(s) {
  const out = {};
  for (const k of Object.keys(AUDIO_DEFAULTS)) if (typeof s?.[k] === 'boolean') out[k] = s[k];
  return out;
}

/** Loudness 0..1 from an analyser's time-domain bytes (128 = silence), scaled so normal speech fills most of the bar. */
export function levelFromSamples(bytes) {
  if (!bytes?.length) return 0;
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) { const v = (bytes[i] - 128) / 128; sum += v * v; }
  return Math.min(1, Math.sqrt(sum / bytes.length) * 4);
}

/** True when the sound hits the top or bottom of the range: it is distorting (clipping). */
export function clipsInSamples(bytes) {
  if (!bytes?.length) return false;
  for (let i = 0; i < bytes.length; i++) if (bytes[i] <= 1 || bytes[i] >= 254) return true;
  return false;
}

/** Words for a level, shown next to the meter. Too loud means the sound actually distorted recently. */
export function levelHint(peak, clipped = false) {
  if (clipped) return 'Too loud: move back a little or lower the mic volume';
  if (peak < 0.04) return 'No sound: check the microphone';
  return '';
}

/**
 * Live level of a stream's microphone. onLevel(level, peak, clipped) about 20 times a second; returns stop().
 * peak is the loudest level and clipped whether it distorted, over the last ~2 s, so a hint does not flicker.
 */
export function createLevelMeter(stream, onLevel, { AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext, every = 50 } = {}) {
  const track = stream?.getAudioTracks?.()[0];
  if (!AudioCtx || !track) return () => {};
  let ctx;
  try { ctx = new AudioCtx(); } catch { return () => {}; }
  const source = ctx.createMediaStreamSource(new globalThis.MediaStream([track]));
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const buf = new Uint8Array(analyser.fftSize);
  const recent = [];
  const clips = [];
  const timer = setInterval(() => {
    analyser.getByteTimeDomainData(buf);
    const level = levelFromSamples(buf);
    recent.push(level);
    clips.push(clipsInSamples(buf));
    if (recent.length > 2000 / every) { recent.shift(); clips.shift(); }
    onLevel(level, Math.max(...recent), clips.includes(true));
  }, every);
  ctx.resume?.().catch(() => {});
  return () => {
    clearInterval(timer);
    try { source.disconnect(); } catch { /* gone */ }
    ctx.close?.().catch(() => {});
  };
}

/** One audio track from several (MediaRecorder only records the first audio track it is given). */
export function mixAudioTracks(tracks, { AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
  const live = tracks.filter(Boolean);
  if (live.length < 2 || !AudioCtx) return { track: live[0] || null, stop: () => {} };
  const ctx = new AudioCtx();
  const dest = ctx.createMediaStreamDestination();
  const sources = live.map((t) => { const s = ctx.createMediaStreamSource(new globalThis.MediaStream([t])); s.connect(dest); return s; });
  ctx.resume?.().catch(() => {});
  return {
    track: dest.stream.getAudioTracks()[0],
    stop: () => { sources.forEach((s) => { try { s.disconnect(); } catch { /* gone */ } }); ctx.close?.().catch(() => {}); },
  };
}

/** Record a few seconds from the microphone and give back the clip, to hear how you sound. */
export function recordMicTest(stream, ms = 4000, { Recorder = globalThis.MediaRecorder } = {}) {
  return new Promise((resolve, reject) => {
    let rec;
    try { rec = new Recorder(new globalThis.MediaStream(stream.getAudioTracks())); } catch (err) { reject(err); return; }
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
    rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
    rec.onerror = (e) => reject(e.error || new Error('The microphone test failed.'));
    rec.start();
    setTimeout(() => { if (rec.state !== 'inactive') rec.stop(); }, ms);
  });
}
