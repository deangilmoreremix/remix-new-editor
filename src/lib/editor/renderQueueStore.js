const STORE_KEY = 'render:queue';
const LEGACY_KEY = 'render_queue';

const listeners = new Set();
let processing = false;
let processorInterval = null;

// The queue does not know how to render a video by itself. A real render
// requires DOM APIs (a <video> element + canvas + MediaRecorder) that only
// exist on the page. The page registers a real executor here. Until it does,
// there is NO code path that can complete a job — jobs stay queued rather than
// being faked to "completed".
let renderExecutor = null;

/**
 * Register the function that performs a real render for a queued job.
 * The executor receives the job entry and MUST return a promise that resolves
 * with a real render result ({ url, blob, mime, ext, ... }) or rejects on
 * failure. There is intentionally no default/fallback executor: without one,
 * jobs cannot complete.
 *
 * @param {(job: object, onProgress?: (pct: number) => void) => Promise<object>} fn
 * @returns {() => void} unregister function
 */
export function setRenderExecutor(fn) {
  renderExecutor = typeof fn === 'function' ? fn : null;
  return () => {
    if (renderExecutor === fn) renderExecutor = null;
  };
}

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

// Persist a status/field change for a single job, re-reading the queue so we
// never clobber concurrent updates (e.g. removal) with a stale snapshot.
function patchJob(id, patch) {
  const queue = listRenderQueue();
  const idx = queue.findIndex((entry) => entry && entry.id === id);
  if (idx === -1) return null;
  queue[idx] = { ...queue[idx], ...patch };
  updateQueue(queue);
  return queue[idx];
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
    progress: 0,
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

/**
 * Process the next queued job by running the registered real render executor.
 *
 * Returns the job entry that started processing, or null when there is nothing
 * to do. If no executor is registered, the job is marked "failed" with an
 * explicit error — it is NEVER marked "completed" without a real render result.
 */
export function processNextJob() {
  if (processing) return null;
  const queue = listRenderQueue();
  const next = queue.find((entry) => entry && entry.status === 'queued');
  if (!next) return null;

  if (!renderExecutor) {
    // Missing capability is a real, user-facing failure — not a fake success.
    patchJob(next.id, {
      status: 'failed',
      error: 'No renderer available. Open the Render page to process this job.',
    });
    return null;
  }

  processing = true;
  const started = patchJob(next.id, { status: 'processing', progress: 0, error: null });

  const onProgress = (pct) => {
    const value = Math.max(0, Math.min(100, Math.round(pct)));
    patchJob(next.id, { status: 'processing', progress: value });
  };

  Promise.resolve()
    .then(() => renderExecutor(started, onProgress))
    .then((result) => {
      if (!result || (!result.url && !result.blob)) {
        throw new Error('Renderer returned no output');
      }
      // Only now — with a real render result in hand — is the job complete.
      patchJob(next.id, {
        status: 'completed',
        progress: 100,
        result: {
          url: result.url || null,
          mime: result.mime || null,
          ext: result.ext || null,
          size: result.blob ? result.blob.size : result.size || null,
        },
      });
    })
    .catch((error) => {
      patchJob(next.id, {
        status: 'failed',
        error: error && error.message ? error.message : String(error),
      });
    })
    .finally(() => {
      processing = false;
    });

  return started;
}

export function startProcessor(intervalMs = 5000) {
  if (processorInterval) return () => stopProcessor();
  processorInterval = setInterval(() => {
    const queue = listRenderQueue();
    if (queue.some((entry) => entry && entry.status === 'queued')) {
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
