// Ported from Remotion Recorder (https://github.com/remotion-dev/recorder, commit 4c09934),
// src/helpers/start-media-recorder.ts: one recorder per source, saved every 10 s, stopped as soon
// as any of its tracks ends (otherwise the file's timestamps come out corrupt).
import { findGoodSupportedCodec, getExtension } from './codec.js';
import { createFileStorage } from './fileStorage.js';

export const MEDIA_RECORDER_OPTIONS = {
  audioBitsPerSecond: 128000,
  videoBitsPerSecond: 8 * 4000000,
  videoKeyFrameIntervalDuration: 2 * 1000,
};
export const SAVE_EVERY_MS = 10_000;

export async function startMediaRecorder({ prefix, timestamp, stream, audioOnly = false, Recorder = globalThis.MediaRecorder, storage }) {
  const mimeType = findGoodSupportedCodec(stream.getAudioTracks().length > 0, { audioOnly, Recorder });
  const extension = audioOnly ? 'webm' : getExtension(mimeType);
  const filename = `${prefix}${timestamp}.${extension}`;
  const options = audioOnly ? { audioBitsPerSecond: MEDIA_RECORDER_OPTIONS.audioBitsPerSecond, mimeType } : { ...MEDIA_RECORDER_OPTIONS, mimeType };
  const recorder = new Recorder(stream, options);
  const writer = await createFileStorage(filename, mimeType, { storage });

  const periodic = new AbortController();
  recorder.addEventListener('dataavailable', ({ data }) => { if (data?.size) writer.write(data); }, { signal: periodic.signal });

  let stopped = null;
  const stopAndWaitUntilDone = () => {
    if (stopped) return stopped;
    periodic.abort();
    const controller = new AbortController();
    stopped = new Promise((resolve, reject) => {
      recorder.addEventListener('error', () => reject(new Error(`Error recording ${prefix}`)), { once: true, signal: controller.signal });
      recorder.addEventListener('dataavailable', ({ data }) => {
        writer.write(data).then(() => resolve({
          prefix, mimeType, endDate: Date.now(),
          data: () => writer.save(),
          releaseData: () => writer.release(),
        })).catch(reject);
      }, { once: true, signal: controller.signal });
      if (recorder.state === 'inactive') reject(new Error(`Recorder for ${prefix} already stopped`));
      else recorder.stop();
    });
    stopped.finally(() => controller.abort()).catch(() => {});
    return stopped;
  };

  for (const track of stream.getTracks()) track.addEventListener('ended', () => { stopAndWaitUntilDone().catch(() => {}); }, { once: true });

  recorder.start(SAVE_EVERY_MS);
  return { recorder, stream, mimeType, stopAndWaitUntilDone };
}
