// Character consistency persistence and helpers.
// Stores omni-reference images and first/last frame URLs in IndexedDB.

const DB_NAME = 'smartvideo-character-references';
const STORE_NAME = 'references';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not available'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCharacterReference({ id, imageUrl, videoUrl, firstFrameUrl, lastFrameUrl, modelId, createdAt } = {}) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({
      id: id || `ref_${Date.now()}`,
      imageUrl,
      videoUrl,
      firstFrameUrl,
      lastFrameUrl,
      modelId,
      createdAt: createdAt || new Date().toISOString()
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('[CharacterConsistency] save failed:', e);
  }
}

export async function getCharacterReference(id) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const result = await new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return result || null;
  } catch (e) {
    console.warn('[CharacterConsistency] get failed:', e);
    return null;
  }
}

export async function listCharacterReferences() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const result = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    return result;
  } catch (e) {
    console.warn('[CharacterConsistency] list failed:', e);
    return [];
  }
}

export async function deleteCharacterReference(id) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('[CharacterConsistency] delete failed:', e);
  }
}
