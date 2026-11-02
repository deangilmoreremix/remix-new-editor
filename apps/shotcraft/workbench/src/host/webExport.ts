import { canRenderMediaOnWeb, renderMediaOnWeb } from "@remotion/web-renderer";
import { MainComposition } from "../preview/Composition";
import type { ProjectData } from "../types";
import { projectEndFrame } from "../types";

export interface ExportProgress {
  progress: number; // 0..1
}

/** Render the current project to MP4 entirely in the browser (WebCodecs via
 *  @remotion/web-renderer). No server, no Lambda. */
export const exportProjectOnWeb = async (
  project: ProjectData,
  onProgress: (p: ExportProgress) => void,
  signal?: AbortSignal,
): Promise<Blob> => {
  const check = await canRenderMediaOnWeb({
    container: "mp4",
    width: project.width,
    height: project.height,
  });
  if (!check.canRender) {
    const msg = check.issues.filter((i) => i.severity === "error").map((i) => i.message).join(" ");
    throw new Error(msg || "This browser can't export video. Use a recent Chrome, Edge or Firefox.");
  }
  const durationInFrames = Math.max(2, projectEndFrame(project));
  const { getBlob } = await renderMediaOnWeb({
    composition: {
      id: "Main",
      component: MainComposition,
      durationInFrames,
      fps: project.fps,
      width: project.width,
      height: project.height,
      defaultProps: { project },
    },
    inputProps: { project },
    container: "mp4",
    videoBitrate: "high",
    onProgress: (p) => onProgress({ progress: Math.min(1, Math.max(0, p.progress)) }),
    signal,
  });
  return getBlob();
};
