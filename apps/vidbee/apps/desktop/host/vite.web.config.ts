// Host build config (not upstream): builds upstream's desktop renderer as a plain web app (no electron-vite).
// Mirrors the `renderer` section of apps/desktop/electron.vite.config.ts; the only additions are the output dir and the
// classic <script> that installs the browser shim (host/web-shim.js) before the app bundle runs.
import { dirname, join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'
import Icons from 'unplugin-icons/vite'
import { defineConfig } from 'vite'
import { createRendererResolve } from '../renderer-react-resolve'
import { vitePlugin as rebrand } from '../../../brand/rebrand.mjs'

const require = createRequire(import.meta.url)
const desktopRoot = resolve(import.meta.dirname, '..')
const lobeIconsDir = join(dirname(require.resolve('@lobehub/icons-static-svg/package.json')), 'icons')

export default defineConfig({
  root: resolve(desktopRoot, 'src/renderer'),
  base: './',
  define: { __GLITCHTIP_DSN__: '""', __GLITCHTIP_ENVIRONMENT__: '"web"', __GLITCHTIP_RELEASE__: '"vidbee-web"' },
  build: { outDir: resolve(desktopRoot, 'out-web/renderer'), emptyOutDir: true, sourcemap: false },
  legacy: { inconsistentCjsInterop: true },
  optimizeDeps: {
    exclude: ['@vidbee/downloader-core', '@vidbee/downloader-core/browser-cookies-setting', '@vidbee/downloader-core/cookie-setup', '@vidbee/downloader-core/filename-style', '@vidbee/downloader-core/format-preferences', 'katex'],
    include: ['react', 'react-dom', 'react/jsx-runtime', '@videojs/react', 'streamdown', '@streamdown/code', '@streamdown/math', '@streamdown/cjk', '@shadcn/react/message-scroller']
  },
  resolve: (() => {
    const base = createRendererResolve(desktopRoot)
    return { ...base, alias: { ...base.alias, 'electron-ga4-telemetry/desktop': resolve(import.meta.dirname, 'ga4-renderer-stub.js') } }
  })(),
  plugins: [
    // Rebrands user-facing text at build time (see ../../../brand); VIDBEE_BRAND=off for a pristine upstream build.
    rebrand(),
    {
      name: 'host-web-shim',
      transformIndexHtml: () => [{ tag: 'script', attrs: { src: './web-shim.js' }, injectTo: 'head-prepend' }]
    },
    react(),
    Icons({ compiler: 'jsx', customCollections: { lobehub: FileSystemIconLoader(lobeIconsDir) }, jsx: 'react' }),
    tailwindcss()
  ],
  publicDir: resolve(desktopRoot, 'src/renderer/public')
})
