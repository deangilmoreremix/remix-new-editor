'use client';

import { canRenderMediaOnWeb, renderMediaOnWeb, renderStillOnWeb } from '@remotion/web-renderer';
import type { 
  WebRendererVideoCodec, 
  WebRendererAudioCodec, 
  WebRendererContainer, 
  RenderMediaOnWebOptions,
  RenderStillOnWebOptions,
  RenderStillOnWebResult,
  RenderMediaOnWebProgress
} from '@remotion/web-renderer';
import type { ProjectData } from './types';
import { MainComposition } from './preview/Composition';
import { projectEndFrame } from './types';
import { setExportMode, setWebRendering } from './demosrc/_fixtures/ExportMode';

type RenderOptions = {
  project: ProjectData;
  /** `etaMs`: the web renderer's estimate of the time left, when it has one. */
  onProgress?: (progress: number, info?: { etaMs: number | null }) => void;
  signal?: AbortSignal;
  videoCodec?: WebRendererVideoCodec | null;
  audioCodec?: WebRendererAudioCodec | null;
  container?: WebRendererContainer;
  muted?: boolean;
  transparent?: boolean;
  scale?: number;
  licenseKey?: string;
  /** Speed knobs of the web renderer (see the experiments in the export notes). */
  tuning?: Partial<Pick<RenderMediaOnWebOptions<any, any>, 'hardwareAcceleration' | 'pageResponsiveness' | 'keyframeIntervalInSeconds' | 'videoBitrate' | 'mediaCacheSizeInBytes'>>;
};

type CanRenderResult = {
  canRender: boolean;
  issues: string[];
  videoCodec: WebRendererVideoCodec | null;
  audioCodec: WebRendererAudioCodec | null;
  container: WebRendererContainer | null;
};

type RenderResult = {
  blob: Blob;
  progress: number;
};

type StillResult = {
  blob: Blob;
};

/**
 * Check whether the current browser can render media using the Remotion Web Renderer.
 * Uses mediabunny under the hood — checks for WebCodecs, WebGL, and codec support.
 */
export const canRenderVideo = async (opts: {
  width: number;
  height: number;
  transparent?: boolean;
  muted?: boolean;
  videoCodec?: WebRendererVideoCodec | null;
  audioCodec?: WebRendererAudioCodec | null;
  container?: WebRendererContainer;
}): Promise<CanRenderResult> => {
  const result = await canRenderMediaOnWeb({
    width: opts.width,
    height: opts.height,
    transparent: opts.transparent ?? false,
    muted: opts.muted ?? false,
    videoCodec: opts.videoCodec ?? null,
    audioCodec: opts.audioCodec ?? null,
    container: opts.container ?? 'mp4',
  });

  return {
    canRender: result.canRender,
    issues: result.issues.map((i) => i.message),
    videoCodec: result.resolvedVideoCodec,
    audioCodec: result.resolvedAudioCodec,
    // `resolvedOutputTarget` is where the file is written ('web-fs' | 'arraybuffer'), not a
    // container; the container is the one that was asked for.
    container: result.canRender ? opts.container ?? 'mp4' : null,
  };
};

/**
 * How hard the encoder and the page work. A real machine usually has a hardware H.264
 * encoder, which is several times faster than software; headless / sandboxed browsers
 * do not, and asking them for one can stall, so it is probed (with a time limit) and the
 * software encoder is the fallback. Cached for the page's life.
 */
let encoderTuning: Promise<NonNullable<RenderOptions['tuning']>> | null = null;
export const pickEncoderTuning = (size: { width: number; height: number }): Promise<NonNullable<RenderOptions['tuning']>> => {
  encoderTuning ??= (async () => {
    const base = { pageResponsiveness: 'low', keyframeIntervalInSeconds: 2, videoBitrate: 'high' } as const;
    try {
      const Encoder = (globalThis as unknown as { VideoEncoder?: { isConfigSupported: (c: object) => Promise<{ supported?: boolean }> } }).VideoEncoder;
      if (!Encoder) return { ...base, hardwareAcceleration: 'prefer-software' };
      const probe = Encoder.isConfigSupported({ codec: 'avc1.640028', width: size.width, height: size.height, bitrate: 8_000_000, framerate: 30, hardwareAcceleration: 'prefer-hardware' });
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
      const res = await Promise.race([probe, timeout]);
      return { ...base, hardwareAcceleration: res?.supported ? 'prefer-hardware' : 'prefer-software' };
    } catch {
      return { ...base, hardwareAcceleration: 'prefer-software' };
    }
  })();
  return encoderTuning;
};

/**
 * Render a Motion Studio composition to an MP4 Blob entirely in the browser.
 * Uses the Remotion Web Renderer — no server-side rendering required.
 */
export const renderVideoOnWeb = async (opts: RenderOptions): Promise<RenderResult> => {
  const { project, onProgress, signal, muted = false, transparent = false } = opts;
  const { width, height, fps } = project;

  // MainComposition is the React component used by the Remotion Player preview.
  // We wrap it to inject renderExact=true so the web renderer gets the full
  // project duration (matching the server-side export behavior).
  const Component = MainComposition;
  const inputProps = { project, renderExact: true };
  const durationInFrames = Math.max(2, projectEndFrame(project));

  const composition = {
    component: Component as any,
    id: 'Main',
    width,
    height,
    fps,
    durationInFrames,
    defaultProps: inputProps,
  };

  const tuning = { ...(await pickEncoderTuning({ width: Math.round(width * (opts.scale ?? 1)), height: Math.round(height * (opts.scale ?? 1)) })), ...opts.tuning };
  const renderOpts: RenderMediaOnWebOptions<any, any> = {
    composition,
    // CRITICAL: The Remotion Web Renderer drives the component with the
    // `inputProps` option, not via `composition.defaultProps`. Passing
    // `defaultProps` only on the composition object is silently ignored by
    // renderMediaOnWeb, so the component would receive `undefined` props
    // and MainComposition would throw on `project.tracks`. We pass the
    // same payload at both levels so the props are guaranteed to reach
    // the component regardless of which path the web renderer takes.
    inputProps,
    // Remotion license key. Without it the web renderer logs a warning and
    // suppresses the usage/license telemetry POST to https://www.remotion.pro
    // (which the CSP now allows). The team qualifies for Remotion's free
    // license (fewer than 3 employees), so default to "free-license"; a
    // company license can be supplied via NEXT_PUBLIC_REMOTION_LICENSE_KEY
    // without a code change.
    licenseKey: opts.licenseKey ?? process.env.NEXT_PUBLIC_REMOTION_LICENSE_KEY ?? 'free-license',
    videoCodec: opts.videoCodec ?? 'h264',
    audioCodec: opts.audioCodec ?? 'aac',
    container: opts.container ?? 'mp4',
    muted,
    transparent,
    scale: opts.scale ?? 1,
    signal,
    // Encoder, yielding and bitrate come from `pickEncoderTuning`: hardware H.264 when the
    // browser has it, software otherwise (headless / sandboxed browsers, incl. Chromium
    // Headless Shell, have none and can hang on a hardware request).
    ...tuning,
    // Safety net: if any registered card calls delayRender() and never
    // resolves (e.g. a remote asset that 404s, a card waiting on a
    // condition that never fires in this environment), the render will
    // fail fast with a clear "delayRender timed out" error rather than
    // hanging the entire export pipeline for minutes.
    delayRenderTimeoutInMilliseconds: 15_000,
    onProgress: (progress: RenderMediaOnWebProgress) => {
      // Privacy-safe stage log: no project content, only frame counts and
      // percentages. Emitted to console for both real users and E2E tests.
      console.log(
        '[motion-studio:export] progress',
        JSON.stringify({
          stage: 'rendering',
          renderedFrames: progress.renderedFrames,
          encodedFrames: progress.encodedFrames,
          progress: Number(progress.progress.toFixed(3)),
          doneIn: progress.doneIn,
          renderEstimatedTime: progress.renderEstimatedTime,
        }),
      );
      const eta = progress.renderEstimatedTime > 0 && progress.doneIn === null ? progress.renderEstimatedTime : null;
      onProgress?.(progress.progress, { etaMs: eta });
    },
  };

  console.log(
    '[motion-studio:export] starting',
    JSON.stringify({
      width,
      height,
      fps,
      durationInFrames,
      videoCodec: renderOpts.videoCodec,
      audioCodec: renderOpts.audioCodec,
      container: renderOpts.container,
      muted,
      transparent,
    }),
  );

  // Motion-blur recipes draw their world many times a frame; while exporting they draw far fewer.
  setExportMode(true);
  setWebRendering(true);
  let result;
  try {
    result = await renderMediaOnWeb(renderOpts);
  } finally {
    setExportMode(false);
    setWebRendering(false);
  }

  console.log('[motion-studio:export] encoding finished, awaiting blob');

  const blob = await result.getBlob();

  console.log(
    '[motion-studio:export] complete',
    JSON.stringify({ blobSize: blob.size, blobType: blob.type || 'unknown' }),
  );

  return {
    blob,
    progress: 1,
  };
};

/**
 * Whether this browser can draw page content to a canvas natively (Chrome's experimental HTML-in-canvas,
 * `drawElementImage`). The web renderer uses it when present and is then noticeably quicker (measured here:
 * 720p 36 vs 50 ms a frame with no GPU); without it the renderer paints each element itself.
 */
export const supportsHtmlInCanvas = (): boolean => {
  if (typeof document === 'undefined') return false;
  try {
    const ctx = document.createElement('canvas').getContext('2d') as (CanvasRenderingContext2D & { drawElementImage?: unknown }) | null;
    return typeof ctx?.drawElementImage === 'function';
  } catch {
    return false;
  }
};

/** A Chromium-based browser (Chrome, Edge, Brave…): the only ones the flag exists in. */
export const isChromiumBrowser = (): boolean => typeof navigator !== 'undefined' && /Chrome\/\d+/.test(navigator.userAgent) && !/OPR\//.test(navigator.userAgent);

export class RenderUnsupportedError extends Error {}

/**
 * Render a project to MP4 the way every Motion Studio export does: check the
 * browser first (WebCodecs, WebGL, an h264/aac encoder at this size), then
 * render with the codecs that check resolved. The web renderer writes to disk
 * through the File System API when the browser has it, otherwise to memory.
 */
export const exportMp4 = async (opts: Omit<RenderOptions, 'videoCodec' | 'audioCodec' | 'container'>): Promise<RenderResult> => {
  // `scale` renders the same frames at a smaller output size (e.g. 2/3 → 1080p becomes 720p).
  const scale = opts.scale ?? 1;
  const check = await canRenderVideo({ width: Math.round(opts.project.width * scale), height: Math.round(opts.project.height * scale), muted: opts.muted });
  if (!check.canRender) {
    throw new RenderUnsupportedError(
      check.issues.length ? check.issues.join(', ') : 'This browser cannot encode MP4 in this configuration.',
    );
  }
  return renderVideoOnWeb({ ...opts, videoCodec: check.videoCodec, audioCodec: check.audioCodec, container: 'mp4' });
};

/** "about 1 min 20 s left" from the renderer's estimate. */
export const formatEta = (ms: number | null | undefined): string => {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return '';
  const total = Math.max(1, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `about ${m ? `${m} min ` : ''}${m && !sec ? '' : `${sec} s `}left`;
};

/**
 * While a render runs, ask before the tab is closed or reloaded: the web
 * renderer lives in this tab, so leaving it cancels the export. Returns the
 * function that removes the guard.
 */
export const guardTabWhileRendering = (): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = '';
  };
  window.addEventListener('beforeunload', onBeforeUnload);
  return () => window.removeEventListener('beforeunload', onBeforeUnload);
};

/**
 * Render a still frame from the composition as a PNG Blob.
 */
export const renderStillOnWebExport = async (
  project: ProjectData,
  frame: number,
  signal?: AbortSignal,
  /** Output size factor; the frame checks and the frame review do not need full size (a half-size still is ~3× quicker). */
  scale = 1,
): Promise<StillResult> => {
  const { width, height, fps } = project;
  const inputProps = { project, renderExact: true };
  const durationInFrames = Math.max(2, projectEndFrame(project));

  const composition = {
    component: MainComposition as any,
    id: 'Main',
    width,
    height,
    fps,
    durationInFrames,
    defaultProps: inputProps,
  };

  const renderOpts: RenderStillOnWebOptions<any, any> = {
    composition,
    inputProps,
    frame,
    signal,
    scale,
  };

  setWebRendering(true);
  let result;
  try {
    result = await renderStillOnWeb(renderOpts);
  } finally {
    setWebRendering(false);
  }

  const blob = await result.blob();

  return { blob };
};

/**
 * Create a downloadable URL from a rendered Blob.
 * Call URL.revokeObjectURL(url) when done.
 */
export const createDownloadUrl = (blob: Blob): string => {
  return URL.createObjectURL(blob);
};