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

const num = (n) => Number(n.toFixed(4)).toString();

/**
 * @param {{ duration: number, zoom: boolean }[]} shots  clip order; duration in seconds (> transition)
 * @param {{ transition?: number, hasNarration?: boolean, hasMusic?: boolean }} opts
 * @returns {{ filterComplex: string, total: number, audioLabel: string|null, inputCount: number }}
 *   Inputs: 0..N-1 clips, then narration (if any), then music (if any).
 */
export function buildAssemblyPlan(shots, { transition = DEFAULT_TRANSITION_SEC, hasNarration = false, hasMusic = false } = {}) {
  if (!Array.isArray(shots) || !shots.length) throw new Error('No clips to assemble.');
  const td = shots.length > 1 ? Math.max(0, Number(transition) || 0) : 0;
  shots.forEach((s, i) => {
    if (!(s.duration > td)) throw new Error(`Clip ${i + 1} is too short for the transition.`);
  });

  const f = [];
  shots.forEach((s, i) => {
    let v = `[${i}:v]trim=duration=${num(s.duration)},setpts=PTS-STARTPTS,fps=${FPS},`
      + `scale=${CANVAS_W}:${CANVAS_H}:force_original_aspect_ratio=increase,crop=${CANVAS_W}:${CANVAS_H},setsar=1,settb=AVTB`;
    if (s.zoom) {
      // subtle centered punch-in on impact beats
      v += `,scale=${CANVAS_W + 36}:${CANVAS_H + 64}:flags=lanczos,crop=${CANVAS_W}:${CANVAS_H}:(iw-${CANVAS_W})/2:(ih-${CANVAS_H})/2`;
    }
    f.push(`${v},format=yuv420p[v${i}]`);
  });

  let last = 'v0';
  let elapsed = shots[0].duration;
  for (let i = 1; i < shots.length; i += 1) {
    const out = i === shots.length - 1 ? 'vout' : `x${i}`;
    if (td > 0) {
      const name = TRANSITIONS[(i - 1) % TRANSITIONS.length];
      f.push(`[${last}][v${i}]xfade=transition=${name}:duration=${num(td)}:offset=${num(elapsed - td)}[${out}]`);
      elapsed += shots[i].duration - td;
    } else {
      f.push(`[${last}][v${i}]concat=n=2:v=1:a=0[${out}]`);
      elapsed += shots[i].duration;
    }
    last = out;
  }
  if (shots.length === 1) f.push('[v0]null[vout]');

  const total = elapsed;
  const n = shots.length;
  let audioLabel = null;
  if (hasNarration) {
    f.push(`[${n}:a]highpass=f=80,lowpass=f=8000,volume=1.2,aresample=48000[nar]`);
    audioLabel = 'nar';
  }
  if (hasMusic) {
    const mi = n + (hasNarration ? 1 : 0);
    f.push(`[${mi}:a]aresample=48000,volume=${MUSIC_VOLUME},afade=t=out:st=${num(Math.max(0, total - 1))}:d=1[bgm]`);
    if (hasNarration) {
      f.push('[nar][bgm]amix=inputs=2:duration=longest:normalize=0[aout]');
      audioLabel = 'aout';
    } else {
      audioLabel = 'bgm';
    }
  }
  return { filterComplex: f.join(';'), total, audioLabel, inputCount: n + (hasNarration ? 1 : 0) + (hasMusic ? 1 : 0) };
}

/** Evenly spread each beat's words over its shots' on-screen window → SRT text. */
export function buildSrt(beats, { transition = DEFAULT_TRANSITION_SEC } = {}) {
  const td = Number(transition) || 0;
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
      beatEnd = st + s.duration_sec;
      cursor += s.duration_sec;
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

async function fetchBytes(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Could not download ${url.slice(0, 60)}… (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Assemble clips + narration + music into one 9:16 MP4 Blob.
 * @param {{ url: string, duration: number, zoom: boolean }[]} clips
 */
export async function runAssembly({ clips, narrationUrl, musicUrl, transition = DEFAULT_TRANSITION_SEC, onProgress, signal }) {
  const plan = buildAssemblyPlan(clips, { transition, hasNarration: !!narrationUrl, hasMusic: !!musicUrl });
  const [{ FFmpeg }, { toBlobURL }] = await Promise.all([import('@ffmpeg/ffmpeg'), import('@ffmpeg/util')]);
  const ff = new FFmpeg();
  ff.on('progress', ({ progress }) => onProgress?.('encode', Math.min(1, Math.max(0, progress))));
  onProgress?.('load', 0);
  await ff.load({
    coreURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  const args = [];
  for (let i = 0; i < clips.length; i += 1) {
    onProgress?.('download', i / clips.length);
    await ff.writeFile(`clip${i}.mp4`, await fetchBytes(clips[i].url, signal));
    args.push('-i', `clip${i}.mp4`);
  }
  if (narrationUrl) { await ff.writeFile('narration.mp3', await fetchBytes(narrationUrl, signal)); args.push('-i', 'narration.mp3'); }
  if (musicUrl) { await ff.writeFile('bgm.mp3', await fetchBytes(musicUrl, signal)); args.push('-i', 'bgm.mp3'); }

  args.push('-filter_complex', plan.filterComplex, '-map', '[vout]');
  if (plan.audioLabel) args.push('-map', `[${plan.audioLabel}]`, '-c:a', 'aac', '-b:a', '96k');
  args.push('-t', num(plan.total), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-movflags', '+faststart', 'final.mp4');

  const code = await ff.exec(args);
  if (code !== 0) throw new Error('The video encoder failed. Try fewer or shorter clips.');
  const data = await ff.readFile('final.mp4');
  ff.terminate();
  return { blob: new Blob([data], { type: 'video/mp4' }), duration: plan.total };
}
