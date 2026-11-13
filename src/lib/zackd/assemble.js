/* global DOMException */
// Zack D studio: final-cut assembly in the browser (ffmpeg.wasm).
// Port of scripts/assemble.py from https://github.com/Anil-matcha/zack-d-films-ai-video-generator (MIT).
// The plan/filter-graph/SRT builders are pure and unit-tested; runAssembly() needs a browser.

export const CANVAS_W = 720;
export const CANVAS_H = 1280;
export const FPS = 30;
export const DEFAULT_TRANSITION_SEC = 0.35;
export const TRANSITIONS = ['fade', 'wipeleft', 'slideleft', 'circleopen'];
export const MUSIC_VOLUME = 0.126; // about -18 dB under narration
const FFMPEG_CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

// Same number formatting as upstream's _escape_filter_number (6 decimals, trailing zeros stripped).
const num = (n) => Number(n).toFixed(6).replace(/0+$/, '').replace(/\.$/, '');

export const CLIP_VOLUME_UNDER_NARRATION = 0.25; // extension: about -12 dB, so the Veo sound sits under a mixed-in voice

/** Level for the clips' own audio. Upstream never touches it (full level); we only lower it under a mixed-in narration. */
export const clipVolumeFor = (hasNarration) => (hasNarration ? CLIP_VOLUME_UNDER_NARRATION : 1);

/**
 * Port of upstream assemble.py `_build_filter_graph` (+ its input layout). With the defaults the graph is
 * character-for-character what upstream builds; the parity test pins that against recorded upstream output.
 *
 * @param {{ duration: number, zoom?: boolean, hasAudio?: boolean }[]} shots  in order; `duration` is the clip's REAL length
 *   (upstream ffprobes each clip), `hasAudio === false` gets a silent lavfi input after it, as upstream does
 * @param {{ transition?: number, clipAudio?: boolean, hasNarration?: boolean, hasMusic?: boolean, clipVolume?: number }} opts
 *   hasNarration/hasMusic are OUR extension (upstream never mixes them): appended after the upstream graph.
 * @returns {{ filterComplex: string, total: number, audioLabel: string|null, inputs: object[], inputCount: number }}
 *   `inputs` lists ffmpeg inputs in order: { type: 'clip'|'silence'|'narration'|'music', shot?, duration? }
 */
export function buildAssemblyPlan(shots, { transition = DEFAULT_TRANSITION_SEC, clipAudio = true, hasNarration = false, hasMusic = false, clipVolume } = {}) {
  if (!Array.isArray(shots) || !shots.length) throw new Error('No clips to assemble.');
  shots.forEach((s, i) => { if (!(s.duration > 0)) throw new Error(`Clip ${i + 1} has no usable duration.`); });
  const td = Math.max(0, Number(transition) || 0);

  const inputs = [];
  const idx = shots.map((s, i) => {
    const video = inputs.length;
    inputs.push({ type: 'clip', shot: i });
    let audio = video;
    if (clipAudio && s.hasAudio === false) { audio = inputs.length; inputs.push({ type: 'silence', duration: s.duration }); }
    return { video, audio };
  });

  const f = [];
  const vLabels = [];
  const aLabels = [];
  shots.forEach((s, i) => {
    const d = num(s.duration);
    let v = `[${idx[i].video}:v]trim=duration=${d},setpts=PTS-STARTPTS,fps=${FPS},`
      + `scale=${CANVAS_W}:${CANVAS_H}:force_original_aspect_ratio=increase,crop=${CANVAS_W}:${CANVAS_H},setsar=1,settb=AVTB`;
    if (s.zoom) v += `,scale=${CANVAS_W + 36}:${CANVAS_H + 64}:flags=lanczos,crop=${CANVAS_W}:${CANVAS_H}:(iw-${CANVAS_W})/2:(ih-${CANVAS_H})/2`;
    v += ',format=yuv420p';
    f.push(`${v}[v${vLabels.length}]`);
    vLabels.push(`v${vLabels.length}`);
    if (clipAudio) {
      f.push(`[${idx[i].audio}:a]atrim=duration=${d},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a${aLabels.length}]`);
      aLabels.push(`a${aLabels.length}`);
    }
  });

  let total;
  if (vLabels.length === 1) { f.push(`[${vLabels[0]}]null[vout]`); total = shots[0].duration; }
  else if (td <= 0) { f.push(`${vLabels.map((l) => `[${l}]`).join('')}concat=n=${vLabels.length}:v=1:a=0[vout]`); total = shots.reduce((n, x) => n + x.duration, 0); }
  else {
    let prev = vLabels[0];
    let timeline = shots[0].duration;
    for (let i = 1; i < vLabels.length; i += 1) {
      const d = Math.min(td, shots[i].duration, timeline);
      const out = `vx${i}`;
      f.push(`[${prev}][${vLabels[i]}]xfade=transition=${TRANSITIONS[(i - 1) % TRANSITIONS.length]}:duration=${num(d)}:offset=${num(timeline - d)}[${out}]`);
      prev = out;
      timeline += shots[i].duration - d;
    }
    f.push(`[${prev}]null[vout]`);
    total = timeline;
  }

  if (clipAudio) {
    if (aLabels.length === 1) f.push(`[${aLabels[0]}]anull[aout]`);
    else if (td <= 0) f.push(`${aLabels.map((l) => `[${l}]`).join('')}concat=n=${aLabels.length}:v=0:a=1[aout]`);
    else {
      let prev = aLabels[0];
      for (let i = 1; i < aLabels.length; i += 1) {
        const d = Math.min(td, shots[i - 1].duration, shots[i].duration);
        f.push(`[${prev}][${aLabels[i]}]acrossfade=d=${num(d)}:c1=tri:c2=tri[ax${i}]`);
        prev = `ax${i}`;
      }
      f.push(`[${prev}]anull[aout]`);
    }
  }

  // Extension (not upstream): mix the generated narration / music into the cut.
  const sources = [];
  let audioLabel = clipAudio ? 'aout' : null;
  if (hasNarration || hasMusic) {
    if (clipAudio) { f.push(`[aout]volume=${num(clipVolume ?? clipVolumeFor(hasNarration))}[clipaudio]`); sources.push('clipaudio'); }
    if (hasNarration) {
      f.push(`[${inputs.length}:a]highpass=f=80,lowpass=f=8000,volume=1.2,aresample=48000[nar]`);
      inputs.push({ type: 'narration' }); sources.push('nar');
    }
    if (hasMusic) {
      f.push(`[${inputs.length}:a]aresample=48000,volume=${MUSIC_VOLUME},afade=t=out:st=${num(Math.max(0, total - 1))}:d=1[bgm]`);
      inputs.push({ type: 'music' }); sources.push('bgm');
    }
    audioLabel = sources[0];
    if (sources.length > 1) { f.push(`${sources.map((l) => `[${l}]`).join('')}amix=inputs=${sources.length}:duration=longest:normalize=0[aout2]`); audioLabel = 'aout2'; }
  }
  return { filterComplex: f.join(';'), total, audioLabel, inputs, inputCount: inputs.length };
}

/** Evenly spread each beat's words over its shots' on-screen window → SRT text. */
/** `durations` (optional) = the real per-shot lengths of the rendered cut, in shot order; falls back to the planned ones. */
export function buildSrt(beats, { transition = DEFAULT_TRANSITION_SEC, durations = null } = {}) {
  const td = Number(transition) || 0;
  const lenOf = (s, k) => (Array.isArray(durations) && Number.isFinite(durations[k]) ? durations[k] : s.duration_sec);
  const ts = (sec) => {
    const ms = Math.max(0, Math.round(sec * 1000));
    const p = (v, l = 2) => String(v).padStart(l, '0');
    return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
  };
  // A shot k (global, 0-based) starts at sum(previous durations) - k * td, matching the xfade offsets.
  let shotIndex = 0;
  let cursor = 0; // sum of durations of shots placed so far
  let idx = 0;
  let prevEnd = 0;
  const out = [];
  (beats || []).forEach((b) => {
    const startOf = (k, before) => before - k * td;
    // never start before the previous beat's captions end (overlapping cues would stack on screen)
    const beatStart = Math.max(startOf(shotIndex, cursor), prevEnd);
    let beatEnd = beatStart;
    b.shots.forEach((s) => {
      const st = startOf(shotIndex, cursor);
      const len = lenOf(s, shotIndex);
      beatEnd = st + len;
      cursor += len;
      shotIndex += 1;
    });
    beatEnd = Math.max(beatEnd, beatStart + 0.1);
    prevEnd = beatEnd;
    const dur = beatEnd - beatStart;
    const words = String(b.narration || '').split(/\s+/).filter(Boolean);
    const chunks = [];
    for (let i = 0; i < words.length; i += 6) chunks.push(words.slice(i, i + 6).join(' '));
    chunks.forEach((c, i) => {
      idx += 1;
      out.push(`${idx}\n${ts(beatStart + (dur * i) / chunks.length)} --> ${ts(beatStart + (dur * (i + 1)) / chunks.length)}\n${c}\n`);
    });
  });
  return out.join('\n');
}

const ENCODER_LOAD_TIMEOUT_MS = 90_000;

/** Reject with `message` if `promise` has not settled after `ms` (a stuck encoder load must not spin forever). */
export function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function fetchBytes(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Could not download ${url.slice(0, 60)}… (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Probe a clip's audio stream and real duration. ffmpeg.wasm ships no ffprobe, so read them from the `-i` logs. */
async function probeClip(ff, name) {
  const lines = [];
  const onLog = ({ message }) => lines.push(message);
  ff.on('log', onLog);
  try { await ff.exec(['-hide_banner', '-i', name]); } catch { /* -i without an output exits non-zero by design */ } finally { ff.off('log', onLog); }
  const m = lines.join('\n').match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return {
    hasAudio: lines.some((l) => /Stream #\d+:\d+.*Audio:/.test(l)),
    duration: m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null,
  };
}

/**
 * Assemble the clips into one 9:16 MP4 Blob the way upstream assemble.py does: each clip at its REAL length, every
 * clip's own audio kept (silence for clips without), joined with the same transitions.
 * @param {{ url: string, planned?: number, zoom?: boolean }[]} clips  `planned` = the beat map's shot length (2-4 s)
 * @param {{ keepClipAudio?: boolean, mixVoice?: boolean, trimToPlanned?: boolean }} extras
 *   mixVoice (narration/music into the cut) and trimToPlanned (cut each clip to `planned`) are OUR extensions
 */
export async function runAssembly({ clips, narrationUrl, musicUrl, keepClipAudio = true, mixVoice = false, trimToPlanned = false, transition = DEFAULT_TRANSITION_SEC, onProgress, signal }) {
  const [{ FFmpeg }, { toBlobURL }] = await Promise.all([import('@ffmpeg/ffmpeg'), import('@ffmpeg/util')]);
  const ff = new FFmpeg();
  const onAbort = () => { try { ff.terminate(); } catch { /* already gone */ } };
  if (signal?.aborted) { throw new DOMException('Aborted', 'AbortError'); }
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    ff.on('progress', ({ progress }) => onProgress?.('encode', Math.min(1, Math.max(0, progress))));
    onProgress?.('load', 0);
    await withTimeout((async () => {
      await ff.load({
        coreURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
      });
    })(), ENCODER_LOAD_TIMEOUT_MS, 'The video encoder could not be loaded. Check your connection and try again.');

    const shots = [];
    for (let i = 0; i < clips.length; i += 1) {
      onProgress?.('download', i / clips.length);
      await ff.writeFile(`clip${i}.mp4`, await fetchBytes(clips[i].url, signal));
      const info = await probeClip(ff, `clip${i}.mp4`);
      const real = info.duration ?? clips[i].planned ?? 3;
      const duration = trimToPlanned && clips[i].planned ? Math.min(real, clips[i].planned) : real;
      shots.push({ duration, zoom: !!clips[i].zoom, hasAudio: info.hasAudio });
    }
    const hasNarration = !!(mixVoice && narrationUrl);
    const hasMusic = !!(mixVoice && musicUrl);
    if (hasNarration) await ff.writeFile('narration.mp3', await fetchBytes(narrationUrl, signal));
    if (hasMusic) await ff.writeFile('bgm.mp3', await fetchBytes(musicUrl, signal));
    const plan = buildAssemblyPlan(shots, { transition, clipAudio: keepClipAudio, hasNarration, hasMusic });

    const args = [];
    for (const input of plan.inputs) {
      if (input.type === 'clip') args.push('-i', `clip${input.shot}.mp4`);
      else if (input.type === 'silence') args.push('-f', 'lavfi', '-t', num(input.duration), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');
      else if (input.type === 'narration') args.push('-i', 'narration.mp3');
      else args.push('-i', 'bgm.mp3');
    }
    args.push('-filter_complex', plan.filterComplex, '-map', '[vout]');
    if (plan.audioLabel) args.push('-map', `[${plan.audioLabel}]`);
    // Upstream passes -shortest; a mixed-in voice may be longer than the picture, so cap at the picture length then.
    if (hasNarration || hasMusic) args.push('-t', num(plan.total)); else args.push('-shortest');
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p');
    if (plan.audioLabel) args.push('-c:a', 'aac', '-b:a', '96k');
    args.push('-movflags', '+faststart', 'final.mp4');

    const code = await ff.exec(args);
    if (code !== 0) throw new Error('The video encoder failed. Try fewer or shorter clips.');
    const data = await ff.readFile('final.mp4');
    return { blob: new Blob([data], { type: 'video/mp4' }), duration: plan.total, durations: shots.map((x) => x.duration), hasAudio: !!plan.audioLabel };
  } catch (e) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError'); // terminating the worker rejects exec with an unrelated error
    throw e;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    try { ff.terminate(); } catch { /* already terminated */ }
  }
}
