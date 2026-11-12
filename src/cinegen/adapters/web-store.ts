// @ts-nocheck — a port of CineGen web's plain-JS ProjectStore; typed loosely on purpose.
// [remix] CineGen web's ProjectStore (web/server/index.mjs), same class and handlers; the only change is where the JSON
// lives: IndexedDB in the browser instead of files under CINEGEN_WEB_DATA_ROOT. It backs `project.*`, `db.*` and
// `elements.{load,save}Library`, the same RPC methods CineGen's web server exposes (buildRpcHandlers).
import { registerElectronApi } from './electron-shim';

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const DB_NAME = 'remix-cinegen-web';
const STORE = 'kv';

class StoreError extends Error {
  status: number; code: string;
  constructor(status: number, message: string, code = 'REQUEST_FAILED') { super(message); this.name = 'StoreError'; this.status = status; this.code = code; }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function kv<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
const kvDelete = (key: string) => kv('readwrite', (s) => s.delete(key)).then(() => undefined);
async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await kv<string | undefined>('readonly', (s) => s.get(key) as IDBRequest<string | undefined>);
  return raw === undefined ? fallback : JSON.parse(raw);
}
async function writeJsonAtomic(key: string, value: unknown) { await kv('readwrite', (s) => s.put(JSON.stringify(value), key)); }

function timestamp() { return new Date().toISOString(); }
function assertId(value: unknown, label = 'id') {
  if (typeof value !== 'string' || !SAFE_ID.test(value)) throw new StoreError(400, `Invalid ${label}.`, 'INVALID_ID');
  return value as string;
}

const EMPTY_DIRECTOR = {
  sourceText: '',
  clipLengthSec: 20,
  stylePrefix: '',
  aspectRatio: '16:9',
  adapterId: 'topview-auto',
  resolution: '720p',
  generateAudio: true,
  genre: 'auto',
  mode: 'source',
  breakdown: [],
  breakdownApproved: false,
  scenes: [],
  clips: [],
  jobStatus: null,
};

function createDefaultProjectState(name) {
  const id = crypto.randomUUID();
  const now = timestamp();
  const timelineId = crypto.randomUUID();
  const videoTrackId = crypto.randomUUID();
  const audioTrackId = crypto.randomUUID();
  const spaceId = crypto.randomUUID();
  return {
    project: {
      id,
      name,
      created_at: now,
      updated_at: now,
      resolution_width: 1920,
      resolution_height: 1080,
      frame_rate: 24,
    },
    assets: [],
    mediaFolders: [],
    sets: [],
    timelines: [{
      id: timelineId,
      project_id: id,
      name: 'Timeline 1',
      duration: 0,
      created_at: now,
      markers: '[]',
      fit: 'contain', // [remix] new timelines store their fit; older ones have none and keep Cover
      tracks: [
        {
          id: videoTrackId,
          timeline_id: timelineId,
          name: 'V1', // [remix] new projects start with four tracks (V1 V2 / A1 A2), as CineGen's own default timeline
          kind: 'video',
          color: '#4A90D9',
          muted: 0,
          solo: 0,
          locked: 0,
          visible: 1,
          volume: 1,
          sort_order: 0,
        },
        {
          id: audioTrackId,
          timeline_id: timelineId,
          name: 'A1',
          kind: 'audio',
          color: '#7ED321',
          muted: 0,
          solo: 0,
          locked: 0,
          visible: 1,
          volume: 1,
          sort_order: 1,
        },
        { id: crypto.randomUUID(), timeline_id: timelineId, name: 'V2', kind: 'video', color: '#4A90D9', muted: 0, solo: 0, locked: 0, visible: 1, volume: 1, sort_order: 2 },
        { id: crypto.randomUUID(), timeline_id: timelineId, name: 'A2', kind: 'audio', color: '#7ED321', muted: 0, solo: 0, locked: 0, visible: 1, volume: 1, sort_order: 3 },
      ],
      clips: [],
      transitions: [],
    }],
    activeTimelineId: timelineId,
    workflow: {
      nodes: [],
      edges: [],
      spaces: [{ id: spaceId, name: 'Space 1', createdAt: now, nodes: [], edges: [] }],
      activeSpaceId: spaceId,
      openSpaceIds: [spaceId],
      director: EMPTY_DIRECTOR,
    },
    elements: [],
    exports: [],
    director: EMPTY_DIRECTOR,
  };
}

export class ProjectStore {
  constructor() {
    this.indexPath = 'projects.json';
  }

  async initialize() { /* nothing to create: keys are made on first write */ }

  projectPath(id) {
    return `projects/${assertId(id, 'project id')}/project.json`;
  }

  async readIndex() {
    const index = await readJson(this.indexPath, { projects: [] });
    return Array.isArray(index?.projects) ? index : { projects: [] };
  }

  async writeIndex(index) {
    await writeJsonAtomic(this.indexPath, index);
  }

  metaFromState(state, previous = {}) {
    const assets = Array.isArray(state.assets) ? state.assets : [];
    const elements = Array.isArray(state.elements) ? state.elements : [];
    const firstThumb = assets.find((asset) => typeof asset?.thumbnail_url === 'string')?.thumbnail_url ?? null;
    return {
      id: state.project.id,
      name: state.project.name,
      createdAt: state.project.created_at || previous.createdAt || timestamp(),
      updatedAt: state.project.updated_at || timestamp(),
      assetCount: assets.length,
      elementCount: elements.length,
      thumbnail: firstThumb,
      useSqlite: true,
    };
  }

  async list() {
    const index = await this.readIndex();
    return [...index.projects].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  async create(name) {
    const normalized = typeof name === 'string' ? name.trim() : '';
    if (!normalized || normalized.length > 100) {
      throw new StoreError(400, 'Project name must be 1-100 characters.', 'INVALID_PROJECT_NAME');
    }
    const state = createDefaultProjectState(normalized);
    await writeJsonAtomic(this.projectPath(state.project.id), state);
    const index = await this.readIndex();
    index.projects = [this.metaFromState(state), ...index.projects.filter((entry) => entry.id !== state.project.id)];
    await this.writeIndex(index);
    return state;
  }

  async load(id) {
    const state = await readJson(this.projectPath(id), null);
    if (!state) throw new StoreError(404, `Project not found: ${id}`, 'PROJECT_NOT_FOUND');
    return state;
  }

  async save(id, state) {
    assertId(id, 'project id');
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      throw new StoreError(400, 'Project state must be an object.', 'INVALID_PROJECT_STATE');
    }
    const previous = await this.load(id);
    const now = timestamp();
    const next = {
      ...state,
      project: {
        ...previous.project,
        ...(state.project ?? {}),
        id,
        created_at: state.project?.created_at || previous.project.created_at,
        updated_at: now,
      },
      assets: Array.isArray(state.assets) ? state.assets : previous.assets,
      mediaFolders: Array.isArray(state.mediaFolders) ? state.mediaFolders : previous.mediaFolders,
      timelines: Array.isArray(state.timelines) ? state.timelines : previous.timelines,
      workflow: state.workflow && typeof state.workflow === 'object' ? state.workflow : previous.workflow,
      elements: Array.isArray(state.elements) ? state.elements : previous.elements,
      exports: Array.isArray(state.exports) ? state.exports : previous.exports,
      director: state.director !== undefined ? state.director : previous.director,
    };
    await writeJsonAtomic(this.projectPath(id), next);
    const index = await this.readIndex();
    const priorMeta = index.projects.find((entry) => entry.id === id);
    const meta = this.metaFromState(next, priorMeta);
    index.projects = [meta, ...index.projects.filter((entry) => entry.id !== id)];
    await this.writeIndex(index);
    return next;
  }

  async patchProject(id, partial) {
    const state = await this.load(id);
    return this.save(id, { ...state, project: { ...state.project, ...(partial ?? {}) } });
  }

  async delete(id) {
    assertId(id, 'project id');
    await kvDelete(this.projectPath(id));
    const index = await this.readIndex();
    index.projects = index.projects.filter((entry) => entry.id !== id);
    await this.writeIndex(index);
  }

  libraryPath() {
    return 'elements-library.json';
  }

  async saveElementsLibrary(library) {
    const folders = Array.isArray(library?.folders) ? library.folders : [];
    const elements = Array.isArray(library?.elements) ? library.elements : [];
    const next = { version: 1, folders, elements };
    await writeJsonAtomic(this.libraryPath(), next);
    return next;
  }

  async loadElementsLibrary(opts = {}) {
    const existing = await readJson(this.libraryPath(), null);
    let library = existing && typeof existing === 'object'
      ? { version: 1, folders: Array.isArray(existing.folders) ? existing.folders : [], elements: Array.isArray(existing.elements) ? existing.elements : [] }
      : null;

    if (!library) {
      const index = await this.readIndex();
      const folders = [];
      const byId = new Map();
      for (const project of index.projects) {
        let incoming = [];
        try {
          const state = await this.load(project.id);
          incoming = Array.isArray(state.elements) ? state.elements : [];
        } catch { incoming = []; }
        if (incoming.length === 0) continue;
        const folder = {
          id: crypto.randomUUID(),
          name: project.name || 'Untitled project',
          createdAt: timestamp(),
          sourceProjectId: project.id,
        };
        folders.push(folder);
        for (const el of incoming) {
          if (!el?.id || byId.has(el.id)) continue;
          byId.set(el.id, { ...el, folderId: el.folderId || folder.id });
        }
      }
      library = { version: 1, folders, elements: [...byId.values()] };
      await writeJsonAtomic(this.libraryPath(), library);
    }

    if (opts.projectId && opts.projectName) {
      const folders = [...library.folders];
      const existingFolder = folders.find((f) => f.sourceProjectId === opts.projectId);
      const name = String(opts.projectName).trim() || 'Untitled project';
      if (!existingFolder) {
        folders.push({
          id: crypto.randomUUID(),
          name,
          createdAt: timestamp(),
          sourceProjectId: opts.projectId,
        });
        library = { ...library, folders };
        await writeJsonAtomic(this.libraryPath(), library);
      } else if (existingFolder.name !== name) {
        library = {
          ...library,
          folders: folders.map((f) => (f.id === existingFolder.id ? { ...f, name } : f)),
        };
        await writeJsonAtomic(this.libraryPath(), library);
      }
    }
    return library;
  }

  async insertAsset(asset) {
    const projectId = assertId(asset?.project_id, 'asset project id');
    const state = await this.load(projectId);
    const assets = Array.isArray(state.assets) ? state.assets : [];
    const nextAsset = { ...asset, id: asset.id || crypto.randomUUID(), project_id: projectId };
    return this.save(projectId, {
      ...state,
      assets: [nextAsset, ...assets.filter((entry) => entry.id !== nextAsset.id)],
    }).then(() => nextAsset);
  }

  async updateAsset(projectId, id, partial) {
    assertId(projectId, 'project id');
    assertId(id, 'asset id');
    const state = await this.load(projectId);
    let found = false;
    const assets = (state.assets ?? []).map((asset) => {
      if (asset.id !== id) return asset;
      found = true;
      return { ...asset, ...(partial ?? {}), id, project_id: projectId };
    });
    if (!found) throw new StoreError(404, `Asset not found: ${id}`, 'ASSET_NOT_FOUND');
    await this.save(projectId, { ...state, assets });
  }

  async deleteAsset(projectId, id) {
    assertId(projectId, 'project id');
    assertId(id, 'asset id');
    const state = await this.load(projectId);
    await this.save(projectId, {
      ...state,
      assets: (state.assets ?? []).filter((asset) => asset.id !== id),
    });
  }
}


const store = new ProjectStore();
const createLegacySnapshot = (state: any) => ({
  project: { id: state.project.id, name: state.project.name, createdAt: state.project.created_at, updatedAt: state.project.updated_at },
  workflow: state.workflow,
  spaces: state.workflow.spaces ?? [],
  activeSpaceId: state.workflow.activeSpaceId ?? '',
  openSpaceIds: state.workflow.openSpaceIds ?? [],
  assets: state.assets,
  mediaFolders: state.mediaFolders,
  timelines: state.timelines,
  activeTimelineId: state.activeTimelineId,
  exports: state.exports,
  elements: state.elements,
  director: state.director ?? state.workflow?.director ?? EMPTY_DIRECTOR,
  sets: state.sets ?? state.workflow?.sets ?? [],
});

/** Same method table as CineGen web's buildRpcHandlers (project / db / elements library). */
export function registerWebStore() {
  registerElectronApi('project', {
    list: () => store.list(),
    create: async (name: unknown) => createLegacySnapshot(await store.create(name)),
    load: async (id: unknown) => createLegacySnapshot(await store.load(id)),
    save: async (id: unknown, updates: any) => {
      const current = await store.load(id);
      const next = await store.save(id, { ...current, ...updates, project: { ...current.project, ...(updates?.project ?? {}) } });
      return createLegacySnapshot(next);
    },
    delete: (id: unknown) => store.delete(id),
  });
  registerElectronApi('db', {
    createProject: (name: unknown) => store.create(name),
    loadProject: (id: unknown) => store.load(id),
    saveProject: async (id: unknown, state: unknown) => { await store.save(id, state); },
    deleteProject: (id: unknown) => store.delete(id),
    closeProject: async () => {},
    updateProject: async (id: unknown, data: unknown) => { await store.patchProject(id, data); },
    insertAsset: (asset: unknown) => store.insertAsset(asset),
    updateAsset: (projectId: unknown, id: unknown, data: unknown) => store.updateAsset(projectId, id, data),
    deleteAsset: (projectId: unknown, id: unknown) => store.deleteAsset(projectId, id),
  });
  registerElectronApi('elements', {
    loadLibrary: (opts: unknown) => store.loadElementsLibrary(opts ?? {}),
    saveLibrary: (library: unknown) => store.saveElementsLibrary(library),
  });
  registerElectronApi('pm', { openProject: async () => ({ ok: true }), open: async () => ({ ok: true }) });
}
