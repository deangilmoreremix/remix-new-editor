// [remix] Port I1: model file cache backed by IndexedDB (blobs), plugged into transformers.js as `env.customCache` so every model file the library
// downloads lands here and can be listed, sized and deleted per model repo. A model counts as "installed" only when its completion marker exists
// (a cancelled / failed download leaves no marker and its files are removed). Plain JS (imported by the worker, see local-ai.worker.js); types in model-cache.d.ts.
function memoryBlobStore() {
  const files = /* @__PURE__ */ new Map();
  const markers = /* @__PURE__ */ new Map();
  return {
    getFile: async (k) => {
      const f = files.get(k);
      return f && { blob: f.blob, type: f.meta.type };
    },
    putFile: async (meta, blob) => void files.set(meta.key, { meta, blob }),
    deleteFile: async (k) => files.delete(k),
    listMeta: async () => [...files.values()].map((f) => f.meta),
    getMarker: async (id) => markers.get(id),
    setMarker: async (m) => void markers.set(m.id, m),
    deleteMarker: async (id) => void markers.delete(id),
    listMarkers: async () => [...markers.values()]
  };
}
const DB = "cinegen-local-ai";
const V = 1;
const req = (r) => new Promise((res, rej) => {
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const done = (tx) => new Promise((res, rej) => {
  tx.oncomplete = () => res();
  tx.onerror = () => rej(tx.error);
  tx.onabort = () => rej(tx.error);
});
function idbBlobStore(idb = indexedDB) {
  let dbp = null;
  const open = () => dbp ??= new Promise((res, rej) => {
    const r = idb.open(DB, V);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore("blobs");
      d.createObjectStore("meta", { keyPath: "key" });
      d.createObjectStore("markers", { keyPath: "id" });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return {
    async getFile(key) {
      const d = await open();
      const b = await req(d.transaction("blobs").objectStore("blobs").get(key));
      if (!b) return void 0;
      return { blob: b, type: b.type };
    },
    async putFile(meta, blob) {
      const d = await open();
      const tx = d.transaction(["blobs", "meta"], "readwrite");
      tx.objectStore("blobs").put(blob, meta.key);
      tx.objectStore("meta").put(meta);
      await done(tx);
    },
    async deleteFile(key) {
      const d = await open();
      const tx = d.transaction(["blobs", "meta"], "readwrite");
      tx.objectStore("blobs").delete(key);
      tx.objectStore("meta").delete(key);
      await done(tx);
      return true;
    },
    async listMeta() {
      const d = await open();
      return req(d.transaction("meta").objectStore("meta").getAll());
    },
    async getMarker(id) {
      const d = await open();
      return req(d.transaction("markers").objectStore("markers").get(id));
    },
    async setMarker(m) {
      const d = await open();
      const tx = d.transaction("markers", "readwrite");
      tx.objectStore("markers").put(m);
      await done(tx);
    },
    async deleteMarker(id) {
      const d = await open();
      const tx = d.transaction("markers", "readwrite");
      tx.objectStore("markers").delete(id);
      await done(tx);
    },
    async listMarkers() {
      const d = await open();
      return req(d.transaction("markers").objectStore("markers").getAll());
    }
  };
}
function repoOfUrl(url) {
  const m = /^https?:\/\/[^/]+\/([^/]+\/[^/]+)\/resolve\//.exec(url);
  return m ? m[1] : "_other";
}
class ModelCache {
  constructor(store) {
    this.store = store;
  }
  async match(request) {
    const f = await this.store.getFile(request);
    return f ? new Response(f.blob, { headers: { "content-type": f.type || "application/octet-stream", "content-length": String(f.blob.size) } }) : void 0;
  }
  async put(request, response, progress) {
    const blob = await response.blob();
    progress?.({ progress: 100, loaded: blob.size, total: blob.size });
    await this.store.putFile({ key: request, repo: repoOfUrl(request), size: blob.size, type: response.headers.get("content-type") || blob.type || "", at: Date.now() }, blob);
  }
  async delete(request) {
    return this.store.deleteFile(request);
  }
  async usageByRepo() {
    const out = {};
    for (const m of await this.store.listMeta()) {
      const u = out[m.repo] ??= { bytes: 0, files: 0 };
      u.bytes += m.size;
      u.files += 1;
    }
    return out;
  }
  async deleteRepo(repo) {
    let n = 0;
    for (const m of await this.store.listMeta()) if (m.repo === repo) {
      await this.store.deleteFile(m.key);
      n += 1;
    }
    return n;
  }
}
export {
  ModelCache,
  idbBlobStore,
  memoryBlobStore,
  repoOfUrl
};
