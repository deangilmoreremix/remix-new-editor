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

/** Turn renderer media errors into something a user can act on. Hosts that don't send
 *  CORS headers can be previewed but not read by the in-browser renderer. */
export const explainExportError = (e: unknown, project: ProjectData): string => {
  const msg = e instanceof Error ? e.message : String(e);
  const src = msg.match(/https?:\/\/[^\s"')]+/)?.[0];
  if (!src || !/(load|fetch|decode|CORS|cross-origin|Failed)/i.test(msg)) return msg;
  const clip = project.tracks.flatMap((t) => t.clips).find((c) => c.props.file === src);
  const name = clip?.label || src.split("/").pop()?.split("?")[0] || "A media file";
  return `"${name}" couldn't be read for export: its host (${new URL(src).host}) doesn't allow in-browser rendering (CORS). Remove or replace that clip and export again.`;
};
