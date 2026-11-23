// Writes mcp/director-agents.json from the Director page's own agent list (src/components/DirectorPage.js), so the MCP's list cannot drift.
// The page imports browser-only modules, so the array literal is read from the source text and evaluated on its own.
import { readFileSync, writeFileSync } from 'node:fs';

export function readDirectorAgents(src = readFileSync(new URL('../src/components/DirectorPage.js', import.meta.url), 'utf8')) {
  const start = src.indexOf('export const DIRECTOR_AGENTS = [');
  if (start < 0) throw new Error('DIRECTOR_AGENTS not found');
  const open = src.indexOf('[', start);
  let depth = 0; let end = -1;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '[') depth += 1;
    else if (src[i] === ']') { depth -= 1; if (depth === 0) { end = i; break; } }
  }
  const list = new Function(`return ${src.slice(open, end + 1)}`)();
  return list.map(({ id, name, description, category }) => ({ id, name, description, category }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = new URL('../mcp/director-agents.json', import.meta.url);
  writeFileSync(out, `${JSON.stringify(readDirectorAgents(), null, 2)}\n`);
  console.log(`Wrote ${readDirectorAgents().length} agents`);
}
