import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', include: ['../../tests/mcp/**/*.test.js'], root: '.', server: { deps: { inline: [] } } },
  server: { fs: { allow: ['../..'] } },
});
