// SmartVid MCP server (stdio) as one self-contained file. Everything it needs (tool code, model catalog, MCP SDK) is bundled by scripts/build.mjs.
import { runStdio } from '../../studio-mcp-core/src/index.js';
import { brand, endpointFixes } from '../../../mcp/brand.js';
import { customTools } from '../../../mcp/tools.js';
import catalogEntries from '../../../mcp/catalog.json' with { type: 'json' };

await runStdio({ brand: { ...brand, customTools }, catalogEntries, endpointFixes });
