import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';
// Cache-bust: 2026-07-28

// Helper: forward a request to the Supabase muapi-proxy without Origin/Referer
// and with the correct Host header so Cloudflare routes it to the project.
function createMuapiProxyMiddleware(targetUrl) {
  return async function muapiProxyMiddleware(req, res, next) {
    const pathname = (req.url || '').split('?')[0];
    if (pathname !== '/functions/v1/muapi-proxy' || req.method !== 'POST') {
      return next();
    }

    const url = new URL(targetUrl);
    
    // Read the request body
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      
      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: '/functions/v1/muapi-proxy',
        method: req.method,
        headers: { ...req.headers },
        rejectUnauthorized: false,
      };

      // Strip origin-like headers and set the correct Host header
      // so the Supabase edge function accepts the request.
      delete options.headers['origin'];
      delete options.headers['Origin'];
      delete options.headers['referer'];
      delete options.headers['Referer'];
      options.headers['host'] = url.hostname;
      options.headers['content-length'] = body.length;

      const proxyReq = https.request(options, (proxyRes) => {
        res.statusCode = proxyRes.statusCode;
        Object.entries(proxyRes.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        console.error('[muapi-proxy] request error:', err);
        if (!res.headersSent) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Proxy error', details: err.message }));
        }
      });

      proxyReq.write(body);
      proxyReq.end();
    });
  };
}

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
    if (/\.html(\?|$)/i.test(source)) return null;
    const importerIsLegacy = STUB_IMPORTER_PREFIXES.some(p => importer.includes(p));
    if (!importerIsLegacy) return null;
    // Never stub imports from the landing page — those are new-style
    // modules that must resolve to their real files.
    if (importer.includes('src/components/landing/')) return null;
    // Try Vite's full resolution. If the source resolves to a file
    // outside the legacy tree (e.g. an npm package in node_modules),
    // let Vite handle it normally.
    const resolved = await this.resolve(source, importer, { skipSelf: true });
    if (resolved) return null;

    // Genuinely unresolved legacy import — stub it so the bundle still
    // resolves. Asset imports get a placeholder data URL.
    if (/\.(svg|png|jpe?g|webp|gif|ico)(\?|$)/i.test(source)) {
      const rel = importer.replace(process.cwd() + '/', '');
      console.warn('[STUB]', source, '<-', rel);
      if (process.env.STRICT_IMPORTS) {
        throw new Error(`Unresolved import "${source}" from ${rel}`);
      }
      return {
        id: '\0legacy-asset-stub:' + source + '::' + importer,
      };
    }
    const rel = importer.replace(process.cwd() + '/', '');
    console.warn('[STUB]', source, '<-', rel);
    if (process.env.STRICT_IMPORTS) {
      throw new Error(`Unresolved import "${source}" from ${rel}`);
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
      console.warn('[stub-legacy] Stubbing unresolved import:', source, '←', importer);
      console.warn('[stub-legacy] Stubbing unresolved import:', source, '←', importer);
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

// fixLegacyImports — remaps webpack/CRA-style specifiers left over from this
// repo's pre-Vite origin to real files under src/ (or, for some legacy
// modules, still at the repo root), and rewrites imports that resolve into
// /public (which Vite forbids importing as modules) to a virtual module
// exporting the asset's public URL.
//
// The legacy `components/` tree references these roots with relative
// `../../` specifiers and no leading "/", e.g.:
//   import { Component } from "../../../../base/Component.js";
//   import { getStore } from "../../../stores/base/Store.js";
//   import utils from "../../../lib/lottie/utils";
//   import asset from "../../../../public/static/images/icon.svg";
//   import { Component } from "../../vite-remix-editor/src/components/base/Component.js";
//
// It only acts on imports that currently FAIL to resolve (or that resolve into
// /public), so healthy imports are never touched. This complements stubLegacy,
// which stubs imports that fail resolution entirely.
const fixLegacyImports = () => {
  const isPublic = (id) =>
    id.includes(`${path.sep}public${path.sep}`) || id.endsWith(`${path.sep}public`);

  const publicUrl = (id) => {
    const rel = id.split(`public${path.sep}`)[1].split(path.sep).join('/');
    return '\0public-url:' + rel;
  };

  // Logical root-relative heads that identify a legacy specifier. Order is
  // significant: more specific heads must be listed before their prefix.
  const LEGACY_HEADS = [
    'vite-remix-editor/src/',
    'vite-remix-editor/',
    'base/Component.js',
    'base/Store.js',
    'stores/',
    'hoc/',
    'lib/',
    'components/',
    'public/',
  ];

  return {
    name: 'fix-legacy-imports',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (!importer || importer.includes('node_modules')) return null;
      if (source.startsWith('\0')) return null;
      if (/\.html(\?|$)/i.test(source)) return null;

      // IMPORTANT: do NOT call Vite's resolver (this.resolve) here. stubLegacy
      // (another 'pre' plugin) also calls this.resolve with skipSelf, which
      // would re-enter this hook and recurse until Vite's recursion guard
      // returns a broken id. We resolve legacy candidates directly against the
      // filesystem instead.

      const isRelative = /^\.\.?\/|^\//.test(source);

      // If the specifier already resolves to a real file on disk (relative to
      // the importer), leave it untouched. A file inside /public is special:
      // Vite forbids importing public assets as modules, so rewrite it to a
      // virtual module exporting the public URL.
      if (isRelative) {
        const asIs = path.resolve(path.dirname(importer), source);
        if (fs.existsSync(asIs) && fs.statSync(asIs).isFile()) {
          if (isPublic(asIs)) return publicUrl(asIs);
          return null;
        }
        // Extensionless relative specifier (e.g. "../../components/modals/X"):
        // try common extensions AND directory index files against the
        // importer-relative path BEFORE falling into the legacy src/-first
        // candidate routing below. Without this, an extensionless relative
        // import whose real sibling is "X.jsx" is treated as unresolved and
        // gets misrouted to a same-named file under src/. Honoring the real
        // sibling keeps relative imports (e.g. the modal registry) pointing at
        // their actual on-disk targets.
        if (!path.extname(asIs)) {
          for (const ext of ['.jsx', '.tsx', '.ts', '.mjs', '.js']) {
            const alt = asIs + ext;
            if (fs.existsSync(alt) && fs.statSync(alt).isFile()) {
              return isPublic(alt) ? publicUrl(alt) : alt;
            }
          }
          for (const idx of ['index.jsx', 'index.tsx', 'index.ts', 'index.mjs', 'index.js']) {
            const alt = path.join(asIs, idx);
            if (fs.existsSync(alt) && fs.statSync(alt).isFile()) {
              return isPublic(alt) ? publicUrl(alt) : alt;
            }
          }
        }
      }

      // Unresolved (or resolves into /public) → treat as a legacy specifier.
      // Strip leading ./ and ../ so we keep the logical root-relative path
      // (e.g. "base/Component.js").
      const logical = source
        .replace(/^(?:\.\.\/)+/, '')
        .replace(/^\.\//, '')
        .replace(/^\//, '');

      if (!LEGACY_HEADS.some((h) => logical.includes(h))) return null;

      // Build root-relative candidate(s), trying src/ first, then the repo
      // root, for roots that live in both places.
      const candidates = [];
      if (logical.startsWith('vite-remix-editor/src/')) {
        candidates.push(logical.replace('vite-remix-editor/src/', 'src/'));
      } else if (logical.startsWith('vite-remix-editor/')) {
        candidates.push(logical.replace('vite-remix-editor/', ''));
      } else if (logical === 'base/Component.js') {
        candidates.push('src/components/base/Component.js');
      } else if (logical === 'base/Store.js') {
        candidates.push('src/stores/base/Store.js');
      } else if (logical.startsWith('stores/')) {
        candidates.push('src/' + logical, logical);
      } else if (logical.startsWith('hoc/')) {
        candidates.push('src/' + logical, logical);
      } else if (logical.startsWith('lib/')) {
        candidates.push('src/' + logical, logical);
      } else if (logical.startsWith('components/')) {
        candidates.push('src/' + logical, logical);
      } else if (logical.startsWith('public/')) {
        candidates.push(logical);
      }

      const isFile = (p) => fs.existsSync(p) && fs.statSync(p).isFile();

      for (const cand of candidates) {
        const abs = path.resolve(__dirname, cand);
        if (isFile(abs)) {
          return isPublic(abs) ? publicUrl(abs) : abs;
        }
        // Extension fallback: legacy .js specifiers are often authored as
        // .jsx/.tsx/.ts/.mjs.
        for (const ext of ['.js', '.jsx', '.tsx', '.ts', '.mjs']) {
          const alt = abs.replace(/\.(js|jsx|ts|tsx|mjs)$/i, '') + ext;
          if (isFile(alt)) {
            return isPublic(alt) ? publicUrl(alt) : alt;
          }
        }
      }
      return null;
    },
    load(id) {
      if (id.startsWith('\0public-url:')) {
        const rel = id.slice('\0public-url:'.length);
        return `export default ${JSON.stringify('/' + rel)};\n`;
      }
      return null;
    },
    // Dev-only: Vite's /@id/ pipeline treats "\0public-url:*.svg?import" ids as
    // asset requests and does not run this plugin's load() for them, so the
    // browser receives the SPA index.html fallback (a JS "module" that is
    // actually HTML) and the importing module rejects at runtime. Serve these
    // virtual modules explicitly as a real ES module exporting the public URL.
    //
    // Registered via the direct `server.middlewares.use(...)` form inside
    // configureServer (NOT the returned post-hook form), so it runs before
    // Vite's internal transform/SPA-fallback middlewares and reliably claims
    // the request regardless of plugin ordering. Vite encodes the virtual id
    // "\0public-url:<rel>" in the request path as
    // "/@id/__x00__public-url:<rel>" (optionally with a "?import" query) —
    // verified against the real failing request for cogwheel.svg. We match on
    // the "public-url:" marker to be resilient to the leading encoding.
    configureServer(server) {
      const MARKER = 'public-url:';
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        const markerIdx = url.indexOf(MARKER);
        // Only handle the virtual public-url id path (served via Vite's /@id/
        // module route). Never touch normal /static/... asset requests.
        if (markerIdx === -1 || !url.startsWith('/@id/')) return next();
        const rel = url.slice(markerIdx + MARKER.length).split('?')[0].split('#')[0];
        res.setHeader('Content-Type', 'application/javascript');
        res.end(`export default ${JSON.stringify('/' + rel)};\n`);
      });
    },
  };
};

// Resolve the Clerk frontend API host from the publishable key so the dev
// CSP (set in securityHeaders) permits Clerk's JS/worker/network requests
// for whichever instance is configured. The key payload is base64 of
// "<frontendDomain>$". Loaded via loadEnv because Vite does not expose .env
// vars on process.env for the config's Node context.
const CLERK_DEV_ENV = loadEnv('development', __dirname, '');
const CLERK_KEY = CLERK_DEV_ENV.VITE_CLERK_PUBLISHABLE_KEY || '';
let clerkDomain = '';
const clerkKeyMatch = CLERK_KEY.match(/^pk_(?:test|live)_(.+)$/);
if (clerkKeyMatch) {
  try {
    clerkDomain = Buffer.from(clerkKeyMatch[1], 'base64').toString('utf8').replace(/\$$/, '');
  } catch (_) { /* ignore malformed key */ }
}
const clerkHostSrc = clerkDomain ? ` https://${clerkDomain}` : '';

// Security headers middleware. clerkHostSrc is the Clerk frontend API host
// derived from VITE_CLERK_PUBLISHABLE_KEY (see the module-scope block
// below) so the dev CSP permits Clerk's JS/worker/network requests for the
// configured instance.
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

                // clerkHostSrc is derived from VITE_CLERK_PUBLISHABLE_KEY at the
                // export below and injected here so the dev CSP permits Clerk's
                // JS/worker/network requests for whichever instance is configured
                // (e.g. touched-stud-74.clerk.accounts.dev for the dev instance),
                // while still allowing the production proxy domain clerk.smartvid.app.

                const csp = [
                  "default-src 'self'",
                  `script-src 'self' ${reactPreambleHash}${clerkHostSrc} https://clerk.smartvid.app https://challenges.cloudflare.com blob:`,
                  `worker-src 'self' blob:${clerkHostSrc} https://clerk.smartvid.app`,
                  `style-src 'self' 'unsafe-inline'${clerkHostSrc}`,
                  `img-src 'self' data: https: blob:${clerkHostSrc}`,
                  `font-src 'self' data:${clerkHostSrc}`,
                  "connect-src 'self' ws://localhost:3001 http://localhost:3001 ws://localhost:8000 http://localhost:8000 ws://localhost:8888 http://localhost:8888 https://*.supabase.co " + (process.env.VITE_MUAPI_URL || 'https://api.muapi.ai') + " https://api.openai.com https://api.muapi.ai https://clerk.smartvid.app https://clerk-telemetry.com https://challenges.cloudflare.com https://raw.githubusercontent.com" + clerkHostSrc,
                  `frame-src 'self'${clerkHostSrc} https://clerk.smartvid.app https://challenges.cloudflare.com`,
                  "media-src 'self' https: blob:",
                ].join('; ');
                res.setHeader('Content-Security-Policy', csp);
                
                 // Prevent clickjacking
                 // In dev, allow framing for embedded studio iframes via CSP frame-src.
                 // Production should reconsider this based on actual framing needs.
                 if (process.env.NODE_ENV !== 'production') {
                   res.removeHeader('X-Frame-Options');
                 } else {
                   res.setHeader('X-Frame-Options', 'SAMEORIGIN');
                 }
                
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
 * gtmBoostDevPlugin — runs in dev (vite dev) to serve /api/gtm-boost/*
 * from the local backend service module. The Express server on :3001
 * is not always running in dev, so mounting the service as a Vite
 * middleware keeps the template-creation flow working without a
 * running backend process. Mirrors the production behavior where the
 * service runs on the Express server.
 *
 * Endpoints served:
 *   GET  /api/gtm-boost/options
 *   POST /api/gtm-boost/template-context
 *   POST /api/gtm-boost/generate
 */
function gtmBoostDevPlugin() {
  return {
    name: 'gtm-boost-dev',
    apply: 'serve',
    configureServer(server) {
      // Lazy import the service so Vite's CJS/ESM handling doesn't choke
      // on the Express dependency at plugin-load time.
      let serviceMod = null;
      const getService = async () => {
        if (serviceMod) return serviceMod;
        try {
          // Use a variable for the import path so Vite's static module
          // scanner cannot pre-resolve this backend service (and its
          // express dependency) during production builds.
          const servicePath = './backend/services/gtmBoostService.js';
          serviceMod = await import(servicePath);
          return serviceMod;
        } catch (e) {
          console.warn('[gtm-boost-dev] Failed to load service:', e.message);
          return null;
        }
      };

      // Helper: read the request body as a UTF-8 string.
      const readBody = (req) => new Promise((resolve) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      });

      // Helper: send a JSON response.
      const sendJson = (res, status, obj) => {
        if (res.headersSent) return;
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(obj));
      };

      server.middlewares.use('/api/gtm-boost', async (req, res) => {
        const mod = await getService();
        if (!mod) {
          sendJson(res, 500, { error: 'gtm-boost service unavailable' });
          return;
        }


        // Vite/Connect strips the mount prefix from req.url before our
        // handler runs, so req.url is already the relative path
        // (e.g. "/options", "/generate", "/template-context").
        const url = req.url || '/';
        const queryIdx = url.indexOf('?');
        const path = queryIdx >= 0 ? url.slice(0, queryIdx) : url;
        const queryPart = queryIdx >= 0 ? url.slice(queryIdx + 1) : '';
        const params = new URLSearchParams(queryPart);

        try {
          // GET /api/gtm-boost/options
          if (req.method === 'GET' && path === '/options') {
            // Return the full library inline so we don't need to mount
            // Express (which isn't available in the Vite dev process).
            sendJson(res, 200, {
              roles: [
                { id: 'sdr', title: 'SDR/BDR Prospecting', description: 'Sales Development Representative / Business Development Representative content for cold outreach and lead qualification', objectives: ['Generate qualified leads', 'Create pipeline opportunities', 'Establish initial contact and interest'], primaryKPI: 'meeting bookings' },
                { id: 'ae', title: 'Account Executive Discovery', description: 'Account Executive content for qualified prospects, discovery, and value demonstration', objectives: ['Advance qualified opportunities', 'Demonstrate ROI and business value', 'Handle objections and concerns'], primaryKPI: 'deal progression' },
                { id: 'sales-manager', title: 'Sales Management', description: 'Sales leadership content for team enablement and pipeline management', objectives: ['Accelerate team performance', 'Build management credibility', 'Drive revenue growth'], primaryKPI: 'team quota attainment' },
                { id: 'revops', title: 'Revenue Operations', description: 'Revenue Operations content for process optimization and data-driven insights', objectives: ['Improve operational efficiency', 'Enhance data accuracy and insights', 'Optimize sales processes and automation'], primaryKPI: 'operational efficiency gains' },
                { id: 'csm', title: 'Customer Success', description: 'Customer Success Management content for retention and expansion', objectives: ['Reduce customer churn', 'Identify expansion opportunities', 'Build long-term customer loyalty'], primaryKPI: 'customer retention and expansion' },
                { id: 'founder', title: 'Executive Leadership', description: 'Founder and executive content for strategic partnerships and vision communication', objectives: ['Build strategic relationships', 'Communicate company vision', 'Drive executive-level engagement'], primaryKPI: 'strategic partnership development' },
              ],
              industries: [
                { id: 'saas', name: 'SaaS', description: 'Software as a Service solutions and subscription-based business models' },
                { id: 'fintech', name: 'FinTech', description: 'Financial technology and payment processing solutions' },
                { id: 'healthcare', name: 'Healthcare', description: 'Healthcare technology and patient care solutions' },
                { id: 'manufacturing', name: 'Manufacturing', description: 'Manufacturing and industrial operations solutions' },
                { id: 'professional-services', name: 'Professional Services', description: 'Consulting, advisory, and professional service firms' },
                { id: 'ecommerce', name: 'E-commerce', description: 'Online retail and DTC brands selling through visual storefronts' },
                { id: 'real-estate', name: 'Real Estate', description: 'Residential, commercial, and proptech selling via property visuals' },
                { id: 'education', name: 'Education', description: 'EdTech, universities, and training orgs selling learning outcomes' },
                { id: 'logistics', name: 'Logistics & Supply Chain', description: 'Freight, warehousing, and supply-chain software and services' },
                { id: 'retail', name: 'Retail & CPG', description: 'Brick-and-mortar and consumer-packaged-goods brand marketing' },
                { id: 'media', name: 'Media & Entertainment', description: 'Streaming, publishing, and studios selling audience attention' },
                { id: 'legal', name: 'Legal & Compliance', description: 'Law firms and legal-tech selling trust and expertise' },
                { id: 'telecom', name: 'Telecom & Connectivity', description: 'Connectivity, broadband, and communications providers' },
                { id: 'energy', name: 'Energy & Clean Tech', description: 'Renewables, utilities, and climate-tech selling transformation' },
                { id: 'nonprofit', name: 'Nonprofit & Mission-Driven', description: 'Charities and mission orgs driving donations and awareness' },
                { id: 'government', name: 'Government & Public Sector', description: 'Public agencies and govtech selling programs and services' },
                { id: 'insurance', name: 'Insurance', description: 'Carriers, brokers, and insurtech selling protection and peace of mind' },
                { id: 'automotive', name: 'Automotive & Mobility', description: 'Dealers, OEMs, and mobility tech selling vehicles and experiences' },
              ],
              methodologies: [
                { id: 'meddpicc', name: 'MEDDPICC', fullName: 'Metrics, Economic Buyer, Decision Criteria, Decision Process, Paper Process, Identify Pain, Champion, Competition', description: 'Enterprise sales qualification framework for complex B2B sales', application: 'Apply systematically to understand and navigate enterprise buying processes' },
                { id: 'spin', name: 'SPIN Selling', fullName: 'Situation, Problem, Implication, Need-payoff', description: 'Consultative selling framework for complex solutions', application: 'Progress conversations from current state to solution value' },
                { id: 'challenger', name: 'Challenger Sale', fullName: 'The Challenger Sale', description: 'Insight-driven sales approach that challenges customer assumptions', application: 'Teach customers, tailor communications, and take control of sales conversations' },
                { id: 'gap-selling', name: 'Gap Selling', fullName: 'Gap Selling', description: 'Framework focusing on the gap between current and desired future state', application: 'Identify gaps and position solutions as bridges to desired outcomes' },
                { id: 'value-selling', name: 'Value Selling', fullName: 'Value-Based Selling', description: 'Sales approach focused on quantifiable business value and ROI', application: 'Demonstrate tangible business impact and quantified results' },
                { id: 'sandler', name: 'Sandler Selling', fullName: 'Sandler Selling System', description: 'Qualification-focused sales process with pain-based selling', application: 'Qualify prospects and focus on pain points throughout sales process' },
              ],
              tonalities: [
                { id: 'professional', name: 'Professional', description: 'Clean, credible, polished tone for B2B image and video creative', guidelines: 'Use clear, confident language; steady pacing; neutral, well-lit framing; minimal but premium styling' },
                { id: 'executive', name: 'Executive Gravitas', description: 'Formal, authoritative tone with strategic insights for boardroom-level video', guidelines: 'Sophisticated vocabulary, emphasis on vision/leadership, slow deliberate cuts, cinematic establishing shots' },
                { id: 'challenger', name: 'Challenger Bold', description: 'Confident, assertive tone that challenges assumptions in punchy video hooks', guidelines: 'Provocative insight-driven copy, hard cuts, high-contrast visuals, bold typography on screen' },
                { id: 'conversational', name: 'Conversational Peer', description: 'Friendly, relatable tone like talking to a trusted colleague on camera', guidelines: 'Use "we"/"you", casual framing (selfie/desk setup), natural lighting, relaxed pacing' },
                { id: 'technical', name: 'Technical Expert', description: 'Deep technical credibility for demo-heavy product videos and explainer images', guidelines: 'Industry terminology, screen-recorded UI demos, diagram overlays, precise labelling' },
                { id: 'inspirational', name: 'Inspirational Vision', description: 'Aspirational tone painting a future vision for brand/manifesto video', guidelines: 'Aspirational copy, sweeping b-roll, upward camera moves, warm uplifting color grade' },
                { id: 'urgent', name: 'Urgent Action', description: 'Time-sensitive, high-energy tone for limited-offer promo video', guidelines: 'Action verbs, countdown graphics, fast pacing, urgent sound design, red/amber accents' },
                { id: 'casual', name: 'Casual Peer-to-Peer', description: 'Light, informal tone for social-first Reels/TikToks aimed at GTM peers', guidelines: 'Slang-light, punchy one-liners, vertical 9:16 framing, trending audio, quick cuts' },
                { id: 'witty', name: 'Witty & Clever', description: 'Humorous, clever copy for scroll-stopping social video and meme images', guidelines: 'Wordplay and light joke setups, comedic timing in edits, playful graphics' },
                { id: 'empathetic', name: 'Empathetic & Human', description: 'Warm, understanding tone for customer-story and retention video', guidelines: 'Validation-first copy, real customer faces, soft focus, gentle pacing, calm score' },
                { id: 'data-driven', name: 'Data-Driven', description: 'Number-led, proof-oriented tone for ROI/results video and stat graphics', guidelines: 'Lead with metrics, animated bar/line charts, clean infographic styling, confident narration' },
                { id: 'storytelling', name: 'Narrative Storytelling', description: 'Three-act story structure for case-study and founding-story video', guidelines: 'Setup-conflict-resolution arc, character-led b-roll, emotional music swell' },
                { id: 'authoritative', name: 'Authoritative Expert', description: 'Commanding, credentialed tone for thought-leadership video', guidelines: 'Cite frameworks and proof, steady eye-contact framing, library/office settings, serious grade' },
                { id: 'minimalist', name: 'Minimalist', description: 'Restrained, single-message tone for clean product hero images and videos', guidelines: 'One idea per frame, lots of negative space, muted palette, slow deliberate motion' },
                { id: 'luxury', name: 'Luxury & Premium', description: 'High-end, exclusive tone for enterprise/ABM video and hero imagery', guidelines: 'Rich textures, slow motion, gold/black palette, elegant typography, no hard-sell' },
                { id: 'playful', name: 'Playful & Fun', description: 'Bright, energetic tone for culture and top-of-funnel social video', guidelines: 'Bright palette, bouncy edits, emoji-style graphics, upbeat quirky music' },
                { id: 'bold', name: 'Bold & Disruptive', description: 'Loud, category-breaking tone for brand-launch video', guidelines: 'Oversized type, saturated color, fast aggressive cuts, statement voiceover' },
                { id: 'educational', name: 'Educational', description: 'Clear teaching tone for how-to and explainer video/image carousels', guidelines: 'Step-by-step structure, pointer/arrow overlays, calm narration, clean whiteboard style' },
                { id: 'trustworthy', name: 'Trustworthy & Reassuring', description: 'Calm, dependable tone for security/compliance and onboarding video', guidelines: 'Plain language, steady pacing, soft blue/green palette, real-environment shots' },
                { id: 'energetic', name: 'Energetic & Upbeat', description: 'High-tempo, motivating tone for event/launch hype video', guidelines: 'Fast cuts, rising tempo, bright colors, crowd/confetti energy, driving beat' },
                { id: 'sophisticated', name: 'Sophisticated & Refined', description: 'Understated elegance for premium B2B brand films', guidelines: 'Subtle motion, refined palette, elegant serif type, restrained music' },
                { id: 'direct', name: 'Direct & No-Fluff', description: 'Blunt, benefit-first tone for bottom-funnel conversion video', guidelines: 'Front-load the offer, plain words, punch-in cuts, clear CTA card' },
                { id: 'friendly', name: 'Friendly & Welcoming', description: 'Warm invite tone for webinar and community onboarding video', guidelines: 'Inviting copy, open body language, bright airy set, gentle uplifting music' },
                { id: 'dramatic', name: 'Dramatic & Cinematic', description: 'High-stakes, cinematic tone for hero/brand film', guidelines: 'Low-key lighting, orchestral swell, slow-mo hero moment, deep contrast grade' },
                { id: 'peer-comparison', name: 'Social Proof / Peer Comparison', description: 'Comparison-led tone for competitive-displacement video', guidelines: 'Show "them vs you" split screens, benchmark charts, confident neutral narration' },
              ],
              focusAreas: [
                { id: 'lead-gen', label: 'Lead Generation', description: 'Lead generation with contact capture' },
                { id: 'awareness', label: 'Brand Awareness', description: 'Brand awareness and market education' },
                { id: 'education', label: 'Education', description: 'Educational content and knowledge sharing' },
                { id: 'demo', label: 'Product Demo', description: 'Product demonstration and capability showcase' },
              ],
            });
            return;
          }

          // POST /api/gtm-boost/template-context
          if (req.method === 'POST' && path === '/template-context') {
            const body = await readBody(req);
            const data = JSON.parse(body || '{}');
            // Inline the route handler logic so we don't need to mount Express.
            const { category, niche, name, description } = data || {};
            const TEMPLATE_CATEGORY_TO_INDUSTRY = {
              'Social Media': 'saas',
              'Style Transfer': 'saas',
              'Entertainment': 'events',
              'Commercial': 'retail',
              'VFX & Action': 'entertainment',
              'Portrait & Creator': 'fashion',
              'Decade & Era': 'fashion',
              'Camera & Cinematic': 'entertainment',
              'Industry Specific': 'saas',
              'Personal Story': 'nonprofit',
              'Restaurant & Cafe': 'restaurant',
              'Med Spa & Beauty': 'fashion',
              'Salon & Barbershop': 'fashion',
              'Gym & Fitness': 'fitness-wellness',
              'Real Estate': 'real-estate',
              'Dental Office': 'healthcare',
              'Chiropractic & Wellness': 'fitness-wellness',
              'Legal & Attorney': 'legal-services',
              'Automotive & Car': 'automotive',
              'Fashion & Style': 'fashion',
              'Events & Celebrations': 'events',
              'Luxury & Premium': 'luxury',
              'restaurant': 'restaurant',
              'med-spa': 'fashion',
              'salon': 'fashion',
              'fitness': 'fitness-wellness',
              'real-estate': 'real-estate',
              'dental': 'healthcare',
              'chiropractic': 'fitness-wellness',
              'legal': 'legal-services',
              'automotive': 'automotive',
              'fashion': 'fashion',
              'events': 'events',
              'luxury': 'luxury',
              'general-business': 'saas',
              'local-business': 'retail',
              'saas': 'saas',
              'agency': 'professional-services',
            };
            const industry =
              (niche && TEMPLATE_CATEGORY_TO_INDUSTRY[niche]) ||
              (category && TEMPLATE_CATEGORY_TO_INDUSTRY[category]) ||
              'saas';
            const tonality = (() => {
              if (industry === 'luxury' || industry === 'real-estate') return 'executive';
              if (industry === 'fashion' || industry === 'events') return 'inspirational';
              if (industry === 'healthcare' || industry === 'fintech') return 'technical';
              return 'conversational';
            })();
            const role = (() => {
              if (['saas', 'fintech', 'manufacturing', 'professional-services'].includes(industry)) return 'ae';
              if (['fashion', 'events', 'luxury', 'automotive', 'restaurant'].includes(industry)) return 'founder';
              if (['healthcare', 'fitness-wellness', 'education', 'real-estate', 'legal-services'].includes(industry)) return 'csm';
              return 'sdr';
            })();
            const methodology = (() => {
              if (['saas', 'fintech', 'manufacturing', 'healthcare'].includes(industry)) return 'meddpicc';
              if (['professional-services', 'legal-services', 'real-estate'].includes(industry)) return 'spin';
              if (['fashion', 'luxury', 'events'].includes(industry)) return 'challenger';
              return 'value-selling';
            })();
            sendJson(res, 200, {
              industry,
              tonality,
              role,
              methodology,
              basePrompt: description || name || '',
            });
            return;
          }

          // POST /api/gtm-boost/generate
          if (req.method === 'POST' && path === '/generate') {
            const body = await readBody(req);
            const data = JSON.parse(body || '{}');
            const { basePrompt, role, industry, methodology, tonality, focus = [], templateContext = {} } = data || {};
            // Apply defaults so the endpoint never 400s on missing/empty selections.
            const resolvedRole = role || 'sdr';
            const resolvedIndustry = industry || 'saas';
            const resolvedMethodology = methodology || 'spin';
            const resolvedTonality = tonality || 'professional';
            // Re-implement the generate logic inline so we don't need the
            // OpenAI fetch (which won't work in the Vite dev process anyway).
            const ROLES = {
              sdr: { title: 'SDR/BDR Prospecting', description: 'Sales Development Representative / Business Development Representative content for cold outreach and lead qualification', objectives: ['Generate qualified leads', 'Create pipeline opportunities', 'Establish initial contact and interest'], primaryKPI: 'meeting bookings' },
              ae: { title: 'Account Executive Discovery', description: 'Account Executive content for qualified prospects, discovery, and value demonstration', objectives: ['Advance qualified opportunities', 'Demonstrate ROI and business value', 'Handle objections and concerns'], primaryKPI: 'deal progression' },
              'sales-manager': { title: 'Sales Management', description: 'Sales leadership content for team enablement and pipeline management', objectives: ['Accelerate team performance', 'Build management credibility', 'Drive revenue growth'], primaryKPI: 'team quota attainment' },
              revops: { title: 'Revenue Operations', description: 'Revenue Operations content for process optimization and data-driven insights', objectives: ['Improve operational efficiency', 'Enhance data accuracy and insights', 'Optimize sales processes and automation'], primaryKPI: 'operational efficiency gains' },
              csm: { title: 'Customer Success', description: 'Customer Success Management content for retention and expansion', objectives: ['Reduce customer churn', 'Identify expansion opportunities', 'Build long-term customer loyalty'], primaryKPI: 'customer retention and expansion' },
              founder: { title: 'Executive Leadership', description: 'Founder and executive content for strategic partnerships and vision communication', objectives: ['Build strategic relationships', 'Communicate company vision', 'Drive executive-level engagement'], primaryKPI: 'strategic partnership development' },
            };
            const INDUSTRIES = {
              saas: { name: 'SaaS', description: 'Software as a Service solutions and subscription-based business models' },
              fintech: { name: 'FinTech', description: 'Financial technology and payment processing solutions' },
              healthcare: { name: 'Healthcare', description: 'Healthcare technology and patient care solutions' },
              manufacturing: { name: 'Manufacturing', description: 'Manufacturing and industrial operations solutions' },
              'professional-services': { name: 'Professional Services', description: 'Consulting, advisory, and professional service firms' },
              ecommerce: { name: 'E-commerce', description: 'Online retail and DTC brands selling through visual storefronts' },
              'real-estate': { name: 'Real Estate', description: 'Residential, commercial, and proptech selling via property visuals' },
              education: { name: 'Education', description: 'EdTech, universities, and training orgs selling learning outcomes' },
              logistics: { name: 'Logistics & Supply Chain', description: 'Freight, warehousing, and supply-chain software and services' },
              retail: { name: 'Retail & CPG', description: 'Brick-and-mortar and consumer-packaged-goods brand marketing' },
              media: { name: 'Media & Entertainment', description: 'Streaming, publishing, and studios selling audience attention' },
              legal: { name: 'Legal & Compliance', description: 'Law firms and legal-tech selling trust and expertise' },
              telecom: { name: 'Telecom & Connectivity', description: 'Connectivity, broadband, and communications providers' },
              energy: { name: 'Energy & Clean Tech', description: 'Renewables, utilities, and climate-tech selling transformation' },
              nonprofit: { name: 'Nonprofit & Mission-Driven', description: 'Charities and mission orgs driving donations and awareness' },
              government: { name: 'Government & Public Sector', description: 'Public agencies and govtech selling programs and services' },
              insurance: { name: 'Insurance', description: 'Carriers, brokers, and insurtech selling protection and peace of mind' },
              automotive: { name: 'Automotive & Mobility', description: 'Dealers, OEMs, and mobility tech selling vehicles and experiences' },
            };
            const METHODOLOGIES = {
              meddpicc: { name: 'MEDDPICC', application: 'Apply systematically to understand and navigate enterprise buying processes' },
              spin: { name: 'SPIN Selling', application: 'Progress conversations from current state to solution value' },
              challenger: { name: 'Challenger Sale', application: 'Teach customers, tailor communications, and take control of sales conversations' },
              'gap-selling': { name: 'Gap Selling', application: 'Identify gaps and position solutions as bridges to desired outcomes' },
              'value-selling': { name: 'Value Selling', application: 'Demonstrate tangible business impact and quantified results' },
              sandler: { name: 'Sandler Selling', application: 'Qualify prospects and focus on pain points throughout sales process' },
            };
            const TONALITIES = {
              professional: { name: 'Professional', guidelines: 'Use clear, confident language; steady pacing; neutral, well-lit framing; minimal but premium styling' },
              executive: { name: 'Executive Gravitas', guidelines: 'Sophisticated vocabulary, emphasis on vision/leadership, slow deliberate cuts, cinematic establishing shots' },
              challenger: { name: 'Challenger Bold', guidelines: 'Provocative insight-driven copy, hard cuts, high-contrast visuals, bold typography on screen' },
              conversational: { name: 'Conversational Peer', guidelines: 'Use "we"/"you", casual framing (selfie/desk setup), natural lighting, relaxed pacing' },
              technical: { name: 'Technical Expert', guidelines: 'Industry terminology, screen-recorded UI demos, diagram overlays, precise labelling' },
              inspirational: { name: 'Inspirational Vision', guidelines: 'Aspirational copy, sweeping b-roll, upward camera moves, warm uplifting color grade' },
              urgent: { name: 'Urgent Action', guidelines: 'Action verbs, countdown graphics, fast pacing, urgent sound design, red/amber accents' },
              casual: { name: 'Casual Peer-to-Peer', guidelines: 'Slang-light, punchy one-liners, vertical 9:16 framing, trending audio, quick cuts' },
              witty: { name: 'Witty & Clever', guidelines: 'Wordplay and light joke setups, comedic timing in edits, playful graphics' },
              empathetic: { name: 'Empathetic & Human', guidelines: 'Validation-first copy, real customer faces, soft focus, gentle pacing, calm score' },
              'data-driven': { name: 'Data-Driven', guidelines: 'Lead with metrics, animated bar/line charts, clean infographic styling, confident narration' },
              storytelling: { name: 'Narrative Storytelling', guidelines: 'Setup-conflict-resolution arc, character-led b-roll, emotional music swell' },
              authoritative: { name: 'Authoritative Expert', guidelines: 'Cite frameworks and proof, steady eye-contact framing, library/office settings, serious grade' },
              minimalist: { name: 'Minimalist', guidelines: 'One idea per frame, lots of negative space, muted palette, slow deliberate motion' },
              luxury: { name: 'Luxury & Premium', guidelines: 'Rich textures, slow motion, gold/black palette, elegant typography, no hard-sell' },
              playful: { name: 'Playful & Fun', guidelines: 'Bright palette, bouncy edits, emoji-style graphics, upbeat quirky music' },
              bold: { name: 'Bold & Disruptive', guidelines: 'Oversized type, saturated color, fast aggressive cuts, statement voiceover' },
              educational: { name: 'Educational', guidelines: 'Step-by-step structure, pointer/arrow overlays, calm narration, clean whiteboard style' },
              trustworthy: { name: 'Trustworthy & Reassuring', guidelines: 'Plain language, steady pacing, soft blue/green palette, real-environment shots' },
              energetic: { name: 'Energetic & Upbeat', guidelines: 'Fast cuts, rising tempo, bright colors, crowd/confetti energy, driving beat' },
              sophisticated: { name: 'Sophisticated & Refined', guidelines: 'Subtle motion, refined palette, elegant serif type, restrained music' },
              direct: { name: 'Direct & No-Fluff', guidelines: 'Front-load the offer, plain words, punch-in cuts, clear CTA card' },
              friendly: { name: 'Friendly & Welcoming', guidelines: 'Inviting copy, open body language, bright airy set, gentle uplifting music' },
              dramatic: { name: 'Dramatic & Cinematic', guidelines: 'Low-key lighting, orchestral swell, slow-mo hero moment, deep contrast grade' },
              'peer-comparison': { name: 'Social Proof / Peer Comparison', guidelines: 'Show "them vs you" split screens, benchmark charts, confident neutral narration' },
            };
            const FOCUS_AREAS = [
              { id: 'lead-gen', label: 'Lead Generation' },
              { id: 'awareness', label: 'Brand Awareness' },
              { id: 'education', label: 'Education' },
              { id: 'demo', label: 'Product Demo' },
            ];
            const roleContent = ROLES[resolvedRole] || ROLES.sdr;
            const industryContent = INDUSTRIES[resolvedIndustry] || INDUSTRIES.saas;
            const methodologyContent = METHODOLOGIES[resolvedMethodology] || METHODOLOGIES.spin;
            const tonalityContent = TONALITIES[resolvedTonality] || TONALITIES.professional;
            const focusLabels = focus
              .map((id) => (FOCUS_AREAS.find((f) => f.id === id) || {}).label)
              .filter(Boolean)
              .join(', ');
            const templateTag = templateContext.templateId
              ? ` [Template: ${templateContext.templateId}]`
              : '';
            const sections = [
              `🎯 ${roleContent.title} Video Prompt${templateTag}`,
              ``,
              `Role Context: ${roleContent.description}`,
              `Objectives: ${roleContent.objectives.join(', ')}`,
              ``,
              `Industry Focus: ${industryContent.description}`,
              ``,
              `Sales Framework: ${methodologyContent.name}`,
              `Application: ${methodologyContent.application}`,
              ``,
              `Writing Style: ${tonalityContent.name}`,
              `Guidelines: ${tonalityContent.guidelines}`,
              ``,
            ];
            if (focusLabels) {
              sections.push(`Focus Areas: ${focusLabels}`);
              sections.push(``);
            }
            sections.push(`Core Concept: ${basePrompt || '(no base prompt provided)'}`);
            sections.push(``);
            sections.push(`Create a compelling video that leverages these GTM frameworks to drive ${roleContent.primaryKPI} and achieve ${roleContent.objectives[0].toLowerCase()}.`);
            sendJson(res, 200, {
              success: true,
              source: 'local-library',
              prompt: sections.join('\n'),
              selections: {
                role: resolvedRole,
                industry: resolvedIndustry,
                methodology: resolvedMethodology,
                tonality: resolvedTonality,
                focus,
              },
              templateContext,
            });
            return;
          }

          sendJson(res, 404, { error: 'Not found', path });
        } catch (e) {
          console.error('[gtm-boost-dev] handler error:', e);
          sendJson(res, 500, { error: 'Internal Server Error', message: e.message });
        }
      });
    },
  };
}

/**
 * modelCatalogDevPlugin — runs in dev (vite dev) to serve /api/model-catalog
 * directly from public/api/model-catalog.json instead of proxying to the
 * backend on :3001. The file is produced at build time by
 * modelCatalogBuildPlugin (or by scripts/generate-model-catalog.mjs). The
 * backend on :3001 is not always running in dev, so serving the static
 * file removes a 404 path and matches the production behavior (Netlify
 * serves the same file as a static rewrite).
 */
function modelCatalogDevPlugin() {
  const CATALOG_PATH = path.join(PROJECT_ROOT, 'public', 'api', 'model-catalog.json');
  return {
    name: 'model-catalog-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/model-catalog', (req, res) => {
        try {
          if (!fs.existsSync(CATALOG_PATH)) {
            res.statusCode = 404;
            res.end(JSON.stringify({
              error: 'Not Found',
              message: 'public/api/model-catalog.json is missing. Run `npm run generate:catalog` or `vite build` first.',
            }));
            return;
          }
          const raw = fs.readFileSync(CATALOG_PATH, 'utf-8');
          const data = JSON.parse(raw);
          // Dev client expects either { models: [...] } (single pool, filtered
          // server-side) or { t2i: [...], i2i: [...], i2v: [...] } (full
          // multi-pool, filtered client-side). The static file holds the full
          // multi-pool shape, so we honor the client's modelType query param
          // by returning the requested pool wrapped in { models: [...] }.
          const url = new URL(req.url, 'http://localhost');
          const modelType = url.searchParams.get('modelType');
          const VALID = ['t2i', 'i2i', 'i2v', 't2v'];
          if (modelType && VALID.includes(modelType)) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ models: data[modelType] || [] }));
          } else {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          }
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Internal Server Error', message: e.message }));
        }
      });
    },
  };
}

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
          t2v: unique(modelsMod.t2vModels || [], 't2v'),
          v2v: unique(modelsMod.v2vModels || [], 'v2v'),
        };
        const total = catalog.t2i.length + catalog.i2i.length + catalog.i2v.length + catalog.t2v.length + catalog.v2v.length;
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
    define: {
        'process.browser': 'true',
        'process.env': '{}',
        'process.env.__NEXT_ROUTER_BASEPATH': '""',
    },
    resolve: {
        // Force a single React instance. @clerk/react is pre-bundled by
        // Vite's dep optimizer into its own chunk; without dedupe it can
        // resolve a second copy of React, which makes every Clerk hook
        // throw "Invalid hook call … more than one copy of React" and
        // crashes <ClerkProvider> — blanking the sign-in page.
        dedupe: ['react', 'react-dom'],
        alias: {
            // Force exact files for react/react-dom subpath exports. Vite 5's
            // resolver can mis-traverse the package `exports` map and append the
            // subpath (e.g. "/client", "/jsx-runtime") onto react(-dom)/index.js
            // (ENOTDIR) on a fresh node_modules, aborting the build. Pinning the
            // real files avoids that. jsx-runtime/jsx-dev-runtime are auto-injected
            // by @vitejs/plugin-react into every .jsx module.
            'react-dom/client': path.resolve(__dirname, 'node_modules/react-dom/client.js'),
            'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
            'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime.js'),
            'react-svg-inline': path.resolve(__dirname, 'src/lib/react-svg-inline.jsx'),
            '@smartvideo/ai-timeline-editor': path.resolve(__dirname, 'packages/ai-timeline-editor/src'),
            '@higgsfield/color-grading': path.resolve(__dirname, 'packages/color-grading/src'),
            '@higgsfield/audio-mixer': path.resolve(__dirname, 'packages/audio-mixer/src'),
            '@higgsfield/transitions': path.resolve(__dirname, 'packages/transitions/src'),
            '@higgsfield/subtitles': path.resolve(__dirname, 'packages/subtitles/src'),
            '@higgsfield/style-templates': path.resolve(__dirname, 'packages/style-templates/src'),
            '@higgsfield/video-compiler': path.resolve(__dirname, 'packages/video-compiler/src'),
            '@higgsfield/ai-chat': path.resolve(__dirname, 'packages/ai-chat/src'),
        },
    },
    plugins: [
        tailwindcss(),
        // Legacy components (e.g. SocialPublisherModal.jsx) use MobX
        // @inject/@observer decorators. @vitejs/plugin-react transforms .jsx
        // via Babel, which does not enable decorators by default — enable the
        // legacy decorators + class-properties plugins so those modules parse.
        react({
            babel: {
                presets: [
                    '@babel/preset-typescript',
                ],
                plugins: [
                    ['@babel/plugin-proposal-decorators', { legacy: true }],
                    ['@babel/plugin-proposal-class-properties', { loose: true }],
                ],
            },
        }),
        securityHeaders(),
        fixLegacyImports(),
        stubLegacy(),
        svgMissingFallback(),
        modelCatalogBuildPlugin(),
        modelCatalogDevPlugin(),
        // Custom proxy plugin for /functions/v1/muapi-proxy that strips
        // origin/referer headers so the Supabase edge function accepts
        // localhost requests during development.
        {
          name: 'muapi-proxy-dev',
          apply: 'serve',
          configureServer(server) {
            const target = process.env.VITE_SUPABASE_URL || 'https://bzxohkrxcwodllketcpz.supabase.co';
            server.middlewares.use(createMuapiProxyMiddleware(target));
          },
        },
        // Only load the gtm-boost dev plugin during `vite dev` to avoid
        // pulling in the express dependency (used by the backend
        // gtmBoostService) at build time. The plugin itself already has
        // `apply: 'serve'`, but the dynamic `import()` inside
        // `configureServer` gets pre-resolved by Vite/Node at config
        // evaluation time, which fails when express is not installed.
        ...(process.env.NODE_ENV !== 'production' ? [gtmBoostDevPlugin()] : []),
        // Serve the AI-VFX Next.js static export from the Vite dev server so
        // the studio lives on the same origin/port as the rest of the app.
        {
          name: 'serve-ai-vfx-static',
          apply: 'serve',
          configureServer(server) {
            const aiVfxOutDir = path.resolve(__dirname, 'apps/ai-vfx/out');
            const mimeTypes = {
              '.html': 'text/html',
              '.js': 'application/javascript',
              '.css': 'text/css',
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.svg': 'image/svg+xml',
              '.json': 'application/json',
              '.webp': 'image/webp',
              '.mp4': 'video/mp4',
              '.wasm': 'application/wasm',
            };

            server.middlewares.use((req, res, next) => {
              const url = req.url || '';
              if (url.startsWith('/ai-vfx/') || url === '/ai-vfx') {
                const relativePath = url.replace('/ai-vfx', '').replace(/^\//, '') || 'index.html';
                const filePath = path.join(aiVfxOutDir, relativePath);
                if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                  const ext = path.extname(filePath);
                  res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
                  fs.createReadStream(filePath).pipe(res);
                  return;
                }
                next();
                return;
              }

              if (url.startsWith('/_next/static/')) {
                const relativePath = url.slice('/_next/static/'.length);
                const filePath = path.join(aiVfxOutDir, '_next', 'static', relativePath);
                if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                  const ext = path.extname(filePath);
                  res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
                  fs.createReadStream(filePath).pipe(res);
                  return;
                }
                next();
                return;
              }

              next();
            });

            server.middlewares.use(async (req, res, next) => {
              const url = req.url || '';
              if (!url.startsWith('/api/proxy-muapi')) return next();

              const chunks = [];
              req.on('data', chunk => chunks.push(chunk));
              req.on('end', () => {
                const body = Buffer.concat(chunks);
                const query = new URLSearchParams(req.url.split('?')[1] || '');
                const apiKey = req.headers['x-api-key'];
                let targetPath;
                if (req.method === 'POST') {
                  targetPath = '/api/v1/generate_wan_ai_effects';
                } else if (req.method === 'GET' && query.has('id')) {
                  targetPath = `/api/v1/predictions/${query.get('id')}/result`;
                } else {
                  res.statusCode = 405;
                  res.end(JSON.stringify({ error: 'Method not allowed' }));
                  return;
                }

                const options = {
                  hostname: 'api.muapi.ai',
                  port: 443,
                  path: targetPath,
                  method: req.method,
                  headers: {
                    'Content-Type': 'application/json',
                    'content-length': body.length,
                  },
                  rejectUnauthorized: false,
                };
                if (apiKey) {
                  options.headers['x-api-key'] = apiKey;
                }

                const proxyReq = https.request(options, (proxyRes) => {
                  res.statusCode = proxyRes.statusCode;
                  Object.entries(proxyRes.headers).forEach(([key, value]) => {
                    res.setHeader(key, value);
                  });
                  proxyRes.pipe(res);
                });

                proxyReq.on('error', (err) => {
                  console.error('[ai-vfx-api] request error:', err);
                  if (!res.headersSent) {
                    res.statusCode = 502;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'Proxy error', details: err.message }));
                  }
                });

                if (body.length > 0) {
                  proxyReq.write(body);
                }
                proxyReq.end();
              });
            });
          },
        },
    ],
    optimizeDeps: {
        // Point the dependency scanner at a clean entry (scripts/clerk-optimize-entry.js)
        // instead of the full index.html graph. main.js statically imports the
        // legacy component tree, whose stale named-export imports (getStore,
        // FormSelect default, …) abort Vite's initial scan, which forces
        // on-demand re-optimization. That re-optimize serves a second React copy
        // to @clerk/react and leaves the sign-in / sign-up buttons disabled.
        // Scanning the clean entry pre-bundles the app's deps in one stable pass;
        // the legacy tree is still served as source on demand (it is outside the
        // auth/studio critical path) without breaking the scan.
        entries: ['scripts/clerk-optimize-entry.js'],
        include: [
            'react', 'react-dom', 'react-dom/client', '@clerk/react',
            '@chakra-ui/react',
            // Common runtime deps pulled in by main.js / the studio / popcorn so
            // they are pre-bundled up front. Pre-bundling avoids the late
            // re-optimize that 504s in-flight requests (including the Clerk auth
            // import) when a previously-unseen dep is discovered on first load.
            'jquery',
            '@emotion/react', '@emotion/styled', 'framer-motion',
            'interactjs', 'lottie-web', 'mitt', 'lodash', 'gl-transitions',
            'react-dropzone', 'mobx', 'mobx-react',
        ],
        // Some legacy app modules (e.g. components/common/ImglyImageEditor*.js)
        // are authored as .js but contain JSX. Vite's dep scanner otherwise
        // parses them with the plain js loader and fails with
        // "The JSX syntax extension is not currently enabled".
        esbuildOptions: { loader: { '.js': 'jsx' } },
    },
    // Many legacy modules under components/ are authored as .js files that
    // nevertheless contain JSX. @vitejs/plugin-react only reliably transforms
    // .jsx/.tsx (and skips .js files via canSkipBabel), so those modules reach
    // esbuild untransformed and the .js loader rejects JSX. Tell esbuild to use
    // the jsx loader (automatic runtime) for .js/.jsx while leaving .ts/.tsx to
    // plugin-react/Babel for type stripping.
    esbuild: {
        loader: 'tsx',
        include: /\.jsx?$/,
        exclude: /\.tsx?$/,
        jsx: 'automatic',
        tsconfigRaw: { compilerOptions: { experimentalDecorators: true } },
    },
    server: {
        host: '127.0.0.1',
        port: 3000,
        // Ignore tool/test scratch dirs so their writes don't trigger dev-server
        // reloads/restarts mid module-graph load (which corrupts the browser
        // module registry during verification).
        watch: {
            ignored: ['**/.playwright-mcp/**', '**/.kilo/**'],
        },
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
            // /api/model-catalog is served by modelCatalogDevPlugin from the
            // static public/api/model-catalog.json file (mirrors the Netlify
            // production rewrite). No proxy needed.
            // /api/gtm-boost is served by gtmBoostDevPlugin which mounts the
            // backend service directly as Vite middleware. No proxy needed.
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
            '/api/analytics': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/api': {
                target: process.env.VITE_MUAPI_URL || 'https://api.muapi.ai',
                changeOrigin: true,
                secure: true,
                rewrite: (path) => path.replace(/^\/api/, ''),
            },
            '/proxy/video': {
                target: 'https://video.twimg.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/proxy\/video/, ''),
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://x.com/',
                    'Origin': 'https://x.com/',
                },
            },
        },
    },
    build: {
        target: 'esnext',
        minify: 'terser',
        esbuild: {
            jsx: 'automatic',
            loader: 'tsx',
            include: /\.jsx?$/,
            exclude: /\.tsx?$/,
            tsconfigRaw: { compilerOptions: { experimentalDecorators: true } },
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
            'X-Frame-Options': 'SAMEORIGIN',
            'X-Content-Type-Options': 'nosniff',
            'X-XSS-Protection': '1; mode=block',
            'Referrer-Policy': 'strict-origin-when-cross-origin'
        }
    }
});
