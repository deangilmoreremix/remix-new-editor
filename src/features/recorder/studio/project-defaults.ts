// Starting props for a new Recorder project. Recorder registers a copy of its "empty"
// composition in remotion/Root.tsx for each new folder (scripts/server/register-composition.ts);
// here a project is its saved props.
import type { MainProps } from "../remotion/Main";
import type { SelectableVideoScene } from "../config/scenes";

export const emptyProjectProps = (): MainProps => ({
  theme: "light",
  canvasLayout: "landscape",
  platform: "youtube",
  scenes: [],
  scenesAndMetadata: [],
});

export const defaultVideoScene = (): SelectableVideoScene => ({
  type: "videoscene",
  webcamPosition: "previous",
  startOffset: 0,
  endOffset: 0,
  transitionToNextScene: true,
  newChapter: "",
  stopChapteringAfterThis: false,
  music: "previous",
  bRolls: [],
});
