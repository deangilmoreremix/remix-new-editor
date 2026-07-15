import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Vite plugin: stub out unresolved legacy imports under components/ and
// src/lib/ that are not part of the media-creation flow. Returns an empty
// default-export so the bundle resolves and the build completes. Stubs are
// gated by an explicit allow-list to avoid masking real issues elsewhere.
const STUB_IMPORTER_PREFIXES = [
  'components/',
  'lib/',
];

const stubLegacy = () => ({
  name: 'stub-legacy-unresolved',
  enforce: 'pre',
  async resolveId(source, importer) {
    if (!importer) return null;
    if (importer.includes('node_modules')) return null;
    if (source.startsWith('\0')) return null;
    const importerIsLegacy = STUB_IMPORTER_PREFIXES.some(p => importer.includes(p));
    if (!importerIsLegacy) return null;
    // Never stub imports from the landing page — those are new-style
    // modules that must resolve to their real files.
    if (importer.includes('src/components/landing/')) return null;
    // Try Vite's full resolution. If the import resolves to a real module
    // (an npm package OR a legacy-tree file), let Vite load it normally so
    // the studios actually work. We only stub imports that are genuinely
    // unresolvable, to keep the build from crashing on missing legacy files.
    const resolved = await this.resolve(source, importer, { skipSelf: true });
    if (resolved) return null;

    // Genuinely unresolved legacy import — stub it so the bundle still
    // resolves. Asset imports get a placeholder data URL.
    if (/\.(svg|png|jpe?g|webp|gif|ico)(\?|$)/i.test(source)) {
      return {
        id: '\0legacy-asset-stub:' + source + '::' + importer,
      };
    }
    return {
      id: '\0legacy-stub:' + source + '::' + importer,
      meta: { legacyStub: { source, importer } }
    };
  },
  load(id) {
    if (id.startsWith('\0legacy-asset-stub:')) {
      // Return a minimal SVG data URL so the bundler can substitute.
      const dataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="black"/></svg>'
      );
      return `export default ${JSON.stringify(dataUrl)};\n`;
    }
    if (id.startsWith('\0legacy-stub:')) {
      // Build named exports by parsing the importer's import statement.
      console.warn('[stub-legacy] Stubbing unresolved import:', source, '←', importer);
      const payload = id.slice('\0legacy-stub:'.length);
      const [source, ...rest] = payload.split('::');
      const importer = rest.join('::');
      // Match the exact quoted import path so subpath imports like
      // '@pqina/pintura/pintura.module.css' don't shadow a main-entry
      // import like '@pqina/pintura' in the same file.
      const matchesSource = (line) =>
        line.includes("'" + source + "'") || line.includes('"' + source + '"');
      let names = [];
      try {
        const importerText = fs.readFileSync(importer, 'utf8');
        const lines = importerText.split(/\n/);
        for (const line of lines) {
          if (!matchesSource(line)) continue;
          const namedMatch = line.match(/import\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"]/);
          if (namedMatch) {
            names = namedMatch[1].split(',').map(s => s.trim().split(/\s+as\s+/).pop()).filter(Boolean);
            break;
          }
          const defaultMatch = line.match(/import\s+(\w+)\s+from\s*['"][^'"]+['"]/);
          if (defaultMatch) {
            names = [defaultMatch[1]];
            break;
          }
          const starMatch = line.match(/import\s*\*\s*as\s+(\w+)\s+from\s*['"][^'"]+['"]/);
          if (starMatch) {
            names = [starMatch[1]];
            break;
          }
        }
      } catch (_) {}
      const seen = new Set();
      const uniq = names.filter(n => { if (seen.has(n)) return false; seen.add(n); return true; });
      let isDefaultImport = false;
      try {
        const importerText = fs.readFileSync(importer, 'utf8');
        for (const line of importerText.split(/\n/)) {
          if (!matchesSource(line)) continue;
          if (/^import\s+\w+\s+from\s*['"][^'"]+['"]/.test(line) && !/\{/.test(line) && !/\*/.test(line)) {
            isDefaultImport = true;
          }
          break;
        }
      } catch (_) {}
      if (isDefaultImport && uniq.length === 1) {
        const n = uniq[0];
        const isClass = /^[A-Z]/.test(n);
        return `export default ${isClass ? `class ${n} {}` : `function ${n}() {}`};\n`;
      }
      const namedExports = uniq.map(n => {
        const isClass = /^[A-Z]/.test(n);
        return isClass ? `export class ${n} {}` : `export function ${n}() {}`;
      }).join('\n');
      return (namedExports || 'export default function MissingStub() { return null; }') + '\n';
    }
    return null;
  },
});

// Security headers middleware
function securityHeaders() {
    return {
        name: 'security-headers',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                // Content Security Policy
                // NOTE: `script-src` must allow Vite's React Refresh preamble, which
                // is injected as an INLINE <script> in dev. Without the preamble's
                // hash the CSP blocks it, `window.__vite_plugin_react_preamble_installed__`
                // is never set, and every .jsx module fails with
                // "@vitejs/plugin-react can't detect preamble". The sha256 below is the
                // stable hash of that preamble for @vitejs/plugin-react.
                const reactPreambleHash = "'sha256-Z2/iFzh9VMlVkEOar1f/oSHWwQk3ve1qk/C2WdsC4Xk='";
                res.setHeader(
                    'Content-Security-Policy',
                    // Clerk: production loads clerk-js from the CNAMEd FAPI
                    // (clerk.smartvid.app); local dev loads it from the dev
                    // instance (*.clerk.accounts.dev). Smart CAPTCHA / bot
                    // protection uses Cloudflare Turnstile
                    // (challenges.cloudflare.com), which must be allowed in
                    // script-src + frame-src or sign-up fails.
                    "default-src 'self'; script-src 'self' " + reactPreambleHash + " https://clerk.smartvid.app https://*.clerk.accounts.dev https://challenges.cloudflare.com blob:; worker-src 'self' blob: https://clerk.smartvid.app https://*.clerk.accounts.dev; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' ws://localhost:3001 http://localhost:3001 ws://localhost:8000 http://localhost:8000 ws://localhost:8888 http://localhost:8888 https://*.supabase.co " + (process.env.VITE_MUAPI_URL || 'https://api.muapi.ai') + " https://api.openai.com https://api.muapi.ai https://clerk.smartvid.app https://*.clerk.accounts.dev; frame-src 'self' https://clerk.smartvid.app https://*.clerk.accounts.dev https://challenges.cloudflare.com; media-src 'self' https: blob:;"
                );
                
                // Prevent clickjacking
                res.setHeader('X-Frame-Options', 'DENY');
                
                // Prevent MIME type sniffing
                res.setHeader('X-Content-Type-Options', 'nosniff');
                
                // Enable XSS filter
                res.setHeader('X-XSS-Protection', '1; mode=block');
                
                // Referrer Policy
                res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
                
                // Permissions Policy
                res.setHeader(
                    'Permissions-Policy',
                    'camera=(), microphone=()'
                );
                
                next();
            });
        }
    };
}

// Resolve the project root for use by plugins below
const PROJECT_ROOT = __dirname;

/**
 * modelCatalogBuildPlugin — runs at build time (vite build).
 *
 * Reads src/lib/models.js and src/lib/modelDescriptions.js and emits
 * public/api/model-catalog.json so Netlify can serve /api/model-catalog
 * as a static file without a running backend process.
 */
function modelCatalogBuildPlugin() {
  return {
    name: 'model-catalog-build',
    enforce: 'post',
    generateBundle(_options, _bundle) {
      try {
        const modelsMod = require(path.join(PROJECT_ROOT, 'src/lib/models.js'));
        const descMod   = require(path.join(PROJECT_ROOT, 'src/lib/modelDescriptions.js'));
        const DESCRIPTIONS = descMod.DESCRIPTIONS || {};

        const seen = new Set();
        const unique = (list, type) => {
          const out = [];
          for (const m of list) {
            if (seen.has(m.id)) continue;
            seen.add(m.id);
            const desc = (DESCRIPTIONS[type] || {})[m.id] || null;
            out.push({ id: m.id, name: m.name, ...(desc ? { description: desc } : {}) });
          }
          return out;
        };

        const catalog = {
          t2i: unique(modelsMod.t2iModels || [], 't2i'),
          i2i: unique(modelsMod.i2iModels || [], 'i2i'),
          i2v: unique(modelsMod.i2vModels || [], 'i2v'),
        };
        const total = catalog.t2i.length + catalog.i2i.length + catalog.i2v.length;
        this.emitFile({
          type: 'asset',
          fileName: 'api/model-catalog.json',
          source: JSON.stringify(catalog),
        });
        console.log(`[model-catalog] Emitted api/model-catalog.json (${total} models)`);
      } catch (e) {
        console.warn('[model-catalog] Build plugin skipped:', e.message);
      }
    },
  };
}

/**
 * svgMissingFallback — some bundled dependencies import `.svg` assets (e.g.
 * `icon-transition.svg?import`) that don't exist in this project, producing
 * 404s / aborted requests at runtime. When the referenced file is genuinely
 * absent we return a transparent 1x1 SVG so the import resolves instead of
 * failing. Real `.svg` files on disk are left untouched.
 */
function svgMissingFallback() {
  const fs = require('fs');
  const PLACEHOLDER =
    'data:image/svg+xml,' +
    encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>');
  return {
    name: 'svg-missing-fallback',
    enforce: 'pre',
    async load(id) {
      const file = id.split('?')[0];
      if (!file.endsWith('.svg')) return null;
      if (fs.existsSync(file)) return null; // real asset: let Vite handle it
      return `export default ${JSON.stringify(PLACEHOLDER)};`;
    },
  };
}

export default defineConfig({
    plugins: [
        tailwindcss(),
        // react(),
        securityHeaders(),
        stubLegacy(),
        svgMissingFallback(),
        modelCatalogBuildPlugin(),
    ],
    resolve: {
        alias: {
            'react-svg-inline': path.resolve(__dirname, 'src/lib/react-svg-inline.jsx'),
            '@higgsfield/timeline-editor': path.resolve(__dirname, 'packages/timeline-editor/src'),
            '@higgsfield/color-grading': path.resolve(__dirname, 'packages/color-grading/src'),
            '@higgsfield/audio-mixer': path.resolve(__dirname, 'packages/audio-mixer/src'),
            '@higgsfield/transitions': path.resolve(__dirname, 'packages/transitions/src'),
            '@higgsfield/subtitles': path.resolve(__dirname, 'packages/subtitles/src'),
            '@higgsfield/style-templates': path.resolve(__dirname, 'packages/style-templates/src'),
            '@higgsfield/video-compiler': path.resolve(__dirname, 'packages/video-compiler/src'),
            '@higgsfield/ai-chat': path.resolve(__dirname, 'packages/ai-chat/src'),
        },
    },
    server: {
        port: 3004,
        proxy: {
            '/api/ai-agent': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/api/scene-detection': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/api/semantic-search': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/api/speech-transcription': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/api/agents': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/videoagent': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/api/model-catalog': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/director-api': {
                target: process.env.VITE_DIRECTOR_API_URL || 'http://localhost:8000',
                changeOrigin: true,
                rewrite: (p) => p.replace(/^\/director-api/, ''),
            },
            '/mcp': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            // Personalization/intelligence API must come BEFORE the generic /api
            // rule so it isn't routed to the MuAPI backend. In dev, serve from the
            // Netlify functions CLI on :8888 if available; otherwise fall back to
            // a same-origin placeholder so the dev server doesn't crash.
            '/api/intelligence': {
                target: process.env.VITE_INTELLIGENCE_API_URL || 'http://localhost:8888',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/intelligence/, '/.netlify/functions/intelligence-api'),
            },
            '/api/personalizer': {
                target: process.env.VITE_INTELLIGENCE_API_URL || 'http://localhost:8888',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/personalizer/, '/.netlify/functions/personalizer-api'),
            },
            '/api': {
                target: process.env.VITE_MUAPI_URL || 'https://api.muapi.ai',
                changeOrigin: true,
                secure: true,
                rewrite: (path) => path.replace(/^\/api/, ''),
            },
        },
    },
    build: {
        target: 'esnext',
        minify: 'terser',
        esbuild: {
            loader: 'jsx',
            include: [/\.jsx?$/, /\.tsx?$/],
            exclude: [/node_modules/],
        },
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true
            }
        },
        rollupOptions: {
            output: {
                // Group heavy, self-contained vendor libs into stable chunks so
                // Rollup doesn't auto-merge them into the editor's chunk graph
                // (that merge is what surfaced the production TDZ crash).
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        if (id.includes('@supabase')) return 'vendor';
                        if (id.includes('mp4box')) return 'vendor-mp4box';
                    }
                    return undefined; // everything else: let Rollup decide
                },
                entryFileNames: 'assets/[name]-[hash].js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash].[ext]'
            }
        },
        sourcemap: process.env.NODE_ENV !== 'production',
        chunkSizeWarningLimit: 1000
    },
    preview: {
        port: 3000,
        headers: {
            'Cache-Control': 'public, max-age=31536000',
            'X-Frame-Options': 'DENY',
            'X-Content-Type-Options': 'nosniff',
            'X-XSS-Protection': '1; mode=block',
            'Referrer-Policy': 'strict-origin-when-cross-origin'
        }
    }
});
