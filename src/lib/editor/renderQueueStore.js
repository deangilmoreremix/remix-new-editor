const STORE_KEY = 'render:queue';
const LEGACY_KEY = 'render_queue';

const listeners = new Set();

function migrate() {
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      localStorage.setItem(STORE_KEY, legacy);
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch {
    // ignore migration errors
  }
}

export function listRenderQueue() {
  try {
    migrate();
    return JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function enqueueRender(job) {
  const queue = listRenderQueue();
  const entry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    ...job,
  };
  queue.push(entry);
  localStorage.setItem(STORE_KEY, JSON.stringify(queue));
  listeners.forEach((fn) => fn(queue));
  return entry;
}

export function removeFromRenderQueue(id) {
  const queue = listRenderQueue().filter((entry) => entry.id !== id);
  localStorage.setItem(STORE_KEY, JSON.stringify(queue));
  listeners.forEach((fn) => fn(queue));
}

export function clearRenderQueue() {
  localStorage.setItem(STORE_KEY, JSON.stringify([]));
  listeners.forEach((fn) => fn([]));
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
