import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createCatalog } from './catalog.js';
import { createGatewayClient } from './client.js';
import { createBrandedServer } from './server.js';

export * from './catalog.js';
export * from './client.js';
export * from './server.js';
export * from './sanitize.js';

/**
 * Start a branded stdio MCP server.
 * brand: { name, slug, prefix, envVar, gatewayUrl, gatewayEnvVar?, extraTools? }
 */
export async function runStdio({ brand, catalogEntries, endpointFixes, env = process.env }) {
  const client = createGatewayClient({
    gatewayUrl: env[brand.gatewayEnvVar || `${brand.envVar.replace(/_API_KEY$/, '')}_API_URL`] || brand.gatewayUrl,
    apiKey: env[brand.envVar],
    brandName: brand.name,
  });
  const server = createBrandedServer({ brand, catalog: createCatalog(catalogEntries, { endpointFixes }), client });
  await server.connect(new StdioServerTransport());
}
