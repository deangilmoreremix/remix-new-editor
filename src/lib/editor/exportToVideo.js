/**
 * exportToVideo — the single, real export path for the redesigned Timeline Editor.
 *
 * This is the bridge between the redesign's "Export" action and the app's
 * actual video-creation logic. It:
 *   1. Serializes the live timeline state (project.tracks[].items[]) into the
 *      shape exportWorker.js reads (tracks[].clips[] with type + src).
 *   2. Runs exportWorker.js (OffscreenCanvas) to compose the timeline into a
 *      real video Blob — not a stub preview.
 *   3. When the user has a VideoDB API key configured, ingests that Blob into
 *      their VideoDB collection via the real `videoDb.indexVideo()` client, so
 *      the output becomes a deliverable inside the app's video pipeline.
 *   4. Degrades gracefully (downloads locally) when no VideoDB key is set, and
 *      surfaces clear errors instead of silently failing.
 *
 * Both the redesign UI (TimelineEditorPage.jsx) and the AI-integration feature
 * should call THIS function so there is exactly one export implementation.
 */

import { videoDb } from '../videoDb.js';

/**
 * Convert the live timeline state (created by createTimelineState / TimelineState)
 * into the shape exportWorker.js reads: { tracks: [{ clips: [{ type, src }] }] }.
 * The redesign stores clips under `project.tracks[].items[]` with `start`/`end`
 * and a `src` (or `assetId`); the worker only needs type + a renderable src.
 */
function toWorkerTimelineData(state) {
  const project = state?.project || state;
  const tracks = Array.isArray(project?.tracks) ? project.tracks : [];
  return {
    duration: state?.duration || state?.timelineSeconds ? (state.timelineSeconds || 5) * 1000 : 5000,
    tracks: tracks.map((track) => {
      const clips = (track.items || track.clips || []).map((clip) => ({
        type: clip.type || track.type || 'video',
        src: clip.src || clip.url || clip.assetId || null,
        start: clip.start ?? 0,
        end: clip.end ?? (clip.start ?? 0) + 5,
      }));
      return { type: track.type, clips };
    }),
  };
}

/**
 * @param {object} params
 * @param {object} params.state            Live timeline state (from createTimelineState)
 * @param {object} [params.settings]        width/height/preset overrides
 * @param {function} [params.onProgress]    (percent:number)=>void
 * @param {function} [params.showToast]     (msg, type)=>void
 * @returns {Promise<{ ok:boolean, url?:string, videoDbId?:string, message:string }>}
 */
export async function exportToVideo({ state, settings = {}, onProgress, showToast }) {
  // 1. Serialize the live timeline into the format the worker understands.
  const timelineData = toWorkerTimelineData(state);
  const clipCount = timelineData.tracks.reduce((n, t) => n + t.clips.length, 0);
  if (clipCount === 0) {
    const msg = 'Nothing to export — add at least one clip to the timeline.';
    showToast?.(msg, 'info');
    return { ok: false, message: msg };
  }

  const width = settings.width || 1920;
  const height = settings.height || 1080;
  const preset = settings.preset || 'standard';

  onProgress?.(0);

  // 2. Compose the timeline into a real video Blob via the export worker.
  const blob = await runExportWorker({ timelineData, settings: { width, height, preset } }, onProgress);
  if (!blob) {
    const msg = 'Export failed while rendering the timeline.';
    showToast?.(msg, 'error');
    return { ok: false, message: msg };
  }

  const blobUrl = URL.createObjectURL(blob);

  // 3. Ingest into the app's video pipeline when the user is connected.
  if (videoDb.hasKey()) {
    try {
      onProgress?.(95);
      const name = `Timeline Export ${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
      const media = await videoDb.indexVideo(blobUrl, { name, mediaType: 'video' });
      onProgress?.(100);
      const videoDbId = media?.id || media?.media_id || undefined;
      const msg = videoDbId
        ? `Exported to VideoDB (${videoDbId}).`
        : 'Exported to VideoDB.';
      showToast?.(msg, 'success');
      return { ok: true, url: blobUrl, videoDbId, message: msg };
    } catch (err) {
      // Network/ingest failure: still hand back the local Blob so the user
      // isn't blocked, but tell them why it didn't land in VideoDB.
      const msg = `Rendered, but VideoDB ingest failed: ${err.message}`;
      showToast?.(msg, 'error');
      return { ok: true, url: blobUrl, message: msg };
    }
  }

  // 4. No VideoDB key: download locally and explain how to enable the pipeline.
  triggerDownload(blobUrl, `timeline-export-${Date.now()}.webm`);
  onProgress?.(100);
  const msg = 'Exported locally. Add a VideoDB API key in Settings to send it into your video library.';
  showToast?.(msg, 'info');
  return { ok: true, url: blobUrl, message: msg };
}

function runExportWorker({ timelineData, settings }, onProgress) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./exportWorker.js', import.meta.url), { type: 'module' });
    let settled = false;
    const finish = (fn) => (arg) => {
      if (settled) return;
      settled = true;
      try { worker.terminate(); } catch { /* noop */ }
      fn(arg);
    };
    const done = finish(resolve);
    const fail = finish(reject);

    worker.onmessage = (e) => {
      const data = e.data || {};
      if (data.type === 'progress') {
        onProgress?.(data.progress);
      } else if (data.type === 'complete') {
        done(data.result?.url ? data.result : null);
      } else if (data.type === 'error') {
        fail(new Error(data.error || 'Export worker error'));
      }
    };
    worker.onerror = (err) => fail(new Error(err.message || 'Export worker crashed'));

    worker.postMessage({ action: 'export', settings, timelineData });
  });
}

function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
