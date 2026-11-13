

import { resolveFit, DEFAULT_ASPECT } from '@cinegen/lib/occ/frame-geometry';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useWorkspace, getActiveTimeline } from '@cinegen/components/workspace/workspace-shell';
import { ExportSettings, type ExportExtras } from './export-settings';
import { RenderProgress } from './render-progress';
import { cinegenFcpxml } from '@cinegen/lib/occ/fcpxml';
import type { ExportPreset, ExportJob } from '@cinegen/types/export';
import { clipEndTime } from '@cinegen/types/timeline';
import { flattenCompounds } from '@cinegen/lib/editor/stage1'; // [remix] Stage 1: compound clips export as their content
import { exportClipsFromTimeline, exportTracksFromTimeline, exportTransitionsFromTimeline } from '@cinegen/lib/editor/export-mapping';

export function ExportTab() {
  const { state, dispatch } = useWorkspace();
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const activeTimeline = getActiveTimeline(state);
  const exportTimeline = useMemo(() => flattenCompounds(activeTimeline), [activeTimeline]);
  const exportClips = useMemo(() => exportClipsFromTimeline(exportTimeline, state.assets), [exportTimeline, state.assets]);
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
        tracks: exportTracksFromTimeline(exportTimeline),
        masterVolume: exportTimeline.masterVolume ?? 1, // [remix] Stage 4
        totalDuration,
        // [remix] OpenChatCut export bitrate + render check
        videoBitrate: extras?.videoBitrate, qa: extras?.qa, aspect: extras?.aspect,
        // [remix] OpenChatCut motion-graphics templates on the overlay lane are rendered into the export
        // [remix] visual overlays (text, stickers, call buttons, End Screens, Connect Forms…) are drawn into the render; interactive forms stay player-only
        overlays: (state.overlays ?? []).filter((o) => o.type !== 'mg-template' && o.type !== 'hyperframes'),
        mgOverlays: (state.overlays ?? []).filter((o) => o.type === 'mg-template').map((o) => ({ id: o.id, name: o.name, start: o.start, end: o.end, code: o.code, props: o.props })),
        // [hyperframes] verified HyperFrames animations on the overlay lane (rendered by the sandboxed export runner)
        hfOverlays: (state.overlays ?? []).filter((o) => o.type === 'hyperframes').map((o) => ({ id: o.id, name: o.name, start: o.start, end: o.end, blockId: o.blockId, props: o.props, blockWidth: o.blockWidth, blockHeight: o.blockHeight })),
        // [remix] OpenChatCut GL transitions on dissolve cuts
        transitions: exportTransitionsFromTimeline(exportTimeline),
      });
      dispatch({ type: 'ADD_EXPORT', exportJob: job });
    } catch (error) {
      console.error('Failed to start render:', error);
    }
  }, [dispatch, exportClips, totalDuration, exportTimeline, state.overlays]);

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

        <ExportSettings hasClips={hasClips} onRender={handleRender} aspect={activeTimeline.aspect ?? DEFAULT_ASPECT} fit={resolveFit(undefined, activeTimeline)} onFit={(fit) => dispatch({ type: 'SET_TIMELINE', timelineId: activeTimeline.id, timeline: { ...activeTimeline, fit } })} onAspect={(aspect) => dispatch({ type: 'SET_TIMELINE', timelineId: activeTimeline.id, timeline: { ...activeTimeline, aspect } })} />
        {/* [remix] OpenChatCut FCPXML export (Final Cut Pro / Premiere / DaVinci Resolve) */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <button type="button" disabled={!hasClips} data-testid="export-fcpxml" onClick={() => {
            const xml = cinegenFcpxml(exportTimeline, state.assets, { title: activeTimeline.name });
            const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }));
            const a = document.createElement('a'); a.href = url; a.download = `${activeTimeline.name || 'timeline'}.fcpxml`; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
          }}>Export FCPXML</button>
          <span style={{ fontSize: 11, opacity: 0.65 }}>For Final Cut Pro, Premiere and DaVinci Resolve. Relink the media after import.</span>
        </div>

        {/* [remix] interactive sharing moved to the Leads tab */}
        <p className="export-tab__hint" style={{ marginTop: 16 }}>
          Publish an interactive version (forms, buttons) and collect leads in the <button type="button" className="mini-btn" data-testid="export-to-leads" onClick={() => dispatch({ type: 'SET_TAB', tab: 'leads' })}>Leads</button> tab.
        </p>

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
