// Regenerates mcp/bridge-tools.json from the tab adapters. Runs through vitest so the app's ES modules resolve exactly as they do in tests.
import { spawnSync } from 'node:child_process';
const r = spawnSync('npx', ['vitest', 'run', 'tests/mcp/bridge-manifest.test.js'], { stdio: 'inherit', env: { ...process.env, UPDATE_BRIDGE_MANIFEST: '1' } });
process.exit(r.status ?? 1);
