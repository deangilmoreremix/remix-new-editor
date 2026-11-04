import { useCallback, useMemo, useRef, useState } from "react";
import { canRenderMediaOnWeb, renderMediaOnWeb } from "@remotion/web-renderer";
import { z } from "zod";
import { CompositionProps } from "../../types/constants";
import { compileCode } from "../remotion/compiler";
import { notifyExported } from "../host/bridge";

// SmartVid: the template rendered on Remotion Lambda; here the video renders in the
// browser with @remotion/web-renderer (WebCodecs). The state shape is unchanged so the
// upstream RenderControls / DownloadButton / ProgressBar components work as-is.
export type State =
  | { status: "init" }
  | { status: "invoking" }
  | { renderId: string; bucketName: string; progress: number; status: "rendering" }
  | { renderId: string | null; status: "error"; error: Error }
  | { url: string; size: number; status: "done" };

const WIDTH = 1920;
const HEIGHT = 1080;

export const useRendering = (inputProps: z.infer<typeof CompositionProps>) => {
  const [state, setState] = useState<State>({ status: "init" });
  const urlRef = useRef<string | null>(null);

  const renderMedia = useCallback(async () => {
    setState({ status: "invoking" });
    try {
      const { Component, error } = compileCode(inputProps.code);
      if (!Component) throw new Error(error || "The animation code doesn't compile.");
      const check = await canRenderMediaOnWeb({ container: "mp4", width: WIDTH, height: HEIGHT });
      if (!check.canRender) {
        throw new Error(
          check.issues.filter((i) => i.severity === "error").map((i) => i.message).join(" ") ||
            "This browser can't render video. Use a recent Chrome, Edge or Firefox.",
        );
      }
      setState({ status: "rendering", progress: 0, renderId: "web", bucketName: "" });
      const { getBlob } = await renderMediaOnWeb({
        composition: {
          id: "DynamicComp",
          component: Component as React.FC<Record<string, unknown>>,
          durationInFrames: inputProps.durationInFrames,
          fps: inputProps.fps,
          width: WIDTH,
          height: HEIGHT,
        },
        container: "mp4",
        videoBitrate: "high",
        onProgress: (p) =>
          setState({ status: "rendering", progress: Math.min(1, Math.max(0, p.progress)), renderId: "web", bucketName: "" }),
      });
      const blob = await getBlob();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      notifyExported(blob, "video-agent.mp4");
      setState({ status: "done", url, size: blob.size });
    } catch (err) {
      setState({ status: "error", error: err as Error, renderId: null });
    }
  }, [inputProps]);

  const undo = useCallback(() => {
    setState({ status: "init" });
  }, []);

  return useMemo(() => ({ renderMedia, state, undo }), [renderMedia, state, undo]);
};
