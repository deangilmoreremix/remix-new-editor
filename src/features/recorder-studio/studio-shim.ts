// Replacement for the handful of Remotion Studio / filesystem APIs the vendored Remotion
// Recorder composition relies on (getStaticFiles, writeStaticFile, updateDefaultProps, ...).
// Files live in memory as blob URLs instead of a project folder on disk.
import type { StaticFile } from "remotion";
import { getActiveProjectStore } from "./project-store";
import type { StudioProps } from "./project-store";

export type { StaticFile };

const ASSET_BASE = `${import.meta.env?.BASE_URL ?? "/"}recorder-studio/`;

const files = new Map<string, StaticFile>();
const folderListeners = new Set<() => void>();
const fileListeners = new Map<string, Set<(f: StaticFile | null) => void>>();

const MIME: Record<string, string> = {
  json: "application/json",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
};

const notify = (name: string) => {
  folderListeners.forEach((l) => l());
  fileListeners.get(name)?.forEach((l) => l(files.get(name) ?? null));
  // Rewriting a file replaces its blob URL (and revokes the old one), so the composition's
  // metadata, which holds those URLs, must be recomputed.
  getActiveProjectStore()?.bumpRevision();
};

export const registerBlobFile = (name: string, blob: Blob): StaticFile => {
  const previous = files.get(name);
  if (previous) URL.revokeObjectURL(previous.src);
  const file: StaticFile = {
    name,
    src: URL.createObjectURL(blob),
    lastModified: Date.now(),
    sizeInBytes: blob.size,
  };
  files.set(name, file);
  notify(name);
  return file;
};

export const clearProjectFiles = (prefix: string) => {
  [...files.keys()]
    .filter((n) => n.startsWith(prefix))
    .forEach((n) => {
      URL.revokeObjectURL(files.get(n)!.src);
      files.delete(n);
    });
  folderListeners.forEach((l) => l());
};

/** Original file name for a registered blob URL (blob URLs carry no extension), else the input. */
export const nameForSource = (src: string): string =>
  [...files.values()].find((f) => f.src === src)?.name ?? src;

export const getStaticFiles = (): StaticFile[] => [...files.values()];

export const staticFile = (path: string): string =>
  files.get(path)?.src ?? `${ASSET_BASE}${path}`;

export const writeStaticFile = async ({
  filePath,
  contents,
}: {
  filePath: string;
  contents: string | ArrayBuffer;
}) => {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  registerBlobFile(filePath, new Blob([contents], { type: MIME[ext] ?? "application/octet-stream" }));
};

export const deleteStaticFile = async (name: string) => {
  const file = files.get(name);
  if (!file) return;
  URL.revokeObjectURL(file.src);
  files.delete(name);
  notify(name);
};

export const watchPublicFolder = (cb: () => void) => {
  folderListeners.add(cb);
  return { cancel: () => void folderListeners.delete(cb) };
};

export const watchStaticFile = (name: string, cb: (f: StaticFile | null) => void) => {
  if (!fileListeners.has(name)) fileListeners.set(name, new Set());
  fileListeners.get(name)!.add(cb);
  return { cancel: () => void fileListeners.get(name)?.delete(cb) };
};

export const reevaluateComposition = () => getActiveProjectStore()?.bumpRevision();

type PropsUpdater = ({ unsavedDefaultProps }: { unsavedDefaultProps: Record<string, unknown> }) => Record<string, unknown>;

export const updateDefaultProps = ({ defaultProps }: { compositionId: string; defaultProps: PropsUpdater }) => {
  const store = getActiveProjectStore();
  if (!store) return;
  store.setProps((old) => defaultProps({ unsavedDefaultProps: old as unknown as Record<string, unknown> }) as unknown as StudioProps);
};

export const saveDefaultProps = async (args: { compositionId: string; defaultProps: PropsUpdater }) => {
  updateDefaultProps(args);
};

export const focusDefaultPropsPath = ({ path }: { path: (string | number)[]; scrollBehavior?: string }) => {
  getActiveProjectStore()?.focusPath(path);
};

// Some vendored code checks this flag before saving caption edits.
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).remotion_publicFolderExists = "recorder-studio";
}

// Landscape exports normally emit a .srt sidecar instead of burning captions in. Recorder
// Studio lets the user choose; the vendored SrtPreviewAndEditor reads this flag while rendering.
let burnLandscapeCaptions = true;
export const setBurnLandscapeCaptions = (value: boolean) => {
  burnLandscapeCaptions = value;
};
export const shouldBurnLandscapeCaptions = () => burnLandscapeCaptions;
