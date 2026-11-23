// Ported from Remotion Recorder (https://github.com/remotion-dev/recorder, commit 4c09934),
// src/RecordButton.tsx (start/stop logic, without the React UI): every active source starts
// together and records to its own file; stopping waits for all of them.
import { startMediaRecorder } from './startRecorder.js';

export const FPS = 30; // Recorder's config/fps.ts

/** sources: [{ prefix: 'webcam' | 'display' | 'audio', stream, audioOnly? }] */
export async function startSession(sources, { Recorder, storage, now = Date.now } = {}) {
  const startDate = now();
  const recorders = await Promise.all(sources.map((s) => startMediaRecorder({
    prefix: s.prefix, stream: s.stream, timestamp: startDate, audioOnly: !!s.audioOnly, Recorder, storage,
  })));
  let finished = null;
  const stop = () => {
    if (!finished) {
      finished = Promise.all(recorders.map((r) => r.stopAndWaitUntilDone())).then((takes) => {
        const endDate = now();
        return { takes, endDate, startDate, expectedFrames: ((endDate - startDate) / 1000) * FPS };
      });
    }
    return finished;
  };
  return {
    startDate,
    recorders,
    stop,
    pause: () => recorders.forEach((r) => r.recorder.state === 'recording' && r.recorder.pause()),
    resume: () => recorders.forEach((r) => r.recorder.state === 'paused' && r.recorder.resume()),
    get state() { return recorders[0]?.recorder.state || 'inactive'; },
  };
}

/** Blobs of a finished session keyed by prefix: { webcam: Blob, display: Blob, … }. */
export async function takeBlobs(result) {
  const out = {};
  for (const t of result.takes) out[t.prefix] = await t.data();
  return out;
}

export async function releaseTakes(result) {
  await Promise.all((result?.takes || []).map((t) => t.releaseData().catch(() => {})));
}
