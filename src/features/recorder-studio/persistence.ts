// Saves the Recorder Studio project in this browser (IndexedDB) so takes, captions and scene settings survive a reload.
// Upstream keeps them on disk in a Remotion project folder; a browser app has no folder, so the browser's own storage stands in.
import type { StudioProps } from "./project-store";
import type { RecorderProject } from "./project";
import type { SelectableScene } from "./composition/config/scenes";
import { setUserWordFixes } from "./composition/config/autocorrect";
import type { WordFix } from "./composition/config/autocorrect";
import { getFileBlob, getStaticFiles, nameForSource, registerBlobFile, staticFile } from "./studio-shim";

const DB_NAME = "recorder-studio";
const STORE = "project";
const KEY = "current";
const FILE_PREFIX = "file:"; // marks a B-roll source stored as a project file name instead of a (dead after reload) blob URL

type Meta = {
  version: 1;
  savedAt: number;
  props: StudioProps;
  files: { name: string; lastModified: number }[];
};
type FileEntry = { blob: Blob; lastModified: number };

export type SavedProject = Meta & { blobs: Map<string, Blob> };

const fileKey = (name: string) => `file:${name}`;

// Which files are already in browser storage (name -> lastModified), so a save only writes what changed.
const persisted = new Map<string, number>();

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open browser storage."));
  });

const withStore = async <T,>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> => {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error ?? new Error("Browser storage failed."));
      tx.onabort = () => reject(tx.error ?? new Error("Browser storage is full or unavailable."));
    });
  } finally {
    db.close();
  }
};

/** B-roll `source` URLs are blob URLs that die on reload: store the project file name instead. */
const sourcesToNames = (props: StudioProps): StudioProps => ({
  ...props,
  scenes: props.scenes.map((scene): SelectableScene => {
    if (scene.type !== "videoscene") return scene;
    return {
      ...scene,
      bRolls: scene.bRolls.map((b) => {
        const name = nameForSource(b.source);
        return name !== b.source ? { ...b, source: FILE_PREFIX + name } : b;
      }),
    };
  }),
});

const namesToSources = (props: StudioProps): StudioProps => ({
  ...props,
  scenes: props.scenes.map((scene): SelectableScene => {
    if (scene.type !== "videoscene") return scene;
    return {
      ...scene,
      bRolls: scene.bRolls.map((b) => (b.source.startsWith(FILE_PREFIX) ? { ...b, source: staticFile(b.source.slice(FILE_PREFIX.length)) } : b)),
    };
  }),
});

// Every registered file belongs to the project (the built-in sounds and images are served from /public, not registered).
export const projectFileNames = () => getStaticFiles().map((f) => f.name);

const signature = (props: StudioProps) =>
  JSON.stringify(sourcesToNames(props)) + "|" + getStaticFiles().map((f) => `${f.name}:${f.lastModified}`).join(",");

let lastSignature = "";

export const saveProject = async (project: RecorderProject): Promise<void> => {
  const props = sourcesToNames(project.store.getProps());
  const names = projectFileNames();
  const files = names.map((name) => ({ name, lastModified: getStaticFiles().find((f) => f.name === name)?.lastModified ?? 0 }));
  const meta: Meta = { version: 1, savedAt: Date.now(), props, files };
  await withStore("readwrite", (store) => {
    for (const f of files) {
      const blob = getFileBlob(f.name);
      if (blob && persisted.get(f.name) !== f.lastModified) store.put({ blob, lastModified: f.lastModified } satisfies FileEntry, fileKey(f.name));
    }
    for (const name of [...persisted.keys()]) if (!names.includes(name)) store.delete(fileKey(name));
    return store.put(meta, KEY);
  });
  persisted.clear();
  for (const f of files) persisted.set(f.name, f.lastModified);
  lastSignature = signature(project.store.getProps());
};

export const loadSavedProject = async (): Promise<SavedProject | null> => {
  try {
    const meta = (await withStore("readonly", (s) => s.get(KEY))) as Meta | undefined;
    if (!meta || meta.version !== 1) return null;
    const blobs = new Map<string, Blob>();
    for (const f of meta.files) {
      const entry = (await withStore("readonly", (s) => s.get(fileKey(f.name)))) as FileEntry | undefined;
      if (entry) blobs.set(f.name, entry.blob);
    }
    return { ...meta, blobs };
  } catch {
    return null; // storage unavailable (private window): behave as "nothing saved"
  }
};

export const clearSavedProject = async (): Promise<void> => {
  try {
    await withStore("readwrite", (store) => {
      for (const name of persisted.keys()) store.delete(fileKey(name));
      return store.delete(KEY);
    });
  } catch {
    /* nothing to clear */
  }
  persisted.clear();
  lastSignature = "";
};

// ----- word fixes (Captions tab) live in localStorage: they are settings, not project data -----
const WORD_FIXES_KEY = "recorderStudioWordFixes";

export const loadWordFixes = (): WordFix[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(WORD_FIXES_KEY) ?? "[]") as WordFix[];
    return Array.isArray(parsed) ? parsed.filter((f) => typeof f?.from === "string" && typeof f?.to === "string") : [];
  } catch {
    return [];
  }
};

export const saveWordFixes = (fixes: WordFix[]) => {
  setUserWordFixes(fixes);
  try {
    localStorage.setItem(WORD_FIXES_KEY, JSON.stringify(fixes));
  } catch {
    /* storage unavailable */
  }
};

// ----- restore -----
let restoring: Promise<SavedProject | null> | null = null;

/**
 * Brings back the saved project, once per page session and only into an empty project, so a new take is never added to (and then
 * saved over) a project that was not loaded yet. Resolves with what was restored, or null.
 */
export const ensureRestored = (project: RecorderProject): Promise<SavedProject | null> => {
  restoring ??= (async () => {
    setUserWordFixes(loadWordFixes());
    if (project.store.getProps().scenes.length > 0) return null;
    const saved = await loadSavedProject();
    if (!saved || saved.props.scenes.length === 0) return null;
    for (const f of saved.files) {
      const blob = saved.blobs.get(f.name);
      if (blob) registerBlobFile(f.name, blob);
    }
    // registering gave the files fresh timestamps; remember them as already stored so the next save does not rewrite every video
    for (const f of getStaticFiles()) if (saved.blobs.has(f.name)) persisted.set(f.name, f.lastModified);
    project.store.setProps(namesToSources(saved.props));
    lastSignature = signature(project.store.getProps());
    return saved;
  })();
  return restoring;
};

/** Forget the saved project and start empty (the next ensureRestored finds nothing). */
export const startOver = async (project: RecorderProject) => {
  project.reset();
  await clearSavedProject();
};

export type SaveStatus = { state: "idle" | "saving" | "saved" | "error"; at?: number; message?: string };

/** Saves after every change (debounced). Returns a stop function that also flushes a pending save. */
export const startAutosave = (project: RecorderProject, onStatus: (s: SaveStatus) => void, delayMs = 800) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let dirty = false;
  const flush = async () => {
    if (!dirty) return;
    dirty = false;
    if (project.store.getProps().scenes.length === 0) return; // nothing worth keeping (and don't wipe a saved project while restoring)
    if (signature(project.store.getProps()) === lastSignature) return; // e.g. playback moving between scenes: nothing to save
    onStatus({ state: "saving" });
    try {
      await saveProject(project);
      onStatus({ state: "saved", at: Date.now() });
    } catch (err) {
      onStatus({ state: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };
  const unsubscribe = project.store.subscribe(() => {
    dirty = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flush(), delayMs);
  });
  // A take may have been added before the Studio mounted (the recorder drawer does that): save what is already there too.
  dirty = true;
  timer = setTimeout(() => void flush(), delayMs);
  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
    void flush();
  };
};
