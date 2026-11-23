/**
 * The timeline editor's agent tools (createAgentTools, tools.js) as MCP tab tools. The tool list, descriptions and parameter schemas are
 * the editor's own; nothing is re-described here, so the MCP cannot drift from what the in-app Video Agent can do.
 *   read-only tools            -> risk "read"  (run silently)
 *   everything else            -> risk "write" (the tab asks before running; export_video is a write that renders in the browser)
 * Names are prefixed "timeline_" like the WebMCP registration.
 */
// The editor's descriptions name its generation backend; MCP clients see the brand instead.
const brandText = (s) => String(s ?? '').replace(/mu-?api(?:\.ai|app)?/gi, 'SmartVid');

export function toBridgeTools(agentTools, { prefix = 'timeline_' } = {}) {
  return agentTools.definitions.map((def) => ({
    name: `${prefix}${def.name}`,
    description: brandText(def.description),
    risk: agentTools.readOnly.has(def.name) ? 'read' : 'write',
    schema: def.parameters,
    async run(args) {
      const out = await agentTools.run(def.name, args || {});
      if (!out.ok) throw new Error(String(out.content || 'The editor could not do that.').slice(0, 400));
      // The editor answers in text (often JSON): hand structured data back when it parses, text otherwise.
      try { return JSON.parse(out.content); } catch { return { text: String(out.content ?? '') }; }
    },
  }));
}
