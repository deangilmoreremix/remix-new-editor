// Render queue tab tools (src/lib/editor/renderQueueStore.js).
const obj = (properties = {}, required = []) => ({ type: 'object', properties, ...(required.length ? { required } : {}) });
const view = (j) => ({ id: j.id, status: j.status, progress: j.progress, name: j.name || j.title, error: j.error || null });

/** @param {{ list: () => any[], enqueue: (job: object) => any, remove: (id: string) => void, process: () => any }} deps */
export function createRenderQueueTools({ list, enqueue, remove, process }) {
  return [
    { name: 'render_queue_list', risk: 'read', description: 'Jobs in this browser\'s render queue.', schema: obj(), run: () => ({ jobs: list().map(view) }) },
    { name: 'render_queue_enqueue', risk: 'write', description: 'Queue a render job (the project payload is whatever the Render page produced; it is stored as given).', schema: obj({ name: { type: 'string', maxLength: 120 }, project: { type: 'object' } }, ['project']), run: (a) => view(enqueue({ name: String(a.name || 'MCP render').slice(0, 120), project: a.project })) },
    { name: 'render_queue_process', risk: 'write', description: 'Run the next queued job. It only renders while the Render page is open; otherwise the job is marked failed with a clear message, never completed.', schema: obj(), run: () => { const j = process(); return j ? view(j) : { started: false }; } },
    { name: 'render_queue_remove', risk: 'destructive', description: 'Remove a job from the queue.', schema: obj({ id: { type: 'string' } }, ['id']), run: (a) => { remove(String(a.id)); return { removed: true }; } },
  ];
}
export const RENDER_QUEUE_NOT_EXPOSED = { render_queue_clear: 'Clearing everything at once is not offered; remove jobs one by one.' };
