// Types for model-cache.js (kept plain JS because the module worker imports it; see local-ai.worker.js).
export interface FileMeta { key: string; repo: string; size: number; type: string; at: number }
export interface Marker { id: string; repo: string; backend: string; bytes: number; at: number }
export interface BlobStore {
  getFile(key: string): Promise<{ blob: Blob; type: string } | undefined>;
  putFile(meta: FileMeta, blob: Blob): Promise<void>;
  deleteFile(key: string): Promise<boolean>;
  listMeta(): Promise<FileMeta[]>;
  getMarker(id: string): Promise<Marker | undefined>;
  setMarker(m: Marker): Promise<void>;
  deleteMarker(id: string): Promise<void>;
  listMarkers(): Promise<Marker[]>;
}
export function memoryBlobStore(): BlobStore;
export function idbBlobStore(idb?: IDBFactory): BlobStore;
/** `https://huggingface.co/<owner>/<name>/resolve/<rev>/<file>` -> `<owner>/<name>`; anything else -> `_other`. */
export function repoOfUrl(url: string): string;
/** Implements transformers.js' `CacheInterface` (match / put / delete) plus usage + per-repo deletion. */
export class ModelCache {
  readonly store: BlobStore;
  constructor(store: BlobStore);
  match(request: string): Promise<Response | undefined>;
  put(request: string, response: Response, progress?: (d: { progress: number; loaded: number; total: number }) => void): Promise<void>;
  delete(request: string): Promise<boolean>;
  usageByRepo(): Promise<Record<string, { bytes: number; files: number }>>;
  deleteRepo(repo: string): Promise<number>;
}
