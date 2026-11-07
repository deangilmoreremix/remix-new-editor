// [remix] CineGen's background visual indexing (workspace-shell.tsx), as a hook for the web provider. The effect and
// its helpers are copied as is; the vision call goes to OpenAI vision (adapters/main-process/vision.ts).
import { useEffect, useRef, type Dispatch } from 'react';
import type { Asset } from '@cinegen/types/project';
import type { WorkspaceAction } from '@cinegen/lib/mcp/workspace-state';
import { getAutoVisualIndexingEnabled, getMaxConcurrentVisionJobs, getBackgroundVisionModel, getOpenAiApiKey } from '@cinegen/lib/utils/api-key';

type VisualIndexState = 'queued' | 'analyzing' | 'ready' | 'failed' | 'missing';

function getAssetVisualIndexState(asset: Asset): VisualIndexState | undefined {
  const metadata = (asset.metadata ?? {}) as Record<string, unknown>;
  const explicit = metadata.llmVisualSummaryStatus;
  if (explicit === 'queued' || explicit === 'analyzing' || explicit === 'ready' || explicit === 'failed' || explicit === 'missing') {
    return explicit;
  }
  const summary = metadata.llmVisualSummary;
  if (!summary || typeof summary !== 'object') return undefined;
  const status = (summary as Record<string, unknown>).status;
  return status === 'queued' || status === 'analyzing' || status === 'ready' || status === 'failed' || status === 'missing'
    ? status
    : undefined;
}

function buildVisualFramePaths(asset: Asset): string[] {
  const metadata = (asset.metadata ?? {}) as Record<string, unknown>;
  const framePaths = Array.isArray(metadata.filmstrip)
    ? metadata.filmstrip.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];
  const filmstripSprite = typeof metadata.filmstripUrl === 'string' && metadata.filmstripUrl.trim()
    ? metadata.filmstripUrl.trim()
    : undefined;
  const thumbnail = typeof asset.thumbnailUrl === 'string' && asset.thumbnailUrl.trim()
    ? asset.thumbnailUrl.trim()
    : undefined;
  const imageSource = asset.type === 'image' && typeof asset.fileRef === 'string' && asset.fileRef.trim()
    ? asset.fileRef.trim()
    : undefined;
  return [...new Set([
    ...framePaths,
    ...(filmstripSprite ? [filmstripSprite] : []),
    ...(thumbnail ? [thumbnail] : []),
    ...(imageSource ? [imageSource] : []),
  ])].slice(0, 6);
}

export function useVisualIndexing(assets: Asset[], wrappedDispatch: Dispatch<WorkspaceAction>) {
  const visionInFlightRef = useRef<Set<string>>(new Set());
  const state = { assets };
  useEffect(() => {
    const apiKey = getOpenAiApiKey(); // [remix] vision runs on the user's OpenAI key
    const autoVisualIndexing = getAutoVisualIndexingEnabled();
    if (!autoVisualIndexing || !apiKey) return;

    const maxConcurrent = getMaxConcurrentVisionJobs();
    const backgroundVisionModel = getBackgroundVisionModel();
    const startupAssetIds = new Set<string>(); // [remix] only assets queued at import are indexed
    const availableSlots = maxConcurrent - visionInFlightRef.current.size;
    if (availableSlots <= 0) return;

    const candidates = state.assets.filter((asset) => {
      if (asset.type !== 'video' && asset.type !== 'image') return false;
      if (visionInFlightRef.current.has(asset.id)) return false;

      const visualState = getAssetVisualIndexState(asset);
      if (visualState === 'ready' || visualState === 'analyzing' || visualState === 'failed' || visualState === 'missing') return false;

      const framePaths = buildVisualFramePaths(asset);
      if (framePaths.length === 0) return false;

      const metadata = (asset.metadata ?? {}) as Record<string, unknown>;
      const processingJobs = Array.isArray(metadata.processingJobs)
        ? metadata.processingJobs.filter((value): value is string => typeof value === 'string')
        : [];
      const waitingOnFilmstrip = asset.type === 'video'
        && processingJobs.includes('generate_filmstrip')
        && !Array.isArray(metadata.filmstrip)
        && !(typeof metadata.filmstripUrl === 'string' && metadata.filmstripUrl.trim());
      if (waitingOnFilmstrip) return false;

      if (visualState === 'queued') return true;
      return startupAssetIds.has(asset.id) && visualState === undefined;
    }).slice(0, availableSlots);

    for (const asset of candidates) {
      const framePaths = buildVisualFramePaths(asset);
      if (framePaths.length === 0) continue;

      visionInFlightRef.current.add(asset.id);
      wrappedDispatch({
        type: 'UPDATE_ASSET',
        asset: {
          id: asset.id,
          metadata: {
            llmVisualSummary: undefined,
            llmVisualSummaryStatus: 'analyzing',
            llmVisualSummaryModel: backgroundVisionModel,
            llmIndexVersion: 1,
          },
        },
      });

      void window.electronAPI.vision.indexAsset({
        apiKey,
        assetId: asset.id,
        assetName: asset.name,
        framePaths,
        model: backgroundVisionModel,
      }).then((summary) => {
        wrappedDispatch({
          type: 'UPDATE_ASSET',
          asset: {
            id: asset.id,
            metadata: {
              llmVisualSummary: summary,
              llmVisualSummaryStatus: summary.status,
              llmVisualSummaryModel: summary.model ?? backgroundVisionModel,
              llmIndexVersion: 1,
              llmIndexUpdatedAt: summary.updatedAt ?? new Date().toISOString(),
            },
          },
        });
      }).catch((error) => {
        wrappedDispatch({
          type: 'UPDATE_ASSET',
          asset: {
            id: asset.id,
            metadata: {
              llmVisualSummary: {
                assetId: asset.id,
                status: 'failed',
                error: error instanceof Error ? error.message : String(error),
                updatedAt: new Date().toISOString(),
                model: backgroundVisionModel,
              },
              llmVisualSummaryStatus: 'failed',
              llmVisualSummaryModel: backgroundVisionModel,
              llmIndexVersion: 1,
              llmIndexUpdatedAt: new Date().toISOString(),
            },
          },
        });
      }).finally(() => {
        visionInFlightRef.current.delete(asset.id);
        // NOTE: Do NOT call setSettingsVersion here — it's in the dependency
        // array and would create an infinite re-render loop. The state.assets
        // update from wrappedDispatch above is sufficient to re-trigger this
        // effect and pick up the next candidate.
      });
    }
  }, [state.assets, wrappedDispatch]);

}
