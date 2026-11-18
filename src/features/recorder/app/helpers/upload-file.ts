// Browser version of Recorder's upload: the take is saved into the project store as
// `<folder>/<prefix><endDate>.<ext>` (the same name the local server wrote into public/).
import { WEBCAM_PREFIX } from "../../config/cameras";
import type { SelectableScene } from "../../config/scenes";
import { defaultVideoScene, emptyProjectProps } from "../../studio/project-defaults";
import { getProps, getStaticFiles, setProps, writeStaticFile } from "../../studio/project-store";
import { getExtension } from "./find-good-supported-codec";

export const parseJsonOrThrowSource = (data: Uint8Array, type: string) => {
  const asString = new TextDecoder("utf-8").decode(data);
  try {
    return JSON.parse(asString);
  } catch {
    throw new Error(`Invalid JSON (${type}): ${asString}`);
  }
};

/** Give the project one video scene per webcam take (Recorder asks you to add them by hand). */
export const ensureSceneForEachTake = async (folder: string) => {
  const takes = getStaticFiles().filter((f) => f.name.startsWith(`${folder}/${WEBCAM_PREFIX}`)).length;
  const props = (getProps(folder) as ReturnType<typeof emptyProjectProps> | null) ?? emptyProjectProps();
  const scenes = props.scenes as SelectableScene[];
  const videoScenes = scenes.filter((s) => s.type === "videoscene").length;
  if (videoScenes >= takes) return;
  const added = Array.from({ length: takes - videoScenes }, defaultVideoScene);
  const endcardAt = scenes.findIndex((s) => s.type === "endcard");
  const next = endcardAt === -1 ? [...scenes, ...added] : [...scenes.slice(0, endcardAt), ...added, ...scenes.slice(endcardAt)];
  await setProps(folder, { ...props, scenes: next });
};

export const uploadFileToServer = async ({
  blob,
  endDate,
  prefix,
  selectedFolder,
  mimeType,
}: {
  blob: Blob;
  endDate: number;
  prefix: string;
  selectedFolder: string;
  expectedFrames: number;
  mimeType: string;
}) => {
  const extension = getExtension(mimeType);
  await writeStaticFile({
    filePath: `${selectedFolder}/${prefix}${endDate}.${extension}`,
    contents: blob.type ? blob : new Blob([blob], { type: mimeType }),
  });
  if (prefix === WEBCAM_PREFIX) await ensureSceneForEachTake(selectedFolder);
};
