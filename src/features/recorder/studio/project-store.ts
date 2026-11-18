// Browser stand-in for the Remotion Studio APIs Recorder relies on (public folder files and
// composition default props). Recorder (remotion-dev/recorder@4c09934) writes takes into
// `public/<folder>/` through a local Node server and edits props through Remotion Studio; here
// both live in the browser: files in IndexedDB (served as object URLs) and props per project.
//
// File names keep Recorder's layout, `<folder>/<prefix><endDate>.<ext>`, so its metadata code
// (calculate-metadata/get-camera.ts) works unchanged.

export type StaticFile = {
  name: string;
  src: string;
  sizeInBytes: number;
  lastModified: number;
};

type Entry = { blob: Blob; lastModified: number; url: string };
type Listener = () => void;

const DB_NAME = "remotion-recorder";
const FILES = "files";
const PROPS = "props";

const entries = new Map<string, Entry>();
const props = new Map<string, Record<string, unknown>>();
const listeners = new Set<Listener>();
const fileWatchers = new Map<string, Set<(f: StaticFile | null) => void>>();

let dbPromise: Promise<IDBDatabase | null> | null = null;
let loaded: Promise<void> | null = null;
let memoryOnly = false;

const OPEN_TIMEOUT_MS = 5000;

const openDb = (): Promise<IDBDatabase | null> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    const idb = globalThis.indexedDB;
    if (!idb || memoryOnly) {
      resolve(null);
      return;
    }
    // A blocked or unanswered open must not stall the studio: carry on in memory.
    const timer = setTimeout(() => resolve(null), OPEN_TIMEOUT_MS);
    try {
      const req = idb.open(DB_NAME, 1);
      req.onblocked = () => {
        clearTimeout(timer);
        resolve(null);
      };
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES);
        if (!db.objectStoreNames.contains(PROPS)) db.createObjectStore(PROPS);
      };
      req.onsuccess = () => {
        clearTimeout(timer);
        resolve(req.result);
      };
      // Private windows can refuse IndexedDB: keep working in memory for this visit.
      req.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
  return dbPromise;
};

const tx = async <T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> => {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = run(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

const toFile = (name: string, e: Entry): StaticFile => ({
  name,
  src: e.url,
  sizeInBytes: e.blob.size,
  lastModified: e.lastModified,
});

const notify = (name?: string) => {
  for (const l of listeners) l();
  if (name) {
    const e = entries.get(name);
    for (const w of fileWatchers.get(name) ?? []) w(e ? toFile(name, e) : null);
  }
};

const mimeFor = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "json") return "application/json";
  if (ext === "webm") return "video/webm";
  if (ext === "mp4") return "video/mp4";
  if (ext === "srt") return "text/plain";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
};

const put = (name: string, blob: Blob, lastModified: number) => {
  const old = entries.get(name);
  if (old) URL.revokeObjectURL(old.url);
  entries.set(name, { blob, lastModified, url: URL.createObjectURL(blob) });
};

/** Read every saved file and project into memory. Safe to call more than once. */
export const loadProjectStore = (): Promise<void> => {
  if (loaded) return loaded;
  loaded = (async () => {
    const db = await openDb();
    if (!db) return;
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction([FILES, PROPS], "readonly");
      const files = t.objectStore(FILES).openCursor();
      files.onsuccess = () => {
        const c = files.result;
        if (!c) return;
        const v = c.value as { blob: Blob; lastModified: number };
        if (!entries.has(String(c.key))) put(String(c.key), v.blob, v.lastModified);
        c.continue();
      };
      const p = t.objectStore(PROPS).openCursor();
      p.onsuccess = () => {
        const c = p.result;
        if (!c) return;
        if (!props.has(String(c.key))) props.set(String(c.key), c.value);
        c.continue();
      };
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
    notify();
  })();
  return loaded;
};

/** Same shape as `getStaticFiles()` from remotion. */
export const getStaticFiles = (): StaticFile[] =>
  [...entries.entries()]
    .map(([name, e]) => toFile(name, e))
    .sort((a, b) => a.name.localeCompare(b.name));

export const getStaticFile = (name: string): StaticFile | null => {
  const e = entries.get(name);
  return e ? toFile(name, e) : null;
};

export const getFileBlob = (name: string): Blob | null => entries.get(name)?.blob ?? null;

/** Same contract as `writeStaticFile()` from @remotion/studio. */
export const writeStaticFile = async ({
  filePath,
  contents,
}: {
  filePath: string;
  contents: string | ArrayBuffer | Blob | Uint8Array;
}) => {
  const name = normalizePath(filePath);
  const blob =
    contents instanceof Blob
      ? contents
      : new Blob([contents as BlobPart], { type: mimeFor(name) });
  const lastModified = Date.now();
  put(name, blob, lastModified);
  notify(name);
  await tx(FILES, "readwrite", (s) => s.put({ blob, lastModified }, name));
  return { name };
};

/** Same contract as `deleteStaticFile()` from @remotion/studio. */
export const deleteStaticFile = async (filePath: string) => {
  const name = normalizePath(filePath);
  const old = entries.get(name);
  if (old) URL.revokeObjectURL(old.url);
  entries.delete(name);
  notify(name);
  await tx(FILES, "readwrite", (s) => s.delete(name));
  return { existed: Boolean(old) };
};

/** Same contract as `watchStaticFile()` from @remotion/studio. */
export const watchStaticFile = (
  filePath: string,
  callback: (file: StaticFile | null) => void,
) => {
  const name = normalizePath(filePath);
  const set = fileWatchers.get(name) ?? new Set();
  set.add(callback);
  fileWatchers.set(name, set);
  return {
    cancel: () => {
      set.delete(callback);
    },
  };
};

export const subscribeProjectStore = (l: Listener) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

const normalizePath = (p: string) => p.replace(/^\/+/, "").replace(/\\/g, "/");

// ---------------------------------------------------------------- folders (projects)

export const FOLDER_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/** Project folders: every folder that holds a file or has saved props. */
export const listFolders = (): string[] => {
  const set = new Set<string>();
  for (const name of entries.keys()) {
    const i = name.indexOf("/");
    if (i > 0) set.add(name.slice(0, i));
  }
  for (const k of props.keys()) set.add(k);
  return [...set].sort();
};

export const createFolder = async (folder: string, initialProps: Record<string, unknown>) => {
  if (!FOLDER_RE.test(folder)) {
    throw new Error("Use letters, numbers, - and _ only (up to 64 characters).");
  }
  if (listFolders().includes(folder)) throw new Error(`"${folder}" already exists.`);
  await setProps(folder, initialProps);
};

export const deleteFolder = async (folder: string) => {
  for (const name of [...entries.keys()]) {
    if (name.startsWith(`${folder}/`)) await deleteStaticFile(name);
  }
  props.delete(folder);
  notify();
  await tx(PROPS, "readwrite", (s) => s.delete(folder));
};

// ---------------------------------------------------------------- default props

export const getProps = <T = Record<string, unknown>>(compositionId: string): T | null =>
  (props.get(compositionId) as T | undefined) ?? null;

export const setProps = async (compositionId: string, value: Record<string, unknown>) => {
  props.set(compositionId, value);
  notify();
  await tx(PROPS, "readwrite", (s) => s.put(value, compositionId));
};

type PropsUpdater = (p: {
  unsavedDefaultProps: Record<string, unknown>;
  savedDefaultProps: Record<string, unknown>;
}) => Record<string, unknown>;

/** Same contract as `updateDefaultProps()` from @remotion/studio (saved immediately here). */
export const updateDefaultProps = ({
  compositionId,
  defaultProps,
}: {
  compositionId: string;
  defaultProps: PropsUpdater;
}) => {
  const current = props.get(compositionId) ?? {};
  const next = defaultProps({ unsavedDefaultProps: current, savedDefaultProps: current });
  return setProps(compositionId, next);
};

/** Same contract as `saveDefaultProps()` from @remotion/studio. */
export const saveDefaultProps = updateDefaultProps;

/** Same idea as `focusDefaultPropsPath()`: the studio's scene list follows playback. */
export const FOCUS_SCENE_EVENT = "recorder:focus-scene";
export const focusDefaultPropsPath = ({ path }: { path: (string | number)[]; scrollBehavior?: ScrollBehavior }) => {
  if (typeof window === "undefined" || path[0] !== "scenes") return;
  window.dispatchEvent(new CustomEvent(FOCUS_SCENE_EVENT, { detail: { index: path[1] } }));
};

/** For tests: forget everything held in memory (and optionally skip IndexedDB). */
export const __resetProjectStore = ({ memory = true }: { memory?: boolean } = {}) => {
  memoryOnly = memory;
  for (const e of entries.values()) URL.revokeObjectURL(e.url);
  entries.clear();
  props.clear();
  listeners.clear();
  fileWatchers.clear();
  loaded = null;
  dbPromise = null;
};

// ---------------------------------------------------------------- project file references

/**
 * Props are saved, object URLs are not: a project file is referred to as `project:<name>`
 * in saved props and resolved to its current object URL when drawn.
 */
export const PROJECT_SRC_PREFIX = "project:";

export const projectSrc = (name: string) => `${PROJECT_SRC_PREFIX}${normalizePath(name)}`;

export const resolveProjectSrc = (src: string): string => {
  if (!src.startsWith(PROJECT_SRC_PREFIX)) return src;
  return entries.get(src.slice(PROJECT_SRC_PREFIX.length))?.url ?? "";
};
