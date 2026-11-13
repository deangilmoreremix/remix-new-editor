// Render the Recorder composition to a video file in the browser (WebCodecs), and build the
// matching .srt from the same caption data the composition uses.
import { canRenderMediaOnWeb, renderMediaOnWeb } from "@remotion/web-renderer";
import type { SceneAndMetadata } from "./composition/config/scenes";
import { FPS } from "./composition/config/fps";
import { combineSrt } from "./composition/remotion/captions/srt/helpers/combine-srt";
import { serializeSrt } from "./composition/remotion/captions/srt/helpers/serialize-srt";
import { Main } from "./composition/remotion/Main";
import type { StudioMetadata } from "./useStudioMetadata";
import { setBurnLandscapeCaptions } from "./studio-shim";

export const buildSrt = (scenes: SceneAndMetadata[]): string =>
  serializeSrt(
    combineSrt(
      scenes.map((scene) => ({
        offsetInMs: Math.round((scene.from * 1000) / FPS),
        srts: scene.type === "video-scene" ? scene.srt : [],
      })),
    ),
  );

export type ExportResult = { blob: Blob; container: "mp4" | "webm"; srt: string; durationInSeconds: number };

export const renderStudio = async ({
  metadata,
  burnLandscapeCaptions,
  onProgress,
  signal,
}: {
  metadata: StudioMetadata;
  burnLandscapeCaptions: boolean;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}): Promise<ExportResult> => {
  const { durationInFrames, width, height, fps, props } = metadata;
  setBurnLandscapeCaptions(burnLandscapeCaptions);

  // H.264 + AAC in an MP4 where the browser can encode it; WebM otherwise.
  const can = await canRenderMediaOnWeb({ container: "mp4", width, height } as never).catch(() => ({ canRender: false }));
  const container = (can as { canRender: boolean }).canRender ? "mp4" : "webm";

  const result = await renderMediaOnWeb({
    composition: {
      id: "recorder",
      component: Main as never,
      durationInFrames,
      fps,
      width,
      height,
      defaultProps: props,
    },
    inputProps: props,
    container,
    // Same licence configuration as the editor's other web exports (see motion-director/webRenderer.ts).
    licenseKey: process.env.NEXT_PUBLIC_REMOTION_LICENSE_KEY ?? "free-license",
    signal: signal ?? null,
    onProgress: (p: { progress: number }) => onProgress?.(p.progress),
    logLevel: "warn",
  } as never);

  return {
    blob: await result.getBlob(),
    container,
    srt: buildSrt(props.scenesAndMetadata),
    durationInSeconds: durationInFrames / fps,
  };
};
