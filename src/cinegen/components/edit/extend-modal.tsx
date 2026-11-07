import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { getApiKey, getKieApiKey } from '@cinegen/lib/utils/api-key';
import { runWorkflow } from '@cinegen/lib/cloud/funding';
import { toFileUrl } from '@cinegen/lib/utils/file-url';
import type { Clip } from '@cinegen/types/timeline';
import { clipEffectiveDuration } from '@cinegen/types/timeline';
import type { Asset } from '@cinegen/types/project';

/* [remix] Extend on MuAPI: "after" animates from the clip's last frame (image-to-video),
   "before" leads into the first frame (first/last-frame model). Replaces the fal/Kie model list. */
import { IMAGE_TO_VIDEO_MODELS, FIRST_LAST_FRAME_MODELS, DEFAULT_IMAGE_TO_VIDEO_MODEL, DEFAULT_FILL_GAP_MODEL } from '../../../lib/muapi/frameModels.js';

const modelsFor = (direction: 'before' | 'after') => Object.entries((direction === 'before' ? FIRST_LAST_FRAME_MODELS : IMAGE_TO_VIDEO_MODELS) as Record<string, { label: string; durations: number[] }>)
  .map(([id, m]) => ({ id: `muapi:${id}`, name: m.label, durations: m.durations }));

function snapDuration(sec: number, modelId: string, direction: 'before' | 'after'): number {
  const m = modelsFor(direction).find((x) => x.id === modelId);
  const opts = m?.durations ?? [5, 10];
  const [lo, hi] = opts.length === 2 && opts[1] - opts[0] > 2 && direction === 'before' ? opts : [opts[0], opts[opts.length - 1]];
  if (direction === 'before') return Math.min(hi, Math.max(lo, Math.round(sec)));
  for (const opt of opts) if (opt >= sec) return opt;
  return opts[opts.length - 1];
}

function buildModelInputs(
  modelId: string,
  direction: 'before' | 'after',
  frameUrl: string,
  prompt: string,
  duration: number,
): Record<string, unknown> {
  void modelId;
  return { prompt: prompt.trim(), duration, image_urls: [frameUrl], direction };
}

function extractFrameAtTime(
  videoUrl: string,
  timeSec: number,
  signal: AbortSignal,
): Promise<{ blob: Blob; dataUrl: string } | null> {
  return new Promise((resolve) => {
    if (signal.aborted) { resolve(null); return; }
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'auto';
    video.src = videoUrl;

    const timeout = setTimeout(() => { video.src = ''; resolve(null); }, 10000);

    video.addEventListener('loadedmetadata', () => {
      const seekTime = Math.min(Math.max(0, timeSec), video.duration || 0);
      video.currentTime = seekTime;
    }, { once: true });

    video.addEventListener('seeked', () => {
      clearTimeout(timeout);
      if (signal.aborted) { resolve(null); return; }
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          canvas.toBlob((blob) => {
            if (blob) resolve({ blob, dataUrl });
            else resolve(null);
          }, 'image/jpeg', 0.85);
          return;
        }
      } catch { /* CORS */ }
      resolve(null);
    }, { once: true });

    video.addEventListener('error', () => { clearTimeout(timeout); resolve(null); }, { once: true });
    video.load();
  });
}

async function uploadFrame(blob: Blob): Promise<string | null> {
  try {
    const buffer = await blob.arrayBuffer();
    const result = await window.electronAPI.elements.upload(
      { buffer, name: 'extend-frame.jpg', type: 'image/jpeg' },
      getApiKey(),
    );
    return result.url;
  } catch {
    return null;
  }
}

export interface ExtendModalProps {
  clip: Clip;
  asset: Asset;
  sourceClip: Clip;
  sourceAsset: Asset;
  onStartGeneration: (
    clipId: string,
    generationPromise: Promise<{ url: string; durationSec: number }>,
    label: string,
  ) => void;
  onClose: () => void;
}

export function ExtendModal({
  clip,
  asset,
  sourceClip,
  sourceAsset,
  onStartGeneration,
  onClose,
}: ExtendModalProps) {
  const direction = asset.metadata?.extendDirection === 'before' ? 'before' : 'after';
  const [prompt, setPrompt] = useState('');
  const [modelId, setModelId] = useState(() => `muapi:${direction === 'before' ? DEFAULT_FILL_GAP_MODEL : DEFAULT_IMAGE_TO_VIDEO_MODEL}`);
  const [phase, setPhase] = useState<'input' | 'extracting' | 'uploading' | 'generating'>('input');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [refFrame, setRefFrame] = useState<string | null>(null);
  const [frameLoading, setFrameLoading] = useState(true);

  const placeholderDuration = clipEffectiveDuration(clip);

  const seekTime = useMemo(() =>
    direction === 'after'
      ? sourceClip.trimStart + clipEffectiveDuration(sourceClip)
      : sourceClip.trimStart,
    [direction, sourceClip],
  );

  const frameLabel = direction === 'after' ? 'End frame' : 'Start frame';

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    const videoUrl = toFileUrl(sourceAsset.fileRef || sourceAsset.url);
    setFrameLoading(true);
    extractFrameAtTime(videoUrl, seekTime, controller.signal).then((result) => {
      if (result && !controller.signal.aborted) {
        setRefFrame(result.dataUrl);
      }
      if (!controller.signal.aborted) setFrameLoading(false);
    });

    return () => controller.abort();
  }, [sourceAsset, seekTime]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); abortRef.current?.abort(); onClose(); }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) { abortRef.current?.abort(); onClose(); }
  }, [onClose]);

  const isGenerating = phase !== 'input';

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Enter a prompt describing what the extension should show');
      return;
    }
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setPhase('extracting');
      const videoUrl = toFileUrl(sourceAsset.fileRef || sourceAsset.url);
      const frameResult = await extractFrameAtTime(videoUrl, seekTime, controller.signal);
      if (controller.signal.aborted) return;

      let frameUrl: string | null = null;
      if (frameResult) {
        setPhase('uploading');
        frameUrl = await uploadFrame(frameResult.blob);
        if (controller.signal.aborted) return;
      }

      if (!frameUrl) {
        setError('Could not extract reference frame from source clip. Try scrubbing the clip first.');
        setPhase('input');
        return;
      }

      setPhase('generating');
      const snappedDuration = snapDuration(placeholderDuration, modelId, direction);
      const inputs = buildModelInputs(modelId, direction, frameUrl, prompt, snappedDuration);

      const generationPromise = (async (): Promise<{ url: string; durationSec: number }> => {
        const data = await runWorkflow({
          apiKey: getApiKey(),
          kieKey: getKieApiKey(),
          nodeId: 'timeline-extend',
          nodeType: 'video',
          modelId,
          inputs,
        }) as Record<string, unknown>;

        const resultUrls = data.resultUrls as string[] | undefined;
        const url = resultUrls?.[0]
          ?? (data.video_url as string)
          ?? (data.url as string)
          ?? ((data as { video?: { url?: string } }).video?.url);
        if (typeof url !== 'string') throw new Error('No video URL in response');
        return { url, durationSec: snappedDuration };
      })();

      const label = prompt.trim().length > 40
        ? prompt.trim().slice(0, 40).trimEnd() + '...'
        : prompt.trim();

      onStartGeneration(clip.id, generationPromise, label);
      onClose();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message);
        setPhase('input');
      }
    }
  }, [prompt, modelId, direction, placeholderDuration, sourceAsset, seekTime, clip, onStartGeneration, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isGenerating) handleGenerate();
    }
  }, [handleGenerate, isGenerating]);

  const phaseLabel =
    phase === 'extracting' ? 'Extracting frame...'
    : phase === 'uploading' ? 'Uploading frame...'
    : phase === 'generating' ? 'Generating video...'
    : '';

  return (
    <div className="em__backdrop" onMouseDown={handleBackdropClick}>
      <div
        className="em"
        role="dialog"
        aria-modal="true"
        aria-label="Extend Clip"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="em__header">
          <svg className="em__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="13 17 18 12 13 7" /><polyline points="6 17 11 12 6 7" />
          </svg>
          <span className="em__title">Extend</span>
          <span className="em__duration">
            {Math.round(placeholderDuration * 10) / 10}s
          </span>
        </div>

        <div className="em__viewer-wrap">
          <div className="em__viewer-label">{frameLabel}</div>
          <div className={`em__frame${frameLoading && !refFrame ? ' em__frame--loading' : ''}`}>
            {refFrame ? (
              <img src={refFrame} alt={`${frameLabel} of source clip`} draggable={false} />
            ) : frameLoading ? (
              <div className="em__frame-loader" />
            ) : (
              <div className="em__frame-empty">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="2" y="2" width="20" height="20" rx="2" />
                  <line x1="2" y1="16" x2="22" y2="16" />
                </svg>
                <span>No frame</span>
              </div>
            )}
          </div>
        </div>

        <div className="em__field">
          <label className="em__label">Model</label>
          <select
            className="em__select"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            disabled={isGenerating}
          >
            {modelsFor(direction).map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <textarea
          className="em__prompt"
          rows={3}
          placeholder="Describe what the extension should show..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isGenerating}
          autoFocus
        />

        <div className="em__controls">
          <button
            type="button"
            className="em__btn em__btn--secondary"
            onClick={() => { abortRef.current?.abort(); onClose(); }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="em__btn em__btn--primary"
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
          >
            {isGenerating ? phaseLabel : 'Generate'}
          </button>
        </div>

        {isGenerating && (
          <div className="em__progress">
            <div className="em__progress-bar" />
          </div>
        )}

        {error && <div className="em__error">{error}</div>}

        <div className="em__hint">
          <kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</kbd><kbd>↵</kbd> generate · <kbd>Esc</kbd> close
        </div>
      </div>
    </div>
  );
}
