// Hosted MCP over streamable HTTP, stateless: every request builds a branded server for the caller, answers, and is forgotten.
// Brand-agnostic. The host supplies how to recognise the caller and how to reach the gateway for them.
//
//   createMcpHttpHandler({ brandName, authenticate(request) -> caller | null, buildServer(caller) -> McpServer, limit? })
//   returns async (Request) => Response    (Web-standard, so it works in Netlify functions, Next route handlers and tests)
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const jsonRpcError = (status, code, message, extra = {}) =>
  new Response(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }), { status, headers: { ...JSON_HEADERS, ...extra } });

export const bearerFrom = (request) => /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') || '')?.[1] || null;

/**
 * @param {{
 *   brandName: string,
 *   authenticate: (request: Request) => Promise<any | null>,
 *   buildServer: (caller: any, request: Request) => any,
 *   limit?: (caller: any) => Promise<{ ok: boolean, retryAfter?: number, message?: string }>,
 *   maxBodyBytes?: number,
 * }} o
 */
export function createMcpHttpHandler({ brandName, authenticate, buildServer, limit, maxBodyBytes = 1_000_000 }) {
  return async function handle(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS' } });
    // Stateless mode has no server-to-client stream and no session to end.
    if (request.method !== 'POST') return jsonRpcError(405, -32000, `${brandName} MCP accepts POST only.`, { Allow: 'POST, OPTIONS' });

    let caller;
    try { caller = await authenticate(request); } catch (err) {
      console.error('[mcp-http] auth failed:', err?.message || 'error');
      return jsonRpcError(503, -32000, `${brandName} MCP access is temporarily unavailable.`);
    }
    if (!caller) {
      return jsonRpcError(401, -32001, `Missing, invalid or revoked ${brandName} MCP key. Create one in the app and send it as "Authorization: Bearer <key>".`, { 'WWW-Authenticate': 'Bearer' });
    }

    if (limit) {
      const verdict = await limit(caller);
      if (!verdict.ok) {
        return jsonRpcError(429, -32002, verdict.message || `Too many requests. Try again shortly.`, { 'Retry-After': String(Math.max(1, Math.ceil(verdict.retryAfter || 1))) });
      }
    }

    const len = Number(request.headers.get('content-length') || 0);
    if (len > maxBodyBytes) return jsonRpcError(413, -32000, 'Request body is too large.');
    let parsed;
    try {
      const text = await request.text();
      if (text.length > maxBodyBytes) return jsonRpcError(413, -32000, 'Request body is too large.');
      parsed = JSON.parse(text);
    } catch { return jsonRpcError(400, -32700, 'Request body must be JSON.'); }

    const server = buildServer(caller, request);
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    try {
      return await transport.handleRequest(request, { parsedBody: parsed });
    } finally {
      // The response body is already produced in JSON mode; release the per-request server.
      void server.close?.().catch?.(() => {});
    }
  };
}
