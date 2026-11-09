

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useWorkspace, getActiveTimeline } from '@cinegen/components/workspace/workspace-shell';
import { ExportSettings, type ExportExtras } from './export-settings';
import { RenderProgress } from './render-progress';
import { cinegenFcpxml } from '@cinegen/lib/occ/fcpxml';
import type { ExportPreset, ExportJob } from '@cinegen/types/export';
import { clipEffectiveDuration, clipEndTime } from '@cinegen/types/timeline';

export function ExportTab() {
  const { state, dispatch } = useWorkspace();
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const activeTimeline = getActiveTimeline(state);
  const exportClips = useMemo(() => {
    const assetsById = new Map(state.assets.map((asset) => [asset.id, asset]));
    return activeTimeline.clips.flatMap((clip) => {
      const asset = assetsById.get(clip.assetId);
      const inputPath = asset?.fileRef || asset?.url;
      const duration = clipEffectiveDuration(clip);
      if (!asset || !inputPath || duration <= 0) return [];
      return [{
        id: clip.id,
        inputPath,
        startTime: clip.startTime,
        duration,
        trimStart: clip.trimStart,
        speed: clip.speed || 1,
        volume: clip.volume ?? 1,
        type: asset.type,
        // [remix] a clip on an audio track plays sound only, even when its media file is a video
        trackKind: activeTimeline.tracks.find((t) => t.id === clip.trackId)?.kind,
        // [remix] OpenChatCut effects burned into the render
        fadeIn: clip.fadeIn, fadeOut: clip.fadeOut, kf: clip.keyframes, fx: clip.fx, lut: clip.lut, blendMode: clip.blendMode, zoom: clip.zoom, captions: clip.captions,
      }];
    });
  }, [activeTimeline.clips, activeTimeline.tracks, state.assets]);
  const hasClips = exportClips.length > 0;
  const totalDuration = Math.max(
    activeTimeline.duration,
    ...activeTimeline.clips.map(clipEndTime),
  );
  const activeJob = state.exports.find(
    (e) => e.status === 'queued' || e.status === 'rendering'
  );
  const latestJob = state.exports[state.exports.length - 1];

  const handleRender = useCallback(async (preset: ExportPreset, fps: 24 | 30 | 60, extras?: ExportExtras) => {
    try {
      const job = await window.electronAPI.export.start({
        preset,
        fps,
        clips: exportClips,
        totalDuration,
        // [remix] OpenChatCut export bitrate + render check
        videoBitrate: extras?.videoBitrate, qa: extras?.qa,
        // [remix] OpenChatCut GL transitions on dissolve cuts
        transitions: (activeTimeline.transitions ?? []).filter((t) => t.glType && t.type === 'dissolve' && t.clipBId).map((t) => ({ glType: t.glType, glDef: t.glDef, clipAId: t.clipAId, clipBId: t.clipBId })),
      });
      dispatch({ type: 'ADD_EXPORT', exportJob: job });
    } catch (error) {
      console.error('Failed to start render:', error);
    }
  }, [dispatch, exportClips, totalDuration, activeTimeline.transitions]);

  useEffect(() => {
    if (!activeJob) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    pollRef.current = setInterval(async () => {
      try {
        const updated = await window.electronAPI.export.poll(activeJob.id);
        dispatch({
          type: 'UPDATE_EXPORT',
          exportId: activeJob.id,
          updates: {
            status: updated.status,
            progress: updated.progress,
            outputUrl: updated.outputUrl,
            fileSize: updated.fileSize,
            error: updated.error,
            completedAt: updated.completedAt,
            qa: updated.qa,
            qaStatus: updated.qaStatus,
          },
        });
      } catch {
        /* polling failures are non-fatal */
      }
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeJob?.id, dispatch]);

  return (
    <div className="export-tab">
      <div className="export-tab__panel">
        <h2 className="export-tab__title">Export</h2>
        <p className="export-tab__subtitle">
          Render your timeline as an MP4 video
        </p>

        <ExportSettings hasClips={hasClips} onRender={handleRender} />
        {/* [remix] OpenChatCut FCPXML export (Final Cut Pro / Premiere / DaVinci Resolve) */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <button type="button" disabled={!hasClips} data-testid="export-fcpxml" onClick={() => {
            const xml = cinegenFcpxml(activeTimeline, state.assets, { title: activeTimeline.name });
            const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }));
            const a = document.createElement('a'); a.href = url; a.download = `${activeTimeline.name || 'timeline'}.fcpxml`; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
          }}>Export FCPXML</button>
          <span style={{ fontSize: 11, opacity: 0.65 }}>For Final Cut Pro, Premiere and DaVinci Resolve. Relink the media after import.</span>
        </div>

        {latestJob && (
          <div className="export-tab__progress">
            <RenderProgress job={latestJob} />
          </div>
        )}

        {!hasClips && (
          <p className="export-tab__hint">
            Add clips to the timeline in the Edit tab before exporting.
          </p>
        )}
      </div>
    </div>
  );
}
