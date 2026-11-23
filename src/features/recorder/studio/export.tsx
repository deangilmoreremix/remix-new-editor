// Export a Recorder project in the browser with @remotion/web-renderer (Recorder rendered with
// the Remotion CLI or Lambda). MP4/H.264 where the browser can encode it, else WebM/VP8.
import React from "react";
import { Main, type MainProps } from "../remotion/Main";
import { computeComposition, projectSrt } from "./composition";
import { ProjectIdProvider } from "./project-context";

const REMOTION_LICENSE_KEY: string =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_REMOTION_LICENSE_KEY ||
  "free-license";

export const EXPORT_PROFILES = [
  { container: "mp4", videoCodec: "h264", audioCodec: "aac", mimeType: "video/mp4", ext: "mp4" },
  { container: "webm", videoCodec: "vp8", audioCodec: "opus", mimeType: "video/webm", ext: "webm" },
] as const;

type Renderer = typeof import("@remotion/web-renderer");

export type ExportResult = {
  blob: Blob;
  mimeType: string;
  ext: string;
  srt: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
};

export const exportProject = async ({
  folder,
  onProgress,
  signal,
  renderer,
}: {
  folder: string;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
  renderer?: Renderer;
}): Promise<ExportResult> => {
  const r = renderer ?? (await import("@remotion/web-renderer"));
  const comp = await computeComposition(folder);
  if (!comp.props.scenes.length) {
    throw new Error("This project has no scenes to export yet. Record a take or add a scene first.");
  }

  let profile: (typeof EXPORT_PROFILES)[number] | null = null;
  for (const p of EXPORT_PROFILES) {
    const check = await r.canRenderMediaOnWeb({
      container: p.container,
      videoCodec: p.videoCodec,
      audioCodec: p.audioCodec,
      width: comp.width,
      height: comp.height,
      muted: false,
    } as Parameters<Renderer["canRenderMediaOnWeb"]>[0]);
    if (check.canRender) {
      profile = p;
      break;
    }
  }
  if (!profile) {
    throw new Error("This browser cannot export video. Use a recent Chrome or Edge.");
  }

  const Component: React.FC<MainProps> = (p) => (
    <ProjectIdProvider projectId={folder}>
      <Main {...p} />
    </ProjectIdProvider>
  );

  const result = await r.renderMediaOnWeb({
    composition: {
      id: folder,
      component: Component,
      width: comp.width,
      height: comp.height,
      fps: comp.fps,
      durationInFrames: comp.durationInFrames,
      defaultProps: comp.props,
    },
    inputProps: comp.props,
    container: profile.container,
    videoCodec: profile.videoCodec,
    audioCodec: profile.audioCodec,
    muted: false,
    licenseKey: REMOTION_LICENSE_KEY,
    signal,
    onProgress: (p: { progress?: number }) =>
      onProgress?.(Math.max(0, Math.min(1, p?.progress ?? 0))),
  } as unknown as Parameters<Renderer["renderMediaOnWeb"]>[0]);
  const blob = await result.getBlob();
  return {
    blob: blob.type ? blob : new Blob([blob], { type: profile.mimeType }),
    mimeType: profile.mimeType,
    ext: profile.ext,
    srt: projectSrt(comp.props.scenesAndMetadata),
    durationInFrames: comp.durationInFrames,
    fps: comp.fps,
    width: comp.width,
    height: comp.height,
  };
};
