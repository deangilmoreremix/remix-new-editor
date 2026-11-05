'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from './i18n';
import { useStore } from './store';
import { estimateExportSec } from './lib/exportCost';
import { canRenderVideo, renderVideoOnWeb, createDownloadUrl, formatEta, guardTabWhileRendering } from './webRenderer';

type JobState = {
  id: string;
  status: 'queued' | 'running' | 'done' | 'error';
  progress: number;
  /** Renderer's estimate of the time left (ms). */
  etaMs?: number | null;
  filename?: string;
  blob?: Blob;
  error?: string;
};

const EXPORT_EVENT = 'motion-studio:export';

/** Start an MP4 export from elsewhere in the studio (the Agent chat's "render the MP4"). */
export const requestExport = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EXPORT_EVENT));
};

const ExportButton: React.FC = () => {
  const t = useT();
  const [job, setJob] = useState<JobState | null>(null);
  const [withoutMusic, setWithoutMusic] = useState(false);
  // Draft renders the same frames at 720p: about a third less work per frame.
  const [draft, setDraft] = useState(false);
  const filmProject = useStore((s) => s.project);
  const abortControllerRef = useRef<AbortController | null>(null);
  /** Set synchronously on start, so a second request during the capability check is ignored. */
  const inFlightRef = useRef(false);

  const stopRendering = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  /** Every export path (button, "Export again", the chat's "render the MP4") goes through here. */
  const start = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      await runExport();
    } finally {
      inFlightRef.current = false;
    }
  };

  const runExport = async () => {
    const project = useStore.getState().project;

    // First, check if the browser can render media on web
    let canRenderResult;
    try {
      console.log('[motion-studio:export] canRender check starting', JSON.stringify({ width: project.width, height: project.height }));
      canRenderResult = await canRenderVideo({
      width: project.width as number,
      height: project.height as number,
    });
      console.log('[motion-studio:export] canRender result', JSON.stringify({ canRender: canRenderResult.canRender, issues: canRenderResult.issues, resolvedVideoCodec: canRenderResult.videoCodec, resolvedAudioCodec: canRenderResult.audioCodec }));
    } catch (e) {
      console.error('[motion-studio:export] canRender threw', e);
      window.alert(t('export.startFailed') + ': ' + (e instanceof Error ? e.message : String(e)));
      return;
    }

    if (!canRenderResult.canRender) {
      const detail = canRenderResult.issues.length
        ? canRenderResult.issues.join(', ')
        : 'This browser cannot encode MP4 in this configuration.';
      console.error('[motion-studio:export] canRender=false', detail);
      window.alert(t('export.startFailed') + ': ' + detail);
      return;
    }

    // Generate a fake ID for tracking (not really needed, but we keep the state structure)
    const id = Math.random().toString(36).substring(2, 9);
    setJob({ id, status: 'queued', progress: 0, filename: project.name });
    abortControllerRef.current = new AbortController();
    // The render runs in this tab: closing or reloading it cancels the export.
    const releaseGuard = guardTabWhileRendering();

    try {
      const result = await renderVideoOnWeb({
        // Only the music bed goes; sound effects and video sound stay.
        project: withoutMusic ? { ...project, tracks: project.tracks.filter((track) => track.name !== t('track.music')) } : project,
        videoCodec: canRenderResult.videoCodec,
        audioCodec: canRenderResult.audioCodec,
        scale: draft ? 2 / 3 : 1,
        onProgress: (progress, info) => {
          if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
            setJob((prev) => (prev ? { ...prev, progress, etaMs: info?.etaMs ?? null, status: 'running' } : null));
          }
        },
        signal: abortControllerRef.current.signal,
      });

      // If we get here, the render completed successfully
      if (!abortControllerRef.current?.signal.aborted) {
        setJob((prev) => (prev ? { ...prev, status: 'done', progress: 1, blob: result.blob } : null));
      }
    } catch (e) {
      // If the render was aborted, we don't show an error
      if (abortControllerRef.current?.signal.aborted) {
        console.log('[motion-studio:export] cancelled by user');
        setJob((prev) => (prev ? { ...prev, status: 'error', error: 'Render cancelled.' } : null));
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[motion-studio:export] render failed', e);
        window.alert(t('export.startFailed') + ': ' + msg);
        setJob((prev) => (prev ? { ...prev, status: 'error', error: msg } : null));
      }
    } finally {
      releaseGuard();
      abortControllerRef.current = null;
    }
  };

  const startRef = useRef(start);
  startRef.current = start;
  const jobRef = useRef(job);
  jobRef.current = job;
  useEffect(() => {
    const onRequest = () => {
      const status = jobRef.current?.status;
      if (status !== 'running' && status !== 'queued') void startRef.current();
    };
    window.addEventListener(EXPORT_EVENT, onRequest);
    return () => window.removeEventListener(EXPORT_EVENT, onRequest);
  }, []);

  // We don't need to resume a render because it's all client-side and doesn't survive a refresh.
  // However, we can keep the effect to clean up on unmount.
  useEffect(() => {
    return () => {
      stopRendering();
    };
  }, []);

  const downloadUrl = job?.blob ? createDownloadUrl(job.blob) : undefined;

  // Clean up the object URL when the blob or component unmounts.
  useEffect(() => {
    return () => {
      stopRendering();
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  if (job?.status === 'running' || job?.status === 'queued') {
    return (
      <>
        <button
          className="btn primary"
          disabled
          title={['Rendering in this tab with the Remotion web renderer — keep it open.', formatEta(job.etaMs)].filter(Boolean).join(' ')}
        >
          {t('export.running', { pct: Math.round((job.progress ?? 0) * 100) })}
        </button>
        <button
          type="button"
          className="btn danger"
          onClick={() => {
            stopRendering();
            setJob((prev) => (prev ? { ...prev, status: 'error', error: t('export.cancelled') } : null));
          }}
          title={t('export.cancelTitle')}
          data-testid="export-cancel"
        >
          {t('export.cancel')}
        </button>
      </>
    );
  }
  if (job?.status === 'done') {
    return (
      <>
        <a
          className="btn"
          href={downloadUrl}
          download={`${(job.filename ?? 'Motion Studio')}-${new Date()
            .toISOString()
            .slice(0, 19)
            .replace(/[:T]/g, '-')}.mp4`}
          title={t('export.revealTitle')}
        >
          {t('export.done')}
        </a>
        <button className="btn primary" onClick={start}>
          {t('export.again')}
        </button>
      </>
    );
  }
  if (job?.status === 'error') {
    return (
      <button
        className="btn danger"
        title={job.error}
        onClick={start}
      >
        {t('export.failedRetry')}
      </button>
    );
  }
  // A ranking of how heavy the film's shots are to draw, scaled to the draft size when chosen.
  const estimateMin = Math.max(1, Math.round((estimateExportSec(filmProject) * (draft ? 0.67 : 1)) / 60));
  return (
    <div className="flex items-center gap-2">
      <button className="btn primary" title={t('export.title')} onClick={start}>
        {t('export.film')}
      </button>
      <label className="flex items-center gap-1.5 text-xs text-white/70 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={withoutMusic}
          onChange={(e) => setWithoutMusic(e.target.checked)}
          aria-label={t('export.withoutMusic')}
        />
        {t('export.withoutMusic')}
      </label>
      <label className="flex items-center gap-1.5 text-xs text-white/70 cursor-pointer select-none" title={t('export.draftHint')}>
        <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} aria-label={t('export.draft')} data-testid="export-draft" />
        {t('export.draft')}
      </label>
      <span className="text-xs text-white/50" title={t('export.estimateHint')} data-testid="export-estimate">
        ~{estimateMin} min
      </span>
    </div>
  );
};

export default ExportButton;