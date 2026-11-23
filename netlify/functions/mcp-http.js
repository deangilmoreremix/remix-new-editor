// netlify/functions/mcp-http.js
// Hosted SmartVid MCP over streamable HTTP, so `claude mcp add --transport http https://<site>/api/mcp --header "Authorization: Bearer sv_live_…"` works with nothing installed.
// The same tools as the stdio server; every tool call goes through the gateway handler in-process (no extra network hop), so the safeguards,
// caps and audit log apply exactly as they do for a local MCP.
import { createMcpHttpHandler, bearerFrom, createBrandedServer, createCatalog, createGatewayClient } from '../../packages/studio-mcp-core/src/index.js';
import { createSupabaseStore, resolveMcpKey, isMcpKey } from './_shared/mcpKeys.js';
import { createHandler as createGateway } from './mcp-gateway.js';
import { brand, endpointFixes } from '../../mcp/brand.js';
import { customTools } from '../../mcp/tools.js';
import catalogEntries from '../../mcp/catalog.json' with { type: 'json' };

let catalog;
const getCatalog = () => (catalog ||= createCatalog(catalogEntries, { endpointFixes }));

/** Turn a gateway call into an in-process handler call and back, so the client needs no network. */
export function inProcessFetch(gateway) {
  return async (url, init = {}) => {
    const u = new URL(url);
    const headers = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    const out = await gateway({
      httpMethod: init.method || 'GET', path: u.pathname + u.search, queryStringParameters: Object.fromEntries(u.searchParams),
      headers, body: typeof init.body === 'string' ? init.body : undefined,
    });
    return { ok: out.statusCode < 400, status: out.statusCode, statusText: '', headers: { get: (n) => out.headers?.[n] ?? null }, text: async () => out.body ?? '' };
  };
}

export function createHttpHandler({ store = () => createSupabaseStore(), gateway = createGateway(), env = process.env, limit } = {}) {
  return createMcpHttpHandler({
    brandName: brand.name,
    authenticate: async (request) => {
      const token = bearerFrom(request);
      if (!token || !isMcpKey(token)) return null;
      const who = await resolveMcpKey(store(), token);
      return who ? { who, token } : null;
    },
    limit,
    buildServer: ({ token }) => createBrandedServer({
      brand: { ...brand, customTools },
      catalog: getCatalog(),
      client: createGatewayClient({ gatewayUrl: 'http://gateway.internal/api/mcp-gateway', apiKey: token, brandName: brand.name, fetchImpl: inProcessFetch(gateway) }),
    }),
  });
}

const web = createHttpHandler();

/** Netlify (Lambda-style) event -> Web Request -> Web Response -> Lambda result. */
export const handler = async (event) => {
  const url = `https://${event.headers?.host || 'localhost'}${event.path || '/api/mcp'}`;
  const request = new Request(url, {
    method: event.httpMethod,
    headers: event.headers || {},
    body: ['GET', 'HEAD'].includes(event.httpMethod) ? undefined : (event.isBase64Encoded ? Buffer.from(event.body || '', 'base64') : event.body),
  });
  const res = await web(request);
  return { statusCode: res.status, headers: Object.fromEntries(res.headers.entries()), body: await res.text() };
};
