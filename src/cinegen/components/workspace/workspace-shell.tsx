// [remix] Browser WorkspaceShell for the Timeline Editor. Same context contract as CineGen's
// ({ state, dispatch, projectId }) and the same undo/redo history + media-job handling (copied verbatim from
// CineGen's workspace-shell.tsx); Electron project loading, cloud sync, MCP bridge and the funding relay are
// replaced by browser storage and the web adapters.
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import type { WorkspaceState } from '@cinegen/types/workspace';
import type { Asset } from '@cinegen/types/project';
import type { Timeline } from '@cinegen/types/timeline';
import { workspaceReducer, createInitialWorkspaceState, type WorkspaceAction } from '@cinegen/lib/mcp/workspace-state';
import { useAssetMediaBackfill } from './use-asset-media-backfill';

export { workspaceReducer } from '@cinegen/lib/mcp/workspace-state';
export type { WorkspaceAction } from '@cinegen/lib/mcp/workspace-state';

export function getActiveTimeline(state: WorkspaceState): Timeline {
  return state.timelines.find((tl) => tl.id === state.activeTimelineId) ?? state.timelines[0];
}

/* ---- Undo / Redo history (CineGen) ---- */
const initialState = createInitialWorkspaceState();
const MAX_HISTORY = 50;
const UNDOABLE_ACTIONS: WorkspaceAction['type'][] = [
  'SET_NODES', 'SET_EDGES', 'UPDATE_NODE_CONFIG', 'APPLY_ELEMENT_MENTION',
  'ADD_SPACE', 'RENAME_SPACE', 'REMOVE_SPACE', 'CLOSE_SPACE', 'OPEN_SPACE', 'SET_ACTIVE_SPACE',
  'ADD_ASSET', 'UPDATE_ASSET', 'REMOVE_ASSET', 'REMOVE_ASSETS',
  'ADD_FOLDER', 'UPDATE_FOLDER', 'REMOVE_FOLDER',
  'SET_TIMELINE', 'ADD_TIMELINE', 'REMOVE_TIMELINE', 'CLOSE_TIMELINE', 'OPEN_TIMELINE',
  'ADD_ELEMENT', 'UPDATE_ELEMENT', 'REMOVE_ELEMENT', 'REMOVE_ELEMENTS',
  'MOVE_ELEMENTS', 'ADD_ELEMENT_FOLDER', 'UPDATE_ELEMENT_FOLDER', 'REMOVE_ELEMENT_FOLDER',
  'SET_DIRECTOR',
  'ADD_SET', 'UPDATE_SET', 'REMOVE_SET',
];

interface HistoryState {
  current: WorkspaceState;
  past: WorkspaceState[];
  future: WorkspaceState[];
  /** Timestamp of last undoable push — used to debounce rapid SET_NODES (drag) */
  lastPushTime: number;
  lastPushType: WorkspaceAction['type'] | null;
}

const DRAG_DEBOUNCE_MS = 300;

function historyReducer(history: HistoryState, action: WorkspaceAction): HistoryState {
  if (action.type === 'HYDRATE' || action.type === 'SYNC_CLOUD_PROJECT') {
    return { current: workspaceReducer(history.current, action), past: [], future: [], lastPushTime: 0, lastPushType: null };
  }
  if (action.type === 'UNDO') {
    if (history.past.length === 0) return history;
    const prev = history.past[history.past.length - 1];
    return {
      past: history.past.slice(0, -1),
      current: {
        ...prev,
        activeTab: history.current.activeTab,
        runningNodeIds: history.current.runningNodeIds,
        currentRun: history.current.currentRun,
      },
      future: [history.current, ...history.future].slice(0, MAX_HISTORY),
      lastPushTime: history.lastPushTime,
      lastPushType: history.lastPushType,
    };
  }

  if (action.type === 'REDO') {
    if (history.future.length === 0) return history;
    const next = history.future[0];
    return {
      past: [...history.past, history.current].slice(-MAX_HISTORY),
      current: {
        ...next,
        activeTab: history.current.activeTab,
        runningNodeIds: history.current.runningNodeIds,
        currentRun: history.current.currentRun,
      },
      future: history.future.slice(1),
      lastPushTime: history.lastPushTime,
      lastPushType: history.lastPushType,
    };
  }

  const next = workspaceReducer(history.current, action);

  if (UNDOABLE_ACTIONS.includes(action.type)) {
    const now = Date.now();
    // Debounce rapid dispatches during drag operations (node dragging, clip move/trim/roll)
    const isDrag =
      (action.type === 'SET_NODES' && history.lastPushType === 'SET_NODES' && now - history.lastPushTime < DRAG_DEBOUNCE_MS) ||
      (action.type === 'SET_TIMELINE' && history.lastPushType === 'SET_TIMELINE' && now - history.lastPushTime < DRAG_DEBOUNCE_MS);

    if (isDrag) {
      // Replace the current state without pushing to undo stack
      return { ...history, current: next };
    }

    return {
      past: [...history.past, history.current].slice(-MAX_HISTORY),
      current: next,
      future: [],
      lastPushTime: now,
      lastPushType: action.type,
    };
  }

  return { ...history, current: next };
}


interface WorkspaceContextValue {
  state: WorkspaceState;
  dispatch: React.Dispatch<WorkspaceAction>;
  projectId: string;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceShell');
  return ctx;
}

const DERIVE_JOB_TYPES = ['generate_thumbnail', 'compute_waveform', 'generate_filmstrip', 'generate_proxy'] as const;
const mediaDebug = (..._args: unknown[]) => undefined;
const mediaDebugError = (...args: unknown[]) => console.warn(...args);

const STORE = 'remix.cinegen.workspace.v1';
// Everything that makes up a project. Sets (openSpaceIds etc.) are rebuilt on load.
const PERSISTED = ['elements', 'elementFolders', 'assets', 'mediaFolders', 'timelines', 'activeTimelineId', 'spaces', 'activeSpaceId', 'nodes', 'edges', 'director', 'exports'] as const;

function initial(): WorkspaceState {
  const base = createInitialWorkspaceState();
  base.activeTab = 'edit'; // the Timeline Editor opens on Edit
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved) {
      for (const k of PERSISTED) if (saved[k] !== undefined) (base as unknown as Record<string, unknown>)[k] = saved[k];
      const b = base as unknown as Record<string, unknown>;
      b.openTimelineIds = new Set([base.activeTimelineId]);
      b.openSpaceIds = new Set([base.activeSpaceId]);
    }
  } catch { /* ignore */ }
  return base;
}

export function WorkspaceProvider({ projectId = 'timeline-editor', children, init }: { projectId?: string; children: ReactNode; init?: (s: WorkspaceState) => WorkspaceState }) {
  const [history, historyDispatch] = useReducer(historyReducer, undefined, (): HistoryState => ({
    current: init ? init(initial()) : initial(),
    past: [],
    future: [],
    lastPushTime: 0,
    lastPushType: null,
  }));
  const state = history.current;
  const assetsRef = useRef(state.assets);
  assetsRef.current = state.assets;
  const timelinesRef = useRef(state.timelines);
  timelinesRef.current = state.timelines;
  const pendingMediaEventsRef = useRef(new Map<string, Array<{ jobType?: string; result: unknown }>>());
  const deriveRetryCountsRef = useRef(new Map<string, number>());
  const deriveInFlightRef = useRef(new Set<string>());
  const wrappedDispatch = useCallback((action: WorkspaceAction) => { historyDispatch(action); }, []);

  // Cmd+Z / Cmd+Shift+Z
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      e.preventDefault();
      historyDispatch({ type: e.shiftKey ? 'REDO' : 'UNDO' });
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Persist the project (browser storage; media URLs must be durable — uploads — to survive a reload).
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const out: Record<string, unknown> = {};
        for (const k of PERSISTED) out[k] = (state as unknown as Record<string, unknown>)[k];
        localStorage.setItem(STORE, JSON.stringify(out));
      } catch { /* quota */ }
    }, 800);
    return () => clearTimeout(t);
  }, [state]);

  /* ---- Media jobs (CineGen's handling, unchanged) ---- */
  const updateAssetProcessingJobs = useCallback((assetId: string, updater: (jobs: Set<string>) => void) => {
    const asset = assetsRef.current.find((entry) => entry.id === assetId);
    if (!asset) return;
    const currentJobs = Array.isArray(asset.metadata?.processingJobs)
      ? (asset.metadata.processingJobs as unknown[]).filter((value): value is string => typeof value === 'string')
      : [];
    const nextJobs = new Set(currentJobs);
    updater(nextJobs);
    const next = [...nextJobs];
    const unchanged = currentJobs.length === next.length && currentJobs.every((job, index) => job === next[index]);
    if (unchanged) return;
    // Media jobs often finish in the same browser task. Keep the event-facing
    // ref ahead of React's next render so each completion removes its job from
    // the result of the previous completion instead of from a stale snapshot.
    assetsRef.current = assetsRef.current.map((entry) => (
      entry.id === assetId
        ? { ...entry, metadata: { ...(entry.metadata ?? {}), processingJobs: next } }
        : entry
    ));
    wrappedDispatch({
      type: 'UPDATE_ASSET',
      asset: { id: assetId, metadata: { processingJobs: next } },
    });
  }, [wrappedDispatch]);


  const isDeriveJobType = useCallback((jobType: string | undefined): jobType is typeof DERIVE_JOB_TYPES[number] => (
    Boolean(jobType && DERIVE_JOB_TYPES.includes(jobType as typeof DERIVE_JOB_TYPES[number]))
  ), []);

  const applyMediaJobResult = useCallback((assetId: string, jobType: string | undefined, result: unknown) => {
    if (jobType) {
      updateAssetProcessingJobs(assetId, (jobs) => {
        jobs.delete(jobType);
      });
    }

    if (jobType === 'extract_metadata') {
      const meta = result as {
        duration?: number; width?: number; height?: number;
        fps?: number; codec?: string; fileSize?: number;
      } | undefined;
      if (!meta) return;

      wrappedDispatch({
        type: 'UPDATE_ASSET',
        asset: {
          id: assetId,
          duration: meta.duration,
          width: meta.width,
          height: meta.height,
          fps: meta.fps,
          codec: meta.codec,
          fileSize: meta.fileSize,
          status: 'online' as const,
        },
      });

      // Fix clips that were created with the 5s default before metadata arrived
      if (meta.duration && meta.duration !== 5) {
        const currentTimelines = timelinesRef.current;
        for (const tl of currentTimelines) {
          const affectedClips = tl.clips.filter(
            (c) => c.assetId === assetId && c.duration === 5,
          );
          if (affectedClips.length > 0) {
            const updatedClips = tl.clips.map((c) =>
              c.assetId === assetId && c.duration === 5
                ? { ...c, duration: meta.duration! }
                : c,
            );
            wrappedDispatch({
              type: 'SET_TIMELINE',
              timelineId: tl.id,
              timeline: { ...tl, clips: updatedClips },
            });
          }
        }
      }
      return;
    }

    if (jobType === 'generate_thumbnail') {
      const thumbResult = result as { outputPath?: string } | undefined;
      if (!thumbResult?.outputPath) return;
      wrappedDispatch({
        type: 'UPDATE_ASSET',
        asset: { id: assetId, thumbnailUrl: thumbResult.outputPath },
      });
      return;
    }

    if (jobType === 'compute_waveform') {
      const waveResult = result as { peaks?: number[]; peaksPath?: string } | undefined;
      if (!waveResult?.peaks) return;
      const waveformMeta: Record<string, unknown> = { waveform: waveResult.peaks };
      if (waveResult.peaksPath) {
        waveformMeta.waveformPath = waveResult.peaksPath;
      }
      wrappedDispatch({
        type: 'UPDATE_ASSET',
        asset: {
          id: assetId,
          metadata: waveformMeta,
        },
      });
      return;
    }

    if (jobType === 'generate_filmstrip') {
      const filmResult = result as { outputPath?: string; frames?: string[] } | undefined;
      if (Array.isArray(filmResult?.frames) && filmResult.frames.length > 0) {
        wrappedDispatch({
          type: 'UPDATE_ASSET',
          asset: {
            id: assetId,
            metadata: { filmstrip: filmResult.frames, filmstripUrl: undefined },
          },
        });
        return;
      }
      if (!filmResult?.outputPath) return;
      wrappedDispatch({
        type: 'UPDATE_ASSET',
        asset: {
          id: assetId,
          metadata: { filmstripUrl: filmResult.outputPath, filmstrip: undefined },
        },
      });
      return;
    }

    if (jobType === 'generate_proxy') {
      const proxyResult = result as { outputPath?: string } | undefined;
      if (!proxyResult?.outputPath) return;
      wrappedDispatch({
        type: 'UPDATE_ASSET',
        asset: { id: assetId, proxyRef: proxyResult.outputPath },
      });
    }
  }, [updateAssetProcessingJobs, wrappedDispatch]);


  const queueDeriveJobForAsset = useCallback((asset: Asset, jobType: 'generate_thumbnail' | 'compute_waveform' | 'generate_filmstrip') => {
    if (!asset.fileRef) return Promise.resolve();
    const deriveKey = `${asset.id}:${jobType}`;
    if (deriveInFlightRef.current.has(deriveKey)) return Promise.resolve();
    deriveInFlightRef.current.add(deriveKey);
    updateAssetProcessingJobs(asset.id, (jobs) => {
      jobs.add(jobType);
    });
    return window.electronAPI.media.queueProcessing({
      assetId: asset.id,
      projectId,
      inputPath: asset.fileRef,
      needsProxy: false,
      includeThumbnail: jobType === 'generate_thumbnail',
      includeWaveform: jobType === 'compute_waveform',
      includeFilmstrip: jobType === 'generate_filmstrip',
    }).catch((error) => {
      deriveInFlightRef.current.delete(deriveKey);
      throw error;
    });
  }, [projectId, updateAssetProcessingJobs]);


  // Listen for media worker completion/error events; queue early completions until the asset exists in state.
  useEffect(() => {
    const unsubComplete = window.electronAPI.media.onJobComplete((data) => {
      const { assetId, jobType, result } = data as {
        jobId: string; result: unknown; assetId?: string; jobType?: string;
      };
      if (!assetId) return;

      mediaDebug('media job complete', {
        assetId,
        jobType,
        result: (() => {
          if (!result || typeof result !== 'object') return result;
          const r = result as Record<string, unknown>;
          return {
            outputPath: r.outputPath,
            frames: Array.isArray(r.frames) ? r.frames.length : undefined,
            duration: r.duration,
            width: r.width,
            height: r.height,
            codec: r.codec,
            fileSize: r.fileSize,
            hasPeaks: Array.isArray(r.peaks) ? r.peaks.length : undefined,
          };
        })(),
      });

      const hasAsset = assetsRef.current.some((a) => a.id === assetId);
      if (!hasAsset) {
        const pending = pendingMediaEventsRef.current.get(assetId) ?? [];
        pending.push({ jobType, result });
        pendingMediaEventsRef.current.set(assetId, pending);
        return;
      }

      if (isDeriveJobType(jobType)) {
        deriveInFlightRef.current.delete(`${assetId}:${jobType}`);
        deriveRetryCountsRef.current.delete(`${assetId}:${jobType}`);
      }

      applyMediaJobResult(assetId, jobType, result);
    });

    const unsubError = window.electronAPI.media.onJobError((data) => {
      const { assetId, jobType, error } = data as {
        jobId: string; error: string; assetId?: string; jobType?: string;
      };
      if (!assetId || !jobType) return;
      if (isDeriveJobType(jobType)) {
        deriveInFlightRef.current.delete(`${assetId}:${jobType}`);
      }

      mediaDebugError('media job error', { assetId, jobType, error });
      console.error(`[workspace] Media job failed (${jobType}) for asset ${assetId}: ${error}`);
      if (jobType !== 'generate_thumbnail' && jobType !== 'compute_waveform' && jobType !== 'generate_filmstrip') {
        updateAssetProcessingJobs(assetId, (jobs) => {
          jobs.delete(jobType);
        });
        return;
      }

      const asset = assetsRef.current.find((a) => a.id === assetId);
      if (!asset?.fileRef) return;

      const retryKey = `${assetId}:${jobType}`;
      const attempts = deriveRetryCountsRef.current.get(retryKey) ?? 0;
      const maxRetries = 4;
      if (attempts >= maxRetries) {
        updateAssetProcessingJobs(assetId, (jobs) => {
          jobs.delete(jobType);
        });
        return;
      }
      deriveRetryCountsRef.current.set(retryKey, attempts + 1);

      const delayMs = 800 * (attempts + 1);
      setTimeout(() => {
        queueDeriveJobForAsset(asset, jobType)
          .catch((err) => {
            console.error('[workspace] Retry queueing failed:', err);
            updateAssetProcessingJobs(assetId, (jobs) => {
              jobs.delete(jobType);
            });
          });
      }, delayMs);
    });

    return () => {
      unsubComplete();
      unsubError();
    };
  }, [applyMediaJobResult, isDeriveJobType, queueDeriveJobForAsset, updateAssetProcessingJobs]);

  // Flush queued media updates once their assets are present.
  useEffect(() => {
    if (pendingMediaEventsRef.current.size === 0) return;
    const assetIds = new Set(state.assets.map((a) => a.id));

    for (const [assetId, events] of pendingMediaEventsRef.current.entries()) {
      if (!assetIds.has(assetId)) continue;
      pendingMediaEventsRef.current.delete(assetId);
      for (const ev of events) {
        applyMediaJobResult(assetId, ev.jobType, ev.result);
      }
    }
  }, [state.assets, applyMediaJobResult]);


  useAssetMediaBackfill(state.assets, projectId, deriveInFlightRef, wrappedDispatch, updateAssetProcessingJobs);

  const value = useMemo(() => ({ state, dispatch: wrappedDispatch, projectId }), [state, wrappedDispatch, projectId]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
