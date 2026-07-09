const STORE_KEY = 'render:queue';
const LEGACY_KEY = 'render_queue';

const listeners = new Set();
let processing = false;
let processorInterval = null;

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

function notify(queue) {
  listeners.forEach((fn) => fn(queue));
}

function updateQueue(updated) {
  localStorage.setItem(STORE_KEY, JSON.stringify(updated));
  notify(updated);
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
    status: 'queued',
    ...job,
  };
  queue.push(entry);
  updateQueue(queue);
  return entry;
}

export function removeFromRenderQueue(id) {
  const queue = listRenderQueue().filter((entry) => entry.id !== id);
  updateQueue(queue);
}

export function clearRenderQueue() {
  updateQueue([]);
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function processNextJob() {
  if (processing) return null;
  const queue = listRenderQueue();
  const next = queue.find((entry) => entry.status === 'queued');
  if (!next) return null;

  processing = true;
  next.status = 'processing';
  updateQueue(queue);

  const jobIndex = queue.findIndex((entry) => entry.id === next.id);

  setTimeout(() => {
    try {
      queue[jobIndex].status = 'completed';
    } catch (error) {
      queue[jobIndex].status = 'failed';
      queue[jobIndex].error = error.message;
    } finally {
      updateQueue(queue);
      processing = false;
    }
  }, 1000);

  return next;
}

export function startProcessor(intervalMs = 5000) {
  if (processorInterval) return () => stopProcessor();
  processorInterval = setInterval(() => {
    const queue = listRenderQueue();
    if (queue.some((entry) => entry.status === 'queued')) {
      processNextJob();
    }
  }, intervalMs);
  return () => stopProcessor();
}

export function stopProcessor() {
  if (processorInterval) {
    clearInterval(processorInterval);
    processorInterval = null;
  }
}
