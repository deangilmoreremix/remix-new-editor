import { createRoot } from "react-dom/client";
import { RecorderStudio } from "./RecorderStudio";
import { getRecorderProject } from "./project";
import type { RecorderProject } from "./project";
import type { ExportResult } from "./export";
import type { TakeSource } from "./project";

export type { ExportResult, TakeSource };
export { getRecorderProject };

/** Mounts Recorder Studio into `el`; returns an unmount function. */
export const mountRecorderStudio = (
  el: HTMLElement,
  options: { project?: RecorderProject; onAddToTimeline?: (result: ExportResult) => void } = {},
) => {
  const root = createRoot(el);
  root.render(<RecorderStudio project={options.project ?? getRecorderProject()} onAddToTimeline={options.onAddToTimeline} />);
  return () => root.unmount();
};
