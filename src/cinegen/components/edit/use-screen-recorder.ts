// [remix] Screen recorder for the CineGen timeline: opens the Recorder drawer (Webcam / Screen / Camera 2 / Camera 3 / mic, plus
// Recorder Studio) and puts what it records into the media pool and onto the timeline, one track per source, at the playhead.
// Kept out of edit-tab.tsx so that file stays close to upstream CineGen (see timeline-parity.test.ts).
import { useCallback, useRef, type Dispatch } from 'react';
import type { Asset } from '@cinegen/types/project';
import type { Timeline } from '@cinegen/types/timeline';
import type { WorkspaceAction } from '@cinegen/lib/mcp/workspace-state';
import { addClipToTrack } from '@cinegen/lib/editor/timeline-operations';
import { generateId } from '@cinegen/lib/utils/ids';

interface Options {
  timeline: Timeline;
  currentTime: number;
  projectId: string;
  dispatch: Dispatch<WorkspaceAction>;
}

/** One recorded file as the Recorder drawer hands it over. */
interface Recorded {
  kind: 'webcam' | 'display' | 'alternative1' | 'alternative2' | 'audio' | 'import' | 'studio';
  label?: string;
  blob: Blob;
  duration?: number;
}

type Track = Timeline['tracks'][number];

// Later tracks are drawn on top, so `order` is also the stacking order (screen first, facecam above it).
const LAYERS: Record<Recorded['kind'], { name: string; kind: 'video' | 'audio'; color: string; order: number }> = {
  display: { name: 'Screen', kind: 'video', color: '#4a9fd6', order: 0 },
  studio: { name: 'Recorder Studio', kind: 'video', color: '#a78bfa', order: 1 },
  import: { name: 'Recorder', kind: 'video', color: '#a78bfa', order: 2 },
  alternative1: { name: 'Camera 2', kind: 'video', color: '#f472b6', order: 3 },
  alternative2: { name: 'Camera 3', kind: 'video', color: '#fb7185', order: 4 },
  webcam: { name: 'Facecam', kind: 'video', color: '#f59e0b', order: 5 },
  audio: { name: 'Recorded audio', kind: 'audio', color: '#34d399', order: 6 },
};

// Facecam as a picture-in-picture in the bottom-right corner when it was recorded together with a screen.
const PIP = { x: 32, y: 30, scale: 0.28, rotation: 0 };

const extensionOf = (blob: Blob) => (blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm');

/** Duration and size of a media blob. Falls back to `fallback` seconds when the browser cannot tell (MediaRecorder WebM often can't). */
function probe(blob: Blob, isVideo: boolean, fallback: number): Promise<{ duration: number; width?: number; height?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const el = document.createElement(isVideo ? 'video' : 'audio');
    const done = (r: { duration: number; width?: number; height?: number }) => { URL.revokeObjectURL(url); resolve(r); };
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      const d = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : fallback;
      done({ duration: d, ...(isVideo ? { width: (el as HTMLVideoElement).videoWidth, height: (el as HTMLVideoElement).videoHeight } : {}) });
    };
    el.onerror = () => done({ duration: fallback });
    el.src = url;
  });
}

export function useScreenRecorder({ timeline, currentTime, projectId, dispatch }: Options) {
  // Importing and probing finish after the click, so the clips must go onto the timeline as it is NOW (SET_TIMELINE replaces the whole
  // timeline, a stale snapshot would erase edits made in between).
  const latestRef = useRef({ timeline, currentTime });
  latestRef.current = { timeline, currentTime };

  const place = useCallback(async (recorded: Recorded[], at: number, fallbackSeconds: number) => {
    const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const hasScreen = recorded.some((r) => r.kind === 'display');
    const ordered = [...recorded].sort((a, b) => LAYERS[a.kind].order - LAYERS[b.kind].order);

    // 1. media pool: import every file and register the asset
    const prepared: { rec: Recorded; asset: Asset }[] = [];
    for (const rec of ordered) {
      const layer = LAYERS[rec.kind];
      const isVideo = layer.kind === 'video';
      const name = `${rec.label || layer.name} ${stamp}.${extensionOf(rec.blob)}`;
      const imported = await window.electronAPI.media.importBlob({ blob: rec.blob, name }) as { assetId: string; filePath: string };
      const meta = await probe(rec.blob, isVideo, rec.duration || fallbackSeconds);
      const jobs = isVideo ? ['extract_metadata', 'generate_thumbnail', 'compute_waveform', 'generate_filmstrip'] : ['extract_metadata', 'compute_waveform'];
      const asset: Asset = {
        id: imported.assetId, name, type: isVideo ? 'video' : 'audio', url: imported.filePath, fileRef: imported.filePath,
        duration: meta.duration, width: meta.width, height: meta.height,
        createdAt: new Date().toISOString(), status: 'processing', metadata: { source: 'screen-recorder', processingJobs: jobs },
      };
      dispatch({ type: 'ADD_ASSET', asset });
      prepared.push({ rec, asset });
      if (isVideo) {
        void window.electronAPI.media.queueProcessing({
          assetId: asset.id, projectId, inputPath: imported.filePath, needsProxy: false,
          includeThumbnail: true, includeWaveform: true, includeFilmstrip: true,
        }).catch((err: unknown) => { console.warn('[screen-recorder] could not queue media processing for', asset.id, err); });
      }
    }

    // 2. timeline: each source goes on its own free track at the playhead. Video sources take the first free video tracks (screen on the
    // lowest, facecam above it), so the editor's empty V1/V2 are used first; a new video track is only created, next to the other video
    // tracks, when none is free. "Free" = no clip overlapping the recording, so existing footage is never covered.
    let tl = latestRef.current.timeline;
    const used = new Set<string>();
    const isFree = (t: Track, from: number, to: number) => !t.locked && !used.has(t.id)
      && !tl.clips.some((c) => c.trackId === t.id && c.startTime < to && c.startTime + c.duration > from);
    for (const { rec, asset } of prepared) {
      const layer = LAYERS[rec.kind];
      const from = Math.max(0, at);
      const to = from + (asset.duration ?? fallbackSeconds);
      let track: Track | undefined = tl.tracks.find((t) => t.kind === layer.kind && isFree(t, from, to));
      if (!track) {
        const count = tl.tracks.filter((t) => t.kind === layer.kind).length;
        track = { id: generateId(), name: `${layer.kind === 'video' ? 'Video' : 'Audio'} ${count + 1}`, kind: layer.kind, color: layer.color, muted: false, solo: false, locked: false, visible: true, volume: 1 };
        const lastSameKind = tl.tracks.map((t) => t.kind).lastIndexOf(layer.kind);
        const at2 = lastSameKind >= 0 ? lastSameKind + 1 : tl.tracks.length;
        tl = { ...tl, tracks: [...tl.tracks.slice(0, at2), track, ...tl.tracks.slice(at2)] };
      }
      used.add(track.id);
      tl = addClipToTrack(tl, track.id, asset, from);
      if (rec.kind === 'webcam' && hasScreen) {
        const trackId = track.id;
        tl = { ...tl, clips: tl.clips.map((c) => (c.assetId === asset.id && c.trackId === trackId ? { ...c, transform: { ...PIP } } : c)) };
      }
    }
    dispatch({ type: 'SET_TIMELINE', timelineId: latestRef.current.timeline.id, timeline: tl });
  }, [dispatch, projectId]);

  /** Opens the Recorder drawer; whatever it produces lands at the playhead position from the moment it was opened. */
  const open = useCallback(async () => {
    const at = Math.max(0, latestRef.current.currentTime);
    const { RecorderModal } = await import('../../../components/modals/RecorderModal.jsx');
    const modal = new RecorderModal({
      onComplete: (result: { sources?: Recorded[]; duration?: number }) => {
        if (!result?.sources?.length) return;
        place(result.sources, at, result.duration || 5).catch((err: unknown) => console.error('[screen-recorder] could not add the recording:', err));
      },
      // Recorder Studio's rendered video (captions, layouts, end card burned in).
      onStudioExport: (result: { blob: Blob; durationInSeconds: number }) => {
        place([{ kind: 'studio', label: 'Recorder Studio', blob: result.blob, duration: result.durationInSeconds }], at, result.durationInSeconds)
          .catch((err: unknown) => console.error('[screen-recorder] could not add the Studio video:', err));
      },
    });
    modal.open();
  }, [place]);

  return { open };
}
