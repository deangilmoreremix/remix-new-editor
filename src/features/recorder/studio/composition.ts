// Runs Recorder's calculateMetadata (remotion/calculate-metadata/calc-metadata.ts) in the
// browser for a project, for the Player and the web renderer. Remotion Studio did this for
// each registered composition.
import type { Caption } from "@remotion/captions";
import { FPS } from "../config/fps";
import type { SceneAndMetadata } from "../config/scenes";
import { videoConf } from "../config/scenes";
import type { MainProps } from "../remotion/Main";
import { calcMetadata } from "../remotion/calculate-metadata/calc-metadata";
import { combineSrt } from "../remotion/captions/srt/helpers/combine-srt";
import { serializeSrt } from "../remotion/captions/srt/helpers/serialize-srt";
import { emptyProjectProps } from "./project-defaults";
import { getProps } from "./project-store";

export type ProjectComposition = {
  durationInFrames: number;
  width: number;
  height: number;
  fps: number;
  props: MainProps;
};

/** Saved props, with the schema's defaults filled in (Studio validates the same way). */
export const projectProps = (folder: string): MainProps => {
  const saved = (getProps(folder) as MainProps | null) ?? emptyProjectProps();
  const parsed = videoConf.safeParse(saved);
  const base = parsed.success ? parsed.data : saved;
  return { ...saved, ...base, scenesAndMetadata: [] } as MainProps;
};

export const computeComposition = async (
  folder: string,
  props: MainProps = projectProps(folder),
): Promise<ProjectComposition> => {
  const controller = new AbortController();
  const result = await calcMetadata({
    props,
    defaultProps: props,
    compositionId: folder,
    abortSignal: controller.signal,
    isRendering: false,
  } as Parameters<typeof calcMetadata>[0]);
  return {
    durationInFrames: Math.max(1, result.durationInFrames ?? 1),
    width: result.width ?? 1920,
    height: result.height ?? 1080,
    fps: result.fps ?? FPS,
    props: (result.props ?? props) as MainProps,
  };
};

/** The whole video's captions as one SRT file (Recorder emits it as a render artifact). */
export const projectSrt = (scenesAndMetadata: SceneAndMetadata[]): string => {
  const toCombine = scenesAndMetadata.map((scene) => ({
    offsetInMs: Math.round((scene.from * 1000) / FPS),
    srts: scene.type === "video-scene" ? scene.srt : [],
  }));
  return serializeSrt(combineSrt(toCombine)) ?? "";
};

export type { Caption };
