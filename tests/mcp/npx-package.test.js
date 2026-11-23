// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectStdio, createGovernor, createMemoryGovernorStore } from '../../packages/studio-mcp-core/src/index.js';
import { createHandler as createGateway } from '../../netlify/functions/mcp-gateway.js';
import { createMcpKey } from '../../netlify/functions/_shared/mcpKeys.js';
import { keyStore, MU } from './helpers/bridgeWorld.js';

vi.hoisted(() => { process.env.MCP_KEY_SECRET = 'm'.repeat(40); });

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../packages/smartvid-mcp');
const bin = path.join(pkgDir, 'dist/index.js');

beforeAll(() => { execFileSync(process.execPath, [path.join(pkgDir, 'scripts/build.mjs')], { stdio: 'pipe' }); }, 120_000);

describe('smartvid-mcp package', () => {
  it('packs only the bundle and the README, with no secrets and no upstream name', () => {
    const out = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: pkgDir, encoding: 'utf8' }));
    const files = out[0].files.map((f) => f.path).sort();
    expect(files).toEqual(['README.md', 'dist/index.js', 'package.json']);
    expect(files.join(' ')).not.toMatch(/\.env|secret|key|mu-?api/i);
    const manifest = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
    expect(manifest.bin['smartvid-mcp']).toBe('dist/index.js');
    expect(manifest.name).toBe('smartvid-mcp');
  });

  it('the shipped text carries no upstream name, no secret-looking values, and no server-only code paths', () => {
    const bundle = readFileSync(bin, 'utf8');
    const readme = readFileSync(path.join(pkgDir, 'README.md'), 'utf8');
    for (const text of [bundle, readme]) {
      expect(text).not.toMatch(/mu-?api/i);
      expect(text).not.toMatch(/sk-[A-Za-z0-9]{20,}|sv_live_[A-Za-z0-9_-]{30,}|SUPABASE_SERVICE_ROLE|MCP_KEY_SECRET/);
    }
    expect(bundle.startsWith('#!/usr/bin/env node')).toBe(true);
    expect(readme).toMatch(/--transport http/);
    expect(readme).toMatch(/npx -y smartvid-mcp/);
  });

  describe('runs over stdio', () => {
    let server; let url; let key;
    beforeAll(async () => {
      const ks = keyStore();
      key = (await createMcpKey(ks, { userId: 'owner_1', muapiKey: MU })).key;
      const gateway = createGateway({ store: () => ks, studios: {}, env: {}, governor: createGovernor({ store: createMemoryGovernorStore() }), bridge: null, limiter: null });
      server = http.createServer(async (req, res) => {
        let body = ''; for await (const c of req) body += c;
        const u = new URL(req.url, 'http://x');
        const out = await gateway({ httpMethod: req.method, path: u.pathname + u.search, queryStringParameters: Object.fromEntries(u.searchParams), headers: req.headers, body: body || undefined });
        res.writeHead(out.statusCode, out.headers); res.end(out.body);
      });
      await new Promise((r) => server.listen(0, '127.0.0.1', r));
      url = `http://127.0.0.1:${server.address().port}/api/mcp-gateway`;
    });
    afterAll(() => server?.close());

    it('lists the tools and answers a call through the gateway', async () => {
      expect(existsSync(bin)).toBe(true);
      const mcp = await connectStdio({ command: process.execPath, args: [bin], env: { SMARTVID_API_KEY: key, SMARTVID_API_URL: url } });
      try {
        const { tools } = await mcp.listTools();
        expect(tools.length).toBeGreaterThan(50);
        expect(tools.every((t) => t.name.startsWith('smartvid_'))).toBe(true);
        expect(JSON.stringify(tools)).not.toMatch(/mu-?api/i);
        const r = await mcp.callTool({ name: 'smartvid_list_studios', arguments: {} });
        expect(r.isError).toBeFalsy();
        // a destructive tool still needs confirmation, enforced by the gateway the bundle talks to
        const del = await mcp.callTool({ name: 'smartvid_leads_delete', arguments: { lead_id: 'abc' } });
        expect(JSON.stringify(del.content)).toMatch(/confirm/i);
      } finally { await mcp.close(); }
    }, 60_000);
  });
});
