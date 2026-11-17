

import { resolveFit, DEFAULT_ASPECT } from '@cinegen/lib/occ/frame-geometry';
import { exportClipsOf, exportTotalDuration, exportOverlaysOf, exportTransitionsOf } from '@cinegen/lib/occ/export-args';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useWorkspace, getActiveTimeline } from '@cinegen/components/workspace/workspace-shell';
import { ExportSettings, type ExportExtras } from './export-settings';
import { RenderProgress } from './render-progress';
import { cinegenFcpxml } from '@cinegen/lib/occ/fcpxml';
import type { ExportPreset, ExportJob } from '@cinegen/types/export';
import { exportBlockers, describeBlockers } from '@cinegen/lib/export-blockers';

export function ExportTab() {
  const { state, dispatch } = useWorkspace();
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const activeTimeline = getActiveTimeline(state);
  const exportClips = useMemo(() => exportClipsOf(activeTimeline, state.assets), [activeTimeline.clips, activeTimeline.tracks, state.assets]);
  const hasClips = exportClips.length > 0;
  // Clips that were dropped from the render, and why (so a disabled Render button can explain itself).
  const blockedReason = useMemo(() => describeBlockers(exportBlockers(activeTimeline.clips, state.assets)), [activeTimeline.clips, state.assets]);
  const totalDuration = exportTotalDuration(activeTimeline);
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
        videoBitrate: extras?.videoBitrate, qa: extras?.qa, aspect: extras?.aspect,
        // [remix] visual overlays (text, stickers, call buttons, End Screens, Connect Forms…) are drawn into the render; interactive forms stay player-only;
        // motion-graphics templates and HyperFrames animations are rendered by the sandboxed runner; GL transitions go on dissolve cuts
        ...exportOverlaysOf(state.overlays ?? []),
        transitions: exportTransitionsOf(activeTimeline),
      });
      dispatch({ type: 'ADD_EXPORT', exportJob: job });
    } catch (error) {
      console.error('Failed to start render:', error);
    }
  }, [dispatch, exportClips, totalDuration, activeTimeline.transitions, state.overlays]);

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

        <ExportSettings hasClips={hasClips} blockedReason={blockedReason} onRender={handleRender} aspect={activeTimeline.aspect ?? DEFAULT_ASPECT} fit={resolveFit(undefined, activeTimeline)} onFit={(fit) => dispatch({ type: 'SET_TIMELINE', timelineId: activeTimeline.id, timeline: { ...activeTimeline, fit } })} onAspect={(aspect) => dispatch({ type: 'SET_TIMELINE', timelineId: activeTimeline.id, timeline: { ...activeTimeline, aspect } })} />
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

        {/* [remix] interactive sharing moved to the Leads tab */}
        <p className="export-tab__hint" style={{ marginTop: 16 }}>
          Publish an interactive version (forms, buttons) and collect leads in the <button type="button" className="mini-btn" data-testid="export-to-leads" onClick={() => dispatch({ type: 'SET_TAB', tab: 'leads' })}>Leads</button> tab. A plain MP4 can't hold a form, so add a QR end card there to send MP4 viewers to your published link.
        </p>

        {latestJob && (
          <div className="export-tab__progress">
            <RenderProgress job={latestJob} />
          </div>
        )}

        {!hasClips && (
          <p className="export-tab__hint" data-testid="export-blocked-hint">
            {blockedReason || 'Add clips to the timeline in the Edit tab before exporting.'}
          </p>
        )}
        {hasClips && blockedReason && (
          <p className="export-tab__hint" data-testid="export-skipped-hint">
            Some clips will be left out: {blockedReason}
          </p>
        )}
      </div>
    </div>
  );
}
