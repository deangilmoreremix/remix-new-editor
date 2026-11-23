// Ask a same-origin embedded app (Workbench) to do something and wait for its answer.
//   parent -> app: { type: 'sv:call', id, op, args }      app -> parent: { type: 'sv:call-result', id, ok, result | error }
// Only messages from that iframe's own window and our own origin are accepted.
export function createIframeRpc({ getFrame, origin = () => window.location.origin, timeoutMs = 15_000, addListener = (fn) => window.addEventListener('message', fn), removeListener = (fn) => window.removeEventListener('message', fn), makeId = () => crypto.randomUUID() } = {}) {
  const waiting = new Map();
  const onMessage = (e) => {
    const frame = getFrame();
    if (!frame || e.source !== frame.contentWindow || e.origin !== origin()) return;
    const d = e.data;
    if (!d || d.type !== 'sv:call-result' || !waiting.has(d.id)) return;
    const w = waiting.get(d.id);
    waiting.delete(d.id);
    clearTimeout(w.timer);
    if (d.ok) w.resolve(d.result); else w.reject(new Error(String(d.error || 'The embedded editor could not do that.')));
  };
  addListener(onMessage);
  return {
    call(op, args = {}) {
      const frame = getFrame();
      if (!frame?.contentWindow) return Promise.reject(new Error('The editor is not open.'));
      const id = makeId();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { waiting.delete(id); reject(new Error('The editor did not answer in time. It may still be loading.')); }, timeoutMs);
        waiting.set(id, { resolve, reject, timer });
        frame.contentWindow.postMessage({ type: 'sv:call', id, op, args }, origin());
      });
    },
    dispose() { removeListener(onMessage); for (const w of waiting.values()) { clearTimeout(w.timer); w.reject(new Error('The editor was closed.')); } waiting.clear(); },
  };
}
