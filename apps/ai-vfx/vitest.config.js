import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { transformWithEsbuild } from 'vite';

// The upstream app writes JSX inside .js files. Vite/Vitest's esbuild only
// parses JSX for .jsx by default, so we force .js to be transformed as JSX.
const jsxInJs = {
  name: 'jsx-in-js',
  async transform(code, id) {
    if (!id.match(/[\\/]apps[\\/]ai-vfx[\\/]/)) return null;
    if (!id.endsWith('.js')) return null;
    if (id.includes('node_modules')) return null;
    return transformWithEsbuild(code, id, {
      loader: 'jsx',
      jsx: 'automatic',
    });
  },
};

export default defineConfig({
  plugins: [jsxInJs, react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['__tests__/**/*.{test,spec}.{js,jsx}'],
  },
});
