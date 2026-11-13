// Recomputes the composition's metadata (durations, layouts, trimmed start/end frames) with the
// Recorder's own calculateMetadata whenever scenes, files or style change. @remotion/player does
// not run calculateMetadata itself, so Recorder Studio does it here.
import { useEffect, useState, useSyncExternalStore } from "react";
import type { MainProps } from "./composition/remotion/Main";
import { calcMetadata } from "./composition/remotion/calculate-metadata/calc-metadata";
import { COMPOSITION_ID } from "./project-store";
import type { ProjectStore } from "./project-store";

export type StudioMetadata = {
  durationInFrames: number;
  width: number;
  height: number;
  fps: number;
  props: MainProps;
};

export type MetadataState =
  | { status: "empty" }
  | { status: "loading"; previous: StudioMetadata | null }
  | { status: "ready"; metadata: StudioMetadata }
  | { status: "error"; message: string; previous: StudioMetadata | null };

export const useStudioMetadata = (store: ProjectStore): MetadataState => {
  const props = useSyncExternalStore(store.subscribe, store.getProps);
  const revision = useSyncExternalStore(store.subscribe, store.getRevision);
  const [state, setState] = useState<MetadataState>({ status: "empty" });

  useEffect(() => {
    if (props.scenes.length === 0) {
      setState({ status: "empty" });
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState((old) => ({
        status: "loading",
        previous: old.status === "ready" ? old.metadata : old.status === "loading" || old.status === "error" ? old.previous : null,
      }));
      try {
        const result = await (calcMetadata as unknown as (args: unknown) => Promise<StudioMetadata>)({
          props: { ...props, scenesAndMetadata: [] },
          defaultProps: props,
          compositionId: COMPOSITION_ID,
          abortSignal: controller.signal,
          isRendering: false,
        });
        if (!controller.signal.aborted) setState({ status: "ready", metadata: result });
      } catch (err) {
        if (controller.signal.aborted) return;
        setState((old) => ({
          status: "error",
          message: err instanceof Error ? err.message : String(err),
          previous: old.status === "ready" ? old.metadata : old.status === "loading" || old.status === "error" ? old.previous : null,
        }));
      }
    }, 120);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [props, revision]);

  return state;
};
