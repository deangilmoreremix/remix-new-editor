/**
 * WebMCP: expose the editor's agent tools to AI agents running in the
 * browser (navigator.modelContext — the W3C WebMCP draft; Chrome ships it
 * behind a flag / origin trial). Feature-detected: nothing happens when the
 * API is missing.
 *
 * Read-only tools run directly. Tools that change the timeline or export
 * ask the user to confirm in the page first (once per minute per tool).
 */
const CONFIRM_TTL_MS = 60_000;

export const hasWebMcp = () => typeof navigator !== 'undefined' && !!navigator.modelContext
  && (typeof navigator.modelContext.registerTool === 'function' || typeof navigator.modelContext.provideContext === 'function');

/**
 * @param {object} agentTools   createAgentTools(...) result
 * @param {object} o            { confirm(message) → Promise<bool>, onChange() }
 * @returns {() => void}        unregister
 */
export function registerWebMcpTools(agentTools, { confirm, onChange } = {}) {
  if (!hasWebMcp()) return () => {};
  const mc = navigator.modelContext;
  const approved = new Map(); // tool → time approved

  const tools = agentTools.definitions.map((def) => {
    const readOnly = agentTools.readOnly.has(def.name);
    return {
      name: `timeline_${def.name}`,
      description: `[Timeline editor] ${def.description}`,
      inputSchema: def.parameters,
      annotations: { readOnlyHint: readOnly },
      async execute(args) {
        if (!readOnly) {
          const at = approved.get(def.name) || 0;
          if (Date.now() - at > CONFIRM_TTL_MS) {
            const ok = await (confirm ? confirm(`An AI agent in your browser wants to use “${def.name.replace(/_/g, ' ')}” on your timeline. Allow it?`) : Promise.resolve(false));
            if (!ok) return { content: [{ type: 'text', text: 'The user declined this action.' }], isError: true };
            approved.set(def.name, Date.now());
          }
        }
        const out = await agentTools.run(def.name, args || {});
        if (!readOnly) onChange?.();
        return { content: [{ type: 'text', text: out.content }], ...(out.ok ? {} : { isError: true }) };
      },
    };
  });

  const handles = [];
  try {
    if (typeof mc.registerTool === 'function') {
      tools.forEach((t) => { handles.push({ name: t.name, h: mc.registerTool(t) }); });
    } else {
      mc.provideContext({ tools });
    }
  } catch (err) {
    console.warn('[WebMCP] could not register the timeline tools', err);
  }

  return () => {
    handles.forEach(({ name, h }) => {
      try {
        if (h && typeof h.unregister === 'function') h.unregister();
        else if (typeof mc.unregisterTool === 'function') mc.unregisterTool(name);
      } catch { /* already gone */ }
    });
    if (!handles.length && typeof mc.provideContext === 'function') {
      try { mc.provideContext({ tools: [] }); } catch { /* ignore */ }
    }
  };
}
