// Ported from Remotion Recorder (https://github.com/remotion-dev/recorder, commit 4c09934),
// src/helpers/store-file.ts: write a take to the origin private file system (OPFS) while
// recording, so long takes do not sit in memory. Falls back to memory where OPFS writes are
// unavailable (some Safari versions, private windows).
export async function createFileStorage(filename, mimeType, { storage = globalThis.navigator?.storage } = {}) {
  let directoryHandle = null;
  let writable = null;
  try {
    directoryHandle = await storage?.getDirectory?.();
    const fileHandle = await directoryHandle?.getFileHandle(filename, { create: true });
    writable = await fileHandle?.createWritable?.();
  } catch {
    writable = null;
  }
  return writable ? opfsStorage(directoryHandle, writable, filename, mimeType) : memoryStorage(mimeType);
}

function opfsStorage(directoryHandle, writable, filename, mimeType) {
  let written = 0;
  let chain = Promise.resolve();
  const write = async (data) => {
    await writable.write({ type: 'write', position: written, data });
    written += data.size ?? data.byteLength ?? 0;
  };
  return {
    kind: 'opfs',
    write: (data) => (chain = chain.then(() => write(data))),
    save: async () => {
      await chain;
      try { await writable.close(); } catch { /* already closed */ }
      const file = await (await directoryHandle.getFileHandle(filename, { create: true })).getFile();
      // Copy the bytes out: a File backed by OPFS stops being readable once release() removes it.
      return new Blob([await file.arrayBuffer()], { type: mimeType });
    },
    getBytesWritten: () => written,
    release: async () => {
      try { await writable.close(); } catch { /* already closed */ }
      try { await directoryHandle.removeEntry(filename, { recursive: true }); } catch { /* gone */ }
    },
  };
}

function memoryStorage(mimeType) {
  let chunks = [];
  let written = 0;
  return {
    kind: 'memory',
    write: async (data) => { chunks.push(data); written += data.size ?? 0; },
    save: async () => new Blob(chunks, { type: mimeType }),
    getBytesWritten: () => written,
    release: async () => { chunks = []; written = 0; },
  };
}
