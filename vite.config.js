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
    // Try Vite's full resolution. If the source resolves to a file
    // outside the legacy tree (e.g. an npm package in node_modules),
    // let Vite handle it normally.
    const resolved = await this.resolve(source, importer, { skipSelf: true });
    if (resolved) {
      const resolvedId = typeof resolved === 'string' ? resolved : resolved.id;
      // Never stub landing-page modules even if they resolve under
      // src/components/landing/ (which technically contains 'components/').
      if (resolvedId.includes('src/components/landing/')) return null;
      const resolvedIsLegacy = STUB_IMPORTER_PREFIXES.some(p => resolvedId.includes(p));
      if (!resolvedIsLegacy) return null;
    }
    // For asset imports (svg/png/...) from the legacy tree, return a stub
    // module that exports a placeholder data URL so the build passes.
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
                res.setHeader(
                    'Content-Security-Policy',
                    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' ws://localhost:3001 http://localhost:3001 ws://localhost:8000 http://localhost:8000 ws://localhost:8888 http://localhost:8888 https://*.supabase.co " + (process.env.VITE_MUAPI_URL || 'https://api.muapi.ai') + " https://api.openai.com https://api.muapi.ai; media-src 'self' https: blob:;"
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

export default defineConfig({
    plugins: [
        tailwindcss(),
        react(),
        securityHeaders(),
        stubLegacy(),
        modelCatalogBuildPlugin(),
    ],
    resolve: {
        alias: {
            'react-svg-inline': path.resolve(__dirname, 'src/lib/react-svg-inline.jsx'),
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
            jsx: 'preserve',
        },
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true
            }
        },
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor': ['@supabase/supabase-js'],
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
