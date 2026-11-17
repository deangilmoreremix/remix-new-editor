import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', include: ['../../tests/mcp/**/*.test.js'], exclude: ['**/payload-parity.test.js', '**/node_modules/**', '../../tests/mcp/payload-parity.test.js'], root: '.', server: { deps: { inline: [] } } },
  server: { fs: { allow: ['../..'] } },
});
