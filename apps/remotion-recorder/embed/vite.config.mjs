// Builds the UNMODIFIED upstream Remotion Recorder UI (../src) as static files for the editor to embed in an iframe.
//   npm run build:remotion-recorder   ->  public/recorder-ui/
// Only five server-bound modules are swapped for ./adapters/* (build-time aliasing); upstream's own index.html, Tailwind 3 config,
// components, devices/permission/recording code and conversion are used as written.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const repoRoot = path.resolve(appRoot, '../..');
const require = createRequire(import.meta.url);

// Upstream's Tailwind config uses relative content globs, so resolve them from the app folder.
process.chdir(appRoot);
const tailwind = require('tailwindcss-v3'); // the UI is authored for Tailwind 3; the editor itself uses Tailwind 4
const autoprefixer = require('autoprefixer');

const swaps = new Map(
  Object.entries({
    'src/helpers/upload-file.ts': 'embed/adapters/upload-file.ts',
    'src/helpers/transcribe-video.ts': 'embed/adapters/transcribe-video.ts',
    'src/helpers/cancel-transcribe.ts': 'embed/adapters/cancel-transcribe.ts',
    'src/actions/fetch-project-folders.ts': 'embed/adapters/fetch-project-folders.ts',
    'src/actions/create-folder.ts': 'embed/adapters/create-folder.ts',
  }).map(([from, to]) => [path.join(appRoot, from), path.join(appRoot, to)]),
);

const swapServerModules = {
  name: 'recorder-embed-swap-server-modules',
  enforce: 'pre',
  async resolveId(source, importer, options) {
    if (!importer || !/^[./]/.test(source)) return null;
    const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
    return resolved && swaps.get(resolved.id) ? swaps.get(resolved.id) : null;
  },
};

// Upstream's own server fills <!--remotion-server-placeholder--> with `window.remotionServerEnabled = true` (scripts/server/index-html.ts).
// Do the same here so the UI offers "Copy to public/<folder>" + transcription, which the adapters route to the editor.
// It is an external file, not an inline <script>: the editor's Content-Security-Policy (script-src 'self') blocks inline scripts.
const upstreamIndexHtml = {
  name: 'recorder-embed-index-html',
  transformIndexHtml: (html) =>
    html
      .replace('<!--remotion-server-placeholder-->', '<script src="/recorder-ui/server-flag.js"></script>')
      .replace('href="/favicon.png"', 'href="./favicon.png"'),
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'server-flag.js', source: 'window.remotionServerEnabled = true;\n' });
    for (const file of ['favicon.png', 'logo.png']) {
      this.emitFile({ type: 'asset', fileName: file, source: fs.readFileSync(path.join(appRoot, 'public', file)) });
    }
  },
};

// src/Logo.tsx points at the absolute path "/logo.png"; inside the editor the app lives under /recorder-ui/.
const rebaseLogo = {
  name: 'recorder-embed-rebase-logo',
  enforce: 'pre',
  transform: (code, id) => (id.endsWith('/src/Logo.tsx') ? code.replace('src="/logo.png"', 'src="/recorder-ui/logo.png"') : null),
};

export default defineConfig({
  root: appRoot,
  base: '/recorder-ui/',
  publicDir: false, // upstream's public/ holds a sample project (13 MB); only the favicon and logo are needed
  plugins: [swapServerModules, rebaseLogo, react(), upstreamIndexHtml],
  resolve: { alias: { '@': path.resolve(appRoot, 'src') } }, // same alias as upstream's vite.config.ts
  css: { postcss: { plugins: [tailwind({ config: path.join(appRoot, 'tailwind.config.js') }), autoprefixer()] } },
  build: {
    outDir: process.env.RECORDER_UI_OUT || path.join(repoRoot, 'public/recorder-ui'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
  },
});
