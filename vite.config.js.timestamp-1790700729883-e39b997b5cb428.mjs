var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// vite.config.js
import { defineConfig, loadEnv } from "file:///Users/shasheemoore/Downloads/remix-new-editor/node_modules/vite/dist/node/index.js";
import tailwindcss from "file:///Users/shasheemoore/Downloads/remix-new-editor/node_modules/@tailwindcss/vite/dist/index.mjs";
import react from "file:///Users/shasheemoore/Downloads/remix-new-editor/node_modules/@vitejs/plugin-react/dist/index.js";
import path2 from "path";
import fs2 from "fs";
import https from "https";

// vite/plugins/publicAuditReportPlugin.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
var __vite_injected_original_import_meta_url = "file:///Users/shasheemoore/Downloads/remix-new-editor/vite/plugins/publicAuditReportPlugin.js";
var __dirname2 = path.dirname(fileURLToPath(__vite_injected_original_import_meta_url));
var PUBLIC_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data:",
    "media-src 'self' https:",
    "connect-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'"
  ].join("; "),
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};
function isReportPath(pathname) {
  return /^\/audit\/report\/[^/]+$/.test(pathname);
}
function publicAuditReportPlugin() {
  return {
    name: "smartvideo-public-audit-report",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        try {
          const url = new URL(req.url || "", "http://localhost");
          if (!isReportPath(url.pathname)) {
            return next();
          }
          if (req.method !== "GET" && req.method !== "HEAD") {
            res.statusCode = 405;
            res.setHeader("Allow", "GET, HEAD");
            res.end("Method Not Allowed");
            return;
          }
          const htmlPath = path.resolve(__dirname2, "..", "..", "public", "audit-report.html");
          const html = fs.readFileSync(htmlPath, "utf8");
          for (const [k, v] of Object.entries(PUBLIC_HEADERS)) {
            res.setHeader(k, v);
          }
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.statusCode = 200;
          res.end(req.method === "HEAD" ? "" : html);
        } catch (e) {
          next(e);
        }
      });
    }
  };
}

// vite.config.js
var __vite_injected_original_dirname = "/Users/shasheemoore/Downloads/remix-new-editor";
function createMuapiProxyMiddleware(targetUrl) {
  return async function muapiProxyMiddleware(req, res, next) {
    const pathname = (req.url || "").split("?")[0];
    if (pathname !== "/functions/v1/muapi-proxy" || req.method !== "POST") {
      return next();
    }
    const url = new URL(targetUrl);
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: "/functions/v1/muapi-proxy",
        method: req.method,
        headers: { ...req.headers },
        rejectUnauthorized: false
      };
      delete options.headers["origin"];
      delete options.headers["Origin"];
      delete options.headers["referer"];
      delete options.headers["Referer"];
      options.headers["host"] = url.hostname;
      options.headers["content-length"] = body.length;
      const proxyReq = https.request(options, (proxyRes) => {
        res.statusCode = proxyRes.statusCode;
        Object.entries(proxyRes.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        proxyRes.pipe(res);
      });
      proxyReq.on("error", (err) => {
        console.error("[muapi-proxy] request error:", err);
        if (!res.headersSent) {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Proxy error", details: err.message }));
        }
      });
      proxyReq.write(body);
      proxyReq.end();
    });
  };
}
var STUB_IMPORTER_PREFIXES = [
  "components/",
  "lib/"
];
var stubLegacy = () => ({
  name: "stub-legacy-unresolved",
  enforce: "pre",
  async resolveId(source, importer) {
    if (!importer) return null;
    if (importer.includes("node_modules")) return null;
    if (source.startsWith("\0")) return null;
    if (/\.html(\?|$)/i.test(source)) return null;
    const importerIsLegacy = STUB_IMPORTER_PREFIXES.some((p) => importer.includes(p));
    if (!importerIsLegacy) return null;
    if (importer.includes("src/components/landing/")) return null;
    const resolved = await this.resolve(source, importer, { skipSelf: true });
    if (resolved) return null;
    if (/\.(svg|png|jpe?g|webp|gif|ico)(\?|$)/i.test(source)) {
      const rel2 = importer.replace(process.cwd() + "/", "");
      console.warn("[STUB]", source, "<-", rel2);
      if (process.env.STRICT_IMPORTS) {
        throw new Error(`Unresolved import "${source}" from ${rel2}`);
      }
      return {
        id: "\0legacy-asset-stub:" + source + "::" + importer
      };
    }
    const rel = importer.replace(process.cwd() + "/", "");
    console.warn("[STUB]", source, "<-", rel);
    if (process.env.STRICT_IMPORTS) {
      throw new Error(`Unresolved import "${source}" from ${rel}`);
    }
    return {
      id: "\0legacy-stub:" + source + "::" + importer,
      meta: { legacyStub: { source, importer } }
    };
  },
  load(id) {
    if (id.startsWith("\0legacy-asset-stub:")) {
      const dataUrl = "data:image/svg+xml;utf8," + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="black"/></svg>'
      );
      return `export default ${JSON.stringify(dataUrl)};
`;
    }
    if (id.startsWith("\0legacy-stub:")) {
      const payload = id.slice("\0legacy-stub:".length);
      const [source, ...rest] = payload.split("::");
      const importer = rest.join("::");
      console.warn("[stub-legacy] Stubbing unresolved import:", source, "\u2190", importer);
      console.warn("[stub-legacy] Stubbing unresolved import:", source, "\u2190", importer);
      const matchesSource = (line) => line.includes("'" + source + "'") || line.includes('"' + source + '"');
      let names = [];
      try {
        const importerText = fs2.readFileSync(importer, "utf8");
        const lines = importerText.split(/\n/);
        for (const line of lines) {
          if (!matchesSource(line)) continue;
          const namedMatch = line.match(/import\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"]/);
          if (namedMatch) {
            names = namedMatch[1].split(",").map((s) => s.trim().split(/\s+as\s+/).pop()).filter(Boolean);
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
      } catch (_) {
      }
      const seen = /* @__PURE__ */ new Set();
      const uniq = names.filter((n) => {
        if (seen.has(n)) return false;
        seen.add(n);
        return true;
      });
      let isDefaultImport = false;
      try {
        const importerText = fs2.readFileSync(importer, "utf8");
        for (const line of importerText.split(/\n/)) {
          if (!matchesSource(line)) continue;
          if (/^import\s+\w+\s+from\s*['"][^'"]+['"]/.test(line) && !/\{/.test(line) && !/\*/.test(line)) {
            isDefaultImport = true;
          }
          break;
        }
      } catch (_) {
      }
      if (isDefaultImport && uniq.length === 1) {
        const n = uniq[0];
        const isClass = /^[A-Z]/.test(n);
        return `export default ${isClass ? `class ${n} {}` : `function ${n}() {}`};
`;
      }
      const namedExports = uniq.map((n) => {
        const isClass = /^[A-Z]/.test(n);
        return isClass ? `export class ${n} {}` : `export function ${n}() {}`;
      }).join("\n");
      return (namedExports || "export default function MissingStub() { return null; }") + "\n";
    }
    return null;
  }
});
var fixLegacyImports = () => {
  const isPublic = (id) => id.includes(`${path2.sep}public${path2.sep}`) || id.endsWith(`${path2.sep}public`);
  const publicUrl = (id) => {
    const rel = id.split(`public${path2.sep}`)[1].split(path2.sep).join("/");
    return "\0public-url:" + rel;
  };
  const LEGACY_HEADS = [
    "vite-remix-editor/src/",
    "vite-remix-editor/",
    "base/Component.js",
    "base/Store.js",
    "stores/",
    "hoc/",
    "lib/",
    "components/",
    "public/"
  ];
  return {
    name: "fix-legacy-imports",
    enforce: "pre",
    async resolveId(source, importer) {
      if (!importer || importer.includes("node_modules")) return null;
      if (source.startsWith("\0")) return null;
      if (/\.html(\?|$)/i.test(source)) return null;
      const isRelative = /^\.\.?\/|^\//.test(source);
      if (isRelative) {
        const asIs = path2.resolve(path2.dirname(importer), source);
        if (fs2.existsSync(asIs) && fs2.statSync(asIs).isFile()) {
          if (isPublic(asIs)) return publicUrl(asIs);
          return null;
        }
        if (!path2.extname(asIs)) {
          for (const ext of [".jsx", ".tsx", ".ts", ".mjs", ".js"]) {
            const alt = asIs + ext;
            if (fs2.existsSync(alt) && fs2.statSync(alt).isFile()) {
              return isPublic(alt) ? publicUrl(alt) : alt;
            }
          }
          for (const idx of ["index.jsx", "index.tsx", "index.ts", "index.mjs", "index.js"]) {
            const alt = path2.join(asIs, idx);
            if (fs2.existsSync(alt) && fs2.statSync(alt).isFile()) {
              return isPublic(alt) ? publicUrl(alt) : alt;
            }
          }
        }
      }
      const logical = source.replace(/^(?:\.\.\/)+/, "").replace(/^\.\//, "").replace(/^\//, "");
      if (!LEGACY_HEADS.some((h) => logical.includes(h))) return null;
      const candidates = [];
      if (logical.startsWith("vite-remix-editor/src/")) {
        candidates.push(logical.replace("vite-remix-editor/src/", "src/"));
      } else if (logical.startsWith("vite-remix-editor/")) {
        candidates.push(logical.replace("vite-remix-editor/", ""));
      } else if (logical === "base/Component.js") {
        candidates.push("src/components/base/Component.js");
      } else if (logical === "base/Store.js") {
        candidates.push("src/stores/base/Store.js");
      } else if (logical.startsWith("stores/")) {
        candidates.push("src/" + logical, logical);
      } else if (logical.startsWith("hoc/")) {
        candidates.push("src/" + logical, logical);
      } else if (logical.startsWith("lib/")) {
        candidates.push("src/" + logical, logical);
      } else if (logical.startsWith("components/")) {
        candidates.push("src/" + logical, logical);
      } else if (logical.startsWith("public/")) {
        candidates.push(logical);
      }
      const isFile = (p) => fs2.existsSync(p) && fs2.statSync(p).isFile();
      for (const cand of candidates) {
        const abs = path2.resolve(__vite_injected_original_dirname, cand);
        if (isFile(abs)) {
          return isPublic(abs) ? publicUrl(abs) : abs;
        }
        for (const ext of [".js", ".jsx", ".tsx", ".ts", ".mjs"]) {
          const alt = abs.replace(/\.(js|jsx|ts|tsx|mjs)$/i, "") + ext;
          if (isFile(alt)) {
            return isPublic(alt) ? publicUrl(alt) : alt;
          }
        }
      }
      return null;
    },
    load(id) {
      if (id.startsWith("\0public-url:")) {
        const rel = id.slice("\0public-url:".length);
        return `export default ${JSON.stringify("/" + rel)};
`;
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
      const MARKER = "public-url:";
      server.middlewares.use((req, res, next) => {
        const url = req.url || "";
        const markerIdx = url.indexOf(MARKER);
        if (markerIdx === -1 || !url.startsWith("/@id/")) return next();
        const rel = url.slice(markerIdx + MARKER.length).split("?")[0].split("#")[0];
        res.setHeader("Content-Type", "application/javascript");
        res.end(`export default ${JSON.stringify("/" + rel)};
`);
      });
    }
  };
};
var CLERK_DEV_ENV = loadEnv("development", __vite_injected_original_dirname, "");
var CLERK_KEY = CLERK_DEV_ENV.VITE_CLERK_PUBLISHABLE_KEY || "";
var clerkDomain = "";
var clerkKeyMatch = CLERK_KEY.match(/^pk_(?:test|live)_(.+)$/);
if (clerkKeyMatch) {
  try {
    clerkDomain = Buffer.from(clerkKeyMatch[1], "base64").toString("utf8").replace(/\$$/, "");
  } catch (_) {
  }
}
var clerkHostSrc = clerkDomain ? ` https://${clerkDomain}` : "";
function securityHeaders() {
  return {
    name: "security-headers",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || "";
        if (url.startsWith("/ai-vfx")) {
          return next();
        }
        const reactPreambleHash = "'sha256-Z2/iFzh9VMlVkEOar1f/oSHWwQk3ve1qk/C2WdsC4Xk='";
        const isProduction = process.env.NODE_ENV === "production";
        const devConnectSrc = !isProduction ? " http://localhost:5173 ws://localhost:5173 http://localhost:3000" : "";
        const devFrameSrc = !isProduction ? " http://localhost:5173 http://localhost:3000 https://ai-vfx.smartvid.app" : "";
        const csp = [
          "default-src 'self'",
          `script-src 'self' ${reactPreambleHash}${clerkHostSrc} https://clerk.smartvid.app https://challenges.cloudflare.com blob:`,
          `worker-src 'self' blob:${clerkHostSrc} https://clerk.smartvid.app`,
          `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com${clerkHostSrc}`,
          `img-src 'self' data: https: blob:${clerkHostSrc}`,
          `font-src 'self' data:${clerkHostSrc}`,
          "connect-src 'self' ws://localhost:3001 http://localhost:3001 ws://localhost:8000 http://localhost:8000 ws://localhost:8888 http://localhost:8888 https://*.supabase.co " + (process.env.VITE_MUAPI_URL || "https://api.muapi.ai") + " https://api.openai.com https://api.muapi.ai https://clerk.smartvid.app https://clerk-telemetry.com https://challenges.cloudflare.com https://raw.githubusercontent.com" + clerkHostSrc,
          `frame-src 'self'${clerkHostSrc} https://clerk.smartvid.app https://challenges.cloudflare.com http://localhost:5173 http://localhost:3000 http://localhost:5199 https://ai-vfx.smartvid.app https://video-agent.smartvid.app`,
          "media-src 'self' https: blob:"
        ].join("; ");
        res.setHeader("Content-Security-Policy", csp);
        if (process.env.NODE_ENV !== "production") {
          res.removeHeader("X-Frame-Options");
        } else {
          res.setHeader("X-Frame-Options", "SAMEORIGIN");
        }
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("X-XSS-Protection", "1; mode=block");
        res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        res.setHeader(
          "Permissions-Policy",
          "camera=(), microphone=()"
        );
        next();
      });
    }
  };
}
var PROJECT_ROOT = __vite_injected_original_dirname;
function gtmBoostDevPlugin() {
  return {
    name: "gtm-boost-dev",
    apply: "serve",
    configureServer(server) {
      let serviceMod = null;
      const getService = async () => {
        if (serviceMod) return serviceMod;
        try {
          const servicePath = "./backend/services/gtmBoostService.js";
          serviceMod = await import(servicePath);
          return serviceMod;
        } catch (e) {
          console.warn("[gtm-boost-dev] Failed to load service:", e.message);
          return null;
        }
      };
      const readBody = (req) => new Promise((resolve) => {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      });
      const sendJson = (res, status, obj) => {
        if (res.headersSent) return;
        res.statusCode = status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(obj));
      };
      server.middlewares.use("/api/gtm-boost", async (req, res) => {
        const mod = await getService();
        if (!mod) {
          sendJson(res, 500, { error: "gtm-boost service unavailable" });
          return;
        }
        const url = req.url || "/";
        const queryIdx = url.indexOf("?");
        const path3 = queryIdx >= 0 ? url.slice(0, queryIdx) : url;
        const queryPart = queryIdx >= 0 ? url.slice(queryIdx + 1) : "";
        const params = new URLSearchParams(queryPart);
        try {
          if (req.method === "GET" && path3 === "/options") {
            sendJson(res, 200, {
              roles: [
                { id: "sdr", title: "SDR/BDR Prospecting", description: "Sales Development Representative / Business Development Representative content for cold outreach and lead qualification", objectives: ["Generate qualified leads", "Create pipeline opportunities", "Establish initial contact and interest"], primaryKPI: "meeting bookings" },
                { id: "ae", title: "Account Executive Discovery", description: "Account Executive content for qualified prospects, discovery, and value demonstration", objectives: ["Advance qualified opportunities", "Demonstrate ROI and business value", "Handle objections and concerns"], primaryKPI: "deal progression" },
                { id: "sales-manager", title: "Sales Management", description: "Sales leadership content for team enablement and pipeline management", objectives: ["Accelerate team performance", "Build management credibility", "Drive revenue growth"], primaryKPI: "team quota attainment" },
                { id: "revops", title: "Revenue Operations", description: "Revenue Operations content for process optimization and data-driven insights", objectives: ["Improve operational efficiency", "Enhance data accuracy and insights", "Optimize sales processes and automation"], primaryKPI: "operational efficiency gains" },
                { id: "csm", title: "Customer Success", description: "Customer Success Management content for retention and expansion", objectives: ["Reduce customer churn", "Identify expansion opportunities", "Build long-term customer loyalty"], primaryKPI: "customer retention and expansion" },
                { id: "founder", title: "Executive Leadership", description: "Founder and executive content for strategic partnerships and vision communication", objectives: ["Build strategic relationships", "Communicate company vision", "Drive executive-level engagement"], primaryKPI: "strategic partnership development" }
              ],
              industries: [
                { id: "saas", name: "SaaS", description: "Software as a Service solutions and subscription-based business models" },
                { id: "fintech", name: "FinTech", description: "Financial technology and payment processing solutions" },
                { id: "healthcare", name: "Healthcare", description: "Healthcare technology and patient care solutions" },
                { id: "manufacturing", name: "Manufacturing", description: "Manufacturing and industrial operations solutions" },
                { id: "professional-services", name: "Professional Services", description: "Consulting, advisory, and professional service firms" },
                { id: "ecommerce", name: "E-commerce", description: "Online retail and DTC brands selling through visual storefronts" },
                { id: "real-estate", name: "Real Estate", description: "Residential, commercial, and proptech selling via property visuals" },
                { id: "education", name: "Education", description: "EdTech, universities, and training orgs selling learning outcomes" },
                { id: "logistics", name: "Logistics & Supply Chain", description: "Freight, warehousing, and supply-chain software and services" },
                { id: "retail", name: "Retail & CPG", description: "Brick-and-mortar and consumer-packaged-goods brand marketing" },
                { id: "media", name: "Media & Entertainment", description: "Streaming, publishing, and studios selling audience attention" },
                { id: "legal", name: "Legal & Compliance", description: "Law firms and legal-tech selling trust and expertise" },
                { id: "telecom", name: "Telecom & Connectivity", description: "Connectivity, broadband, and communications providers" },
                { id: "energy", name: "Energy & Clean Tech", description: "Renewables, utilities, and climate-tech selling transformation" },
                { id: "nonprofit", name: "Nonprofit & Mission-Driven", description: "Charities and mission orgs driving donations and awareness" },
                { id: "government", name: "Government & Public Sector", description: "Public agencies and govtech selling programs and services" },
                { id: "insurance", name: "Insurance", description: "Carriers, brokers, and insurtech selling protection and peace of mind" },
                { id: "automotive", name: "Automotive & Mobility", description: "Dealers, OEMs, and mobility tech selling vehicles and experiences" }
              ],
              methodologies: [
                { id: "meddpicc", name: "MEDDPICC", fullName: "Metrics, Economic Buyer, Decision Criteria, Decision Process, Paper Process, Identify Pain, Champion, Competition", description: "Enterprise sales qualification framework for complex B2B sales", application: "Apply systematically to understand and navigate enterprise buying processes" },
                { id: "spin", name: "SPIN Selling", fullName: "Situation, Problem, Implication, Need-payoff", description: "Consultative selling framework for complex solutions", application: "Progress conversations from current state to solution value" },
                { id: "challenger", name: "Challenger Sale", fullName: "The Challenger Sale", description: "Insight-driven sales approach that challenges customer assumptions", application: "Teach customers, tailor communications, and take control of sales conversations" },
                { id: "gap-selling", name: "Gap Selling", fullName: "Gap Selling", description: "Framework focusing on the gap between current and desired future state", application: "Identify gaps and position solutions as bridges to desired outcomes" },
                { id: "value-selling", name: "Value Selling", fullName: "Value-Based Selling", description: "Sales approach focused on quantifiable business value and ROI", application: "Demonstrate tangible business impact and quantified results" },
                { id: "sandler", name: "Sandler Selling", fullName: "Sandler Selling System", description: "Qualification-focused sales process with pain-based selling", application: "Qualify prospects and focus on pain points throughout sales process" }
              ],
              tonalities: [
                { id: "professional", name: "Professional", description: "Clean, credible, polished tone for B2B image and video creative", guidelines: "Use clear, confident language; steady pacing; neutral, well-lit framing; minimal but premium styling" },
                { id: "executive", name: "Executive Gravitas", description: "Formal, authoritative tone with strategic insights for boardroom-level video", guidelines: "Sophisticated vocabulary, emphasis on vision/leadership, slow deliberate cuts, cinematic establishing shots" },
                { id: "challenger", name: "Challenger Bold", description: "Confident, assertive tone that challenges assumptions in punchy video hooks", guidelines: "Provocative insight-driven copy, hard cuts, high-contrast visuals, bold typography on screen" },
                { id: "conversational", name: "Conversational Peer", description: "Friendly, relatable tone like talking to a trusted colleague on camera", guidelines: 'Use "we"/"you", casual framing (selfie/desk setup), natural lighting, relaxed pacing' },
                { id: "technical", name: "Technical Expert", description: "Deep technical credibility for demo-heavy product videos and explainer images", guidelines: "Industry terminology, screen-recorded UI demos, diagram overlays, precise labelling" },
                { id: "inspirational", name: "Inspirational Vision", description: "Aspirational tone painting a future vision for brand/manifesto video", guidelines: "Aspirational copy, sweeping b-roll, upward camera moves, warm uplifting color grade" },
                { id: "urgent", name: "Urgent Action", description: "Time-sensitive, high-energy tone for limited-offer promo video", guidelines: "Action verbs, countdown graphics, fast pacing, urgent sound design, red/amber accents" },
                { id: "casual", name: "Casual Peer-to-Peer", description: "Light, informal tone for social-first Reels/TikToks aimed at GTM peers", guidelines: "Slang-light, punchy one-liners, vertical 9:16 framing, trending audio, quick cuts" },
                { id: "witty", name: "Witty & Clever", description: "Humorous, clever copy for scroll-stopping social video and meme images", guidelines: "Wordplay and light joke setups, comedic timing in edits, playful graphics" },
                { id: "empathetic", name: "Empathetic & Human", description: "Warm, understanding tone for customer-story and retention video", guidelines: "Validation-first copy, real customer faces, soft focus, gentle pacing, calm score" },
                { id: "data-driven", name: "Data-Driven", description: "Number-led, proof-oriented tone for ROI/results video and stat graphics", guidelines: "Lead with metrics, animated bar/line charts, clean infographic styling, confident narration" },
                { id: "storytelling", name: "Narrative Storytelling", description: "Three-act story structure for case-study and founding-story video", guidelines: "Setup-conflict-resolution arc, character-led b-roll, emotional music swell" },
                { id: "authoritative", name: "Authoritative Expert", description: "Commanding, credentialed tone for thought-leadership video", guidelines: "Cite frameworks and proof, steady eye-contact framing, library/office settings, serious grade" },
                { id: "minimalist", name: "Minimalist", description: "Restrained, single-message tone for clean product hero images and videos", guidelines: "One idea per frame, lots of negative space, muted palette, slow deliberate motion" },
                { id: "luxury", name: "Luxury & Premium", description: "High-end, exclusive tone for enterprise/ABM video and hero imagery", guidelines: "Rich textures, slow motion, gold/black palette, elegant typography, no hard-sell" },
                { id: "playful", name: "Playful & Fun", description: "Bright, energetic tone for culture and top-of-funnel social video", guidelines: "Bright palette, bouncy edits, emoji-style graphics, upbeat quirky music" },
                { id: "bold", name: "Bold & Disruptive", description: "Loud, category-breaking tone for brand-launch video", guidelines: "Oversized type, saturated color, fast aggressive cuts, statement voiceover" },
                { id: "educational", name: "Educational", description: "Clear teaching tone for how-to and explainer video/image carousels", guidelines: "Step-by-step structure, pointer/arrow overlays, calm narration, clean whiteboard style" },
                { id: "trustworthy", name: "Trustworthy & Reassuring", description: "Calm, dependable tone for security/compliance and onboarding video", guidelines: "Plain language, steady pacing, soft blue/green palette, real-environment shots" },
                { id: "energetic", name: "Energetic & Upbeat", description: "High-tempo, motivating tone for event/launch hype video", guidelines: "Fast cuts, rising tempo, bright colors, crowd/confetti energy, driving beat" },
                { id: "sophisticated", name: "Sophisticated & Refined", description: "Understated elegance for premium B2B brand films", guidelines: "Subtle motion, refined palette, elegant serif type, restrained music" },
                { id: "direct", name: "Direct & No-Fluff", description: "Blunt, benefit-first tone for bottom-funnel conversion video", guidelines: "Front-load the offer, plain words, punch-in cuts, clear CTA card" },
                { id: "friendly", name: "Friendly & Welcoming", description: "Warm invite tone for webinar and community onboarding video", guidelines: "Inviting copy, open body language, bright airy set, gentle uplifting music" },
                { id: "dramatic", name: "Dramatic & Cinematic", description: "High-stakes, cinematic tone for hero/brand film", guidelines: "Low-key lighting, orchestral swell, slow-mo hero moment, deep contrast grade" },
                { id: "peer-comparison", name: "Social Proof / Peer Comparison", description: "Comparison-led tone for competitive-displacement video", guidelines: 'Show "them vs you" split screens, benchmark charts, confident neutral narration' }
              ],
              focusAreas: [
                { id: "lead-gen", label: "Lead Generation", description: "Lead generation with contact capture" },
                { id: "awareness", label: "Brand Awareness", description: "Brand awareness and market education" },
                { id: "education", label: "Education", description: "Educational content and knowledge sharing" },
                { id: "demo", label: "Product Demo", description: "Product demonstration and capability showcase" }
              ]
            });
            return;
          }
          if (req.method === "POST" && path3 === "/template-context") {
            const body = await readBody(req);
            const data = JSON.parse(body || "{}");
            const { category, niche, name, description } = data || {};
            const TEMPLATE_CATEGORY_TO_INDUSTRY = {
              "Social Media": "saas",
              "Style Transfer": "saas",
              "Entertainment": "events",
              "Commercial": "retail",
              "VFX & Action": "entertainment",
              "Portrait & Creator": "fashion",
              "Decade & Era": "fashion",
              "Camera & Cinematic": "entertainment",
              "Industry Specific": "saas",
              "Personal Story": "nonprofit",
              "Restaurant & Cafe": "restaurant",
              "Med Spa & Beauty": "fashion",
              "Salon & Barbershop": "fashion",
              "Gym & Fitness": "fitness-wellness",
              "Real Estate": "real-estate",
              "Dental Office": "healthcare",
              "Chiropractic & Wellness": "fitness-wellness",
              "Legal & Attorney": "legal-services",
              "Automotive & Car": "automotive",
              "Fashion & Style": "fashion",
              "Events & Celebrations": "events",
              "Luxury & Premium": "luxury",
              "restaurant": "restaurant",
              "med-spa": "fashion",
              "salon": "fashion",
              "fitness": "fitness-wellness",
              "real-estate": "real-estate",
              "dental": "healthcare",
              "chiropractic": "fitness-wellness",
              "legal": "legal-services",
              "automotive": "automotive",
              "fashion": "fashion",
              "events": "events",
              "luxury": "luxury",
              "general-business": "saas",
              "local-business": "retail",
              "saas": "saas",
              "agency": "professional-services"
            };
            const industry = niche && TEMPLATE_CATEGORY_TO_INDUSTRY[niche] || category && TEMPLATE_CATEGORY_TO_INDUSTRY[category] || "saas";
            const tonality = (() => {
              if (industry === "luxury" || industry === "real-estate") return "executive";
              if (industry === "fashion" || industry === "events") return "inspirational";
              if (industry === "healthcare" || industry === "fintech") return "technical";
              return "conversational";
            })();
            const role = (() => {
              if (["saas", "fintech", "manufacturing", "professional-services"].includes(industry)) return "ae";
              if (["fashion", "events", "luxury", "automotive", "restaurant"].includes(industry)) return "founder";
              if (["healthcare", "fitness-wellness", "education", "real-estate", "legal-services"].includes(industry)) return "csm";
              return "sdr";
            })();
            const methodology = (() => {
              if (["saas", "fintech", "manufacturing", "healthcare"].includes(industry)) return "meddpicc";
              if (["professional-services", "legal-services", "real-estate"].includes(industry)) return "spin";
              if (["fashion", "luxury", "events"].includes(industry)) return "challenger";
              return "value-selling";
            })();
            sendJson(res, 200, {
              industry,
              tonality,
              role,
              methodology,
              basePrompt: description || name || ""
            });
            return;
          }
          if (req.method === "POST" && path3 === "/generate") {
            const body = await readBody(req);
            const data = JSON.parse(body || "{}");
            const { basePrompt, role, industry, methodology, tonality, focus = [], templateContext = {} } = data || {};
            const resolvedRole = role || "sdr";
            const resolvedIndustry = industry || "saas";
            const resolvedMethodology = methodology || "spin";
            const resolvedTonality = tonality || "professional";
            const ROLES = {
              sdr: { title: "SDR/BDR Prospecting", description: "Sales Development Representative / Business Development Representative content for cold outreach and lead qualification", objectives: ["Generate qualified leads", "Create pipeline opportunities", "Establish initial contact and interest"], primaryKPI: "meeting bookings" },
              ae: { title: "Account Executive Discovery", description: "Account Executive content for qualified prospects, discovery, and value demonstration", objectives: ["Advance qualified opportunities", "Demonstrate ROI and business value", "Handle objections and concerns"], primaryKPI: "deal progression" },
              "sales-manager": { title: "Sales Management", description: "Sales leadership content for team enablement and pipeline management", objectives: ["Accelerate team performance", "Build management credibility", "Drive revenue growth"], primaryKPI: "team quota attainment" },
              revops: { title: "Revenue Operations", description: "Revenue Operations content for process optimization and data-driven insights", objectives: ["Improve operational efficiency", "Enhance data accuracy and insights", "Optimize sales processes and automation"], primaryKPI: "operational efficiency gains" },
              csm: { title: "Customer Success", description: "Customer Success Management content for retention and expansion", objectives: ["Reduce customer churn", "Identify expansion opportunities", "Build long-term customer loyalty"], primaryKPI: "customer retention and expansion" },
              founder: { title: "Executive Leadership", description: "Founder and executive content for strategic partnerships and vision communication", objectives: ["Build strategic relationships", "Communicate company vision", "Drive executive-level engagement"], primaryKPI: "strategic partnership development" }
            };
            const INDUSTRIES = {
              saas: { name: "SaaS", description: "Software as a Service solutions and subscription-based business models" },
              fintech: { name: "FinTech", description: "Financial technology and payment processing solutions" },
              healthcare: { name: "Healthcare", description: "Healthcare technology and patient care solutions" },
              manufacturing: { name: "Manufacturing", description: "Manufacturing and industrial operations solutions" },
              "professional-services": { name: "Professional Services", description: "Consulting, advisory, and professional service firms" },
              ecommerce: { name: "E-commerce", description: "Online retail and DTC brands selling through visual storefronts" },
              "real-estate": { name: "Real Estate", description: "Residential, commercial, and proptech selling via property visuals" },
              education: { name: "Education", description: "EdTech, universities, and training orgs selling learning outcomes" },
              logistics: { name: "Logistics & Supply Chain", description: "Freight, warehousing, and supply-chain software and services" },
              retail: { name: "Retail & CPG", description: "Brick-and-mortar and consumer-packaged-goods brand marketing" },
              media: { name: "Media & Entertainment", description: "Streaming, publishing, and studios selling audience attention" },
              legal: { name: "Legal & Compliance", description: "Law firms and legal-tech selling trust and expertise" },
              telecom: { name: "Telecom & Connectivity", description: "Connectivity, broadband, and communications providers" },
              energy: { name: "Energy & Clean Tech", description: "Renewables, utilities, and climate-tech selling transformation" },
              nonprofit: { name: "Nonprofit & Mission-Driven", description: "Charities and mission orgs driving donations and awareness" },
              government: { name: "Government & Public Sector", description: "Public agencies and govtech selling programs and services" },
              insurance: { name: "Insurance", description: "Carriers, brokers, and insurtech selling protection and peace of mind" },
              automotive: { name: "Automotive & Mobility", description: "Dealers, OEMs, and mobility tech selling vehicles and experiences" }
            };
            const METHODOLOGIES = {
              meddpicc: { name: "MEDDPICC", application: "Apply systematically to understand and navigate enterprise buying processes" },
              spin: { name: "SPIN Selling", application: "Progress conversations from current state to solution value" },
              challenger: { name: "Challenger Sale", application: "Teach customers, tailor communications, and take control of sales conversations" },
              "gap-selling": { name: "Gap Selling", application: "Identify gaps and position solutions as bridges to desired outcomes" },
              "value-selling": { name: "Value Selling", application: "Demonstrate tangible business impact and quantified results" },
              sandler: { name: "Sandler Selling", application: "Qualify prospects and focus on pain points throughout sales process" }
            };
            const TONALITIES = {
              professional: { name: "Professional", guidelines: "Use clear, confident language; steady pacing; neutral, well-lit framing; minimal but premium styling" },
              executive: { name: "Executive Gravitas", guidelines: "Sophisticated vocabulary, emphasis on vision/leadership, slow deliberate cuts, cinematic establishing shots" },
              challenger: { name: "Challenger Bold", guidelines: "Provocative insight-driven copy, hard cuts, high-contrast visuals, bold typography on screen" },
              conversational: { name: "Conversational Peer", guidelines: 'Use "we"/"you", casual framing (selfie/desk setup), natural lighting, relaxed pacing' },
              technical: { name: "Technical Expert", guidelines: "Industry terminology, screen-recorded UI demos, diagram overlays, precise labelling" },
              inspirational: { name: "Inspirational Vision", guidelines: "Aspirational copy, sweeping b-roll, upward camera moves, warm uplifting color grade" },
              urgent: { name: "Urgent Action", guidelines: "Action verbs, countdown graphics, fast pacing, urgent sound design, red/amber accents" },
              casual: { name: "Casual Peer-to-Peer", guidelines: "Slang-light, punchy one-liners, vertical 9:16 framing, trending audio, quick cuts" },
              witty: { name: "Witty & Clever", guidelines: "Wordplay and light joke setups, comedic timing in edits, playful graphics" },
              empathetic: { name: "Empathetic & Human", guidelines: "Validation-first copy, real customer faces, soft focus, gentle pacing, calm score" },
              "data-driven": { name: "Data-Driven", guidelines: "Lead with metrics, animated bar/line charts, clean infographic styling, confident narration" },
              storytelling: { name: "Narrative Storytelling", guidelines: "Setup-conflict-resolution arc, character-led b-roll, emotional music swell" },
              authoritative: { name: "Authoritative Expert", guidelines: "Cite frameworks and proof, steady eye-contact framing, library/office settings, serious grade" },
              minimalist: { name: "Minimalist", guidelines: "One idea per frame, lots of negative space, muted palette, slow deliberate motion" },
              luxury: { name: "Luxury & Premium", guidelines: "Rich textures, slow motion, gold/black palette, elegant typography, no hard-sell" },
              playful: { name: "Playful & Fun", guidelines: "Bright palette, bouncy edits, emoji-style graphics, upbeat quirky music" },
              bold: { name: "Bold & Disruptive", guidelines: "Oversized type, saturated color, fast aggressive cuts, statement voiceover" },
              educational: { name: "Educational", guidelines: "Step-by-step structure, pointer/arrow overlays, calm narration, clean whiteboard style" },
              trustworthy: { name: "Trustworthy & Reassuring", guidelines: "Plain language, steady pacing, soft blue/green palette, real-environment shots" },
              energetic: { name: "Energetic & Upbeat", guidelines: "Fast cuts, rising tempo, bright colors, crowd/confetti energy, driving beat" },
              sophisticated: { name: "Sophisticated & Refined", guidelines: "Subtle motion, refined palette, elegant serif type, restrained music" },
              direct: { name: "Direct & No-Fluff", guidelines: "Front-load the offer, plain words, punch-in cuts, clear CTA card" },
              friendly: { name: "Friendly & Welcoming", guidelines: "Inviting copy, open body language, bright airy set, gentle uplifting music" },
              dramatic: { name: "Dramatic & Cinematic", guidelines: "Low-key lighting, orchestral swell, slow-mo hero moment, deep contrast grade" },
              "peer-comparison": { name: "Social Proof / Peer Comparison", guidelines: 'Show "them vs you" split screens, benchmark charts, confident neutral narration' }
            };
            const FOCUS_AREAS = [
              { id: "lead-gen", label: "Lead Generation" },
              { id: "awareness", label: "Brand Awareness" },
              { id: "education", label: "Education" },
              { id: "demo", label: "Product Demo" }
            ];
            const roleContent = ROLES[resolvedRole] || ROLES.sdr;
            const industryContent = INDUSTRIES[resolvedIndustry] || INDUSTRIES.saas;
            const methodologyContent = METHODOLOGIES[resolvedMethodology] || METHODOLOGIES.spin;
            const tonalityContent = TONALITIES[resolvedTonality] || TONALITIES.professional;
            const focusLabels = focus.map((id) => (FOCUS_AREAS.find((f) => f.id === id) || {}).label).filter(Boolean).join(", ");
            const templateTag = templateContext.templateId ? ` [Template: ${templateContext.templateId}]` : "";
            const sections = [
              `\u{1F3AF} ${roleContent.title} Video Prompt${templateTag}`,
              ``,
              `Role Context: ${roleContent.description}`,
              `Objectives: ${roleContent.objectives.join(", ")}`,
              ``,
              `Industry Focus: ${industryContent.description}`,
              ``,
              `Sales Framework: ${methodologyContent.name}`,
              `Application: ${methodologyContent.application}`,
              ``,
              `Writing Style: ${tonalityContent.name}`,
              `Guidelines: ${tonalityContent.guidelines}`,
              ``
            ];
            if (focusLabels) {
              sections.push(`Focus Areas: ${focusLabels}`);
              sections.push(``);
            }
            sections.push(`Core Concept: ${basePrompt || "(no base prompt provided)"}`);
            sections.push(``);
            sections.push(`Create a compelling video that leverages these GTM frameworks to drive ${roleContent.primaryKPI} and achieve ${roleContent.objectives[0].toLowerCase()}.`);
            sendJson(res, 200, {
              success: true,
              source: "local-library",
              prompt: sections.join("\n"),
              selections: {
                role: resolvedRole,
                industry: resolvedIndustry,
                methodology: resolvedMethodology,
                tonality: resolvedTonality,
                focus
              },
              templateContext
            });
            return;
          }
          sendJson(res, 404, { error: "Not found", path: path3 });
        } catch (e) {
          console.error("[gtm-boost-dev] handler error:", e);
          sendJson(res, 500, { error: "Internal Server Error", message: e.message });
        }
      });
    }
  };
}
function modelCatalogDevPlugin() {
  const CATALOG_PATH = path2.join(PROJECT_ROOT, "public", "api", "model-catalog.json");
  return {
    name: "model-catalog-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/model-catalog", (req, res) => {
        try {
          if (!fs2.existsSync(CATALOG_PATH)) {
            res.statusCode = 404;
            res.end(JSON.stringify({
              error: "Not Found",
              message: "public/api/model-catalog.json is missing. Run `npm run generate:catalog` or `vite build` first."
            }));
            return;
          }
          const raw = fs2.readFileSync(CATALOG_PATH, "utf-8");
          const data = JSON.parse(raw);
          const url = new URL(req.url, "http://localhost");
          const modelType = url.searchParams.get("modelType");
          const VALID = ["t2i", "i2i", "i2v", "t2v", "v2v"];
          if (modelType && VALID.includes(modelType)) {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ models: data[modelType] || [] }));
          } else {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(data));
          }
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "Internal Server Error", message: e.message }));
        }
      });
    }
  };
}
function modelCatalogBuildPlugin() {
  return {
    name: "model-catalog-build",
    enforce: "post",
    generateBundle(_options, _bundle) {
      try {
        const modelsMod = __require(path2.join(PROJECT_ROOT, "src/lib/models.js"));
        const descMod = __require(path2.join(PROJECT_ROOT, "src/lib/modelDescriptions.js"));
        const DESCRIPTIONS = descMod.DESCRIPTIONS || {};
        const seen = /* @__PURE__ */ new Set();
        const unique = (list, type) => {
          const out = [];
          for (const m of list) {
            if (seen.has(m.id)) continue;
            seen.add(m.id);
            const desc = (DESCRIPTIONS[type] || {})[m.id] || null;
            out.push({
              id: m.id,
              name: m.name,
              provider: m.provider || null,
              provider_name: m.provider_name || null,
              ...desc ? { description: desc } : {}
            });
          }
          return out;
        };
        const catalog = {
          t2i: unique(modelsMod.t2iModels || [], "t2i"),
          i2i: unique(modelsMod.i2iModels || [], "i2i"),
          i2v: unique(modelsMod.i2vModels || [], "i2v"),
          t2v: unique(modelsMod.t2vModels || [], "t2v"),
          v2v: unique(modelsMod.v2vModels || [], "v2v")
        };
        const total = catalog.t2i.length + catalog.i2i.length + catalog.i2v.length + catalog.t2v.length + catalog.v2v.length;
        this.emitFile({
          type: "asset",
          fileName: "api/model-catalog.json",
          source: JSON.stringify(catalog)
        });
        console.log(`[model-catalog] Emitted api/model-catalog.json (${total} models)`);
      } catch (e) {
        console.warn("[model-catalog] Build plugin skipped:", e.message);
      }
    }
  };
}
function svgMissingFallback() {
  const PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>');
  return {
    name: "svg-missing-fallback",
    enforce: "pre",
    async load(id) {
      const file = id.split("?")[0];
      if (!file.endsWith(".svg")) return null;
      if (fs2.existsSync(file)) return null;
      return `export default ${JSON.stringify(PLACEHOLDER)};`;
    }
  };
}
var vite_config_default = defineConfig({
  define: {
    "process.browser": "true",
    "process.env": "{}",
    "process.env.__NEXT_ROUTER_BASEPATH": '""'
  },
  resolve: {
    // Force a single React instance. @clerk/react is pre-bundled by
    // Vite's dep optimizer into its own chunk; without dedupe it can
    // resolve a second copy of React, which makes every Clerk hook
    // throw "Invalid hook call … more than one copy of React" and
    // crashes <ClerkProvider> — blanking the sign-in page.
    dedupe: ["react", "react-dom"],
    alias: {
      // Force exact files for react/react-dom subpath exports. Vite 5's
      // resolver can mis-traverse the package `exports` map and append the
      // subpath (e.g. "/client", "/jsx-runtime") onto react(-dom)/index.js
      // (ENOTDIR) on a fresh node_modules, aborting the build. Pinning the
      // real files avoids that. jsx-runtime/jsx-dev-runtime are auto-injected
      // by @vitejs/plugin-react into every .jsx module.
      "react-dom/client": path2.resolve(__vite_injected_original_dirname, "node_modules/react-dom/client.js"),
      "react/jsx-runtime": path2.resolve(__vite_injected_original_dirname, "node_modules/react/jsx-runtime.js"),
      "react/jsx-dev-runtime": path2.resolve(__vite_injected_original_dirname, "node_modules/react/jsx-dev-runtime.js"),
      "react-svg-inline": path2.resolve(__vite_injected_original_dirname, "src/lib/react-svg-inline.jsx"),
      "@smartvideo/ai-timeline-editor": path2.resolve(__vite_injected_original_dirname, "packages/ai-timeline-editor/src"),
      "@higgsfield/color-grading": path2.resolve(__vite_injected_original_dirname, "packages/color-grading/src"),
      "@higgsfield/audio-mixer": path2.resolve(__vite_injected_original_dirname, "packages/audio-mixer/src"),
      "@higgsfield/transitions": path2.resolve(__vite_injected_original_dirname, "packages/transitions/src"),
      "@higgsfield/subtitles": path2.resolve(__vite_injected_original_dirname, "packages/subtitles/src"),
      "@higgsfield/style-templates": path2.resolve(__vite_injected_original_dirname, "packages/style-templates/src"),
      "@higgsfield/video-compiler": path2.resolve(__vite_injected_original_dirname, "packages/video-compiler/src"),
      "@higgsfield/ai-chat": path2.resolve(__vite_injected_original_dirname, "packages/ai-chat/src")
    }
  },
  plugins: [
    publicAuditReportPlugin(),
    tailwindcss(),
    {
      name: "tsx-pre-transform",
      enforce: "pre",
      async transform(src, id) {
        if (id.endsWith(".tsx")) {
          const { transform } = await import("file:///Users/shasheemoore/Downloads/remix-new-editor/node_modules/esbuild/lib/main.js");
          const result = await transform(src, {
            loader: "tsx",
            jsx: "automatic",
            tsconfigRaw: { compilerOptions: { experimentalDecorators: true } }
          });
          return result.code;
        }
      }
    },
    // Legacy components (e.g. SocialPublisherModal.jsx) use MobX
    // @inject/@observer decorators. @vitejs/plugin-react transforms .jsx
    // via Babel, which does not enable decorators by default — enable the
    // legacy decorators + class-properties plugins so those modules parse.
    react({
      babel: {
        presets: [
          "@babel/preset-typescript",
          "@babel/preset-react"
        ],
        plugins: [
          ["@babel/plugin-proposal-decorators", { legacy: true }],
          ["@babel/plugin-proposal-class-properties", { loose: true }]
        ]
      }
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
      name: "muapi-proxy-dev",
      apply: "serve",
      configureServer(server) {
        const target = process.env.VITE_SUPABASE_URL || "https://bzxohkrxcwodllketcpz.supabase.co";
        server.middlewares.use(createMuapiProxyMiddleware(target));
      }
    },
    // Only load the gtm-boost dev plugin during `vite dev` to avoid
    // pulling in the express dependency (used by the backend
    // gtmBoostService) at build time. The plugin itself already has
    // `apply: 'serve'`, but the dynamic `import()` inside
    // `configureServer` gets pre-resolved by Vite/Node at config
    // evaluation time, which fails when express is not installed.
    ...process.env.NODE_ENV !== "production" ? [gtmBoostDevPlugin()] : [],
    // Serve the AI-VFX Next.js static export from the Vite dev server so
    // the studio lives on the same origin/port as the rest of the app.
    {
      name: "serve-ai-vfx-static",
      apply: "serve",
      configureServer(server) {
        const aiVfxOutDir = path2.resolve(__vite_injected_original_dirname, "apps/ai-vfx/out");
        const mimeTypes = {
          ".html": "text/html",
          ".js": "application/javascript",
          ".css": "text/css",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".svg": "image/svg+xml",
          ".json": "application/json",
          ".webp": "image/webp",
          ".mp4": "video/mp4",
          ".wasm": "application/wasm"
        };
        server.middlewares.use((req, res, next) => {
          const url = req.url || "";
          if (url.startsWith("/ai-vfx/") || url === "/ai-vfx") {
            const relativePath = url.replace("/ai-vfx", "").replace(/^\//, "") || "index.html";
            const filePath = path2.join(aiVfxOutDir, relativePath);
            if (fs2.existsSync(filePath) && fs2.statSync(filePath).isFile()) {
              const ext = path2.extname(filePath);
              res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
              fs2.createReadStream(filePath).pipe(res);
              return;
            }
            next();
            return;
          }
          if (url.startsWith("/_next/static/")) {
            const relativePath = url.slice("/_next/static/".length);
            const filePath = path2.join(aiVfxOutDir, "_next", "static", relativePath);
            if (fs2.existsSync(filePath) && fs2.statSync(filePath).isFile()) {
              const ext = path2.extname(filePath);
              res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
              fs2.createReadStream(filePath).pipe(res);
              return;
            }
            next();
            return;
          }
          next();
        });
        server.middlewares.use(async (req, res, next) => {
          const url = req.url || "";
          if (!url.startsWith("/api/proxy-muapi")) return next();
          const chunks = [];
          req.on("data", (chunk) => chunks.push(chunk));
          req.on("end", () => {
            const body = Buffer.concat(chunks);
            const query = new URLSearchParams(req.url.split("?")[1] || "");
            const apiKey = req.headers["x-api-key"];
            let targetPath;
            if (req.method === "POST") {
              targetPath = "/api/v1/generate_wan_ai_effects";
            } else if (req.method === "GET" && query.has("id")) {
              targetPath = `/api/v1/predictions/${query.get("id")}/result`;
            } else {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: "Method not allowed" }));
              return;
            }
            const options = {
              hostname: "api.muapi.ai",
              port: 443,
              path: targetPath,
              method: req.method,
              headers: {
                "Content-Type": "application/json",
                "content-length": body.length
              },
              rejectUnauthorized: false
            };
            if (apiKey) {
              options.headers["x-api-key"] = apiKey;
            }
            const proxyReq = https.request(options, (proxyRes) => {
              res.statusCode = proxyRes.statusCode;
              Object.entries(proxyRes.headers).forEach(([key, value]) => {
                res.setHeader(key, value);
              });
              proxyRes.pipe(res);
            });
            proxyReq.on("error", (err) => {
              console.error("[ai-vfx-api] request error:", err);
              if (!res.headersSent) {
                res.statusCode = 502;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Proxy error", details: err.message }));
              }
            });
            if (body.length > 0) {
              proxyReq.write(body);
            }
            proxyReq.end();
          });
        });
      }
    }
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
    entries: ["scripts/clerk-optimize-entry.js"],
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "@clerk/react",
      "@chakra-ui/react",
      // Common runtime deps pulled in by main.js / the studio / popcorn so
      // they are pre-bundled up front. Pre-bundling avoids the late
      // re-optimize that 504s in-flight requests (including the Clerk auth
      // import) when a previously-unseen dep is discovered on first load.
      "jquery",
      "@emotion/react",
      "@emotion/styled",
      "framer-motion",
      "interactjs",
      "lottie-web",
      "mitt",
      "lodash",
      "gl-transitions",
      "react-dropzone",
      "mobx",
      "mobx-react"
    ],
    // Some legacy app modules (e.g. components/common/ImglyImageEditor*.js)
    // are authored as .js but contain JSX. Vite's dep scanner otherwise
    // parses them with the plain js loader and fails with
    // "The JSX syntax extension is not currently enabled".
    esbuildOptions: { loader: { ".js": "jsx" } }
  },
  // Many legacy modules under components/ are authored as .js files that
  // nevertheless contain JSX. @vitejs/plugin-react only reliably transforms
  // .jsx/.tsx (and skips .js files via canSkipBabel), so those modules reach
  // esbuild untransformed and the .js loader rejects JSX. Tell esbuild to use
  // the jsx loader (automatic runtime) for .js/.jsx while leaving .ts/.tsx to
  // plugin-react/Babel for type stripping.
  esbuild: {
    loader: "tsx",
    include: /\.jsx?$/,
    exclude: /\.tsx?$/,
    jsx: "automatic",
    tsconfigRaw: { compilerOptions: { experimentalDecorators: true } }
  },
  server: {
    host: "127.0.0.1",
    port: 3e3,
    // Ignore tool/test scratch dirs so their writes don't trigger dev-server
    // reloads/restarts mid module-graph load (which corrupts the browser
    // module registry during verification).
    watch: {
      ignored: ["**/.playwright-mcp/**", "**/.kilo/**"]
    },
    proxy: {
      "/ai-vfx": {
        target: "http://localhost:3000",
        changeOrigin: true,
        ws: true
      },
      "/_next/static": {
        target: "http://localhost:3000",
        changeOrigin: true
      },
      "/_next/image": {
        target: "http://localhost:3000",
        changeOrigin: true
      },
      "/_next/data": {
        target: "http://localhost:3000",
        changeOrigin: true
      },
      "/api/ai-agent": {
        target: "http://localhost:3001",
        changeOrigin: true
      },
      "/api/audit/report": {
        target: "http://localhost:3001",
        changeOrigin: true
      },
      "/api/scene-detection": {
        target: "http://localhost:3001",
        changeOrigin: true
      },
      "/api/semantic-search": {
        target: "http://localhost:3001",
        changeOrigin: true
      },
      "/api/speech-transcription": {
        target: "http://localhost:3001",
        changeOrigin: true
      },
      "/api/agents": {
        target: "http://localhost:3001",
        changeOrigin: true
      },
      "/api/templates": {
        target: "http://localhost:3001",
        changeOrigin: true
      },
      "/videoagent": {
        target: "http://localhost:3001",
        changeOrigin: true
      },
      // /api/model-catalog is served by modelCatalogDevPlugin from the
      // static public/api/model-catalog.json file (mirrors the Netlify
      // production rewrite). No proxy needed.
      // /api/gtm-boost is served by gtmBoostDevPlugin which mounts the
      // backend service directly as Vite middleware. No proxy needed.
      "/director-api": {
        target: process.env.VITE_DIRECTOR_API_URL || "http://localhost:8000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/director-api/, "")
      },
      "/mcp": {
        target: "http://localhost:3001",
        changeOrigin: true
      },
      // Personalization/intelligence API must come BEFORE the generic /api
      // rule so it isn't routed to the MuAPI backend. In dev, serve from the
      // Netlify functions CLI on :8888 if available; otherwise fall back to
      // a same-origin placeholder so the dev server doesn't crash.
      "/api/intelligence": {
        target: process.env.VITE_INTELLIGENCE_API_URL || "http://localhost:8888",
        changeOrigin: true,
        rewrite: (path3) => path3.replace(/^\/api\/intelligence/, "/.netlify/functions/intelligence-api")
      },
      "/api/personalizer": {
        target: process.env.VITE_INTELLIGENCE_API_URL || "http://localhost:8888",
        changeOrigin: true,
        rewrite: (path3) => path3.replace(/^\/api\/personalizer/, "/.netlify/functions/personalizer-api")
      },
      "/api/analytics": {
        target: "http://localhost:3001",
        changeOrigin: true
      },
      "/api/pexels": {
        target: "http://localhost:3001",
        changeOrigin: true
      },
      "/api": {
        target: process.env.VITE_MUAPI_URL || "https://api.muapi.ai",
        changeOrigin: true,
        secure: true,
        rewrite: (path3) => path3.replace(/^\/api/, "")
      },
      "/proxy/video": {
        target: "https://video.twimg.com",
        changeOrigin: true,
        rewrite: (path3) => path3.replace(/^\/proxy\/video/, ""),
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://x.com/",
          "Origin": "https://x.com/"
        }
      }
    }
  },
  build: {
    target: "esnext",
    minify: "terser",
    esbuild: {
      jsx: "automatic",
      loader: "tsx",
      include: /\.(jsx|tsx|ts)$/,
      tsconfigRaw: { compilerOptions: { experimentalDecorators: true } }
    },
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        // Group heavy, self-contained vendor libs into stable chunks so
        // Rollup doesn't auto-merge them into the editor's chunk graph
        // (that merge is what surfaced the production TDZ crash).
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@supabase")) return "vendor";
            if (id.includes("mp4box")) return "vendor-mp4box";
          }
          return void 0;
        },
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]"
      }
    },
    sourcemap: process.env.NODE_ENV !== "production",
    chunkSizeWarningLimit: 1e3
  },
  preview: {
    port: 3e3,
    headers: {
      "Cache-Control": "public, max-age=31536000",
      "X-Frame-Options": "SAMEORIGIN",
      "X-Content-Type-Options": "nosniff",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiLCAidml0ZS9wbHVnaW5zL3B1YmxpY0F1ZGl0UmVwb3J0UGx1Z2luLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL3NoYXNoZWVtb29yZS9Eb3dubG9hZHMvcmVtaXgtbmV3LWVkaXRvclwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL3NoYXNoZWVtb29yZS9Eb3dubG9hZHMvcmVtaXgtbmV3LWVkaXRvci92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvc2hhc2hlZW1vb3JlL0Rvd25sb2Fkcy9yZW1peC1uZXctZWRpdG9yL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSAnQHRhaWx3aW5kY3NzL3ZpdGUnO1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0JztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCBodHRwIGZyb20gJ2h0dHAnO1xuaW1wb3J0IGh0dHBzIGZyb20gJ2h0dHBzJztcbmltcG9ydCB7IHB1YmxpY0F1ZGl0UmVwb3J0UGx1Z2luIH0gZnJvbSAnLi92aXRlL3BsdWdpbnMvcHVibGljQXVkaXRSZXBvcnRQbHVnaW4uanMnO1xuLy8gQ2FjaGUtYnVzdDogMjAyNi0wNy0yOFxuXG4vLyBIZWxwZXI6IGZvcndhcmQgYSByZXF1ZXN0IHRvIHRoZSBTdXBhYmFzZSBtdWFwaS1wcm94eSB3aXRob3V0IE9yaWdpbi9SZWZlcmVyXG4vLyBhbmQgd2l0aCB0aGUgY29ycmVjdCBIb3N0IGhlYWRlciBzbyBDbG91ZGZsYXJlIHJvdXRlcyBpdCB0byB0aGUgcHJvamVjdC5cbmZ1bmN0aW9uIGNyZWF0ZU11YXBpUHJveHlNaWRkbGV3YXJlKHRhcmdldFVybCkge1xuICByZXR1cm4gYXN5bmMgZnVuY3Rpb24gbXVhcGlQcm94eU1pZGRsZXdhcmUocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCBwYXRobmFtZSA9IChyZXEudXJsIHx8ICcnKS5zcGxpdCgnPycpWzBdO1xuICAgIGlmIChwYXRobmFtZSAhPT0gJy9mdW5jdGlvbnMvdjEvbXVhcGktcHJveHknIHx8IHJlcS5tZXRob2QgIT09ICdQT1NUJykge1xuICAgICAgcmV0dXJuIG5leHQoKTtcbiAgICB9XG5cbiAgICBjb25zdCB1cmwgPSBuZXcgVVJMKHRhcmdldFVybCk7XG4gICAgXG4gICAgLy8gUmVhZCB0aGUgcmVxdWVzdCBib2R5XG4gICAgY29uc3QgY2h1bmtzID0gW107XG4gICAgcmVxLm9uKCdkYXRhJywgY2h1bmsgPT4gY2h1bmtzLnB1c2goY2h1bmspKTtcbiAgICByZXEub24oJ2VuZCcsICgpID0+IHtcbiAgICAgIGNvbnN0IGJvZHkgPSBCdWZmZXIuY29uY2F0KGNodW5rcyk7XG4gICAgICBcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIGhvc3RuYW1lOiB1cmwuaG9zdG5hbWUsXG4gICAgICAgIHBvcnQ6IHVybC5wb3J0IHx8IDQ0MyxcbiAgICAgICAgcGF0aDogJy9mdW5jdGlvbnMvdjEvbXVhcGktcHJveHknLFxuICAgICAgICBtZXRob2Q6IHJlcS5tZXRob2QsXG4gICAgICAgIGhlYWRlcnM6IHsgLi4ucmVxLmhlYWRlcnMgfSxcbiAgICAgICAgcmVqZWN0VW5hdXRob3JpemVkOiBmYWxzZSxcbiAgICAgIH07XG5cbiAgICAgIC8vIFN0cmlwIG9yaWdpbi1saWtlIGhlYWRlcnMgYW5kIHNldCB0aGUgY29ycmVjdCBIb3N0IGhlYWRlclxuICAgICAgLy8gc28gdGhlIFN1cGFiYXNlIGVkZ2UgZnVuY3Rpb24gYWNjZXB0cyB0aGUgcmVxdWVzdC5cbiAgICAgIGRlbGV0ZSBvcHRpb25zLmhlYWRlcnNbJ29yaWdpbiddO1xuICAgICAgZGVsZXRlIG9wdGlvbnMuaGVhZGVyc1snT3JpZ2luJ107XG4gICAgICBkZWxldGUgb3B0aW9ucy5oZWFkZXJzWydyZWZlcmVyJ107XG4gICAgICBkZWxldGUgb3B0aW9ucy5oZWFkZXJzWydSZWZlcmVyJ107XG4gICAgICBvcHRpb25zLmhlYWRlcnNbJ2hvc3QnXSA9IHVybC5ob3N0bmFtZTtcbiAgICAgIG9wdGlvbnMuaGVhZGVyc1snY29udGVudC1sZW5ndGgnXSA9IGJvZHkubGVuZ3RoO1xuXG4gICAgICBjb25zdCBwcm94eVJlcSA9IGh0dHBzLnJlcXVlc3Qob3B0aW9ucywgKHByb3h5UmVzKSA9PiB7XG4gICAgICAgIHJlcy5zdGF0dXNDb2RlID0gcHJveHlSZXMuc3RhdHVzQ29kZTtcbiAgICAgICAgT2JqZWN0LmVudHJpZXMocHJveHlSZXMuaGVhZGVycykuZm9yRWFjaCgoW2tleSwgdmFsdWVdKSA9PiB7XG4gICAgICAgICAgcmVzLnNldEhlYWRlcihrZXksIHZhbHVlKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHByb3h5UmVzLnBpcGUocmVzKTtcbiAgICAgIH0pO1xuXG4gICAgICBwcm94eVJlcS5vbignZXJyb3InLCAoZXJyKSA9PiB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1ttdWFwaS1wcm94eV0gcmVxdWVzdCBlcnJvcjonLCBlcnIpO1xuICAgICAgICBpZiAoIXJlcy5oZWFkZXJzU2VudCkge1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAyO1xuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnUHJveHkgZXJyb3InLCBkZXRhaWxzOiBlcnIubWVzc2FnZSB9KSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBwcm94eVJlcS53cml0ZShib2R5KTtcbiAgICAgIHByb3h5UmVxLmVuZCgpO1xuICAgIH0pO1xuICB9O1xufVxuXG4vLyBWaXRlIHBsdWdpbjogc3R1YiBvdXQgdW5yZXNvbHZlZCBsZWdhY3kgaW1wb3J0cyB1bmRlciBjb21wb25lbnRzLyBhbmRcbi8vIHNyYy9saWIvIHRoYXQgYXJlIG5vdCBwYXJ0IG9mIHRoZSBtZWRpYS1jcmVhdGlvbiBmbG93LiBSZXR1cm5zIGFuIGVtcHR5XG4vLyBkZWZhdWx0LWV4cG9ydCBzbyB0aGUgYnVuZGxlIHJlc29sdmVzIGFuZCB0aGUgYnVpbGQgY29tcGxldGVzLiBTdHVicyBhcmVcbi8vIGdhdGVkIGJ5IGFuIGV4cGxpY2l0IGFsbG93LWxpc3QgdG8gYXZvaWQgbWFza2luZyByZWFsIGlzc3VlcyBlbHNld2hlcmUuXG5cbmNvbnN0IFNUVUJfSU1QT1JURVJfUFJFRklYRVMgPSBbXG4gICdjb21wb25lbnRzLycsXG4gICdsaWIvJyxcbl07XG5cbi8vIFRoZSBvbGQgSW1nbHkvcG9wY29ybiB0aW1lbGluZSBlZGl0b3IgKGNvbXBvbmVudHMvY29tbW9uL3RpbWVsaW5lLyosXG4vLyBjb21wb25lbnRzL2NvbW1vbi9JbWdseSosIHNyYy9saWIvZWRpdG9yLyosIGxpYi9jb25zdGFudHMvdGltZWxpbmUuanMsIC4uLilcbi8vIGlzIGdlbnVpbmVseSBicm9rZW4gYW5kIGluY29uc2lzdGVudDogbWFueSBvZiBpdHMgbW9kdWxlcyBmYWlsIHRvIHBhcnNlIGFuZFxuLy8gaXRzIGludGVybmFsIGltcG9ydHMgKGUuZy4gZGVmYXVsdCB2cyBuYW1lZCBleHBvcnRzKSBkb24ndCBsaW5lIHVwLiBUaGVzZVxuLy8gbW9kdWxlcyBhcmUgTk9UIHBhcnQgb2YgdGhlIG1lZGlhLWNyZWF0aW9uIGZsb3cgKFZpZGVvU3R1ZGlvLCBJbWFnZVN0dWRpbyxcbi8vIC4uLiksIGFuZCBzdHViYmluZyB0aGUgd2hvbGUgc3VidHJlZSBrZWVwcyB0aGUgYnVpbGQgZ3JlZW4gd2hpbGUgbGVhdmluZyB0aGVcbi8vIHdvcmtpbmcgcGFnZXMgZnVuY3Rpb25hbC5cbmNvbnN0IEJST0tFTl9MRUdBQ1lfTUFUQ0hFUlMgPSBbXG4gICdjb21wb25lbnRzL2NvbW1vbi8nLFxuICAnY29tcG9uZW50cy9mb3JtL0Zvcm1UZXh0RmllbGQnLFxuICAnc3JjL2xpYi9lZGl0b3InLFxuICAnbGliL2NvbnN0YW50cy90aW1lbGluZScsXG5dO1xuXG5jb25zdCBzdHViTGVnYWN5ID0gKCkgPT4gKHtcbiAgbmFtZTogJ3N0dWItbGVnYWN5LXVucmVzb2x2ZWQnLFxuICBlbmZvcmNlOiAncHJlJyxcbiAgYXN5bmMgcmVzb2x2ZUlkKHNvdXJjZSwgaW1wb3J0ZXIpIHtcbiAgICBpZiAoIWltcG9ydGVyKSByZXR1cm4gbnVsbDtcbiAgICBpZiAoaW1wb3J0ZXIuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcycpKSByZXR1cm4gbnVsbDtcbiAgICBpZiAoc291cmNlLnN0YXJ0c1dpdGgoJ1xcMCcpKSByZXR1cm4gbnVsbDtcbiAgICBpZiAoL1xcLmh0bWwoXFw/fCQpL2kudGVzdChzb3VyY2UpKSByZXR1cm4gbnVsbDtcbiAgICBjb25zdCBpbXBvcnRlcklzTGVnYWN5ID0gU1RVQl9JTVBPUlRFUl9QUkVGSVhFUy5zb21lKHAgPT4gaW1wb3J0ZXIuaW5jbHVkZXMocCkpO1xuICAgIGlmICghaW1wb3J0ZXJJc0xlZ2FjeSkgcmV0dXJuIG51bGw7XG4gICAgLy8gTmV2ZXIgc3R1YiBpbXBvcnRzIGZyb20gdGhlIGxhbmRpbmcgcGFnZSBcdTIwMTQgdGhvc2UgYXJlIG5ldy1zdHlsZVxuICAgIC8vIG1vZHVsZXMgdGhhdCBtdXN0IHJlc29sdmUgdG8gdGhlaXIgcmVhbCBmaWxlcy5cbiAgICBpZiAoaW1wb3J0ZXIuaW5jbHVkZXMoJ3NyYy9jb21wb25lbnRzL2xhbmRpbmcvJykpIHJldHVybiBudWxsO1xuICAgIC8vIFRyeSBWaXRlJ3MgZnVsbCByZXNvbHV0aW9uLiBJZiB0aGUgaW1wb3J0IHJlc29sdmVzIHRvIGEgcmVhbCBmaWxlIGl0XG4gICAgLy8gc2hvdWxkIGJlIGxvYWRlZCBmb3IgcmVhbCBcdTIwMTQgVU5MRVNTIGl0IGlzIGdlbnVpbmUgKHByZS1leGlzdGluZykgYnJva2VuXG4gICAgLy8gbGVnYWN5IGNvZGUgdGhhdCBmYWlscyB0byBwYXJzZSwgaW4gd2hpY2ggY2FzZSB3ZSBzdHViIGl0IHNvIHRoZSBidWlsZFxuICAgIC8vIHN0aWxsIGNvbXBsZXRlcy4gUHJldmlvdXNseSBhIHJlc29sdmVkICpsZWdhY3kqIHRhcmdldCBhbHdheXMgZmVsbFxuICAgIC8vIHRocm91Z2ggdG8gdGhlIHN0dWIsIHdoaWNoIHJlcGxhY2VkIHJlYWwgY29tcG9uZW50cyBsaWtlIFZpZGVvU3R1ZGlvLmpzXG4gICAgLy8gd2l0aCBlbXB0eSBgTWlzc2luZ1N0dWJgIG1vZHVsZXMgdGhhdCBoYWQgbm8gbmFtZWQgZXhwb3J0cyAoc29cbiAgICAvLyBgbS5WaWRlb1N0dWRpb2Agd2FzIHVuZGVmaW5lZCAtPiBcImUuVmlkZW9TdHVkaW8gaXMgbm90IGEgZnVuY3Rpb25cIikuXG4gICAgY29uc3QgcmVzb2x2ZWQgPSBhd2FpdCB0aGlzLnJlc29sdmUoc291cmNlLCBpbXBvcnRlciwgeyBza2lwU2VsZjogdHJ1ZSB9KTtcbiAgICBpZiAocmVzb2x2ZWQpIHJldHVybiBudWxsO1xuXG4gICAgLy8gR2VudWluZWx5IHVucmVzb2x2ZWQgbGVnYWN5IGltcG9ydCBcdTIwMTQgc3R1YiBpdCBzbyB0aGUgYnVuZGxlIHN0aWxsXG4gICAgLy8gcmVzb2x2ZXMuIEFzc2V0IGltcG9ydHMgZ2V0IGEgcGxhY2Vob2xkZXIgZGF0YSBVUkwuXG4gICAgaWYgKC9cXC4oc3ZnfHBuZ3xqcGU/Z3x3ZWJwfGdpZnxpY28pKFxcP3wkKS9pLnRlc3Qoc291cmNlKSkge1xuICAgICAgY29uc3QgcmVsID0gaW1wb3J0ZXIucmVwbGFjZShwcm9jZXNzLmN3ZCgpICsgJy8nLCAnJyk7XG4gICAgICBjb25zb2xlLndhcm4oJ1tTVFVCXScsIHNvdXJjZSwgJzwtJywgcmVsKTtcbiAgICAgIGlmIChwcm9jZXNzLmVudi5TVFJJQ1RfSU1QT1JUUykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVucmVzb2x2ZWQgaW1wb3J0IFwiJHtzb3VyY2V9XCIgZnJvbSAke3JlbH1gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGlkOiAnXFwwbGVnYWN5LWFzc2V0LXN0dWI6JyArIHNvdXJjZSArICc6OicgKyBpbXBvcnRlcixcbiAgICAgIH07XG4gICAgfVxuICAgIGNvbnN0IHJlbCA9IGltcG9ydGVyLnJlcGxhY2UocHJvY2Vzcy5jd2QoKSArICcvJywgJycpO1xuICAgIGNvbnNvbGUud2FybignW1NUVUJdJywgc291cmNlLCAnPC0nLCByZWwpO1xuICAgIGlmIChwcm9jZXNzLmVudi5TVFJJQ1RfSU1QT1JUUykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnJlc29sdmVkIGltcG9ydCBcIiR7c291cmNlfVwiIGZyb20gJHtyZWx9YCk7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBpZDogJ1xcMGxlZ2FjeS1zdHViOicgKyBzb3VyY2UgKyAnOjonICsgaW1wb3J0ZXIsXG4gICAgICBtZXRhOiB7IGxlZ2FjeVN0dWI6IHsgc291cmNlLCBpbXBvcnRlciB9IH1cbiAgICB9O1xuICB9LFxuICBsb2FkKGlkKSB7XG4gICAgaWYgKGlkLnN0YXJ0c1dpdGgoJ1xcMGxlZ2FjeS1hc3NldC1zdHViOicpKSB7XG4gICAgICAvLyBSZXR1cm4gYSBtaW5pbWFsIFNWRyBkYXRhIFVSTCBzbyB0aGUgYnVuZGxlciBjYW4gc3Vic3RpdHV0ZS5cbiAgICAgIGNvbnN0IGRhdGFVcmwgPSAnZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJyArIGVuY29kZVVSSUNvbXBvbmVudChcbiAgICAgICAgJzxzdmcgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHdpZHRoPVwiMjRcIiBoZWlnaHQ9XCIyNFwiPjxyZWN0IHdpZHRoPVwiMjRcIiBoZWlnaHQ9XCIyNFwiIGZpbGw9XCJibGFja1wiLz48L3N2Zz4nXG4gICAgICApO1xuICAgICAgcmV0dXJuIGBleHBvcnQgZGVmYXVsdCAke0pTT04uc3RyaW5naWZ5KGRhdGFVcmwpfTtcXG5gO1xuICAgIH1cbiAgICBpZiAoaWQuc3RhcnRzV2l0aCgnXFwwbGVnYWN5LXN0dWI6JykpIHtcbiAgICAgIC8vIEJ1aWxkIG5hbWVkIGV4cG9ydHMgYnkgcGFyc2luZyB0aGUgaW1wb3J0ZXIncyBpbXBvcnQgc3RhdGVtZW50LlxuICAgICAgY29uc3QgcGF5bG9hZCA9IGlkLnNsaWNlKCdcXDBsZWdhY3ktc3R1YjonLmxlbmd0aCk7XG4gICAgICBjb25zdCBbc291cmNlLCAuLi5yZXN0XSA9IHBheWxvYWQuc3BsaXQoJzo6Jyk7XG4gICAgICBjb25zdCBpbXBvcnRlciA9IHJlc3Quam9pbignOjonKTtcbiAgICAgIGNvbnNvbGUud2FybignW3N0dWItbGVnYWN5XSBTdHViYmluZyB1bnJlc29sdmVkIGltcG9ydDonLCBzb3VyY2UsICdcdTIxOTAnLCBpbXBvcnRlcik7XG4gICAgICBjb25zb2xlLndhcm4oJ1tzdHViLWxlZ2FjeV0gU3R1YmJpbmcgdW5yZXNvbHZlZCBpbXBvcnQ6Jywgc291cmNlLCAnXHUyMTkwJywgaW1wb3J0ZXIpO1xuICAgICAgLy8gTWF0Y2ggdGhlIGV4YWN0IHF1b3RlZCBpbXBvcnQgcGF0aCBzbyBzdWJwYXRoIGltcG9ydHMgbGlrZVxuICAgICAgLy8gJ0BwcWluYS9waW50dXJhL3BpbnR1cmEubW9kdWxlLmNzcycgZG9uJ3Qgc2hhZG93IGEgbWFpbi1lbnRyeVxuICAgICAgLy8gaW1wb3J0IGxpa2UgJ0BwcWluYS9waW50dXJhJyBpbiB0aGUgc2FtZSBmaWxlLlxuICAgICAgY29uc3QgbWF0Y2hlc1NvdXJjZSA9IChsaW5lKSA9PlxuICAgICAgICBsaW5lLmluY2x1ZGVzKFwiJ1wiICsgc291cmNlICsgXCInXCIpIHx8IGxpbmUuaW5jbHVkZXMoJ1wiJyArIHNvdXJjZSArICdcIicpO1xuICAgICAgbGV0IG5hbWVzID0gW107XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBpbXBvcnRlclRleHQgPSBmcy5yZWFkRmlsZVN5bmMoaW1wb3J0ZXIsICd1dGY4Jyk7XG4gICAgICAgIGNvbnN0IGxpbmVzID0gaW1wb3J0ZXJUZXh0LnNwbGl0KC9cXG4vKTtcbiAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICAgICAgaWYgKCFtYXRjaGVzU291cmNlKGxpbmUpKSBjb250aW51ZTtcbiAgICAgICAgICBjb25zdCBuYW1lZE1hdGNoID0gbGluZS5tYXRjaCgvaW1wb3J0XFxzKlxceyhbXn1dKylcXH1cXHMqZnJvbVxccypbJ1wiXVteJ1wiXStbJ1wiXS8pO1xuICAgICAgICAgIGlmIChuYW1lZE1hdGNoKSB7XG4gICAgICAgICAgICBuYW1lcyA9IG5hbWVkTWF0Y2hbMV0uc3BsaXQoJywnKS5tYXAocyA9PiBzLnRyaW0oKS5zcGxpdCgvXFxzK2FzXFxzKy8pLnBvcCgpKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgZGVmYXVsdE1hdGNoID0gbGluZS5tYXRjaCgvaW1wb3J0XFxzKyhcXHcrKVxccytmcm9tXFxzKlsnXCJdW14nXCJdK1snXCJdLyk7XG4gICAgICAgICAgaWYgKGRlZmF1bHRNYXRjaCkge1xuICAgICAgICAgICAgbmFtZXMgPSBbZGVmYXVsdE1hdGNoWzFdXTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBzdGFyTWF0Y2ggPSBsaW5lLm1hdGNoKC9pbXBvcnRcXHMqXFwqXFxzKmFzXFxzKyhcXHcrKVxccytmcm9tXFxzKlsnXCJdW14nXCJdK1snXCJdLyk7XG4gICAgICAgICAgaWYgKHN0YXJNYXRjaCkge1xuICAgICAgICAgICAgbmFtZXMgPSBbc3Rhck1hdGNoWzFdXTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoXykge31cbiAgICAgIGNvbnN0IHNlZW4gPSBuZXcgU2V0KCk7XG4gICAgICBjb25zdCB1bmlxID0gbmFtZXMuZmlsdGVyKG4gPT4geyBpZiAoc2Vlbi5oYXMobikpIHJldHVybiBmYWxzZTsgc2Vlbi5hZGQobik7IHJldHVybiB0cnVlOyB9KTtcbiAgICAgIGxldCBpc0RlZmF1bHRJbXBvcnQgPSBmYWxzZTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGltcG9ydGVyVGV4dCA9IGZzLnJlYWRGaWxlU3luYyhpbXBvcnRlciwgJ3V0ZjgnKTtcbiAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGltcG9ydGVyVGV4dC5zcGxpdCgvXFxuLykpIHtcbiAgICAgICAgICBpZiAoIW1hdGNoZXNTb3VyY2UobGluZSkpIGNvbnRpbnVlO1xuICAgICAgICAgIGlmICgvXmltcG9ydFxccytcXHcrXFxzK2Zyb21cXHMqWydcIl1bXidcIl0rWydcIl0vLnRlc3QobGluZSkgJiYgIS9cXHsvLnRlc3QobGluZSkgJiYgIS9cXCovLnRlc3QobGluZSkpIHtcbiAgICAgICAgICAgIGlzRGVmYXVsdEltcG9ydCA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChfKSB7fVxuICAgICAgaWYgKGlzRGVmYXVsdEltcG9ydCAmJiB1bmlxLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICBjb25zdCBuID0gdW5pcVswXTtcbiAgICAgICAgY29uc3QgaXNDbGFzcyA9IC9eW0EtWl0vLnRlc3Qobik7XG4gICAgICAgIHJldHVybiBgZXhwb3J0IGRlZmF1bHQgJHtpc0NsYXNzID8gYGNsYXNzICR7bn0ge31gIDogYGZ1bmN0aW9uICR7bn0oKSB7fWB9O1xcbmA7XG4gICAgICB9XG4gICAgICBjb25zdCBuYW1lZEV4cG9ydHMgPSB1bmlxLm1hcChuID0+IHtcbiAgICAgICAgY29uc3QgaXNDbGFzcyA9IC9eW0EtWl0vLnRlc3Qobik7XG4gICAgICAgIHJldHVybiBpc0NsYXNzID8gYGV4cG9ydCBjbGFzcyAke259IHt9YCA6IGBleHBvcnQgZnVuY3Rpb24gJHtufSgpIHt9YDtcbiAgICAgIH0pLmpvaW4oJ1xcbicpO1xuICAgICAgcmV0dXJuIChuYW1lZEV4cG9ydHMgfHwgJ2V4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIE1pc3NpbmdTdHViKCkgeyByZXR1cm4gbnVsbDsgfScpICsgJ1xcbic7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxufSk7XG5cbi8vIGZpeExlZ2FjeUltcG9ydHMgXHUyMDE0IHJlbWFwcyB3ZWJwYWNrL0NSQS1zdHlsZSBzcGVjaWZpZXJzIGxlZnQgb3ZlciBmcm9tIHRoaXNcbi8vIHJlcG8ncyBwcmUtVml0ZSBvcmlnaW4gdG8gcmVhbCBmaWxlcyB1bmRlciBzcmMvIChvciwgZm9yIHNvbWUgbGVnYWN5XG4vLyBtb2R1bGVzLCBzdGlsbCBhdCB0aGUgcmVwbyByb290KSwgYW5kIHJld3JpdGVzIGltcG9ydHMgdGhhdCByZXNvbHZlIGludG9cbi8vIC9wdWJsaWMgKHdoaWNoIFZpdGUgZm9yYmlkcyBpbXBvcnRpbmcgYXMgbW9kdWxlcykgdG8gYSB2aXJ0dWFsIG1vZHVsZVxuLy8gZXhwb3J0aW5nIHRoZSBhc3NldCdzIHB1YmxpYyBVUkwuXG4vL1xuLy8gVGhlIGxlZ2FjeSBgY29tcG9uZW50cy9gIHRyZWUgcmVmZXJlbmNlcyB0aGVzZSByb290cyB3aXRoIHJlbGF0aXZlXG4vLyBgLi4vLi4vYCBzcGVjaWZpZXJzIGFuZCBubyBsZWFkaW5nIFwiL1wiLCBlLmcuOlxuLy8gICBpbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tIFwiLi4vLi4vLi4vLi4vYmFzZS9Db21wb25lbnQuanNcIjtcbi8vICAgaW1wb3J0IHsgZ2V0U3RvcmUgfSBmcm9tIFwiLi4vLi4vLi4vc3RvcmVzL2Jhc2UvU3RvcmUuanNcIjtcbi8vICAgaW1wb3J0IHV0aWxzIGZyb20gXCIuLi8uLi8uLi9saWIvbG90dGllL3V0aWxzXCI7XG4vLyAgIGltcG9ydCBhc3NldCBmcm9tIFwiLi4vLi4vLi4vLi4vcHVibGljL3N0YXRpYy9pbWFnZXMvaWNvbi5zdmdcIjtcbi8vICAgaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSBcIi4uLy4uL3ZpdGUtcmVtaXgtZWRpdG9yL3NyYy9jb21wb25lbnRzL2Jhc2UvQ29tcG9uZW50LmpzXCI7XG4vL1xuLy8gSXQgb25seSBhY3RzIG9uIGltcG9ydHMgdGhhdCBjdXJyZW50bHkgRkFJTCB0byByZXNvbHZlIChvciB0aGF0IHJlc29sdmUgaW50b1xuLy8gL3B1YmxpYyksIHNvIGhlYWx0aHkgaW1wb3J0cyBhcmUgbmV2ZXIgdG91Y2hlZC4gVGhpcyBjb21wbGVtZW50cyBzdHViTGVnYWN5LFxuLy8gd2hpY2ggc3R1YnMgaW1wb3J0cyB0aGF0IGZhaWwgcmVzb2x1dGlvbiBlbnRpcmVseS5cbmNvbnN0IGZpeExlZ2FjeUltcG9ydHMgPSAoKSA9PiB7XG4gIGNvbnN0IGlzUHVibGljID0gKGlkKSA9PlxuICAgIGlkLmluY2x1ZGVzKGAke3BhdGguc2VwfXB1YmxpYyR7cGF0aC5zZXB9YCkgfHwgaWQuZW5kc1dpdGgoYCR7cGF0aC5zZXB9cHVibGljYCk7XG5cbiAgY29uc3QgcHVibGljVXJsID0gKGlkKSA9PiB7XG4gICAgY29uc3QgcmVsID0gaWQuc3BsaXQoYHB1YmxpYyR7cGF0aC5zZXB9YClbMV0uc3BsaXQocGF0aC5zZXApLmpvaW4oJy8nKTtcbiAgICByZXR1cm4gJ1xcMHB1YmxpYy11cmw6JyArIHJlbDtcbiAgfTtcblxuICAvLyBMb2dpY2FsIHJvb3QtcmVsYXRpdmUgaGVhZHMgdGhhdCBpZGVudGlmeSBhIGxlZ2FjeSBzcGVjaWZpZXIuIE9yZGVyIGlzXG4gIC8vIHNpZ25pZmljYW50OiBtb3JlIHNwZWNpZmljIGhlYWRzIG11c3QgYmUgbGlzdGVkIGJlZm9yZSB0aGVpciBwcmVmaXguXG4gIGNvbnN0IExFR0FDWV9IRUFEUyA9IFtcbiAgICAndml0ZS1yZW1peC1lZGl0b3Ivc3JjLycsXG4gICAgJ3ZpdGUtcmVtaXgtZWRpdG9yLycsXG4gICAgJ2Jhc2UvQ29tcG9uZW50LmpzJyxcbiAgICAnYmFzZS9TdG9yZS5qcycsXG4gICAgJ3N0b3Jlcy8nLFxuICAgICdob2MvJyxcbiAgICAnbGliLycsXG4gICAgJ2NvbXBvbmVudHMvJyxcbiAgICAncHVibGljLycsXG4gIF07XG5cbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnZml4LWxlZ2FjeS1pbXBvcnRzJyxcbiAgICBlbmZvcmNlOiAncHJlJyxcbiAgICBhc3luYyByZXNvbHZlSWQoc291cmNlLCBpbXBvcnRlcikge1xuICAgICAgaWYgKCFpbXBvcnRlciB8fCBpbXBvcnRlci5pbmNsdWRlcygnbm9kZV9tb2R1bGVzJykpIHJldHVybiBudWxsO1xuICAgICAgaWYgKHNvdXJjZS5zdGFydHNXaXRoKCdcXDAnKSkgcmV0dXJuIG51bGw7XG4gICAgICBpZiAoL1xcLmh0bWwoXFw/fCQpL2kudGVzdChzb3VyY2UpKSByZXR1cm4gbnVsbDtcblxuICAgICAgLy8gSU1QT1JUQU5UOiBkbyBOT1QgY2FsbCBWaXRlJ3MgcmVzb2x2ZXIgKHRoaXMucmVzb2x2ZSkgaGVyZS4gc3R1YkxlZ2FjeVxuICAgICAgLy8gKGFub3RoZXIgJ3ByZScgcGx1Z2luKSBhbHNvIGNhbGxzIHRoaXMucmVzb2x2ZSB3aXRoIHNraXBTZWxmLCB3aGljaFxuICAgICAgLy8gd291bGQgcmUtZW50ZXIgdGhpcyBob29rIGFuZCByZWN1cnNlIHVudGlsIFZpdGUncyByZWN1cnNpb24gZ3VhcmRcbiAgICAgIC8vIHJldHVybnMgYSBicm9rZW4gaWQuIFdlIHJlc29sdmUgbGVnYWN5IGNhbmRpZGF0ZXMgZGlyZWN0bHkgYWdhaW5zdCB0aGVcbiAgICAgIC8vIGZpbGVzeXN0ZW0gaW5zdGVhZC5cblxuICAgICAgY29uc3QgaXNSZWxhdGl2ZSA9IC9eXFwuXFwuP1xcL3xeXFwvLy50ZXN0KHNvdXJjZSk7XG5cbiAgICAgIC8vIElmIHRoZSBzcGVjaWZpZXIgYWxyZWFkeSByZXNvbHZlcyB0byBhIHJlYWwgZmlsZSBvbiBkaXNrIChyZWxhdGl2ZSB0b1xuICAgICAgLy8gdGhlIGltcG9ydGVyKSwgbGVhdmUgaXQgdW50b3VjaGVkLiBBIGZpbGUgaW5zaWRlIC9wdWJsaWMgaXMgc3BlY2lhbDpcbiAgICAgIC8vIFZpdGUgZm9yYmlkcyBpbXBvcnRpbmcgcHVibGljIGFzc2V0cyBhcyBtb2R1bGVzLCBzbyByZXdyaXRlIGl0IHRvIGFcbiAgICAgIC8vIHZpcnR1YWwgbW9kdWxlIGV4cG9ydGluZyB0aGUgcHVibGljIFVSTC5cbiAgICAgIGlmIChpc1JlbGF0aXZlKSB7XG4gICAgICAgIGNvbnN0IGFzSXMgPSBwYXRoLnJlc29sdmUocGF0aC5kaXJuYW1lKGltcG9ydGVyKSwgc291cmNlKTtcbiAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoYXNJcykgJiYgZnMuc3RhdFN5bmMoYXNJcykuaXNGaWxlKCkpIHtcbiAgICAgICAgICBpZiAoaXNQdWJsaWMoYXNJcykpIHJldHVybiBwdWJsaWNVcmwoYXNJcyk7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgLy8gRXh0ZW5zaW9ubGVzcyByZWxhdGl2ZSBzcGVjaWZpZXIgKGUuZy4gXCIuLi8uLi9jb21wb25lbnRzL21vZGFscy9YXCIpOlxuICAgICAgICAvLyB0cnkgY29tbW9uIGV4dGVuc2lvbnMgQU5EIGRpcmVjdG9yeSBpbmRleCBmaWxlcyBhZ2FpbnN0IHRoZVxuICAgICAgICAvLyBpbXBvcnRlci1yZWxhdGl2ZSBwYXRoIEJFRk9SRSBmYWxsaW5nIGludG8gdGhlIGxlZ2FjeSBzcmMvLWZpcnN0XG4gICAgICAgIC8vIGNhbmRpZGF0ZSByb3V0aW5nIGJlbG93LiBXaXRob3V0IHRoaXMsIGFuIGV4dGVuc2lvbmxlc3MgcmVsYXRpdmVcbiAgICAgICAgLy8gaW1wb3J0IHdob3NlIHJlYWwgc2libGluZyBpcyBcIlguanN4XCIgaXMgdHJlYXRlZCBhcyB1bnJlc29sdmVkIGFuZFxuICAgICAgICAvLyBnZXRzIG1pc3JvdXRlZCB0byBhIHNhbWUtbmFtZWQgZmlsZSB1bmRlciBzcmMvLiBIb25vcmluZyB0aGUgcmVhbFxuICAgICAgICAvLyBzaWJsaW5nIGtlZXBzIHJlbGF0aXZlIGltcG9ydHMgKGUuZy4gdGhlIG1vZGFsIHJlZ2lzdHJ5KSBwb2ludGluZyBhdFxuICAgICAgICAvLyB0aGVpciBhY3R1YWwgb24tZGlzayB0YXJnZXRzLlxuICAgICAgICBpZiAoIXBhdGguZXh0bmFtZShhc0lzKSkge1xuICAgICAgICAgIGZvciAoY29uc3QgZXh0IG9mIFsnLmpzeCcsICcudHN4JywgJy50cycsICcubWpzJywgJy5qcyddKSB7XG4gICAgICAgICAgICBjb25zdCBhbHQgPSBhc0lzICsgZXh0O1xuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoYWx0KSAmJiBmcy5zdGF0U3luYyhhbHQpLmlzRmlsZSgpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBpc1B1YmxpYyhhbHQpID8gcHVibGljVXJsKGFsdCkgOiBhbHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciAoY29uc3QgaWR4IG9mIFsnaW5kZXguanN4JywgJ2luZGV4LnRzeCcsICdpbmRleC50cycsICdpbmRleC5tanMnLCAnaW5kZXguanMnXSkge1xuICAgICAgICAgICAgY29uc3QgYWx0ID0gcGF0aC5qb2luKGFzSXMsIGlkeCk7XG4gICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhhbHQpICYmIGZzLnN0YXRTeW5jKGFsdCkuaXNGaWxlKCkpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGlzUHVibGljKGFsdCkgPyBwdWJsaWNVcmwoYWx0KSA6IGFsdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gVW5yZXNvbHZlZCAob3IgcmVzb2x2ZXMgaW50byAvcHVibGljKSBcdTIxOTIgdHJlYXQgYXMgYSBsZWdhY3kgc3BlY2lmaWVyLlxuICAgICAgLy8gU3RyaXAgbGVhZGluZyAuLyBhbmQgLi4vIHNvIHdlIGtlZXAgdGhlIGxvZ2ljYWwgcm9vdC1yZWxhdGl2ZSBwYXRoXG4gICAgICAvLyAoZS5nLiBcImJhc2UvQ29tcG9uZW50LmpzXCIpLlxuICAgICAgY29uc3QgbG9naWNhbCA9IHNvdXJjZVxuICAgICAgICAucmVwbGFjZSgvXig/OlxcLlxcLlxcLykrLywgJycpXG4gICAgICAgIC5yZXBsYWNlKC9eXFwuXFwvLywgJycpXG4gICAgICAgIC5yZXBsYWNlKC9eXFwvLywgJycpO1xuXG4gICAgICBpZiAoIUxFR0FDWV9IRUFEUy5zb21lKChoKSA9PiBsb2dpY2FsLmluY2x1ZGVzKGgpKSkgcmV0dXJuIG51bGw7XG5cbiAgICAgIC8vIEJ1aWxkIHJvb3QtcmVsYXRpdmUgY2FuZGlkYXRlKHMpLCB0cnlpbmcgc3JjLyBmaXJzdCwgdGhlbiB0aGUgcmVwb1xuICAgICAgLy8gcm9vdCwgZm9yIHJvb3RzIHRoYXQgbGl2ZSBpbiBib3RoIHBsYWNlcy5cbiAgICAgIGNvbnN0IGNhbmRpZGF0ZXMgPSBbXTtcbiAgICAgIGlmIChsb2dpY2FsLnN0YXJ0c1dpdGgoJ3ZpdGUtcmVtaXgtZWRpdG9yL3NyYy8nKSkge1xuICAgICAgICBjYW5kaWRhdGVzLnB1c2gobG9naWNhbC5yZXBsYWNlKCd2aXRlLXJlbWl4LWVkaXRvci9zcmMvJywgJ3NyYy8nKSk7XG4gICAgICB9IGVsc2UgaWYgKGxvZ2ljYWwuc3RhcnRzV2l0aCgndml0ZS1yZW1peC1lZGl0b3IvJykpIHtcbiAgICAgICAgY2FuZGlkYXRlcy5wdXNoKGxvZ2ljYWwucmVwbGFjZSgndml0ZS1yZW1peC1lZGl0b3IvJywgJycpKTtcbiAgICAgIH0gZWxzZSBpZiAobG9naWNhbCA9PT0gJ2Jhc2UvQ29tcG9uZW50LmpzJykge1xuICAgICAgICBjYW5kaWRhdGVzLnB1c2goJ3NyYy9jb21wb25lbnRzL2Jhc2UvQ29tcG9uZW50LmpzJyk7XG4gICAgICB9IGVsc2UgaWYgKGxvZ2ljYWwgPT09ICdiYXNlL1N0b3JlLmpzJykge1xuICAgICAgICBjYW5kaWRhdGVzLnB1c2goJ3NyYy9zdG9yZXMvYmFzZS9TdG9yZS5qcycpO1xuICAgICAgfSBlbHNlIGlmIChsb2dpY2FsLnN0YXJ0c1dpdGgoJ3N0b3Jlcy8nKSkge1xuICAgICAgICBjYW5kaWRhdGVzLnB1c2goJ3NyYy8nICsgbG9naWNhbCwgbG9naWNhbCk7XG4gICAgICB9IGVsc2UgaWYgKGxvZ2ljYWwuc3RhcnRzV2l0aCgnaG9jLycpKSB7XG4gICAgICAgIGNhbmRpZGF0ZXMucHVzaCgnc3JjLycgKyBsb2dpY2FsLCBsb2dpY2FsKTtcbiAgICAgIH0gZWxzZSBpZiAobG9naWNhbC5zdGFydHNXaXRoKCdsaWIvJykpIHtcbiAgICAgICAgY2FuZGlkYXRlcy5wdXNoKCdzcmMvJyArIGxvZ2ljYWwsIGxvZ2ljYWwpO1xuICAgICAgfSBlbHNlIGlmIChsb2dpY2FsLnN0YXJ0c1dpdGgoJ2NvbXBvbmVudHMvJykpIHtcbiAgICAgICAgY2FuZGlkYXRlcy5wdXNoKCdzcmMvJyArIGxvZ2ljYWwsIGxvZ2ljYWwpO1xuICAgICAgfSBlbHNlIGlmIChsb2dpY2FsLnN0YXJ0c1dpdGgoJ3B1YmxpYy8nKSkge1xuICAgICAgICBjYW5kaWRhdGVzLnB1c2gobG9naWNhbCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGlzRmlsZSA9IChwKSA9PiBmcy5leGlzdHNTeW5jKHApICYmIGZzLnN0YXRTeW5jKHApLmlzRmlsZSgpO1xuXG4gICAgICBmb3IgKGNvbnN0IGNhbmQgb2YgY2FuZGlkYXRlcykge1xuICAgICAgICBjb25zdCBhYnMgPSBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBjYW5kKTtcbiAgICAgICAgaWYgKGlzRmlsZShhYnMpKSB7XG4gICAgICAgICAgcmV0dXJuIGlzUHVibGljKGFicykgPyBwdWJsaWNVcmwoYWJzKSA6IGFicztcbiAgICAgICAgfVxuICAgICAgICAvLyBFeHRlbnNpb24gZmFsbGJhY2s6IGxlZ2FjeSAuanMgc3BlY2lmaWVycyBhcmUgb2Z0ZW4gYXV0aG9yZWQgYXNcbiAgICAgICAgLy8gLmpzeC8udHN4Ly50cy8ubWpzLlxuICAgICAgICBmb3IgKGNvbnN0IGV4dCBvZiBbJy5qcycsICcuanN4JywgJy50c3gnLCAnLnRzJywgJy5tanMnXSkge1xuICAgICAgICAgIGNvbnN0IGFsdCA9IGFicy5yZXBsYWNlKC9cXC4oanN8anN4fHRzfHRzeHxtanMpJC9pLCAnJykgKyBleHQ7XG4gICAgICAgICAgaWYgKGlzRmlsZShhbHQpKSB7XG4gICAgICAgICAgICByZXR1cm4gaXNQdWJsaWMoYWx0KSA/IHB1YmxpY1VybChhbHQpIDogYWx0O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICBsb2FkKGlkKSB7XG4gICAgICBpZiAoaWQuc3RhcnRzV2l0aCgnXFwwcHVibGljLXVybDonKSkge1xuICAgICAgICBjb25zdCByZWwgPSBpZC5zbGljZSgnXFwwcHVibGljLXVybDonLmxlbmd0aCk7XG4gICAgICAgIHJldHVybiBgZXhwb3J0IGRlZmF1bHQgJHtKU09OLnN0cmluZ2lmeSgnLycgKyByZWwpfTtcXG5gO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICAvLyBEZXYtb25seTogVml0ZSdzIC9AaWQvIHBpcGVsaW5lIHRyZWF0cyBcIlxcMHB1YmxpYy11cmw6Ki5zdmc/aW1wb3J0XCIgaWRzIGFzXG4gICAgLy8gYXNzZXQgcmVxdWVzdHMgYW5kIGRvZXMgbm90IHJ1biB0aGlzIHBsdWdpbidzIGxvYWQoKSBmb3IgdGhlbSwgc28gdGhlXG4gICAgLy8gYnJvd3NlciByZWNlaXZlcyB0aGUgU1BBIGluZGV4Lmh0bWwgZmFsbGJhY2sgKGEgSlMgXCJtb2R1bGVcIiB0aGF0IGlzXG4gICAgLy8gYWN0dWFsbHkgSFRNTCkgYW5kIHRoZSBpbXBvcnRpbmcgbW9kdWxlIHJlamVjdHMgYXQgcnVudGltZS4gU2VydmUgdGhlc2VcbiAgICAvLyB2aXJ0dWFsIG1vZHVsZXMgZXhwbGljaXRseSBhcyBhIHJlYWwgRVMgbW9kdWxlIGV4cG9ydGluZyB0aGUgcHVibGljIFVSTC5cbiAgICAvL1xuICAgIC8vIFJlZ2lzdGVyZWQgdmlhIHRoZSBkaXJlY3QgYHNlcnZlci5taWRkbGV3YXJlcy51c2UoLi4uKWAgZm9ybSBpbnNpZGVcbiAgICAvLyBjb25maWd1cmVTZXJ2ZXIgKE5PVCB0aGUgcmV0dXJuZWQgcG9zdC1ob29rIGZvcm0pLCBzbyBpdCBydW5zIGJlZm9yZVxuICAgIC8vIFZpdGUncyBpbnRlcm5hbCB0cmFuc2Zvcm0vU1BBLWZhbGxiYWNrIG1pZGRsZXdhcmVzIGFuZCByZWxpYWJseSBjbGFpbXNcbiAgICAvLyB0aGUgcmVxdWVzdCByZWdhcmRsZXNzIG9mIHBsdWdpbiBvcmRlcmluZy4gVml0ZSBlbmNvZGVzIHRoZSB2aXJ0dWFsIGlkXG4gICAgLy8gXCJcXDBwdWJsaWMtdXJsOjxyZWw+XCIgaW4gdGhlIHJlcXVlc3QgcGF0aCBhc1xuICAgIC8vIFwiL0BpZC9fX3gwMF9fcHVibGljLXVybDo8cmVsPlwiIChvcHRpb25hbGx5IHdpdGggYSBcIj9pbXBvcnRcIiBxdWVyeSkgXHUyMDE0XG4gICAgLy8gdmVyaWZpZWQgYWdhaW5zdCB0aGUgcmVhbCBmYWlsaW5nIHJlcXVlc3QgZm9yIGNvZ3doZWVsLnN2Zy4gV2UgbWF0Y2ggb25cbiAgICAvLyB0aGUgXCJwdWJsaWMtdXJsOlwiIG1hcmtlciB0byBiZSByZXNpbGllbnQgdG8gdGhlIGxlYWRpbmcgZW5jb2RpbmcuXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgY29uc3QgTUFSS0VSID0gJ3B1YmxpYy11cmw6JztcbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoKHJlcSwgcmVzLCBuZXh0KSA9PiB7XG4gICAgICAgIGNvbnN0IHVybCA9IHJlcS51cmwgfHwgJyc7XG4gICAgICAgIGNvbnN0IG1hcmtlcklkeCA9IHVybC5pbmRleE9mKE1BUktFUik7XG4gICAgICAgIC8vIE9ubHkgaGFuZGxlIHRoZSB2aXJ0dWFsIHB1YmxpYy11cmwgaWQgcGF0aCAoc2VydmVkIHZpYSBWaXRlJ3MgL0BpZC9cbiAgICAgICAgLy8gbW9kdWxlIHJvdXRlKS4gTmV2ZXIgdG91Y2ggbm9ybWFsIC9zdGF0aWMvLi4uIGFzc2V0IHJlcXVlc3RzLlxuICAgICAgICBpZiAobWFya2VySWR4ID09PSAtMSB8fCAhdXJsLnN0YXJ0c1dpdGgoJy9AaWQvJykpIHJldHVybiBuZXh0KCk7XG4gICAgICAgIGNvbnN0IHJlbCA9IHVybC5zbGljZShtYXJrZXJJZHggKyBNQVJLRVIubGVuZ3RoKS5zcGxpdCgnPycpWzBdLnNwbGl0KCcjJylbMF07XG4gICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qYXZhc2NyaXB0Jyk7XG4gICAgICAgIHJlcy5lbmQoYGV4cG9ydCBkZWZhdWx0ICR7SlNPTi5zdHJpbmdpZnkoJy8nICsgcmVsKX07XFxuYCk7XG4gICAgICB9KTtcbiAgICB9LFxuICB9O1xufTtcblxuLy8gUmVzb2x2ZSB0aGUgQ2xlcmsgZnJvbnRlbmQgQVBJIGhvc3QgZnJvbSB0aGUgcHVibGlzaGFibGUga2V5IHNvIHRoZSBkZXZcbi8vIENTUCAoc2V0IGluIHNlY3VyaXR5SGVhZGVycykgcGVybWl0cyBDbGVyaydzIEpTL3dvcmtlci9uZXR3b3JrIHJlcXVlc3RzXG4vLyBmb3Igd2hpY2hldmVyIGluc3RhbmNlIGlzIGNvbmZpZ3VyZWQuIFRoZSBrZXkgcGF5bG9hZCBpcyBiYXNlNjQgb2Zcbi8vIFwiPGZyb250ZW5kRG9tYWluPiRcIi4gTG9hZGVkIHZpYSBsb2FkRW52IGJlY2F1c2UgVml0ZSBkb2VzIG5vdCBleHBvc2UgLmVudlxuLy8gdmFycyBvbiBwcm9jZXNzLmVudiBmb3IgdGhlIGNvbmZpZydzIE5vZGUgY29udGV4dC5cbmNvbnN0IENMRVJLX0RFVl9FTlYgPSBsb2FkRW52KCdkZXZlbG9wbWVudCcsIF9fZGlybmFtZSwgJycpO1xuY29uc3QgQ0xFUktfS0VZID0gQ0xFUktfREVWX0VOVi5WSVRFX0NMRVJLX1BVQkxJU0hBQkxFX0tFWSB8fCAnJztcbmxldCBjbGVya0RvbWFpbiA9ICcnO1xuY29uc3QgY2xlcmtLZXlNYXRjaCA9IENMRVJLX0tFWS5tYXRjaCgvXnBrXyg/OnRlc3R8bGl2ZSlfKC4rKSQvKTtcbmlmIChjbGVya0tleU1hdGNoKSB7XG4gIHRyeSB7XG4gICAgY2xlcmtEb21haW4gPSBCdWZmZXIuZnJvbShjbGVya0tleU1hdGNoWzFdLCAnYmFzZTY0JykudG9TdHJpbmcoJ3V0ZjgnKS5yZXBsYWNlKC9cXCQkLywgJycpO1xuICB9IGNhdGNoIChfKSB7IC8qIGlnbm9yZSBtYWxmb3JtZWQga2V5ICovIH1cbn1cbmNvbnN0IGNsZXJrSG9zdFNyYyA9IGNsZXJrRG9tYWluID8gYCBodHRwczovLyR7Y2xlcmtEb21haW59YCA6ICcnO1xuXG4vLyBTZWN1cml0eSBoZWFkZXJzIG1pZGRsZXdhcmUuIGNsZXJrSG9zdFNyYyBpcyB0aGUgQ2xlcmsgZnJvbnRlbmQgQVBJIGhvc3Rcbi8vIGRlcml2ZWQgZnJvbSBWSVRFX0NMRVJLX1BVQkxJU0hBQkxFX0tFWSAoc2VlIHRoZSBtb2R1bGUtc2NvcGUgYmxvY2tcbi8vIGJlbG93KSBzbyB0aGUgZGV2IENTUCBwZXJtaXRzIENsZXJrJ3MgSlMvd29ya2VyL25ldHdvcmsgcmVxdWVzdHMgZm9yIHRoZVxuLy8gY29uZmlndXJlZCBpbnN0YW5jZS5cbmZ1bmN0aW9uIHNlY3VyaXR5SGVhZGVycygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBuYW1lOiAnc2VjdXJpdHktaGVhZGVycycsXG4gICAgICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAgICAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoKHJlcSwgcmVzLCBuZXh0KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdXJsID0gcmVxLnVybCB8fCAnJztcbiAgICAgICAgICAgICAgICBpZiAodXJsLnN0YXJ0c1dpdGgoJy9haS12ZngnKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV4dCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBDb250ZW50IFNlY3VyaXR5IFBvbGljeVxuICAgICAgICAgICAgICAgIC8vIE5PVEU6IGBzY3JpcHQtc3JjYCBtdXN0IGFsbG93IFZpdGUncyBSZWFjdCBSZWZyZXNoIHByZWFtYmxlLCB3aGljaFxuICAgICAgICAgICAgICAgIC8vIGlzIGluamVjdGVkIGFzIGFuIElOTElORSA8c2NyaXB0PiBpbiBkZXYuIFdpdGhvdXQgdGhlIHByZWFtYmxlJ3NcbiAgICAgICAgICAgICAgICAvLyBoYXNoIHRoZSBDU1AgYmxvY2tzIGl0LCBgd2luZG93Ll9fdml0ZV9wbHVnaW5fcmVhY3RfcHJlYW1ibGVfaW5zdGFsbGVkX19gXG4gICAgICAgICAgICAgICAgLy8gaXMgbmV2ZXIgc2V0LCBhbmQgZXZlcnkgLmpzeCBtb2R1bGUgZmFpbHMgd2l0aFxuICAgICAgICAgICAgICAgIC8vIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3QgY2FuJ3QgZGV0ZWN0IHByZWFtYmxlXCIuIFRoZSBzaGEyNTYgYmVsb3cgaXMgdGhlXG4gICAgICAgICAgICAgICAgLy8gc3RhYmxlIGhhc2ggb2YgdGhhdCBwcmVhbWJsZSBmb3IgQHZpdGVqcy9wbHVnaW4tcmVhY3QuXG4gICAgICAgICAgICAgICAgY29uc3QgcmVhY3RQcmVhbWJsZUhhc2ggPSBcIidzaGEyNTYtWjIvaUZ6aDlWTWxWa0VPYXIxZi9vU0hXd1FrM3ZlMXFrL0MyV2RzQzRYaz0nXCI7XG5cbiAgICAgICAgICAgICAgICAvLyBjbGVya0hvc3RTcmMgaXMgZGVyaXZlZCBmcm9tIFZJVEVfQ0xFUktfUFVCTElTSEFCTEVfS0VZIGF0IHRoZVxuICAgICAgICAgICAgICAgIC8vIGV4cG9ydCBiZWxvdyBhbmQgaW5qZWN0ZWQgaGVyZSBzbyB0aGUgZGV2IENTUCBwZXJtaXRzIENsZXJrJ3NcbiAgICAgICAgICAgICAgICAvLyBKUy93b3JrZXIvbmV0d29yayByZXF1ZXN0cyBmb3Igd2hpY2hldmVyIGluc3RhbmNlIGlzIGNvbmZpZ3VyZWRcbiAgICAgICAgICAgICAgICAvLyAoZS5nLiB0b3VjaGVkLXN0dWQtNzQuY2xlcmsuYWNjb3VudHMuZGV2IGZvciB0aGUgZGV2IGluc3RhbmNlKSxcbiAgICAgICAgICAgICAgICAvLyB3aGlsZSBzdGlsbCBhbGxvd2luZyB0aGUgcHJvZHVjdGlvbiBwcm94eSBkb21haW4gY2xlcmsuc21hcnR2aWQuYXBwLlxuXG4gICAgICAgICAgICAgICAgY29uc3QgaXNQcm9kdWN0aW9uID0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdwcm9kdWN0aW9uJztcbiAgICAgICAgICAgICAgICBjb25zdCBkZXZDb25uZWN0U3JjID0gIWlzUHJvZHVjdGlvbiA/ICcgaHR0cDovL2xvY2FsaG9zdDo1MTczIHdzOi8vbG9jYWxob3N0OjUxNzMgaHR0cDovL2xvY2FsaG9zdDozMDAwJyA6ICcnO1xuICAgICAgICAgICAgICAgIGNvbnN0IGRldkZyYW1lU3JjID0gIWlzUHJvZHVjdGlvbiA/ICcgaHR0cDovL2xvY2FsaG9zdDo1MTczIGh0dHA6Ly9sb2NhbGhvc3Q6MzAwMCBodHRwczovL2FpLXZmeC5zbWFydHZpZC5hcHAnIDogJyc7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBjc3AgPSBbXG4gICAgICAgICAgICAgICAgICBcImRlZmF1bHQtc3JjICdzZWxmJ1wiLFxuICAgICAgICAgICAgICAgICAgYHNjcmlwdC1zcmMgJ3NlbGYnICR7cmVhY3RQcmVhbWJsZUhhc2h9JHtjbGVya0hvc3RTcmN9IGh0dHBzOi8vY2xlcmsuc21hcnR2aWQuYXBwIGh0dHBzOi8vY2hhbGxlbmdlcy5jbG91ZGZsYXJlLmNvbSBibG9iOmAsXG4gICAgICAgICAgICAgICAgICBgd29ya2VyLXNyYyAnc2VsZicgYmxvYjoke2NsZXJrSG9zdFNyY30gaHR0cHM6Ly9jbGVyay5zbWFydHZpZC5hcHBgLFxuICAgICAgICAgICAgICAgICAgYHN0eWxlLXNyYyAnc2VsZicgJ3Vuc2FmZS1pbmxpbmUnIGh0dHBzOi8vZm9udHMuZ29vZ2xlYXBpcy5jb20gaHR0cHM6Ly9mb250cy5nc3RhdGljLmNvbSR7Y2xlcmtIb3N0U3JjfWAsXG4gICAgICAgICAgICAgICAgICBgaW1nLXNyYyAnc2VsZicgZGF0YTogaHR0cHM6IGJsb2I6JHtjbGVya0hvc3RTcmN9YCxcbiAgICAgICAgICAgICAgICAgIGBmb250LXNyYyAnc2VsZicgZGF0YToke2NsZXJrSG9zdFNyY31gLFxuICAgICAgICAgICAgICAgICAgXCJjb25uZWN0LXNyYyAnc2VsZicgd3M6Ly9sb2NhbGhvc3Q6MzAwMSBodHRwOi8vbG9jYWxob3N0OjMwMDEgd3M6Ly9sb2NhbGhvc3Q6ODAwMCBodHRwOi8vbG9jYWxob3N0OjgwMDAgd3M6Ly9sb2NhbGhvc3Q6ODg4OCBodHRwOi8vbG9jYWxob3N0Ojg4ODggaHR0cHM6Ly8qLnN1cGFiYXNlLmNvIFwiICsgKHByb2Nlc3MuZW52LlZJVEVfTVVBUElfVVJMIHx8ICdodHRwczovL2FwaS5tdWFwaS5haScpICsgXCIgaHR0cHM6Ly9hcGkub3BlbmFpLmNvbSBodHRwczovL2FwaS5tdWFwaS5haSBodHRwczovL2NsZXJrLnNtYXJ0dmlkLmFwcCBodHRwczovL2NsZXJrLXRlbGVtZXRyeS5jb20gaHR0cHM6Ly9jaGFsbGVuZ2VzLmNsb3VkZmxhcmUuY29tIGh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbVwiICsgY2xlcmtIb3N0U3JjLFxuICAgICAgICAgICAgICAgICAgYGZyYW1lLXNyYyAnc2VsZicke2NsZXJrSG9zdFNyY30gaHR0cHM6Ly9jbGVyay5zbWFydHZpZC5hcHAgaHR0cHM6Ly9jaGFsbGVuZ2VzLmNsb3VkZmxhcmUuY29tIGh0dHA6Ly9sb2NhbGhvc3Q6NTE3MyBodHRwOi8vbG9jYWxob3N0OjMwMDAgaHR0cDovL2xvY2FsaG9zdDo1MTk5IGh0dHBzOi8vYWktdmZ4LnNtYXJ0dmlkLmFwcCBodHRwczovL3ZpZGVvLWFnZW50LnNtYXJ0dmlkLmFwcGAsXG4gICAgICAgICAgICAgICAgICBcIm1lZGlhLXNyYyAnc2VsZicgaHR0cHM6IGJsb2I6XCIsXG4gICAgICAgICAgICAgICAgXS5qb2luKCc7ICcpO1xuICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtU2VjdXJpdHktUG9saWN5JywgY3NwKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgLy8gUHJldmVudCBjbGlja2phY2tpbmdcbiAgICAgICAgICAgICAgICAgLy8gSW4gZGV2LCBhbGxvdyBmcmFtaW5nIGZvciBlbWJlZGRlZCBzdHVkaW8gaWZyYW1lcyB2aWEgQ1NQIGZyYW1lLXNyYy5cbiAgICAgICAgICAgICAgICAgLy8gUHJvZHVjdGlvbiBzaG91bGQgcmVjb25zaWRlciB0aGlzIGJhc2VkIG9uIGFjdHVhbCBmcmFtaW5nIG5lZWRzLlxuICAgICAgICAgICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgIHJlcy5yZW1vdmVIZWFkZXIoJ1gtRnJhbWUtT3B0aW9ucycpO1xuICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ1gtRnJhbWUtT3B0aW9ucycsICdTQU1FT1JJR0lOJyk7XG4gICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBQcmV2ZW50IE1JTUUgdHlwZSBzbmlmZmluZ1xuICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ1gtQ29udGVudC1UeXBlLU9wdGlvbnMnLCAnbm9zbmlmZicpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIEVuYWJsZSBYU1MgZmlsdGVyXG4gICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignWC1YU1MtUHJvdGVjdGlvbicsICcxOyBtb2RlPWJsb2NrJyk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gUmVmZXJyZXIgUG9saWN5XG4gICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignUmVmZXJyZXItUG9saWN5JywgJ3N0cmljdC1vcmlnaW4td2hlbi1jcm9zcy1vcmlnaW4nKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBQZXJtaXNzaW9ucyBQb2xpY3lcbiAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKFxuICAgICAgICAgICAgICAgICAgICAnUGVybWlzc2lvbnMtUG9saWN5JyxcbiAgICAgICAgICAgICAgICAgICAgJ2NhbWVyYT0oKSwgbWljcm9waG9uZT0oKSdcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcbn1cblxuLy8gUmVzb2x2ZSB0aGUgcHJvamVjdCByb290IGZvciB1c2UgYnkgcGx1Z2lucyBiZWxvd1xuY29uc3QgUFJPSkVDVF9ST09UID0gX19kaXJuYW1lO1xuXG4vKipcbiAqIGd0bUJvb3N0RGV2UGx1Z2luIFx1MjAxNCBydW5zIGluIGRldiAodml0ZSBkZXYpIHRvIHNlcnZlIC9hcGkvZ3RtLWJvb3N0LypcbiAqIGZyb20gdGhlIGxvY2FsIGJhY2tlbmQgc2VydmljZSBtb2R1bGUuIFRoZSBFeHByZXNzIHNlcnZlciBvbiA6MzAwMVxuICogaXMgbm90IGFsd2F5cyBydW5uaW5nIGluIGRldiwgc28gbW91bnRpbmcgdGhlIHNlcnZpY2UgYXMgYSBWaXRlXG4gKiBtaWRkbGV3YXJlIGtlZXBzIHRoZSB0ZW1wbGF0ZS1jcmVhdGlvbiBmbG93IHdvcmtpbmcgd2l0aG91dCBhXG4gKiBydW5uaW5nIGJhY2tlbmQgcHJvY2Vzcy4gTWlycm9ycyB0aGUgcHJvZHVjdGlvbiBiZWhhdmlvciB3aGVyZSB0aGVcbiAqIHNlcnZpY2UgcnVucyBvbiB0aGUgRXhwcmVzcyBzZXJ2ZXIuXG4gKlxuICogRW5kcG9pbnRzIHNlcnZlZDpcbiAqICAgR0VUICAvYXBpL2d0bS1ib29zdC9vcHRpb25zXG4gKiAgIFBPU1QgL2FwaS9ndG0tYm9vc3QvdGVtcGxhdGUtY29udGV4dFxuICogICBQT1NUIC9hcGkvZ3RtLWJvb3N0L2dlbmVyYXRlXG4gKi9cbmZ1bmN0aW9uIGd0bUJvb3N0RGV2UGx1Z2luKCkge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdndG0tYm9vc3QtZGV2JyxcbiAgICBhcHBseTogJ3NlcnZlJyxcbiAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICAvLyBMYXp5IGltcG9ydCB0aGUgc2VydmljZSBzbyBWaXRlJ3MgQ0pTL0VTTSBoYW5kbGluZyBkb2Vzbid0IGNob2tlXG4gICAgICAvLyBvbiB0aGUgRXhwcmVzcyBkZXBlbmRlbmN5IGF0IHBsdWdpbi1sb2FkIHRpbWUuXG4gICAgICBsZXQgc2VydmljZU1vZCA9IG51bGw7XG4gICAgICBjb25zdCBnZXRTZXJ2aWNlID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICBpZiAoc2VydmljZU1vZCkgcmV0dXJuIHNlcnZpY2VNb2Q7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgLy8gVXNlIGEgdmFyaWFibGUgZm9yIHRoZSBpbXBvcnQgcGF0aCBzbyBWaXRlJ3Mgc3RhdGljIG1vZHVsZVxuICAgICAgICAgIC8vIHNjYW5uZXIgY2Fubm90IHByZS1yZXNvbHZlIHRoaXMgYmFja2VuZCBzZXJ2aWNlIChhbmQgaXRzXG4gICAgICAgICAgLy8gZXhwcmVzcyBkZXBlbmRlbmN5KSBkdXJpbmcgcHJvZHVjdGlvbiBidWlsZHMuXG4gICAgICAgICAgY29uc3Qgc2VydmljZVBhdGggPSAnLi9iYWNrZW5kL3NlcnZpY2VzL2d0bUJvb3N0U2VydmljZS5qcyc7XG4gICAgICAgICAgc2VydmljZU1vZCA9IGF3YWl0IGltcG9ydChzZXJ2aWNlUGF0aCk7XG4gICAgICAgICAgcmV0dXJuIHNlcnZpY2VNb2Q7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oJ1tndG0tYm9vc3QtZGV2XSBGYWlsZWQgdG8gbG9hZCBzZXJ2aWNlOicsIGUubWVzc2FnZSk7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIC8vIEhlbHBlcjogcmVhZCB0aGUgcmVxdWVzdCBib2R5IGFzIGEgVVRGLTggc3RyaW5nLlxuICAgICAgY29uc3QgcmVhZEJvZHkgPSAocmVxKSA9PiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICBjb25zdCBjaHVua3MgPSBbXTtcbiAgICAgICAgcmVxLm9uKCdkYXRhJywgKGMpID0+IGNodW5rcy5wdXNoKGMpKTtcbiAgICAgICAgcmVxLm9uKCdlbmQnLCAoKSA9PiByZXNvbHZlKEJ1ZmZlci5jb25jYXQoY2h1bmtzKS50b1N0cmluZygndXRmLTgnKSkpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIEhlbHBlcjogc2VuZCBhIEpTT04gcmVzcG9uc2UuXG4gICAgICBjb25zdCBzZW5kSnNvbiA9IChyZXMsIHN0YXR1cywgb2JqKSA9PiB7XG4gICAgICAgIGlmIChyZXMuaGVhZGVyc1NlbnQpIHJldHVybjtcbiAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSBzdGF0dXM7XG4gICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkob2JqKSk7XG4gICAgICB9O1xuXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKCcvYXBpL2d0bS1ib29zdCcsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICBjb25zdCBtb2QgPSBhd2FpdCBnZXRTZXJ2aWNlKCk7XG4gICAgICAgIGlmICghbW9kKSB7XG4gICAgICAgICAgc2VuZEpzb24ocmVzLCA1MDAsIHsgZXJyb3I6ICdndG0tYm9vc3Qgc2VydmljZSB1bmF2YWlsYWJsZScgfSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cblxuICAgICAgICAvLyBWaXRlL0Nvbm5lY3Qgc3RyaXBzIHRoZSBtb3VudCBwcmVmaXggZnJvbSByZXEudXJsIGJlZm9yZSBvdXJcbiAgICAgICAgLy8gaGFuZGxlciBydW5zLCBzbyByZXEudXJsIGlzIGFscmVhZHkgdGhlIHJlbGF0aXZlIHBhdGhcbiAgICAgICAgLy8gKGUuZy4gXCIvb3B0aW9uc1wiLCBcIi9nZW5lcmF0ZVwiLCBcIi90ZW1wbGF0ZS1jb250ZXh0XCIpLlxuICAgICAgICBjb25zdCB1cmwgPSByZXEudXJsIHx8ICcvJztcbiAgICAgICAgY29uc3QgcXVlcnlJZHggPSB1cmwuaW5kZXhPZignPycpO1xuICAgICAgICBjb25zdCBwYXRoID0gcXVlcnlJZHggPj0gMCA/IHVybC5zbGljZSgwLCBxdWVyeUlkeCkgOiB1cmw7XG4gICAgICAgIGNvbnN0IHF1ZXJ5UGFydCA9IHF1ZXJ5SWR4ID49IDAgPyB1cmwuc2xpY2UocXVlcnlJZHggKyAxKSA6ICcnO1xuICAgICAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHF1ZXJ5UGFydCk7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAvLyBHRVQgL2FwaS9ndG0tYm9vc3Qvb3B0aW9uc1xuICAgICAgICAgIGlmIChyZXEubWV0aG9kID09PSAnR0VUJyAmJiBwYXRoID09PSAnL29wdGlvbnMnKSB7XG4gICAgICAgICAgICAvLyBSZXR1cm4gdGhlIGZ1bGwgbGlicmFyeSBpbmxpbmUgc28gd2UgZG9uJ3QgbmVlZCB0byBtb3VudFxuICAgICAgICAgICAgLy8gRXhwcmVzcyAod2hpY2ggaXNuJ3QgYXZhaWxhYmxlIGluIHRoZSBWaXRlIGRldiBwcm9jZXNzKS5cbiAgICAgICAgICAgIHNlbmRKc29uKHJlcywgMjAwLCB7XG4gICAgICAgICAgICAgIHJvbGVzOiBbXG4gICAgICAgICAgICAgICAgeyBpZDogJ3NkcicsIHRpdGxlOiAnU0RSL0JEUiBQcm9zcGVjdGluZycsIGRlc2NyaXB0aW9uOiAnU2FsZXMgRGV2ZWxvcG1lbnQgUmVwcmVzZW50YXRpdmUgLyBCdXNpbmVzcyBEZXZlbG9wbWVudCBSZXByZXNlbnRhdGl2ZSBjb250ZW50IGZvciBjb2xkIG91dHJlYWNoIGFuZCBsZWFkIHF1YWxpZmljYXRpb24nLCBvYmplY3RpdmVzOiBbJ0dlbmVyYXRlIHF1YWxpZmllZCBsZWFkcycsICdDcmVhdGUgcGlwZWxpbmUgb3Bwb3J0dW5pdGllcycsICdFc3RhYmxpc2ggaW5pdGlhbCBjb250YWN0IGFuZCBpbnRlcmVzdCddLCBwcmltYXJ5S1BJOiAnbWVldGluZyBib29raW5ncycgfSxcbiAgICAgICAgICAgICAgICB7IGlkOiAnYWUnLCB0aXRsZTogJ0FjY291bnQgRXhlY3V0aXZlIERpc2NvdmVyeScsIGRlc2NyaXB0aW9uOiAnQWNjb3VudCBFeGVjdXRpdmUgY29udGVudCBmb3IgcXVhbGlmaWVkIHByb3NwZWN0cywgZGlzY292ZXJ5LCBhbmQgdmFsdWUgZGVtb25zdHJhdGlvbicsIG9iamVjdGl2ZXM6IFsnQWR2YW5jZSBxdWFsaWZpZWQgb3Bwb3J0dW5pdGllcycsICdEZW1vbnN0cmF0ZSBST0kgYW5kIGJ1c2luZXNzIHZhbHVlJywgJ0hhbmRsZSBvYmplY3Rpb25zIGFuZCBjb25jZXJucyddLCBwcmltYXJ5S1BJOiAnZGVhbCBwcm9ncmVzc2lvbicgfSxcbiAgICAgICAgICAgICAgICB7IGlkOiAnc2FsZXMtbWFuYWdlcicsIHRpdGxlOiAnU2FsZXMgTWFuYWdlbWVudCcsIGRlc2NyaXB0aW9uOiAnU2FsZXMgbGVhZGVyc2hpcCBjb250ZW50IGZvciB0ZWFtIGVuYWJsZW1lbnQgYW5kIHBpcGVsaW5lIG1hbmFnZW1lbnQnLCBvYmplY3RpdmVzOiBbJ0FjY2VsZXJhdGUgdGVhbSBwZXJmb3JtYW5jZScsICdCdWlsZCBtYW5hZ2VtZW50IGNyZWRpYmlsaXR5JywgJ0RyaXZlIHJldmVudWUgZ3Jvd3RoJ10sIHByaW1hcnlLUEk6ICd0ZWFtIHF1b3RhIGF0dGFpbm1lbnQnIH0sXG4gICAgICAgICAgICAgICAgeyBpZDogJ3Jldm9wcycsIHRpdGxlOiAnUmV2ZW51ZSBPcGVyYXRpb25zJywgZGVzY3JpcHRpb246ICdSZXZlbnVlIE9wZXJhdGlvbnMgY29udGVudCBmb3IgcHJvY2VzcyBvcHRpbWl6YXRpb24gYW5kIGRhdGEtZHJpdmVuIGluc2lnaHRzJywgb2JqZWN0aXZlczogWydJbXByb3ZlIG9wZXJhdGlvbmFsIGVmZmljaWVuY3knLCAnRW5oYW5jZSBkYXRhIGFjY3VyYWN5IGFuZCBpbnNpZ2h0cycsICdPcHRpbWl6ZSBzYWxlcyBwcm9jZXNzZXMgYW5kIGF1dG9tYXRpb24nXSwgcHJpbWFyeUtQSTogJ29wZXJhdGlvbmFsIGVmZmljaWVuY3kgZ2FpbnMnIH0sXG4gICAgICAgICAgICAgICAgeyBpZDogJ2NzbScsIHRpdGxlOiAnQ3VzdG9tZXIgU3VjY2VzcycsIGRlc2NyaXB0aW9uOiAnQ3VzdG9tZXIgU3VjY2VzcyBNYW5hZ2VtZW50IGNvbnRlbnQgZm9yIHJldGVudGlvbiBhbmQgZXhwYW5zaW9uJywgb2JqZWN0aXZlczogWydSZWR1Y2UgY3VzdG9tZXIgY2h1cm4nLCAnSWRlbnRpZnkgZXhwYW5zaW9uIG9wcG9ydHVuaXRpZXMnLCAnQnVpbGQgbG9uZy10ZXJtIGN1c3RvbWVyIGxveWFsdHknXSwgcHJpbWFyeUtQSTogJ2N1c3RvbWVyIHJldGVudGlvbiBhbmQgZXhwYW5zaW9uJyB9LFxuICAgICAgICAgICAgICAgIHsgaWQ6ICdmb3VuZGVyJywgdGl0bGU6ICdFeGVjdXRpdmUgTGVhZGVyc2hpcCcsIGRlc2NyaXB0aW9uOiAnRm91bmRlciBhbmQgZXhlY3V0aXZlIGNvbnRlbnQgZm9yIHN0cmF0ZWdpYyBwYXJ0bmVyc2hpcHMgYW5kIHZpc2lvbiBjb21tdW5pY2F0aW9uJywgb2JqZWN0aXZlczogWydCdWlsZCBzdHJhdGVnaWMgcmVsYXRpb25zaGlwcycsICdDb21tdW5pY2F0ZSBjb21wYW55IHZpc2lvbicsICdEcml2ZSBleGVjdXRpdmUtbGV2ZWwgZW5nYWdlbWVudCddLCBwcmltYXJ5S1BJOiAnc3RyYXRlZ2ljIHBhcnRuZXJzaGlwIGRldmVsb3BtZW50JyB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICBpbmR1c3RyaWVzOiBbXG4gICAgICAgICAgICAgICAgeyBpZDogJ3NhYXMnLCBuYW1lOiAnU2FhUycsIGRlc2NyaXB0aW9uOiAnU29mdHdhcmUgYXMgYSBTZXJ2aWNlIHNvbHV0aW9ucyBhbmQgc3Vic2NyaXB0aW9uLWJhc2VkIGJ1c2luZXNzIG1vZGVscycgfSxcbiAgICAgICAgICAgICAgICB7IGlkOiAnZmludGVjaCcsIG5hbWU6ICdGaW5UZWNoJywgZGVzY3JpcHRpb246ICdGaW5hbmNpYWwgdGVjaG5vbG9neSBhbmQgcGF5bWVudCBwcm9jZXNzaW5nIHNvbHV0aW9ucycgfSxcbiAgICAgICAgICAgICAgICB7IGlkOiAnaGVhbHRoY2FyZScsIG5hbWU6ICdIZWFsdGhjYXJlJywgZGVzY3JpcHRpb246ICdIZWFsdGhjYXJlIHRlY2hub2xvZ3kgYW5kIHBhdGllbnQgY2FyZSBzb2x1dGlvbnMnIH0sXG4gICAgICAgICAgICAgICAgeyBpZDogJ21hbnVmYWN0dXJpbmcnLCBuYW1lOiAnTWFudWZhY3R1cmluZycsIGRlc2NyaXB0aW9uOiAnTWFudWZhY3R1cmluZyBhbmQgaW5kdXN0cmlhbCBvcGVyYXRpb25zIHNvbHV0aW9ucycgfSxcbiAgICAgICAgICAgICAgICB7IGlkOiAncHJvZmVzc2lvbmFsLXNlcnZpY2VzJywgbmFtZTogJ1Byb2Zlc3Npb25hbCBTZXJ2aWNlcycsIGRlc2NyaXB0aW9uOiAnQ29uc3VsdGluZywgYWR2aXNvcnksIGFuZCBwcm9mZXNzaW9uYWwgc2VydmljZSBmaXJtcycgfSxcbiAgICAgICAgICAgICAgICB7IGlkOiAnZWNvbW1lcmNlJywgbmFtZTogJ0UtY29tbWVyY2UnLCBkZXNjcmlwdGlvbjogJ09ubGluZSByZXRhaWwgYW5kIERUQyBicmFuZHMgc2VsbGluZyB0aHJvdWdoIHZpc3VhbCBzdG9yZWZyb250cycgfSxcbiAgICAgICAgICAgICAgICB7IGlkOiAncmVhbC1lc3RhdGUnLCBuYW1lOiAnUmVhbCBFc3RhdGUnLCBkZXNjcmlwdGlvbjogJ1Jlc2lkZW50aWFsLCBjb21tZXJjaWFsLCBhbmQgcHJvcHRlY2ggc2VsbGluZyB2aWEgcHJvcGVydHkgdmlzdWFscycgfSxcbiAgICAgICAgICAgICAgICB7IGlkOiAnZWR1Y2F0aW9uJywgbmFtZTogJ0VkdWNhdGlvbicsIGRlc2NyaXB0aW9uOiAnRWRUZWNoLCB1bml2ZXJzaXRpZXMsIGFuZCB0cmFpbmluZyBvcmdzIHNlbGxpbmcgbGVhcm5pbmcgb3V0Y29tZXMnIH0sXG4gICAgICAgICAgICAgICAgeyBpZDogJ2xvZ2lzdGljcycsIG5hbWU6ICdMb2dpc3RpY3MgJiBTdXBwbHkgQ2hhaW4nLCBkZXNjcmlwdGlvbjogJ0ZyZWlnaHQsIHdhcmVob3VzaW5nLCBhbmQgc3VwcGx5LWNoYWluIHNvZnR3YXJlIGFuZCBzZXJ2aWNlcycgfSxcbiAgICAgICAgICAgICAgICB7IGlkOiAncmV0YWlsJywgbmFtZTogJ1JldGFpbCAmIENQRycsIGRlc2NyaXB0aW9uOiAnQnJpY2stYW5kLW1vcnRhciBhbmQgY29uc3VtZXItcGFja2FnZWQtZ29vZHMgYnJhbmQgbWFya2V0aW5nJyB9LFxuICAgICAgICAgICAgICAgIHsgaWQ6ICdtZWRpYScsIG5hbWU6ICdNZWRpYSAmIEVudGVydGFpbm1lbnQnLCBkZXNjcmlwdGlvbjogJ1N0cmVhbWluZywgcHVibGlzaGluZywgYW5kIHN0dWRpb3Mgc2VsbGluZyBhdWRpZW5jZSBhdHRlbnRpb24nIH0sXG4gICAgICAgICAgICAgICAgeyBpZDogJ2xlZ2FsJywgbmFtZTogJ0xlZ2FsICYgQ29tcGxpYW5jZScsIGRlc2NyaXB0aW9uOiAnTGF3IGZpcm1zIGFuZCBsZWdhbC10ZWNoIHNlbGxpbmcgdHJ1c3QgYW5kIGV4cGVydGlzZScgfSxcbiAgICAgICAgICAgICAgICB7IGlkOiAndGVsZWNvbScsIG5hbWU6ICdUZWxlY29tICYgQ29ubmVjdGl2aXR5JywgZGVzY3JpcHRpb246ICdDb25uZWN0aXZpdHksIGJyb2FkYmFuZCwgYW5kIGNvbW11bmljYXRpb25zIHByb3ZpZGVycycgfSxcbiAgICAgICAgICAgICAgICB7IGlkOiAnZW5lcmd5JywgbmFtZTogJ0VuZXJneSAmIENsZWFuIFRlY2gnLCBkZXNjcmlwdGlvbjogJ1JlbmV3YWJsZXMsIHV0aWxpdGllcywgYW5kIGNsaW1hdGUtdGVjaCBzZWxsaW5nIHRyYW5zZm9ybWF0aW9uJyB9LFxuICAgICAgICAgICAgICAgIHsgaWQ6ICdub25wcm9maXQnLCBuYW1lOiAnTm9ucHJvZml0ICYgTWlzc2lvbi1Ecml2ZW4nLCBkZXNjcmlwdGlvbjogJ0NoYXJpdGllcyBhbmQgbWlzc2lvbiBvcmdzIGRyaXZpbmcgZG9uYXRpb25zIGFuZCBhd2FyZW5lc3MnIH0sXG4gICAgICAgICAgICAgICAgeyBpZDogJ2dvdmVybm1lbnQnLCBuYW1lOiAnR292ZXJubWVudCAmIFB1YmxpYyBTZWN0b3InLCBkZXNjcmlwdGlvbjogJ1B1YmxpYyBhZ2VuY2llcyBhbmQgZ292dGVjaCBzZWxsaW5nIHByb2dyYW1zIGFuZCBzZXJ2aWNlcycgfSxcbiAgICAgICAgICAgICAgICB7IGlkOiAnaW5zdXJhbmNlJywgbmFtZTogJ0luc3VyYW5jZScsIGRlc2NyaXB0aW9uOiAnQ2FycmllcnMsIGJyb2tlcnMsIGFuZCBpbnN1cnRlY2ggc2VsbGluZyBwcm90ZWN0aW9uIGFuZCBwZWFjZSBvZiBtaW5kJyB9LFxuICAgICAgICAgICAgICAgIHsgaWQ6ICdhdXRvbW90aXZlJywgbmFtZTogJ0F1dG9tb3RpdmUgJiBNb2JpbGl0eScsIGRlc2NyaXB0aW9uOiAnRGVhbGVycywgT0VNcywgYW5kIG1vYmlsaXR5IHRlY2ggc2VsbGluZyB2ZWhpY2xlcyBhbmQgZXhwZXJpZW5jZXMnIH0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIG1ldGhvZG9sb2dpZXM6IFtcbiAgICAgICAgICAgICAgICB7IGlkOiAnbWVkZHBpY2MnLCBuYW1lOiAnTUVERFBJQ0MnLCBmdWxsTmFtZTogJ01ldHJpY3MsIEVjb25vbWljIEJ1eWVyLCBEZWNpc2lvbiBDcml0ZXJpYSwgRGVjaXNpb24gUHJvY2VzcywgUGFwZXIgUHJvY2VzcywgSWRlbnRpZnkgUGFpbiwgQ2hhbXBpb24sIENvbXBldGl0aW9uJywgZGVzY3JpcHRpb246ICdFbnRlcnByaXNlIHNhbGVzIHF1YWxpZmljYXRpb24gZnJhbWV3b3JrIGZvciBjb21wbGV4IEIyQiBzYWxlcycsIGFwcGxpY2F0aW9uOiAnQXBwbHkgc3lzdGVtYXRpY2FsbHkgdG8gdW5kZXJzdGFuZCBhbmQgbmF2aWdhdGUgZW50ZXJwcmlzZSBidXlpbmcgcHJvY2Vzc2VzJyB9LFxuICAgICAgICAgICAgICAgIHsgaWQ6ICdzcGluJywgbmFtZTogJ1NQSU4gU2VsbGluZycsIGZ1bGxOYW1lOiAnU2l0dWF0aW9uLCBQcm9ibGVtLCBJbXBsaWNhdGlvbiwgTmVlZC1wYXlvZmYnLCBkZXNjcmlwdGlvbjogJ0NvbnN1bHRhdGl2ZSBzZWxsaW5nIGZyYW1ld29yayBmb3IgY29tcGxleCBzb2x1dGlvbnMnLCBhcHBsaWNhdGlvbjogJ1Byb2dyZXNzIGNvbnZlcnNhdGlvbnMgZnJvbSBjdXJyZW50IHN0YXRlIHRvIHNvbHV0aW9uIHZhbHVlJyB9LFxuICAgICAgICAgICAgICAgIHsgaWQ6ICdjaGFsbGVuZ2VyJywgbmFtZTogJ0NoYWxsZW5nZXIgU2FsZScsIGZ1bGxOYW1lOiAnVGhlIENoYWxsZW5nZXIgU2FsZScsIGRlc2NyaXB0aW9uOiAnSW5zaWdodC1kcml2ZW4gc2FsZXMgYXBwcm9hY2ggdGhhdCBjaGFsbGVuZ2VzIGN1c3RvbWVyIGFzc3VtcHRpb25zJywgYXBwbGljYXRpb246ICdUZWFjaCBjdXN0b21lcnMsIHRhaWxvciBjb21tdW5pY2F0aW9ucywgYW5kIHRha2UgY29udHJvbCBvZiBzYWxlcyBjb252ZXJzYXRpb25zJyB9LFxuICAgICAgICAgICAgICAgIHsgaWQ6ICdnYXAtc2VsbGluZycsIG5hbWU6ICdHYXAgU2VsbGluZycsIGZ1bGxOYW1lOiAnR2FwIFNlbGxpbmcnLCBkZXNjcmlwdGlvbjogJ0ZyYW1ld29yayBmb2N1c2luZyBvbiB0aGUgZ2FwIGJldHdlZW4gY3VycmVudCBhbmQgZGVzaXJlZCBmdXR1cmUgc3RhdGUnLCBhcHBsaWNhdGlvbjogJ0lkZW50aWZ5IGdhcHMgYW5kIHBvc2l0aW9uIHNvbHV0aW9ucyBhcyBicmlkZ2VzIHRvIGRlc2lyZWQgb3V0Y29tZXMnIH0sXG4gICAgICAgICAgICAgICAgeyBpZDogJ3ZhbHVlLXNlbGxpbmcnLCBuYW1lOiAnVmFsdWUgU2VsbGluZycsIGZ1bGxOYW1lOiAnVmFsdWUtQmFzZWQgU2VsbGluZycsIGRlc2NyaXB0aW9uOiAnU2FsZXMgYXBwcm9hY2ggZm9jdXNlZCBvbiBxdWFudGlmaWFibGUgYnVzaW5lc3MgdmFsdWUgYW5kIFJPSScsIGFwcGxpY2F0aW9uOiAnRGVtb25zdHJhdGUgdGFuZ2libGUgYnVzaW5lc3MgaW1wYWN0IGFuZCBxdWFudGlmaWVkIHJlc3VsdHMnIH0sXG4gICAgICAgICAgICAgICAgeyBpZDogJ3NhbmRsZXInLCBuYW1lOiAnU2FuZGxlciBTZWxsaW5nJywgZnVsbE5hbWU6ICdTYW5kbGVyIFNlbGxpbmcgU3lzdGVtJywgZGVzY3JpcHRpb246ICdRdWFsaWZpY2F0aW9uLWZvY3VzZWQgc2FsZXMgcHJvY2VzcyB3aXRoIHBhaW4tYmFzZWQgc2VsbGluZycsIGFwcGxpY2F0aW9uOiAnUXVhbGlmeSBwcm9zcGVjdHMgYW5kIGZvY3VzIG9uIHBhaW4gcG9pbnRzIHRocm91Z2hvdXQgc2FsZXMgcHJvY2VzcycgfSxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgdG9uYWxpdGllczogW1xuICAgICAgICAgICAgICAgIHsgaWQ6ICdwcm9mZXNzaW9uYWwnLCBuYW1lOiAnUHJvZmVzc2lvbmFsJywgZGVzY3JpcHRpb246ICdDbGVhbiwgY3JlZGlibGUsIHBvbGlzaGVkIHRvbmUgZm9yIEIyQiBpbWFnZSBhbmQgdmlkZW8gY3JlYXRpdmUnLCBndWlkZWxpbmVzOiAnVXNlIGNsZWFyLCBjb25maWRlbnQgbGFuZ3VhZ2U7IHN0ZWFkeSBwYWNpbmc7IG5ldXRyYWwsIHdlbGwtbGl0IGZyYW1pbmc7IG1pbmltYWwgYnV0IHByZW1pdW0gc3R5bGluZycgfSxcbiAgICAgICAgICAgICAgICB7IGlkOiAnZXhlY3V0aXZlJywgbmFtZTogJ0V4ZWN1dGl2ZSBHcmF2aXRhcycsIGRlc2NyaXB0aW9uOiAnRm9ybWFsLCBhdXRob3JpdGF0aXZlIHRvbmUgd2l0aCBzdHJhdGVnaWMgaW5zaWdodHMgZm9yIGJvYXJkcm9vbS1sZXZlbCB2aWRlbycsIGd1aWRlbGluZXM6ICdTb3BoaXN0aWNhdGVkIHZvY2FidWxhcnksIGVtcGhhc2lzIG9uIHZpc2lvbi9sZWFkZXJzaGlwLCBzbG93IGRlbGliZXJhdGUgY3V0cywgY2luZW1hdGljIGVzdGFibGlzaGluZyBzaG90cycgfSxcbiAgICAgICAgICAgICAgICB7IGlkOiAnY2hhbGxlbmdlcicsIG5hbWU6ICdDaGFsbGVuZ2VyIEJvbGQnLCBkZXNjcmlwdGlvbjogJ0NvbmZpZGVudCwgYXNzZXJ0aXZlIHRvbmUgdGhhdCBjaGFsbGVuZ2VzIGFzc3VtcHRpb25zIGluIHB1bmNoeSB2aWRlbyBob29rcycsIGd1aWRlbGluZXM6ICdQcm92b2NhdGl2ZSBpbnNpZ2h0LWRyaXZlbiBjb3B5LCBoYXJkIGN1dHMsIGhpZ2gtY29udHJhc3QgdmlzdWFscywgYm9sZCB0eXBvZ3JhcGh5IG9uIHNjcmVlbicgfSxcbiAgICAgICAgICAgICAgICB7IGlkOiAnY29udmVyc2F0aW9uYWwnLCBuYW1lOiAnQ29udmVyc2F0aW9uYWwgUGVlcicsIGRlc2NyaXB0aW9uOiAnRnJpZW5kbHksIHJlbGF0YWJsZSB0b25lIGxpa2UgdGFsa2luZyB0byBhIHRydXN0ZWQgY29sbGVhZ3VlIG9uIGNhbWVyYScsIGd1aWRlbGluZXM6ICdVc2UgXCJ3ZVwiL1wieW91XCIsIGNhc3VhbCBmcmFtaW5nIChzZWxmaWUvZGVzayBzZXR1cCksIG5hdHVyYWwgbGlnaHRpbmcsIHJlbGF4ZWQgcGFjaW5nJyB9LFxuICAgICAgICAgICAgICAgIHsgaWQ6ICd0ZWNobmljYWwnLCBuYW1lOiAnVGVjaG5pY2FsIEV4cGVydCcsIGRlc2NyaXB0aW9uOiAnRGVlcCB0ZWNobmljYWwgY3JlZGliaWxpdHkgZm9yIGRlbW8taGVhdnkgcHJvZHVjdCB2aWRlb3MgYW5kIGV4cGxhaW5lciBpbWFnZXMnLCBndWlkZWxpbmVzOiAnSW5kdXN0cnkgdGVybWlub2xvZ3ksIHNjcmVlbi1yZWNvcmRlZCBVSSBkZW1vcywgZGlhZ3JhbSBvdmVybGF5cywgcHJlY2lzZSBsYWJlbGxpbmcnIH0sXG4gICAgICAgICAgICAgICAgeyBpZDogJ2luc3BpcmF0aW9uYWwnLCBuYW1lOiAnSW5zcGlyYXRpb25hbCBWaXNpb24nLCBkZXNjcmlwdGlvbjogJ0FzcGlyYXRpb25hbCB0b25lIHBhaW50aW5nIGEgZnV0dXJlIHZpc2lvbiBmb3IgYnJhbmQvbWFuaWZlc3RvIHZpZGVvJywgZ3VpZGVsaW5lczogJ0FzcGlyYXRpb25hbCBjb3B5LCBzd2VlcGluZyBiLXJvbGwsIHVwd2FyZCBjYW1lcmEgbW92ZXMsIHdhcm0gdXBsaWZ0aW5nIGNvbG9yIGdyYWRlJyB9LFxuICAgICAgICAgICAgICAgIHsgaWQ6ICd1cmdlbnQnLCBuYW1lOiAnVXJnZW50IEFjdGlvbicsIGRlc2NyaXB0aW9uOiAnVGltZS1zZW5zaXRpdmUsIGhpZ2gtZW5lcmd5IHRvbmUgZm9yIGxpbWl0ZWQtb2ZmZXIgcHJvbW8gdmlkZW8nLCBndWlkZWxpbmVzOiAnQWN0aW9uIHZlcmJzLCBjb3VudGRvd24gZ3JhcGhpY3MsIGZhc3QgcGFjaW5nLCB1cmdlbnQgc291bmQgZGVzaWduLCByZWQvYW1iZXIgYWNjZW50cycgfSxcbiAgICAgICAgICAgICAgICB7IGlkOiAnY2FzdWFsJywgbmFtZTogJ0Nhc3VhbCBQZWVyLXRvLVBlZXInLCBkZXNjcmlwdGlvbjogJ0xpZ2h0LCBpbmZvcm1hbCB0b25lIGZvciBzb2NpYWwtZmlyc3QgUmVlbHMvVGlrVG9rcyBhaW1lZCBhdCBHVE0gcGVlcnMnLCBndWlkZWxpbmVzOiAnU2xhbmctbGlnaHQsIHB1bmNoeSBvbmUtbGluZXJzLCB2ZXJ0aWNhbCA5OjE2IGZyYW1pbmcsIHRyZW5kaW5nIGF1ZGlvLCBxdWljayBjdXRzJyB9LFxuICAgICAgICAgICAgICAgIHsgaWQ6ICd3aXR0eScsIG5hbWU6ICdXaXR0eSAmIENsZXZlcicsIGRlc2NyaXB0aW9uOiAnSHVtb3JvdXMsIGNsZXZlciBjb3B5IGZvciBzY3JvbGwtc3RvcHBpbmcgc29jaWFsIHZpZGVvIGFuZCBtZW1lIGltYWdlcycsIGd1aWRlbGluZXM6ICdXb3JkcGxheSBhbmQgbGlnaHQgam9rZSBzZXR1cHMsIGNvbWVkaWMgdGltaW5nIGluIGVkaXRzLCBwbGF5ZnVsIGdyYXBoaWNzJyB9LFxuICAgICAgICAgICAgICAgIHsgaWQ6ICdlbXBhdGhldGljJywgbmFtZTogJ0VtcGF0aGV0aWMgJiBIdW1hbicsIGRlc2NyaXB0aW9uOiAnV2FybSwgdW5kZXJzdGFuZGluZyB0b25lIGZvciBjdXN0b21lci1zdG9yeSBhbmQgcmV0ZW50aW9uIHZpZGVvJywgZ3VpZGVsaW5lczogJ1ZhbGlkYXRpb24tZmlyc3QgY29weSwgcmVhbCBjdXN0b21lciBmYWNlcywgc29mdCBmb2N1cywgZ2VudGxlIHBhY2luZywgY2FsbSBzY29yZScgfSxcbiAgICAgICAgICAgICAgICB7IGlkOiAnZGF0YS1kcml2ZW4nLCBuYW1lOiAnRGF0YS1Ecml2ZW4nLCBkZXNjcmlwdGlvbjogJ051bWJlci1sZWQsIHByb29mLW9yaWVudGVkIHRvbmUgZm9yIFJPSS9yZXN1bHRzIHZpZGVvIGFuZCBzdGF0IGdyYXBoaWNzJywgZ3VpZGVsaW5lczogJ0xlYWQgd2l0aCBtZXRyaWNzLCBhbmltYXRlZCBiYXIvbGluZSBjaGFydHMsIGNsZWFuIGluZm9ncmFwaGljIHN0eWxpbmcsIGNvbmZpZGVudCBuYXJyYXRpb24nIH0sXG4gICAgICAgICAgICAgICAgeyBpZDogJ3N0b3J5dGVsbGluZycsIG5hbWU6ICdOYXJyYXRpdmUgU3Rvcnl0ZWxsaW5nJywgZGVzY3JpcHRpb246ICdUaHJlZS1hY3Qgc3Rvcnkgc3RydWN0dXJlIGZvciBjYXNlLXN0dWR5IGFuZCBmb3VuZGluZy1zdG9yeSB2aWRlbycsIGd1aWRlbGluZXM6ICdTZXR1cC1jb25mbGljdC1yZXNvbHV0aW9uIGFyYywgY2hhcmFjdGVyLWxlZCBiLXJvbGwsIGVtb3Rpb25hbCBtdXNpYyBzd2VsbCcgfSxcbiAgICAgICAgICAgICAgICB7IGlkOiAnYXV0aG9yaXRhdGl2ZScsIG5hbWU6ICdBdXRob3JpdGF0aXZlIEV4cGVydCcsIGRlc2NyaXB0aW9uOiAnQ29tbWFuZGluZywgY3JlZGVudGlhbGVkIHRvbmUgZm9yIHRob3VnaHQtbGVhZGVyc2hpcCB2aWRlbycsIGd1aWRlbGluZXM6ICdDaXRlIGZyYW1ld29ya3MgYW5kIHByb29mLCBzdGVhZHkgZXllLWNvbnRhY3QgZnJhbWluZywgbGlicmFyeS9vZmZpY2Ugc2V0dGluZ3MsIHNlcmlvdXMgZ3JhZGUnIH0sXG4gICAgICAgICAgICAgICAgeyBpZDogJ21pbmltYWxpc3QnLCBuYW1lOiAnTWluaW1hbGlzdCcsIGRlc2NyaXB0aW9uOiAnUmVzdHJhaW5lZCwgc2luZ2xlLW1lc3NhZ2UgdG9uZSBmb3IgY2xlYW4gcHJvZHVjdCBoZXJvIGltYWdlcyBhbmQgdmlkZW9zJywgZ3VpZGVsaW5lczogJ09uZSBpZGVhIHBlciBmcmFtZSwgbG90cyBvZiBuZWdhdGl2ZSBzcGFjZSwgbXV0ZWQgcGFsZXR0ZSwgc2xvdyBkZWxpYmVyYXRlIG1vdGlvbicgfSxcbiAgICAgICAgICAgICAgICB7IGlkOiAnbHV4dXJ5JywgbmFtZTogJ0x1eHVyeSAmIFByZW1pdW0nLCBkZXNjcmlwdGlvbjogJ0hpZ2gtZW5kLCBleGNsdXNpdmUgdG9uZSBmb3IgZW50ZXJwcmlzZS9BQk0gdmlkZW8gYW5kIGhlcm8gaW1hZ2VyeScsIGd1aWRlbGluZXM6ICdSaWNoIHRleHR1cmVzLCBzbG93IG1vdGlvbiwgZ29sZC9ibGFjayBwYWxldHRlLCBlbGVnYW50IHR5cG9ncmFwaHksIG5vIGhhcmQtc2VsbCcgfSxcbiAgICAgICAgICAgICAgICB7IGlkOiAncGxheWZ1bCcsIG5hbWU6ICdQbGF5ZnVsICYgRnVuJywgZGVzY3JpcHRpb246ICdCcmlnaHQsIGVuZXJnZXRpYyB0b25lIGZvciBjdWx0dXJlIGFuZCB0b3Atb2YtZnVubmVsIHNvY2lhbCB2aWRlbycsIGd1aWRlbGluZXM6ICdCcmlnaHQgcGFsZXR0ZSwgYm91bmN5IGVkaXRzLCBlbW9qaS1zdHlsZSBncmFwaGljcywgdXBiZWF0IHF1aXJreSBtdXNpYycgfSxcbiAgICAgICAgICAgICAgICB7IGlkOiAnYm9sZCcsIG5hbWU6ICdCb2xkICYgRGlzcnVwdGl2ZScsIGRlc2NyaXB0aW9uOiAnTG91ZCwgY2F0ZWdvcnktYnJlYWtpbmcgdG9uZSBmb3IgYnJhbmQtbGF1bmNoIHZpZGVvJywgZ3VpZGVsaW5lczogJ092ZXJzaXplZCB0eXBlLCBzYXR1cmF0ZWQgY29sb3IsIGZhc3QgYWdncmVzc2l2ZSBjdXRzLCBzdGF0ZW1lbnQgdm9pY2VvdmVyJyB9LFxuICAgICAgICAgICAgICAgIHsgaWQ6ICdlZHVjYXRpb25hbCcsIG5hbWU6ICdFZHVjYXRpb25hbCcsIGRlc2NyaXB0aW9uOiAnQ2xlYXIgdGVhY2hpbmcgdG9uZSBmb3IgaG93LXRvIGFuZCBleHBsYWluZXIgdmlkZW8vaW1hZ2UgY2Fyb3VzZWxzJywgZ3VpZGVsaW5lczogJ1N0ZXAtYnktc3RlcCBzdHJ1Y3R1cmUsIHBvaW50ZXIvYXJyb3cgb3ZlcmxheXMsIGNhbG0gbmFycmF0aW9uLCBjbGVhbiB3aGl0ZWJvYXJkIHN0eWxlJyB9LFxuICAgICAgICAgICAgICAgIHsgaWQ6ICd0cnVzdHdvcnRoeScsIG5hbWU6ICdUcnVzdHdvcnRoeSAmIFJlYXNzdXJpbmcnLCBkZXNjcmlwdGlvbjogJ0NhbG0sIGRlcGVuZGFibGUgdG9uZSBmb3Igc2VjdXJpdHkvY29tcGxpYW5jZSBhbmQgb25ib2FyZGluZyB2aWRlbycsIGd1aWRlbGluZXM6ICdQbGFpbiBsYW5ndWFnZSwgc3RlYWR5IHBhY2luZywgc29mdCBibHVlL2dyZWVuIHBhbGV0dGUsIHJlYWwtZW52aXJvbm1lbnQgc2hvdHMnIH0sXG4gICAgICAgICAgICAgICAgeyBpZDogJ2VuZXJnZXRpYycsIG5hbWU6ICdFbmVyZ2V0aWMgJiBVcGJlYXQnLCBkZXNjcmlwdGlvbjogJ0hpZ2gtdGVtcG8sIG1vdGl2YXRpbmcgdG9uZSBmb3IgZXZlbnQvbGF1bmNoIGh5cGUgdmlkZW8nLCBndWlkZWxpbmVzOiAnRmFzdCBjdXRzLCByaXNpbmcgdGVtcG8sIGJyaWdodCBjb2xvcnMsIGNyb3dkL2NvbmZldHRpIGVuZXJneSwgZHJpdmluZyBiZWF0JyB9LFxuICAgICAgICAgICAgICAgIHsgaWQ6ICdzb3BoaXN0aWNhdGVkJywgbmFtZTogJ1NvcGhpc3RpY2F0ZWQgJiBSZWZpbmVkJywgZGVzY3JpcHRpb246ICdVbmRlcnN0YXRlZCBlbGVnYW5jZSBmb3IgcHJlbWl1bSBCMkIgYnJhbmQgZmlsbXMnLCBndWlkZWxpbmVzOiAnU3VidGxlIG1vdGlvbiwgcmVmaW5lZCBwYWxldHRlLCBlbGVnYW50IHNlcmlmIHR5cGUsIHJlc3RyYWluZWQgbXVzaWMnIH0sXG4gICAgICAgICAgICAgICAgeyBpZDogJ2RpcmVjdCcsIG5hbWU6ICdEaXJlY3QgJiBOby1GbHVmZicsIGRlc2NyaXB0aW9uOiAnQmx1bnQsIGJlbmVmaXQtZmlyc3QgdG9uZSBmb3IgYm90dG9tLWZ1bm5lbCBjb252ZXJzaW9uIHZpZGVvJywgZ3VpZGVsaW5lczogJ0Zyb250LWxvYWQgdGhlIG9mZmVyLCBwbGFpbiB3b3JkcywgcHVuY2gtaW4gY3V0cywgY2xlYXIgQ1RBIGNhcmQnIH0sXG4gICAgICAgICAgICAgICAgeyBpZDogJ2ZyaWVuZGx5JywgbmFtZTogJ0ZyaWVuZGx5ICYgV2VsY29taW5nJywgZGVzY3JpcHRpb246ICdXYXJtIGludml0ZSB0b25lIGZvciB3ZWJpbmFyIGFuZCBjb21tdW5pdHkgb25ib2FyZGluZyB2aWRlbycsIGd1aWRlbGluZXM6ICdJbnZpdGluZyBjb3B5LCBvcGVuIGJvZHkgbGFuZ3VhZ2UsIGJyaWdodCBhaXJ5IHNldCwgZ2VudGxlIHVwbGlmdGluZyBtdXNpYycgfSxcbiAgICAgICAgICAgICAgICB7IGlkOiAnZHJhbWF0aWMnLCBuYW1lOiAnRHJhbWF0aWMgJiBDaW5lbWF0aWMnLCBkZXNjcmlwdGlvbjogJ0hpZ2gtc3Rha2VzLCBjaW5lbWF0aWMgdG9uZSBmb3IgaGVyby9icmFuZCBmaWxtJywgZ3VpZGVsaW5lczogJ0xvdy1rZXkgbGlnaHRpbmcsIG9yY2hlc3RyYWwgc3dlbGwsIHNsb3ctbW8gaGVybyBtb21lbnQsIGRlZXAgY29udHJhc3QgZ3JhZGUnIH0sXG4gICAgICAgICAgICAgICAgeyBpZDogJ3BlZXItY29tcGFyaXNvbicsIG5hbWU6ICdTb2NpYWwgUHJvb2YgLyBQZWVyIENvbXBhcmlzb24nLCBkZXNjcmlwdGlvbjogJ0NvbXBhcmlzb24tbGVkIHRvbmUgZm9yIGNvbXBldGl0aXZlLWRpc3BsYWNlbWVudCB2aWRlbycsIGd1aWRlbGluZXM6ICdTaG93IFwidGhlbSB2cyB5b3VcIiBzcGxpdCBzY3JlZW5zLCBiZW5jaG1hcmsgY2hhcnRzLCBjb25maWRlbnQgbmV1dHJhbCBuYXJyYXRpb24nIH0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIGZvY3VzQXJlYXM6IFtcbiAgICAgICAgICAgICAgICB7IGlkOiAnbGVhZC1nZW4nLCBsYWJlbDogJ0xlYWQgR2VuZXJhdGlvbicsIGRlc2NyaXB0aW9uOiAnTGVhZCBnZW5lcmF0aW9uIHdpdGggY29udGFjdCBjYXB0dXJlJyB9LFxuICAgICAgICAgICAgICAgIHsgaWQ6ICdhd2FyZW5lc3MnLCBsYWJlbDogJ0JyYW5kIEF3YXJlbmVzcycsIGRlc2NyaXB0aW9uOiAnQnJhbmQgYXdhcmVuZXNzIGFuZCBtYXJrZXQgZWR1Y2F0aW9uJyB9LFxuICAgICAgICAgICAgICAgIHsgaWQ6ICdlZHVjYXRpb24nLCBsYWJlbDogJ0VkdWNhdGlvbicsIGRlc2NyaXB0aW9uOiAnRWR1Y2F0aW9uYWwgY29udGVudCBhbmQga25vd2xlZGdlIHNoYXJpbmcnIH0sXG4gICAgICAgICAgICAgICAgeyBpZDogJ2RlbW8nLCBsYWJlbDogJ1Byb2R1Y3QgRGVtbycsIGRlc2NyaXB0aW9uOiAnUHJvZHVjdCBkZW1vbnN0cmF0aW9uIGFuZCBjYXBhYmlsaXR5IHNob3djYXNlJyB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gUE9TVCAvYXBpL2d0bS1ib29zdC90ZW1wbGF0ZS1jb250ZXh0XG4gICAgICAgICAgaWYgKHJlcS5tZXRob2QgPT09ICdQT1NUJyAmJiBwYXRoID09PSAnL3RlbXBsYXRlLWNvbnRleHQnKSB7XG4gICAgICAgICAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVhZEJvZHkocmVxKTtcbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBKU09OLnBhcnNlKGJvZHkgfHwgJ3t9Jyk7XG4gICAgICAgICAgICAvLyBJbmxpbmUgdGhlIHJvdXRlIGhhbmRsZXIgbG9naWMgc28gd2UgZG9uJ3QgbmVlZCB0byBtb3VudCBFeHByZXNzLlxuICAgICAgICAgICAgY29uc3QgeyBjYXRlZ29yeSwgbmljaGUsIG5hbWUsIGRlc2NyaXB0aW9uIH0gPSBkYXRhIHx8IHt9O1xuICAgICAgICAgICAgY29uc3QgVEVNUExBVEVfQ0FURUdPUllfVE9fSU5EVVNUUlkgPSB7XG4gICAgICAgICAgICAgICdTb2NpYWwgTWVkaWEnOiAnc2FhcycsXG4gICAgICAgICAgICAgICdTdHlsZSBUcmFuc2Zlcic6ICdzYWFzJyxcbiAgICAgICAgICAgICAgJ0VudGVydGFpbm1lbnQnOiAnZXZlbnRzJyxcbiAgICAgICAgICAgICAgJ0NvbW1lcmNpYWwnOiAncmV0YWlsJyxcbiAgICAgICAgICAgICAgJ1ZGWCAmIEFjdGlvbic6ICdlbnRlcnRhaW5tZW50JyxcbiAgICAgICAgICAgICAgJ1BvcnRyYWl0ICYgQ3JlYXRvcic6ICdmYXNoaW9uJyxcbiAgICAgICAgICAgICAgJ0RlY2FkZSAmIEVyYSc6ICdmYXNoaW9uJyxcbiAgICAgICAgICAgICAgJ0NhbWVyYSAmIENpbmVtYXRpYyc6ICdlbnRlcnRhaW5tZW50JyxcbiAgICAgICAgICAgICAgJ0luZHVzdHJ5IFNwZWNpZmljJzogJ3NhYXMnLFxuICAgICAgICAgICAgICAnUGVyc29uYWwgU3RvcnknOiAnbm9ucHJvZml0JyxcbiAgICAgICAgICAgICAgJ1Jlc3RhdXJhbnQgJiBDYWZlJzogJ3Jlc3RhdXJhbnQnLFxuICAgICAgICAgICAgICAnTWVkIFNwYSAmIEJlYXV0eSc6ICdmYXNoaW9uJyxcbiAgICAgICAgICAgICAgJ1NhbG9uICYgQmFyYmVyc2hvcCc6ICdmYXNoaW9uJyxcbiAgICAgICAgICAgICAgJ0d5bSAmIEZpdG5lc3MnOiAnZml0bmVzcy13ZWxsbmVzcycsXG4gICAgICAgICAgICAgICdSZWFsIEVzdGF0ZSc6ICdyZWFsLWVzdGF0ZScsXG4gICAgICAgICAgICAgICdEZW50YWwgT2ZmaWNlJzogJ2hlYWx0aGNhcmUnLFxuICAgICAgICAgICAgICAnQ2hpcm9wcmFjdGljICYgV2VsbG5lc3MnOiAnZml0bmVzcy13ZWxsbmVzcycsXG4gICAgICAgICAgICAgICdMZWdhbCAmIEF0dG9ybmV5JzogJ2xlZ2FsLXNlcnZpY2VzJyxcbiAgICAgICAgICAgICAgJ0F1dG9tb3RpdmUgJiBDYXInOiAnYXV0b21vdGl2ZScsXG4gICAgICAgICAgICAgICdGYXNoaW9uICYgU3R5bGUnOiAnZmFzaGlvbicsXG4gICAgICAgICAgICAgICdFdmVudHMgJiBDZWxlYnJhdGlvbnMnOiAnZXZlbnRzJyxcbiAgICAgICAgICAgICAgJ0x1eHVyeSAmIFByZW1pdW0nOiAnbHV4dXJ5JyxcbiAgICAgICAgICAgICAgJ3Jlc3RhdXJhbnQnOiAncmVzdGF1cmFudCcsXG4gICAgICAgICAgICAgICdtZWQtc3BhJzogJ2Zhc2hpb24nLFxuICAgICAgICAgICAgICAnc2Fsb24nOiAnZmFzaGlvbicsXG4gICAgICAgICAgICAgICdmaXRuZXNzJzogJ2ZpdG5lc3Mtd2VsbG5lc3MnLFxuICAgICAgICAgICAgICAncmVhbC1lc3RhdGUnOiAncmVhbC1lc3RhdGUnLFxuICAgICAgICAgICAgICAnZGVudGFsJzogJ2hlYWx0aGNhcmUnLFxuICAgICAgICAgICAgICAnY2hpcm9wcmFjdGljJzogJ2ZpdG5lc3Mtd2VsbG5lc3MnLFxuICAgICAgICAgICAgICAnbGVnYWwnOiAnbGVnYWwtc2VydmljZXMnLFxuICAgICAgICAgICAgICAnYXV0b21vdGl2ZSc6ICdhdXRvbW90aXZlJyxcbiAgICAgICAgICAgICAgJ2Zhc2hpb24nOiAnZmFzaGlvbicsXG4gICAgICAgICAgICAgICdldmVudHMnOiAnZXZlbnRzJyxcbiAgICAgICAgICAgICAgJ2x1eHVyeSc6ICdsdXh1cnknLFxuICAgICAgICAgICAgICAnZ2VuZXJhbC1idXNpbmVzcyc6ICdzYWFzJyxcbiAgICAgICAgICAgICAgJ2xvY2FsLWJ1c2luZXNzJzogJ3JldGFpbCcsXG4gICAgICAgICAgICAgICdzYWFzJzogJ3NhYXMnLFxuICAgICAgICAgICAgICAnYWdlbmN5JzogJ3Byb2Zlc3Npb25hbC1zZXJ2aWNlcycsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgY29uc3QgaW5kdXN0cnkgPVxuICAgICAgICAgICAgICAobmljaGUgJiYgVEVNUExBVEVfQ0FURUdPUllfVE9fSU5EVVNUUllbbmljaGVdKSB8fFxuICAgICAgICAgICAgICAoY2F0ZWdvcnkgJiYgVEVNUExBVEVfQ0FURUdPUllfVE9fSU5EVVNUUllbY2F0ZWdvcnldKSB8fFxuICAgICAgICAgICAgICAnc2Fhcyc7XG4gICAgICAgICAgICBjb25zdCB0b25hbGl0eSA9ICgoKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChpbmR1c3RyeSA9PT0gJ2x1eHVyeScgfHwgaW5kdXN0cnkgPT09ICdyZWFsLWVzdGF0ZScpIHJldHVybiAnZXhlY3V0aXZlJztcbiAgICAgICAgICAgICAgaWYgKGluZHVzdHJ5ID09PSAnZmFzaGlvbicgfHwgaW5kdXN0cnkgPT09ICdldmVudHMnKSByZXR1cm4gJ2luc3BpcmF0aW9uYWwnO1xuICAgICAgICAgICAgICBpZiAoaW5kdXN0cnkgPT09ICdoZWFsdGhjYXJlJyB8fCBpbmR1c3RyeSA9PT0gJ2ZpbnRlY2gnKSByZXR1cm4gJ3RlY2huaWNhbCc7XG4gICAgICAgICAgICAgIHJldHVybiAnY29udmVyc2F0aW9uYWwnO1xuICAgICAgICAgICAgfSkoKTtcbiAgICAgICAgICAgIGNvbnN0IHJvbGUgPSAoKCkgPT4ge1xuICAgICAgICAgICAgICBpZiAoWydzYWFzJywgJ2ZpbnRlY2gnLCAnbWFudWZhY3R1cmluZycsICdwcm9mZXNzaW9uYWwtc2VydmljZXMnXS5pbmNsdWRlcyhpbmR1c3RyeSkpIHJldHVybiAnYWUnO1xuICAgICAgICAgICAgICBpZiAoWydmYXNoaW9uJywgJ2V2ZW50cycsICdsdXh1cnknLCAnYXV0b21vdGl2ZScsICdyZXN0YXVyYW50J10uaW5jbHVkZXMoaW5kdXN0cnkpKSByZXR1cm4gJ2ZvdW5kZXInO1xuICAgICAgICAgICAgICBpZiAoWydoZWFsdGhjYXJlJywgJ2ZpdG5lc3Mtd2VsbG5lc3MnLCAnZWR1Y2F0aW9uJywgJ3JlYWwtZXN0YXRlJywgJ2xlZ2FsLXNlcnZpY2VzJ10uaW5jbHVkZXMoaW5kdXN0cnkpKSByZXR1cm4gJ2NzbSc7XG4gICAgICAgICAgICAgIHJldHVybiAnc2RyJztcbiAgICAgICAgICAgIH0pKCk7XG4gICAgICAgICAgICBjb25zdCBtZXRob2RvbG9neSA9ICgoKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChbJ3NhYXMnLCAnZmludGVjaCcsICdtYW51ZmFjdHVyaW5nJywgJ2hlYWx0aGNhcmUnXS5pbmNsdWRlcyhpbmR1c3RyeSkpIHJldHVybiAnbWVkZHBpY2MnO1xuICAgICAgICAgICAgICBpZiAoWydwcm9mZXNzaW9uYWwtc2VydmljZXMnLCAnbGVnYWwtc2VydmljZXMnLCAncmVhbC1lc3RhdGUnXS5pbmNsdWRlcyhpbmR1c3RyeSkpIHJldHVybiAnc3Bpbic7XG4gICAgICAgICAgICAgIGlmIChbJ2Zhc2hpb24nLCAnbHV4dXJ5JywgJ2V2ZW50cyddLmluY2x1ZGVzKGluZHVzdHJ5KSkgcmV0dXJuICdjaGFsbGVuZ2VyJztcbiAgICAgICAgICAgICAgcmV0dXJuICd2YWx1ZS1zZWxsaW5nJztcbiAgICAgICAgICAgIH0pKCk7XG4gICAgICAgICAgICBzZW5kSnNvbihyZXMsIDIwMCwge1xuICAgICAgICAgICAgICBpbmR1c3RyeSxcbiAgICAgICAgICAgICAgdG9uYWxpdHksXG4gICAgICAgICAgICAgIHJvbGUsXG4gICAgICAgICAgICAgIG1ldGhvZG9sb2d5LFxuICAgICAgICAgICAgICBiYXNlUHJvbXB0OiBkZXNjcmlwdGlvbiB8fCBuYW1lIHx8ICcnLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gUE9TVCAvYXBpL2d0bS1ib29zdC9nZW5lcmF0ZVxuICAgICAgICAgIGlmIChyZXEubWV0aG9kID09PSAnUE9TVCcgJiYgcGF0aCA9PT0gJy9nZW5lcmF0ZScpIHtcbiAgICAgICAgICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZWFkQm9keShyZXEpO1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UoYm9keSB8fCAne30nKTtcbiAgICAgICAgICAgIGNvbnN0IHsgYmFzZVByb21wdCwgcm9sZSwgaW5kdXN0cnksIG1ldGhvZG9sb2d5LCB0b25hbGl0eSwgZm9jdXMgPSBbXSwgdGVtcGxhdGVDb250ZXh0ID0ge30gfSA9IGRhdGEgfHwge307XG4gICAgICAgICAgICAvLyBBcHBseSBkZWZhdWx0cyBzbyB0aGUgZW5kcG9pbnQgbmV2ZXIgNDAwcyBvbiBtaXNzaW5nL2VtcHR5IHNlbGVjdGlvbnMuXG4gICAgICAgICAgICBjb25zdCByZXNvbHZlZFJvbGUgPSByb2xlIHx8ICdzZHInO1xuICAgICAgICAgICAgY29uc3QgcmVzb2x2ZWRJbmR1c3RyeSA9IGluZHVzdHJ5IHx8ICdzYWFzJztcbiAgICAgICAgICAgIGNvbnN0IHJlc29sdmVkTWV0aG9kb2xvZ3kgPSBtZXRob2RvbG9neSB8fCAnc3Bpbic7XG4gICAgICAgICAgICBjb25zdCByZXNvbHZlZFRvbmFsaXR5ID0gdG9uYWxpdHkgfHwgJ3Byb2Zlc3Npb25hbCc7XG4gICAgICAgICAgICAvLyBSZS1pbXBsZW1lbnQgdGhlIGdlbmVyYXRlIGxvZ2ljIGlubGluZSBzbyB3ZSBkb24ndCBuZWVkIHRoZVxuICAgICAgICAgICAgLy8gT3BlbkFJIGZldGNoICh3aGljaCB3b24ndCB3b3JrIGluIHRoZSBWaXRlIGRldiBwcm9jZXNzIGFueXdheSkuXG4gICAgICAgICAgICBjb25zdCBST0xFUyA9IHtcbiAgICAgICAgICAgICAgc2RyOiB7IHRpdGxlOiAnU0RSL0JEUiBQcm9zcGVjdGluZycsIGRlc2NyaXB0aW9uOiAnU2FsZXMgRGV2ZWxvcG1lbnQgUmVwcmVzZW50YXRpdmUgLyBCdXNpbmVzcyBEZXZlbG9wbWVudCBSZXByZXNlbnRhdGl2ZSBjb250ZW50IGZvciBjb2xkIG91dHJlYWNoIGFuZCBsZWFkIHF1YWxpZmljYXRpb24nLCBvYmplY3RpdmVzOiBbJ0dlbmVyYXRlIHF1YWxpZmllZCBsZWFkcycsICdDcmVhdGUgcGlwZWxpbmUgb3Bwb3J0dW5pdGllcycsICdFc3RhYmxpc2ggaW5pdGlhbCBjb250YWN0IGFuZCBpbnRlcmVzdCddLCBwcmltYXJ5S1BJOiAnbWVldGluZyBib29raW5ncycgfSxcbiAgICAgICAgICAgICAgYWU6IHsgdGl0bGU6ICdBY2NvdW50IEV4ZWN1dGl2ZSBEaXNjb3ZlcnknLCBkZXNjcmlwdGlvbjogJ0FjY291bnQgRXhlY3V0aXZlIGNvbnRlbnQgZm9yIHF1YWxpZmllZCBwcm9zcGVjdHMsIGRpc2NvdmVyeSwgYW5kIHZhbHVlIGRlbW9uc3RyYXRpb24nLCBvYmplY3RpdmVzOiBbJ0FkdmFuY2UgcXVhbGlmaWVkIG9wcG9ydHVuaXRpZXMnLCAnRGVtb25zdHJhdGUgUk9JIGFuZCBidXNpbmVzcyB2YWx1ZScsICdIYW5kbGUgb2JqZWN0aW9ucyBhbmQgY29uY2VybnMnXSwgcHJpbWFyeUtQSTogJ2RlYWwgcHJvZ3Jlc3Npb24nIH0sXG4gICAgICAgICAgICAgICdzYWxlcy1tYW5hZ2VyJzogeyB0aXRsZTogJ1NhbGVzIE1hbmFnZW1lbnQnLCBkZXNjcmlwdGlvbjogJ1NhbGVzIGxlYWRlcnNoaXAgY29udGVudCBmb3IgdGVhbSBlbmFibGVtZW50IGFuZCBwaXBlbGluZSBtYW5hZ2VtZW50Jywgb2JqZWN0aXZlczogWydBY2NlbGVyYXRlIHRlYW0gcGVyZm9ybWFuY2UnLCAnQnVpbGQgbWFuYWdlbWVudCBjcmVkaWJpbGl0eScsICdEcml2ZSByZXZlbnVlIGdyb3d0aCddLCBwcmltYXJ5S1BJOiAndGVhbSBxdW90YSBhdHRhaW5tZW50JyB9LFxuICAgICAgICAgICAgICByZXZvcHM6IHsgdGl0bGU6ICdSZXZlbnVlIE9wZXJhdGlvbnMnLCBkZXNjcmlwdGlvbjogJ1JldmVudWUgT3BlcmF0aW9ucyBjb250ZW50IGZvciBwcm9jZXNzIG9wdGltaXphdGlvbiBhbmQgZGF0YS1kcml2ZW4gaW5zaWdodHMnLCBvYmplY3RpdmVzOiBbJ0ltcHJvdmUgb3BlcmF0aW9uYWwgZWZmaWNpZW5jeScsICdFbmhhbmNlIGRhdGEgYWNjdXJhY3kgYW5kIGluc2lnaHRzJywgJ09wdGltaXplIHNhbGVzIHByb2Nlc3NlcyBhbmQgYXV0b21hdGlvbiddLCBwcmltYXJ5S1BJOiAnb3BlcmF0aW9uYWwgZWZmaWNpZW5jeSBnYWlucycgfSxcbiAgICAgICAgICAgICAgY3NtOiB7IHRpdGxlOiAnQ3VzdG9tZXIgU3VjY2VzcycsIGRlc2NyaXB0aW9uOiAnQ3VzdG9tZXIgU3VjY2VzcyBNYW5hZ2VtZW50IGNvbnRlbnQgZm9yIHJldGVudGlvbiBhbmQgZXhwYW5zaW9uJywgb2JqZWN0aXZlczogWydSZWR1Y2UgY3VzdG9tZXIgY2h1cm4nLCAnSWRlbnRpZnkgZXhwYW5zaW9uIG9wcG9ydHVuaXRpZXMnLCAnQnVpbGQgbG9uZy10ZXJtIGN1c3RvbWVyIGxveWFsdHknXSwgcHJpbWFyeUtQSTogJ2N1c3RvbWVyIHJldGVudGlvbiBhbmQgZXhwYW5zaW9uJyB9LFxuICAgICAgICAgICAgICBmb3VuZGVyOiB7IHRpdGxlOiAnRXhlY3V0aXZlIExlYWRlcnNoaXAnLCBkZXNjcmlwdGlvbjogJ0ZvdW5kZXIgYW5kIGV4ZWN1dGl2ZSBjb250ZW50IGZvciBzdHJhdGVnaWMgcGFydG5lcnNoaXBzIGFuZCB2aXNpb24gY29tbXVuaWNhdGlvbicsIG9iamVjdGl2ZXM6IFsnQnVpbGQgc3RyYXRlZ2ljIHJlbGF0aW9uc2hpcHMnLCAnQ29tbXVuaWNhdGUgY29tcGFueSB2aXNpb24nLCAnRHJpdmUgZXhlY3V0aXZlLWxldmVsIGVuZ2FnZW1lbnQnXSwgcHJpbWFyeUtQSTogJ3N0cmF0ZWdpYyBwYXJ0bmVyc2hpcCBkZXZlbG9wbWVudCcgfSxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBjb25zdCBJTkRVU1RSSUVTID0ge1xuICAgICAgICAgICAgICBzYWFzOiB7IG5hbWU6ICdTYWFTJywgZGVzY3JpcHRpb246ICdTb2Z0d2FyZSBhcyBhIFNlcnZpY2Ugc29sdXRpb25zIGFuZCBzdWJzY3JpcHRpb24tYmFzZWQgYnVzaW5lc3MgbW9kZWxzJyB9LFxuICAgICAgICAgICAgICBmaW50ZWNoOiB7IG5hbWU6ICdGaW5UZWNoJywgZGVzY3JpcHRpb246ICdGaW5hbmNpYWwgdGVjaG5vbG9neSBhbmQgcGF5bWVudCBwcm9jZXNzaW5nIHNvbHV0aW9ucycgfSxcbiAgICAgICAgICAgICAgaGVhbHRoY2FyZTogeyBuYW1lOiAnSGVhbHRoY2FyZScsIGRlc2NyaXB0aW9uOiAnSGVhbHRoY2FyZSB0ZWNobm9sb2d5IGFuZCBwYXRpZW50IGNhcmUgc29sdXRpb25zJyB9LFxuICAgICAgICAgICAgICBtYW51ZmFjdHVyaW5nOiB7IG5hbWU6ICdNYW51ZmFjdHVyaW5nJywgZGVzY3JpcHRpb246ICdNYW51ZmFjdHVyaW5nIGFuZCBpbmR1c3RyaWFsIG9wZXJhdGlvbnMgc29sdXRpb25zJyB9LFxuICAgICAgICAgICAgICAncHJvZmVzc2lvbmFsLXNlcnZpY2VzJzogeyBuYW1lOiAnUHJvZmVzc2lvbmFsIFNlcnZpY2VzJywgZGVzY3JpcHRpb246ICdDb25zdWx0aW5nLCBhZHZpc29yeSwgYW5kIHByb2Zlc3Npb25hbCBzZXJ2aWNlIGZpcm1zJyB9LFxuICAgICAgICAgICAgICBlY29tbWVyY2U6IHsgbmFtZTogJ0UtY29tbWVyY2UnLCBkZXNjcmlwdGlvbjogJ09ubGluZSByZXRhaWwgYW5kIERUQyBicmFuZHMgc2VsbGluZyB0aHJvdWdoIHZpc3VhbCBzdG9yZWZyb250cycgfSxcbiAgICAgICAgICAgICAgJ3JlYWwtZXN0YXRlJzogeyBuYW1lOiAnUmVhbCBFc3RhdGUnLCBkZXNjcmlwdGlvbjogJ1Jlc2lkZW50aWFsLCBjb21tZXJjaWFsLCBhbmQgcHJvcHRlY2ggc2VsbGluZyB2aWEgcHJvcGVydHkgdmlzdWFscycgfSxcbiAgICAgICAgICAgICAgZWR1Y2F0aW9uOiB7IG5hbWU6ICdFZHVjYXRpb24nLCBkZXNjcmlwdGlvbjogJ0VkVGVjaCwgdW5pdmVyc2l0aWVzLCBhbmQgdHJhaW5pbmcgb3JncyBzZWxsaW5nIGxlYXJuaW5nIG91dGNvbWVzJyB9LFxuICAgICAgICAgICAgICBsb2dpc3RpY3M6IHsgbmFtZTogJ0xvZ2lzdGljcyAmIFN1cHBseSBDaGFpbicsIGRlc2NyaXB0aW9uOiAnRnJlaWdodCwgd2FyZWhvdXNpbmcsIGFuZCBzdXBwbHktY2hhaW4gc29mdHdhcmUgYW5kIHNlcnZpY2VzJyB9LFxuICAgICAgICAgICAgICByZXRhaWw6IHsgbmFtZTogJ1JldGFpbCAmIENQRycsIGRlc2NyaXB0aW9uOiAnQnJpY2stYW5kLW1vcnRhciBhbmQgY29uc3VtZXItcGFja2FnZWQtZ29vZHMgYnJhbmQgbWFya2V0aW5nJyB9LFxuICAgICAgICAgICAgICBtZWRpYTogeyBuYW1lOiAnTWVkaWEgJiBFbnRlcnRhaW5tZW50JywgZGVzY3JpcHRpb246ICdTdHJlYW1pbmcsIHB1Ymxpc2hpbmcsIGFuZCBzdHVkaW9zIHNlbGxpbmcgYXVkaWVuY2UgYXR0ZW50aW9uJyB9LFxuICAgICAgICAgICAgICBsZWdhbDogeyBuYW1lOiAnTGVnYWwgJiBDb21wbGlhbmNlJywgZGVzY3JpcHRpb246ICdMYXcgZmlybXMgYW5kIGxlZ2FsLXRlY2ggc2VsbGluZyB0cnVzdCBhbmQgZXhwZXJ0aXNlJyB9LFxuICAgICAgICAgICAgICB0ZWxlY29tOiB7IG5hbWU6ICdUZWxlY29tICYgQ29ubmVjdGl2aXR5JywgZGVzY3JpcHRpb246ICdDb25uZWN0aXZpdHksIGJyb2FkYmFuZCwgYW5kIGNvbW11bmljYXRpb25zIHByb3ZpZGVycycgfSxcbiAgICAgICAgICAgICAgZW5lcmd5OiB7IG5hbWU6ICdFbmVyZ3kgJiBDbGVhbiBUZWNoJywgZGVzY3JpcHRpb246ICdSZW5ld2FibGVzLCB1dGlsaXRpZXMsIGFuZCBjbGltYXRlLXRlY2ggc2VsbGluZyB0cmFuc2Zvcm1hdGlvbicgfSxcbiAgICAgICAgICAgICAgbm9ucHJvZml0OiB7IG5hbWU6ICdOb25wcm9maXQgJiBNaXNzaW9uLURyaXZlbicsIGRlc2NyaXB0aW9uOiAnQ2hhcml0aWVzIGFuZCBtaXNzaW9uIG9yZ3MgZHJpdmluZyBkb25hdGlvbnMgYW5kIGF3YXJlbmVzcycgfSxcbiAgICAgICAgICAgICAgZ292ZXJubWVudDogeyBuYW1lOiAnR292ZXJubWVudCAmIFB1YmxpYyBTZWN0b3InLCBkZXNjcmlwdGlvbjogJ1B1YmxpYyBhZ2VuY2llcyBhbmQgZ292dGVjaCBzZWxsaW5nIHByb2dyYW1zIGFuZCBzZXJ2aWNlcycgfSxcbiAgICAgICAgICAgICAgaW5zdXJhbmNlOiB7IG5hbWU6ICdJbnN1cmFuY2UnLCBkZXNjcmlwdGlvbjogJ0NhcnJpZXJzLCBicm9rZXJzLCBhbmQgaW5zdXJ0ZWNoIHNlbGxpbmcgcHJvdGVjdGlvbiBhbmQgcGVhY2Ugb2YgbWluZCcgfSxcbiAgICAgICAgICAgICAgYXV0b21vdGl2ZTogeyBuYW1lOiAnQXV0b21vdGl2ZSAmIE1vYmlsaXR5JywgZGVzY3JpcHRpb246ICdEZWFsZXJzLCBPRU1zLCBhbmQgbW9iaWxpdHkgdGVjaCBzZWxsaW5nIHZlaGljbGVzIGFuZCBleHBlcmllbmNlcycgfSxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBjb25zdCBNRVRIT0RPTE9HSUVTID0ge1xuICAgICAgICAgICAgICBtZWRkcGljYzogeyBuYW1lOiAnTUVERFBJQ0MnLCBhcHBsaWNhdGlvbjogJ0FwcGx5IHN5c3RlbWF0aWNhbGx5IHRvIHVuZGVyc3RhbmQgYW5kIG5hdmlnYXRlIGVudGVycHJpc2UgYnV5aW5nIHByb2Nlc3NlcycgfSxcbiAgICAgICAgICAgICAgc3BpbjogeyBuYW1lOiAnU1BJTiBTZWxsaW5nJywgYXBwbGljYXRpb246ICdQcm9ncmVzcyBjb252ZXJzYXRpb25zIGZyb20gY3VycmVudCBzdGF0ZSB0byBzb2x1dGlvbiB2YWx1ZScgfSxcbiAgICAgICAgICAgICAgY2hhbGxlbmdlcjogeyBuYW1lOiAnQ2hhbGxlbmdlciBTYWxlJywgYXBwbGljYXRpb246ICdUZWFjaCBjdXN0b21lcnMsIHRhaWxvciBjb21tdW5pY2F0aW9ucywgYW5kIHRha2UgY29udHJvbCBvZiBzYWxlcyBjb252ZXJzYXRpb25zJyB9LFxuICAgICAgICAgICAgICAnZ2FwLXNlbGxpbmcnOiB7IG5hbWU6ICdHYXAgU2VsbGluZycsIGFwcGxpY2F0aW9uOiAnSWRlbnRpZnkgZ2FwcyBhbmQgcG9zaXRpb24gc29sdXRpb25zIGFzIGJyaWRnZXMgdG8gZGVzaXJlZCBvdXRjb21lcycgfSxcbiAgICAgICAgICAgICAgJ3ZhbHVlLXNlbGxpbmcnOiB7IG5hbWU6ICdWYWx1ZSBTZWxsaW5nJywgYXBwbGljYXRpb246ICdEZW1vbnN0cmF0ZSB0YW5naWJsZSBidXNpbmVzcyBpbXBhY3QgYW5kIHF1YW50aWZpZWQgcmVzdWx0cycgfSxcbiAgICAgICAgICAgICAgc2FuZGxlcjogeyBuYW1lOiAnU2FuZGxlciBTZWxsaW5nJywgYXBwbGljYXRpb246ICdRdWFsaWZ5IHByb3NwZWN0cyBhbmQgZm9jdXMgb24gcGFpbiBwb2ludHMgdGhyb3VnaG91dCBzYWxlcyBwcm9jZXNzJyB9LFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGNvbnN0IFRPTkFMSVRJRVMgPSB7XG4gICAgICAgICAgICAgIHByb2Zlc3Npb25hbDogeyBuYW1lOiAnUHJvZmVzc2lvbmFsJywgZ3VpZGVsaW5lczogJ1VzZSBjbGVhciwgY29uZmlkZW50IGxhbmd1YWdlOyBzdGVhZHkgcGFjaW5nOyBuZXV0cmFsLCB3ZWxsLWxpdCBmcmFtaW5nOyBtaW5pbWFsIGJ1dCBwcmVtaXVtIHN0eWxpbmcnIH0sXG4gICAgICAgICAgICAgIGV4ZWN1dGl2ZTogeyBuYW1lOiAnRXhlY3V0aXZlIEdyYXZpdGFzJywgZ3VpZGVsaW5lczogJ1NvcGhpc3RpY2F0ZWQgdm9jYWJ1bGFyeSwgZW1waGFzaXMgb24gdmlzaW9uL2xlYWRlcnNoaXAsIHNsb3cgZGVsaWJlcmF0ZSBjdXRzLCBjaW5lbWF0aWMgZXN0YWJsaXNoaW5nIHNob3RzJyB9LFxuICAgICAgICAgICAgICBjaGFsbGVuZ2VyOiB7IG5hbWU6ICdDaGFsbGVuZ2VyIEJvbGQnLCBndWlkZWxpbmVzOiAnUHJvdm9jYXRpdmUgaW5zaWdodC1kcml2ZW4gY29weSwgaGFyZCBjdXRzLCBoaWdoLWNvbnRyYXN0IHZpc3VhbHMsIGJvbGQgdHlwb2dyYXBoeSBvbiBzY3JlZW4nIH0sXG4gICAgICAgICAgICAgIGNvbnZlcnNhdGlvbmFsOiB7IG5hbWU6ICdDb252ZXJzYXRpb25hbCBQZWVyJywgZ3VpZGVsaW5lczogJ1VzZSBcIndlXCIvXCJ5b3VcIiwgY2FzdWFsIGZyYW1pbmcgKHNlbGZpZS9kZXNrIHNldHVwKSwgbmF0dXJhbCBsaWdodGluZywgcmVsYXhlZCBwYWNpbmcnIH0sXG4gICAgICAgICAgICAgIHRlY2huaWNhbDogeyBuYW1lOiAnVGVjaG5pY2FsIEV4cGVydCcsIGd1aWRlbGluZXM6ICdJbmR1c3RyeSB0ZXJtaW5vbG9neSwgc2NyZWVuLXJlY29yZGVkIFVJIGRlbW9zLCBkaWFncmFtIG92ZXJsYXlzLCBwcmVjaXNlIGxhYmVsbGluZycgfSxcbiAgICAgICAgICAgICAgaW5zcGlyYXRpb25hbDogeyBuYW1lOiAnSW5zcGlyYXRpb25hbCBWaXNpb24nLCBndWlkZWxpbmVzOiAnQXNwaXJhdGlvbmFsIGNvcHksIHN3ZWVwaW5nIGItcm9sbCwgdXB3YXJkIGNhbWVyYSBtb3Zlcywgd2FybSB1cGxpZnRpbmcgY29sb3IgZ3JhZGUnIH0sXG4gICAgICAgICAgICAgIHVyZ2VudDogeyBuYW1lOiAnVXJnZW50IEFjdGlvbicsIGd1aWRlbGluZXM6ICdBY3Rpb24gdmVyYnMsIGNvdW50ZG93biBncmFwaGljcywgZmFzdCBwYWNpbmcsIHVyZ2VudCBzb3VuZCBkZXNpZ24sIHJlZC9hbWJlciBhY2NlbnRzJyB9LFxuICAgICAgICAgICAgICBjYXN1YWw6IHsgbmFtZTogJ0Nhc3VhbCBQZWVyLXRvLVBlZXInLCBndWlkZWxpbmVzOiAnU2xhbmctbGlnaHQsIHB1bmNoeSBvbmUtbGluZXJzLCB2ZXJ0aWNhbCA5OjE2IGZyYW1pbmcsIHRyZW5kaW5nIGF1ZGlvLCBxdWljayBjdXRzJyB9LFxuICAgICAgICAgICAgICB3aXR0eTogeyBuYW1lOiAnV2l0dHkgJiBDbGV2ZXInLCBndWlkZWxpbmVzOiAnV29yZHBsYXkgYW5kIGxpZ2h0IGpva2Ugc2V0dXBzLCBjb21lZGljIHRpbWluZyBpbiBlZGl0cywgcGxheWZ1bCBncmFwaGljcycgfSxcbiAgICAgICAgICAgICAgZW1wYXRoZXRpYzogeyBuYW1lOiAnRW1wYXRoZXRpYyAmIEh1bWFuJywgZ3VpZGVsaW5lczogJ1ZhbGlkYXRpb24tZmlyc3QgY29weSwgcmVhbCBjdXN0b21lciBmYWNlcywgc29mdCBmb2N1cywgZ2VudGxlIHBhY2luZywgY2FsbSBzY29yZScgfSxcbiAgICAgICAgICAgICAgJ2RhdGEtZHJpdmVuJzogeyBuYW1lOiAnRGF0YS1Ecml2ZW4nLCBndWlkZWxpbmVzOiAnTGVhZCB3aXRoIG1ldHJpY3MsIGFuaW1hdGVkIGJhci9saW5lIGNoYXJ0cywgY2xlYW4gaW5mb2dyYXBoaWMgc3R5bGluZywgY29uZmlkZW50IG5hcnJhdGlvbicgfSxcbiAgICAgICAgICAgICAgc3Rvcnl0ZWxsaW5nOiB7IG5hbWU6ICdOYXJyYXRpdmUgU3Rvcnl0ZWxsaW5nJywgZ3VpZGVsaW5lczogJ1NldHVwLWNvbmZsaWN0LXJlc29sdXRpb24gYXJjLCBjaGFyYWN0ZXItbGVkIGItcm9sbCwgZW1vdGlvbmFsIG11c2ljIHN3ZWxsJyB9LFxuICAgICAgICAgICAgICBhdXRob3JpdGF0aXZlOiB7IG5hbWU6ICdBdXRob3JpdGF0aXZlIEV4cGVydCcsIGd1aWRlbGluZXM6ICdDaXRlIGZyYW1ld29ya3MgYW5kIHByb29mLCBzdGVhZHkgZXllLWNvbnRhY3QgZnJhbWluZywgbGlicmFyeS9vZmZpY2Ugc2V0dGluZ3MsIHNlcmlvdXMgZ3JhZGUnIH0sXG4gICAgICAgICAgICAgIG1pbmltYWxpc3Q6IHsgbmFtZTogJ01pbmltYWxpc3QnLCBndWlkZWxpbmVzOiAnT25lIGlkZWEgcGVyIGZyYW1lLCBsb3RzIG9mIG5lZ2F0aXZlIHNwYWNlLCBtdXRlZCBwYWxldHRlLCBzbG93IGRlbGliZXJhdGUgbW90aW9uJyB9LFxuICAgICAgICAgICAgICBsdXh1cnk6IHsgbmFtZTogJ0x1eHVyeSAmIFByZW1pdW0nLCBndWlkZWxpbmVzOiAnUmljaCB0ZXh0dXJlcywgc2xvdyBtb3Rpb24sIGdvbGQvYmxhY2sgcGFsZXR0ZSwgZWxlZ2FudCB0eXBvZ3JhcGh5LCBubyBoYXJkLXNlbGwnIH0sXG4gICAgICAgICAgICAgIHBsYXlmdWw6IHsgbmFtZTogJ1BsYXlmdWwgJiBGdW4nLCBndWlkZWxpbmVzOiAnQnJpZ2h0IHBhbGV0dGUsIGJvdW5jeSBlZGl0cywgZW1vamktc3R5bGUgZ3JhcGhpY3MsIHVwYmVhdCBxdWlya3kgbXVzaWMnIH0sXG4gICAgICAgICAgICAgIGJvbGQ6IHsgbmFtZTogJ0JvbGQgJiBEaXNydXB0aXZlJywgZ3VpZGVsaW5lczogJ092ZXJzaXplZCB0eXBlLCBzYXR1cmF0ZWQgY29sb3IsIGZhc3QgYWdncmVzc2l2ZSBjdXRzLCBzdGF0ZW1lbnQgdm9pY2VvdmVyJyB9LFxuICAgICAgICAgICAgICBlZHVjYXRpb25hbDogeyBuYW1lOiAnRWR1Y2F0aW9uYWwnLCBndWlkZWxpbmVzOiAnU3RlcC1ieS1zdGVwIHN0cnVjdHVyZSwgcG9pbnRlci9hcnJvdyBvdmVybGF5cywgY2FsbSBuYXJyYXRpb24sIGNsZWFuIHdoaXRlYm9hcmQgc3R5bGUnIH0sXG4gICAgICAgICAgICAgIHRydXN0d29ydGh5OiB7IG5hbWU6ICdUcnVzdHdvcnRoeSAmIFJlYXNzdXJpbmcnLCBndWlkZWxpbmVzOiAnUGxhaW4gbGFuZ3VhZ2UsIHN0ZWFkeSBwYWNpbmcsIHNvZnQgYmx1ZS9ncmVlbiBwYWxldHRlLCByZWFsLWVudmlyb25tZW50IHNob3RzJyB9LFxuICAgICAgICAgICAgICBlbmVyZ2V0aWM6IHsgbmFtZTogJ0VuZXJnZXRpYyAmIFVwYmVhdCcsIGd1aWRlbGluZXM6ICdGYXN0IGN1dHMsIHJpc2luZyB0ZW1wbywgYnJpZ2h0IGNvbG9ycywgY3Jvd2QvY29uZmV0dGkgZW5lcmd5LCBkcml2aW5nIGJlYXQnIH0sXG4gICAgICAgICAgICAgIHNvcGhpc3RpY2F0ZWQ6IHsgbmFtZTogJ1NvcGhpc3RpY2F0ZWQgJiBSZWZpbmVkJywgZ3VpZGVsaW5lczogJ1N1YnRsZSBtb3Rpb24sIHJlZmluZWQgcGFsZXR0ZSwgZWxlZ2FudCBzZXJpZiB0eXBlLCByZXN0cmFpbmVkIG11c2ljJyB9LFxuICAgICAgICAgICAgICBkaXJlY3Q6IHsgbmFtZTogJ0RpcmVjdCAmIE5vLUZsdWZmJywgZ3VpZGVsaW5lczogJ0Zyb250LWxvYWQgdGhlIG9mZmVyLCBwbGFpbiB3b3JkcywgcHVuY2gtaW4gY3V0cywgY2xlYXIgQ1RBIGNhcmQnIH0sXG4gICAgICAgICAgICAgIGZyaWVuZGx5OiB7IG5hbWU6ICdGcmllbmRseSAmIFdlbGNvbWluZycsIGd1aWRlbGluZXM6ICdJbnZpdGluZyBjb3B5LCBvcGVuIGJvZHkgbGFuZ3VhZ2UsIGJyaWdodCBhaXJ5IHNldCwgZ2VudGxlIHVwbGlmdGluZyBtdXNpYycgfSxcbiAgICAgICAgICAgICAgZHJhbWF0aWM6IHsgbmFtZTogJ0RyYW1hdGljICYgQ2luZW1hdGljJywgZ3VpZGVsaW5lczogJ0xvdy1rZXkgbGlnaHRpbmcsIG9yY2hlc3RyYWwgc3dlbGwsIHNsb3ctbW8gaGVybyBtb21lbnQsIGRlZXAgY29udHJhc3QgZ3JhZGUnIH0sXG4gICAgICAgICAgICAgICdwZWVyLWNvbXBhcmlzb24nOiB7IG5hbWU6ICdTb2NpYWwgUHJvb2YgLyBQZWVyIENvbXBhcmlzb24nLCBndWlkZWxpbmVzOiAnU2hvdyBcInRoZW0gdnMgeW91XCIgc3BsaXQgc2NyZWVucywgYmVuY2htYXJrIGNoYXJ0cywgY29uZmlkZW50IG5ldXRyYWwgbmFycmF0aW9uJyB9LFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGNvbnN0IEZPQ1VTX0FSRUFTID0gW1xuICAgICAgICAgICAgICB7IGlkOiAnbGVhZC1nZW4nLCBsYWJlbDogJ0xlYWQgR2VuZXJhdGlvbicgfSxcbiAgICAgICAgICAgICAgeyBpZDogJ2F3YXJlbmVzcycsIGxhYmVsOiAnQnJhbmQgQXdhcmVuZXNzJyB9LFxuICAgICAgICAgICAgICB7IGlkOiAnZWR1Y2F0aW9uJywgbGFiZWw6ICdFZHVjYXRpb24nIH0sXG4gICAgICAgICAgICAgIHsgaWQ6ICdkZW1vJywgbGFiZWw6ICdQcm9kdWN0IERlbW8nIH0sXG4gICAgICAgICAgICBdO1xuICAgICAgICAgICAgY29uc3Qgcm9sZUNvbnRlbnQgPSBST0xFU1tyZXNvbHZlZFJvbGVdIHx8IFJPTEVTLnNkcjtcbiAgICAgICAgICAgIGNvbnN0IGluZHVzdHJ5Q29udGVudCA9IElORFVTVFJJRVNbcmVzb2x2ZWRJbmR1c3RyeV0gfHwgSU5EVVNUUklFUy5zYWFzO1xuICAgICAgICAgICAgY29uc3QgbWV0aG9kb2xvZ3lDb250ZW50ID0gTUVUSE9ET0xPR0lFU1tyZXNvbHZlZE1ldGhvZG9sb2d5XSB8fCBNRVRIT0RPTE9HSUVTLnNwaW47XG4gICAgICAgICAgICBjb25zdCB0b25hbGl0eUNvbnRlbnQgPSBUT05BTElUSUVTW3Jlc29sdmVkVG9uYWxpdHldIHx8IFRPTkFMSVRJRVMucHJvZmVzc2lvbmFsO1xuICAgICAgICAgICAgY29uc3QgZm9jdXNMYWJlbHMgPSBmb2N1c1xuICAgICAgICAgICAgICAubWFwKChpZCkgPT4gKEZPQ1VTX0FSRUFTLmZpbmQoKGYpID0+IGYuaWQgPT09IGlkKSB8fCB7fSkubGFiZWwpXG4gICAgICAgICAgICAgIC5maWx0ZXIoQm9vbGVhbilcbiAgICAgICAgICAgICAgLmpvaW4oJywgJyk7XG4gICAgICAgICAgICBjb25zdCB0ZW1wbGF0ZVRhZyA9IHRlbXBsYXRlQ29udGV4dC50ZW1wbGF0ZUlkXG4gICAgICAgICAgICAgID8gYCBbVGVtcGxhdGU6ICR7dGVtcGxhdGVDb250ZXh0LnRlbXBsYXRlSWR9XWBcbiAgICAgICAgICAgICAgOiAnJztcbiAgICAgICAgICAgIGNvbnN0IHNlY3Rpb25zID0gW1xuICAgICAgICAgICAgICBgXHVEODNDXHVERkFGICR7cm9sZUNvbnRlbnQudGl0bGV9IFZpZGVvIFByb21wdCR7dGVtcGxhdGVUYWd9YCxcbiAgICAgICAgICAgICAgYGAsXG4gICAgICAgICAgICAgIGBSb2xlIENvbnRleHQ6ICR7cm9sZUNvbnRlbnQuZGVzY3JpcHRpb259YCxcbiAgICAgICAgICAgICAgYE9iamVjdGl2ZXM6ICR7cm9sZUNvbnRlbnQub2JqZWN0aXZlcy5qb2luKCcsICcpfWAsXG4gICAgICAgICAgICAgIGBgLFxuICAgICAgICAgICAgICBgSW5kdXN0cnkgRm9jdXM6ICR7aW5kdXN0cnlDb250ZW50LmRlc2NyaXB0aW9ufWAsXG4gICAgICAgICAgICAgIGBgLFxuICAgICAgICAgICAgICBgU2FsZXMgRnJhbWV3b3JrOiAke21ldGhvZG9sb2d5Q29udGVudC5uYW1lfWAsXG4gICAgICAgICAgICAgIGBBcHBsaWNhdGlvbjogJHttZXRob2RvbG9neUNvbnRlbnQuYXBwbGljYXRpb259YCxcbiAgICAgICAgICAgICAgYGAsXG4gICAgICAgICAgICAgIGBXcml0aW5nIFN0eWxlOiAke3RvbmFsaXR5Q29udGVudC5uYW1lfWAsXG4gICAgICAgICAgICAgIGBHdWlkZWxpbmVzOiAke3RvbmFsaXR5Q29udGVudC5ndWlkZWxpbmVzfWAsXG4gICAgICAgICAgICAgIGBgLFxuICAgICAgICAgICAgXTtcbiAgICAgICAgICAgIGlmIChmb2N1c0xhYmVscykge1xuICAgICAgICAgICAgICBzZWN0aW9ucy5wdXNoKGBGb2N1cyBBcmVhczogJHtmb2N1c0xhYmVsc31gKTtcbiAgICAgICAgICAgICAgc2VjdGlvbnMucHVzaChgYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzZWN0aW9ucy5wdXNoKGBDb3JlIENvbmNlcHQ6ICR7YmFzZVByb21wdCB8fCAnKG5vIGJhc2UgcHJvbXB0IHByb3ZpZGVkKSd9YCk7XG4gICAgICAgICAgICBzZWN0aW9ucy5wdXNoKGBgKTtcbiAgICAgICAgICAgIHNlY3Rpb25zLnB1c2goYENyZWF0ZSBhIGNvbXBlbGxpbmcgdmlkZW8gdGhhdCBsZXZlcmFnZXMgdGhlc2UgR1RNIGZyYW1ld29ya3MgdG8gZHJpdmUgJHtyb2xlQ29udGVudC5wcmltYXJ5S1BJfSBhbmQgYWNoaWV2ZSAke3JvbGVDb250ZW50Lm9iamVjdGl2ZXNbMF0udG9Mb3dlckNhc2UoKX0uYCk7XG4gICAgICAgICAgICBzZW5kSnNvbihyZXMsIDIwMCwge1xuICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICBzb3VyY2U6ICdsb2NhbC1saWJyYXJ5JyxcbiAgICAgICAgICAgICAgcHJvbXB0OiBzZWN0aW9ucy5qb2luKCdcXG4nKSxcbiAgICAgICAgICAgICAgc2VsZWN0aW9uczoge1xuICAgICAgICAgICAgICAgIHJvbGU6IHJlc29sdmVkUm9sZSxcbiAgICAgICAgICAgICAgICBpbmR1c3RyeTogcmVzb2x2ZWRJbmR1c3RyeSxcbiAgICAgICAgICAgICAgICBtZXRob2RvbG9neTogcmVzb2x2ZWRNZXRob2RvbG9neSxcbiAgICAgICAgICAgICAgICB0b25hbGl0eTogcmVzb2x2ZWRUb25hbGl0eSxcbiAgICAgICAgICAgICAgICBmb2N1cyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgdGVtcGxhdGVDb250ZXh0LFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgc2VuZEpzb24ocmVzLCA0MDQsIHsgZXJyb3I6ICdOb3QgZm91bmQnLCBwYXRoIH0pO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcignW2d0bS1ib29zdC1kZXZdIGhhbmRsZXIgZXJyb3I6JywgZSk7XG4gICAgICAgICAgc2VuZEpzb24ocmVzLCA1MDAsIHsgZXJyb3I6ICdJbnRlcm5hbCBTZXJ2ZXIgRXJyb3InLCBtZXNzYWdlOiBlLm1lc3NhZ2UgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0sXG4gIH07XG59XG5cbi8qKlxuICogbW9kZWxDYXRhbG9nRGV2UGx1Z2luIFx1MjAxNCBydW5zIGluIGRldiAodml0ZSBkZXYpIHRvIHNlcnZlIC9hcGkvbW9kZWwtY2F0YWxvZ1xuICogZGlyZWN0bHkgZnJvbSBwdWJsaWMvYXBpL21vZGVsLWNhdGFsb2cuanNvbiBpbnN0ZWFkIG9mIHByb3h5aW5nIHRvIHRoZVxuICogYmFja2VuZCBvbiA6MzAwMS4gVGhlIGZpbGUgaXMgcHJvZHVjZWQgYXQgYnVpbGQgdGltZSBieVxuICogbW9kZWxDYXRhbG9nQnVpbGRQbHVnaW4gKG9yIGJ5IHNjcmlwdHMvZ2VuZXJhdGUtbW9kZWwtY2F0YWxvZy5tanMpLiBUaGVcbiAqIGJhY2tlbmQgb24gOjMwMDEgaXMgbm90IGFsd2F5cyBydW5uaW5nIGluIGRldiwgc28gc2VydmluZyB0aGUgc3RhdGljXG4gKiBmaWxlIHJlbW92ZXMgYSA0MDQgcGF0aCBhbmQgbWF0Y2hlcyB0aGUgcHJvZHVjdGlvbiBiZWhhdmlvciAoTmV0bGlmeVxuICogc2VydmVzIHRoZSBzYW1lIGZpbGUgYXMgYSBzdGF0aWMgcmV3cml0ZSkuXG4gKi9cbmZ1bmN0aW9uIG1vZGVsQ2F0YWxvZ0RldlBsdWdpbigpIHtcbiAgY29uc3QgQ0FUQUxPR19QQVRIID0gcGF0aC5qb2luKFBST0pFQ1RfUk9PVCwgJ3B1YmxpYycsICdhcGknLCAnbW9kZWwtY2F0YWxvZy5qc29uJyk7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ21vZGVsLWNhdGFsb2ctZGV2JyxcbiAgICBhcHBseTogJ3NlcnZlJyxcbiAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKCcvYXBpL21vZGVsLWNhdGFsb2cnLCAocmVxLCByZXMpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoQ0FUQUxPR19QQVRIKSkge1xuICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA0MDQ7XG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgZXJyb3I6ICdOb3QgRm91bmQnLFxuICAgICAgICAgICAgICBtZXNzYWdlOiAncHVibGljL2FwaS9tb2RlbC1jYXRhbG9nLmpzb24gaXMgbWlzc2luZy4gUnVuIGBucG0gcnVuIGdlbmVyYXRlOmNhdGFsb2dgIG9yIGB2aXRlIGJ1aWxkYCBmaXJzdC4nLFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCByYXcgPSBmcy5yZWFkRmlsZVN5bmMoQ0FUQUxPR19QQVRILCAndXRmLTgnKTtcbiAgICAgICAgICBjb25zdCBkYXRhID0gSlNPTi5wYXJzZShyYXcpO1xuICAgICAgICAgIC8vIERldiBjbGllbnQgZXhwZWN0cyBlaXRoZXIgeyBtb2RlbHM6IFsuLi5dIH0gKHNpbmdsZSBwb29sLCBmaWx0ZXJlZFxuICAgICAgICAgIC8vIHNlcnZlci1zaWRlKSBvciB7IHQyaTogWy4uLl0sIGkyaTogWy4uLl0sIGkydjogWy4uLl0sIHQydjogWy4uLl0sIHYydjogWy4uLl0gfSAoZnVsbFxuICAgICAgICAgIC8vIG11bHRpLXBvb2wsIGZpbHRlcmVkIGNsaWVudC1zaWRlKS4gVGhlIHN0YXRpYyBmaWxlIGhvbGRzIHRoZSBmdWxsXG4gICAgICAgICAgLy8gbXVsdGktcG9vbCBzaGFwZSwgc28gd2UgaG9ub3IgdGhlIGNsaWVudCdzIG1vZGVsVHlwZSBxdWVyeSBwYXJhbVxuICAgICAgICAgIC8vIGJ5IHJldHVybmluZyB0aGUgcmVxdWVzdGVkIHBvb2wgd3JhcHBlZCBpbiB7IG1vZGVsczogWy4uLl0gfS5cbiAgICAgICAgICBjb25zdCB1cmwgPSBuZXcgVVJMKHJlcS51cmwsICdodHRwOi8vbG9jYWxob3N0Jyk7XG4gICAgICAgICAgY29uc3QgbW9kZWxUeXBlID0gdXJsLnNlYXJjaFBhcmFtcy5nZXQoJ21vZGVsVHlwZScpO1xuICAgICAgICAgIGNvbnN0IFZBTElEID0gWyd0MmknLCAnaTJpJywgJ2kydicsICd0MnYnLCAndjJ2J107XG4gICAgICAgICAgaWYgKG1vZGVsVHlwZSAmJiBWQUxJRC5pbmNsdWRlcyhtb2RlbFR5cGUpKSB7XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IG1vZGVsczogZGF0YVttb2RlbFR5cGVdIHx8IFtdIH0pKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoZGF0YSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ0ludGVybmFsIFNlcnZlciBFcnJvcicsIG1lc3NhZ2U6IGUubWVzc2FnZSB9KSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0sXG4gIH07XG59XG5cbi8qKlxuICogbW9kZWxDYXRhbG9nQnVpbGRQbHVnaW4gXHUyMDE0IHJ1bnMgYXQgYnVpbGQgdGltZSAodml0ZSBidWlsZCkuXG4gKlxuICogUmVhZHMgc3JjL2xpYi9tb2RlbHMuanMgYW5kIHNyYy9saWIvbW9kZWxEZXNjcmlwdGlvbnMuanMgYW5kIGVtaXRzXG4gKiBwdWJsaWMvYXBpL21vZGVsLWNhdGFsb2cuanNvbiBzbyBOZXRsaWZ5IGNhbiBzZXJ2ZSAvYXBpL21vZGVsLWNhdGFsb2dcbiAqIGFzIGEgc3RhdGljIGZpbGUgd2l0aG91dCBhIHJ1bm5pbmcgYmFja2VuZCBwcm9jZXNzLlxuICovXG5mdW5jdGlvbiBtb2RlbENhdGFsb2dCdWlsZFBsdWdpbigpIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnbW9kZWwtY2F0YWxvZy1idWlsZCcsXG4gICAgZW5mb3JjZTogJ3Bvc3QnLFxuICAgIGdlbmVyYXRlQnVuZGxlKF9vcHRpb25zLCBfYnVuZGxlKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBtb2RlbHNNb2QgPSByZXF1aXJlKHBhdGguam9pbihQUk9KRUNUX1JPT1QsICdzcmMvbGliL21vZGVscy5qcycpKTtcbiAgICAgICAgY29uc3QgZGVzY01vZCAgID0gcmVxdWlyZShwYXRoLmpvaW4oUFJPSkVDVF9ST09ULCAnc3JjL2xpYi9tb2RlbERlc2NyaXB0aW9ucy5qcycpKTtcbiAgICAgICAgY29uc3QgREVTQ1JJUFRJT05TID0gZGVzY01vZC5ERVNDUklQVElPTlMgfHwge307XG5cbiAgICAgICAgY29uc3Qgc2VlbiA9IG5ldyBTZXQoKTtcbiAgICAgICAgY29uc3QgdW5pcXVlID0gKGxpc3QsIHR5cGUpID0+IHtcbiAgICAgICAgICBjb25zdCBvdXQgPSBbXTtcbiAgICAgICAgICBmb3IgKGNvbnN0IG0gb2YgbGlzdCkge1xuICAgICAgICAgICAgaWYgKHNlZW4uaGFzKG0uaWQpKSBjb250aW51ZTtcbiAgICAgICAgICAgIHNlZW4uYWRkKG0uaWQpO1xuICAgICAgICAgICAgY29uc3QgZGVzYyA9IChERVNDUklQVElPTlNbdHlwZV0gfHwge30pW20uaWRdIHx8IG51bGw7XG4gICAgICAgICAgICBvdXQucHVzaCh7XG4gICAgICAgICAgICAgIGlkOiBtLmlkLFxuICAgICAgICAgICAgICBuYW1lOiBtLm5hbWUsXG4gICAgICAgICAgICAgIHByb3ZpZGVyOiBtLnByb3ZpZGVyIHx8IG51bGwsXG4gICAgICAgICAgICAgIHByb3ZpZGVyX25hbWU6IG0ucHJvdmlkZXJfbmFtZSB8fCBudWxsLFxuICAgICAgICAgICAgICAuLi4oZGVzYyA/IHsgZGVzY3JpcHRpb246IGRlc2MgfSA6IHt9KSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gb3V0O1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IGNhdGFsb2cgPSB7XG4gICAgICAgICAgdDJpOiB1bmlxdWUobW9kZWxzTW9kLnQyaU1vZGVscyB8fCBbXSwgJ3QyaScpLFxuICAgICAgICAgIGkyaTogdW5pcXVlKG1vZGVsc01vZC5pMmlNb2RlbHMgfHwgW10sICdpMmknKSxcbiAgICAgICAgICBpMnY6IHVuaXF1ZShtb2RlbHNNb2QuaTJ2TW9kZWxzIHx8IFtdLCAnaTJ2JyksXG4gICAgICAgICAgdDJ2OiB1bmlxdWUobW9kZWxzTW9kLnQydk1vZGVscyB8fCBbXSwgJ3QydicpLFxuICAgICAgICAgIHYydjogdW5pcXVlKG1vZGVsc01vZC52MnZNb2RlbHMgfHwgW10sICd2MnYnKSxcbiAgICAgICAgfTtcbiAgICAgICAgY29uc3QgdG90YWwgPSBjYXRhbG9nLnQyaS5sZW5ndGggKyBjYXRhbG9nLmkyaS5sZW5ndGggKyBjYXRhbG9nLmkydi5sZW5ndGggKyBjYXRhbG9nLnQydi5sZW5ndGggKyBjYXRhbG9nLnYydi5sZW5ndGg7XG4gICAgICAgIHRoaXMuZW1pdEZpbGUoe1xuICAgICAgICAgIHR5cGU6ICdhc3NldCcsXG4gICAgICAgICAgZmlsZU5hbWU6ICdhcGkvbW9kZWwtY2F0YWxvZy5qc29uJyxcbiAgICAgICAgICBzb3VyY2U6IEpTT04uc3RyaW5naWZ5KGNhdGFsb2cpLFxuICAgICAgICB9KTtcbiAgICAgICAgY29uc29sZS5sb2coYFttb2RlbC1jYXRhbG9nXSBFbWl0dGVkIGFwaS9tb2RlbC1jYXRhbG9nLmpzb24gKCR7dG90YWx9IG1vZGVscylgKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc29sZS53YXJuKCdbbW9kZWwtY2F0YWxvZ10gQnVpbGQgcGx1Z2luIHNraXBwZWQ6JywgZS5tZXNzYWdlKTtcbiAgICAgIH1cbiAgICB9LFxuICB9O1xufVxuXG4vKipcbiAqIHN2Z01pc3NpbmdGYWxsYmFjayBcdTIwMTQgc29tZSBidW5kbGVkIGRlcGVuZGVuY2llcyBpbXBvcnQgYC5zdmdgIGFzc2V0cyAoZS5nLlxuICogYGljb24tdHJhbnNpdGlvbi5zdmc/aW1wb3J0YCkgdGhhdCBkb24ndCBleGlzdCBpbiB0aGlzIHByb2plY3QsIHByb2R1Y2luZ1xuICogNDA0cyAvIGFib3J0ZWQgcmVxdWVzdHMgYXQgcnVudGltZS4gV2hlbiB0aGUgcmVmZXJlbmNlZCBmaWxlIGlzIGdlbnVpbmVseVxuICogYWJzZW50IHdlIHJldHVybiBhIHRyYW5zcGFyZW50IDF4MSBTVkcgc28gdGhlIGltcG9ydCByZXNvbHZlcyBpbnN0ZWFkIG9mXG4gKiBmYWlsaW5nLiBSZWFsIGAuc3ZnYCBmaWxlcyBvbiBkaXNrIGFyZSBsZWZ0IHVudG91Y2hlZC5cbiAqL1xuZnVuY3Rpb24gc3ZnTWlzc2luZ0ZhbGxiYWNrKCkge1xuICBjb25zdCBQTEFDRUhPTERFUiA9XG4gICAgJ2RhdGE6aW1hZ2Uvc3ZnK3htbCwnICtcbiAgICBlbmNvZGVVUklDb21wb25lbnQoJzxzdmcgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHdpZHRoPVwiMVwiIGhlaWdodD1cIjFcIj48L3N2Zz4nKTtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnc3ZnLW1pc3NpbmctZmFsbGJhY2snLFxuICAgIGVuZm9yY2U6ICdwcmUnLFxuICAgIGFzeW5jIGxvYWQoaWQpIHtcbiAgICAgIGNvbnN0IGZpbGUgPSBpZC5zcGxpdCgnPycpWzBdO1xuICAgICAgaWYgKCFmaWxlLmVuZHNXaXRoKCcuc3ZnJykpIHJldHVybiBudWxsO1xuICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoZmlsZSkpIHJldHVybiBudWxsOyAvLyByZWFsIGFzc2V0OiBsZXQgVml0ZSBoYW5kbGUgaXRcbiAgICAgIHJldHVybiBgZXhwb3J0IGRlZmF1bHQgJHtKU09OLnN0cmluZ2lmeShQTEFDRUhPTERFUil9O2A7XG4gICAgfSxcbiAgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgICBkZWZpbmU6IHtcbiAgICAgICAgJ3Byb2Nlc3MuYnJvd3Nlcic6ICd0cnVlJyxcbiAgICAgICAgJ3Byb2Nlc3MuZW52JzogJ3t9JyxcbiAgICAgICAgJ3Byb2Nlc3MuZW52Ll9fTkVYVF9ST1VURVJfQkFTRVBBVEgnOiAnXCJcIicsXG4gICAgfSxcbiAgICByZXNvbHZlOiB7XG4gICAgICAgIC8vIEZvcmNlIGEgc2luZ2xlIFJlYWN0IGluc3RhbmNlLiBAY2xlcmsvcmVhY3QgaXMgcHJlLWJ1bmRsZWQgYnlcbiAgICAgICAgLy8gVml0ZSdzIGRlcCBvcHRpbWl6ZXIgaW50byBpdHMgb3duIGNodW5rOyB3aXRob3V0IGRlZHVwZSBpdCBjYW5cbiAgICAgICAgLy8gcmVzb2x2ZSBhIHNlY29uZCBjb3B5IG9mIFJlYWN0LCB3aGljaCBtYWtlcyBldmVyeSBDbGVyayBob29rXG4gICAgICAgIC8vIHRocm93IFwiSW52YWxpZCBob29rIGNhbGwgXHUyMDI2IG1vcmUgdGhhbiBvbmUgY29weSBvZiBSZWFjdFwiIGFuZFxuICAgICAgICAvLyBjcmFzaGVzIDxDbGVya1Byb3ZpZGVyPiBcdTIwMTQgYmxhbmtpbmcgdGhlIHNpZ24taW4gcGFnZS5cbiAgICAgICAgZGVkdXBlOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbSddLFxuICAgICAgICBhbGlhczoge1xuICAgICAgICAgICAgLy8gRm9yY2UgZXhhY3QgZmlsZXMgZm9yIHJlYWN0L3JlYWN0LWRvbSBzdWJwYXRoIGV4cG9ydHMuIFZpdGUgNSdzXG4gICAgICAgICAgICAvLyByZXNvbHZlciBjYW4gbWlzLXRyYXZlcnNlIHRoZSBwYWNrYWdlIGBleHBvcnRzYCBtYXAgYW5kIGFwcGVuZCB0aGVcbiAgICAgICAgICAgIC8vIHN1YnBhdGggKGUuZy4gXCIvY2xpZW50XCIsIFwiL2pzeC1ydW50aW1lXCIpIG9udG8gcmVhY3QoLWRvbSkvaW5kZXguanNcbiAgICAgICAgICAgIC8vIChFTk9URElSKSBvbiBhIGZyZXNoIG5vZGVfbW9kdWxlcywgYWJvcnRpbmcgdGhlIGJ1aWxkLiBQaW5uaW5nIHRoZVxuICAgICAgICAgICAgLy8gcmVhbCBmaWxlcyBhdm9pZHMgdGhhdC4ganN4LXJ1bnRpbWUvanN4LWRldi1ydW50aW1lIGFyZSBhdXRvLWluamVjdGVkXG4gICAgICAgICAgICAvLyBieSBAdml0ZWpzL3BsdWdpbi1yZWFjdCBpbnRvIGV2ZXJ5IC5qc3ggbW9kdWxlLlxuICAgICAgICAgICAgJ3JlYWN0LWRvbS9jbGllbnQnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnbm9kZV9tb2R1bGVzL3JlYWN0LWRvbS9jbGllbnQuanMnKSxcbiAgICAgICAgICAgICdyZWFjdC9qc3gtcnVudGltZSc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdub2RlX21vZHVsZXMvcmVhY3QvanN4LXJ1bnRpbWUuanMnKSxcbiAgICAgICAgICAgICdyZWFjdC9qc3gtZGV2LXJ1bnRpbWUnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnbm9kZV9tb2R1bGVzL3JlYWN0L2pzeC1kZXYtcnVudGltZS5qcycpLFxuICAgICAgICAgICAgJ3JlYWN0LXN2Zy1pbmxpbmUnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnc3JjL2xpYi9yZWFjdC1zdmctaW5saW5lLmpzeCcpLFxuICAgICAgICAgICAgJ0BzbWFydHZpZGVvL2FpLXRpbWVsaW5lLWVkaXRvcic6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdwYWNrYWdlcy9haS10aW1lbGluZS1lZGl0b3Ivc3JjJyksXG4gICAgICAgICAgICAnQGhpZ2dzZmllbGQvY29sb3ItZ3JhZGluZyc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdwYWNrYWdlcy9jb2xvci1ncmFkaW5nL3NyYycpLFxuICAgICAgICAgICAgJ0BoaWdnc2ZpZWxkL2F1ZGlvLW1peGVyJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ3BhY2thZ2VzL2F1ZGlvLW1peGVyL3NyYycpLFxuICAgICAgICAgICAgJ0BoaWdnc2ZpZWxkL3RyYW5zaXRpb25zJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ3BhY2thZ2VzL3RyYW5zaXRpb25zL3NyYycpLFxuICAgICAgICAgICAgJ0BoaWdnc2ZpZWxkL3N1YnRpdGxlcyc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdwYWNrYWdlcy9zdWJ0aXRsZXMvc3JjJyksXG4gICAgICAgICAgICAnQGhpZ2dzZmllbGQvc3R5bGUtdGVtcGxhdGVzJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ3BhY2thZ2VzL3N0eWxlLXRlbXBsYXRlcy9zcmMnKSxcbiAgICAgICAgICAgICdAaGlnZ3NmaWVsZC92aWRlby1jb21waWxlcic6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdwYWNrYWdlcy92aWRlby1jb21waWxlci9zcmMnKSxcbiAgICAgICAgICAgICdAaGlnZ3NmaWVsZC9haS1jaGF0JzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ3BhY2thZ2VzL2FpLWNoYXQvc3JjJyksXG4gICAgICAgIH0sXG4gICAgfSxcbiAgICBwbHVnaW5zOiBbXG4gICAgICAgIHB1YmxpY0F1ZGl0UmVwb3J0UGx1Z2luKCksXG4gICAgICAgIHRhaWx3aW5kY3NzKCksXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICd0c3gtcHJlLXRyYW5zZm9ybScsXG4gICAgICAgICAgICBlbmZvcmNlOiAncHJlJyxcbiAgICAgICAgICAgIGFzeW5jIHRyYW5zZm9ybShzcmMsIGlkKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlkLmVuZHNXaXRoKCcudHN4JykpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyB0cmFuc2Zvcm0gfSA9IGF3YWl0IGltcG9ydCgnZXNidWlsZCcpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0cmFuc2Zvcm0oc3JjLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2FkZXI6ICd0c3gnLFxuICAgICAgICAgICAgICAgICAgICAgICAganN4OiAnYXV0b21hdGljJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRzY29uZmlnUmF3OiB7IGNvbXBpbGVyT3B0aW9uczogeyBleHBlcmltZW50YWxEZWNvcmF0b3JzOiB0cnVlIH0gfSxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQuY29kZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICAvLyBMZWdhY3kgY29tcG9uZW50cyAoZS5nLiBTb2NpYWxQdWJsaXNoZXJNb2RhbC5qc3gpIHVzZSBNb2JYXG4gICAgICAgIC8vIEBpbmplY3QvQG9ic2VydmVyIGRlY29yYXRvcnMuIEB2aXRlanMvcGx1Z2luLXJlYWN0IHRyYW5zZm9ybXMgLmpzeFxuICAgICAgICAvLyB2aWEgQmFiZWwsIHdoaWNoIGRvZXMgbm90IGVuYWJsZSBkZWNvcmF0b3JzIGJ5IGRlZmF1bHQgXHUyMDE0IGVuYWJsZSB0aGVcbiAgICAgICAgLy8gbGVnYWN5IGRlY29yYXRvcnMgKyBjbGFzcy1wcm9wZXJ0aWVzIHBsdWdpbnMgc28gdGhvc2UgbW9kdWxlcyBwYXJzZS5cbiAgICAgICAgcmVhY3Qoe1xuICAgICAgICAgICAgYmFiZWw6IHtcbiAgICAgICAgICAgICAgICBwcmVzZXRzOiBbXG4gICAgICAgICAgICAgICAgICAgICdAYmFiZWwvcHJlc2V0LXR5cGVzY3JpcHQnLFxuICAgICAgICAgICAgICAgICAgICAnQGJhYmVsL3ByZXNldC1yZWFjdCcsXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICBwbHVnaW5zOiBbXG4gICAgICAgICAgICAgICAgICAgIFsnQGJhYmVsL3BsdWdpbi1wcm9wb3NhbC1kZWNvcmF0b3JzJywgeyBsZWdhY3k6IHRydWUgfV0sXG4gICAgICAgICAgICAgICAgICAgIFsnQGJhYmVsL3BsdWdpbi1wcm9wb3NhbC1jbGFzcy1wcm9wZXJ0aWVzJywgeyBsb29zZTogdHJ1ZSB9XSxcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSksXG4gICAgICAgIHNlY3VyaXR5SGVhZGVycygpLFxuICAgICAgICBmaXhMZWdhY3lJbXBvcnRzKCksXG4gICAgICAgIHN0dWJMZWdhY3koKSxcbiAgICAgICAgc3ZnTWlzc2luZ0ZhbGxiYWNrKCksXG4gICAgICAgIG1vZGVsQ2F0YWxvZ0J1aWxkUGx1Z2luKCksXG4gICAgICAgIG1vZGVsQ2F0YWxvZ0RldlBsdWdpbigpLFxuICAgICAgICAvLyBDdXN0b20gcHJveHkgcGx1Z2luIGZvciAvZnVuY3Rpb25zL3YxL211YXBpLXByb3h5IHRoYXQgc3RyaXBzXG4gICAgICAgIC8vIG9yaWdpbi9yZWZlcmVyIGhlYWRlcnMgc28gdGhlIFN1cGFiYXNlIGVkZ2UgZnVuY3Rpb24gYWNjZXB0c1xuICAgICAgICAvLyBsb2NhbGhvc3QgcmVxdWVzdHMgZHVyaW5nIGRldmVsb3BtZW50LlxuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogJ211YXBpLXByb3h5LWRldicsXG4gICAgICAgICAgYXBwbHk6ICdzZXJ2ZScsXG4gICAgICAgICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0ID0gcHJvY2Vzcy5lbnYuVklURV9TVVBBQkFTRV9VUkwgfHwgJ2h0dHBzOi8vYnp4b2hrcnhjd29kbGxrZXRjcHouc3VwYWJhc2UuY28nO1xuICAgICAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShjcmVhdGVNdWFwaVByb3h5TWlkZGxld2FyZSh0YXJnZXQpKTtcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICAvLyBPbmx5IGxvYWQgdGhlIGd0bS1ib29zdCBkZXYgcGx1Z2luIGR1cmluZyBgdml0ZSBkZXZgIHRvIGF2b2lkXG4gICAgICAgIC8vIHB1bGxpbmcgaW4gdGhlIGV4cHJlc3MgZGVwZW5kZW5jeSAodXNlZCBieSB0aGUgYmFja2VuZFxuICAgICAgICAvLyBndG1Cb29zdFNlcnZpY2UpIGF0IGJ1aWxkIHRpbWUuIFRoZSBwbHVnaW4gaXRzZWxmIGFscmVhZHkgaGFzXG4gICAgICAgIC8vIGBhcHBseTogJ3NlcnZlJ2AsIGJ1dCB0aGUgZHluYW1pYyBgaW1wb3J0KClgIGluc2lkZVxuICAgICAgICAvLyBgY29uZmlndXJlU2VydmVyYCBnZXRzIHByZS1yZXNvbHZlZCBieSBWaXRlL05vZGUgYXQgY29uZmlnXG4gICAgICAgIC8vIGV2YWx1YXRpb24gdGltZSwgd2hpY2ggZmFpbHMgd2hlbiBleHByZXNzIGlzIG5vdCBpbnN0YWxsZWQuXG4gICAgICAgIC4uLihwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gW2d0bUJvb3N0RGV2UGx1Z2luKCldIDogW10pLFxuICAgICAgICAvLyBTZXJ2ZSB0aGUgQUktVkZYIE5leHQuanMgc3RhdGljIGV4cG9ydCBmcm9tIHRoZSBWaXRlIGRldiBzZXJ2ZXIgc29cbiAgICAgICAgLy8gdGhlIHN0dWRpbyBsaXZlcyBvbiB0aGUgc2FtZSBvcmlnaW4vcG9ydCBhcyB0aGUgcmVzdCBvZiB0aGUgYXBwLlxuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogJ3NlcnZlLWFpLXZmeC1zdGF0aWMnLFxuICAgICAgICAgIGFwcGx5OiAnc2VydmUnLFxuICAgICAgICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAgICAgICAgIGNvbnN0IGFpVmZ4T3V0RGlyID0gcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ2FwcHMvYWktdmZ4L291dCcpO1xuICAgICAgICAgICAgY29uc3QgbWltZVR5cGVzID0ge1xuICAgICAgICAgICAgICAnLmh0bWwnOiAndGV4dC9odG1sJyxcbiAgICAgICAgICAgICAgJy5qcyc6ICdhcHBsaWNhdGlvbi9qYXZhc2NyaXB0JyxcbiAgICAgICAgICAgICAgJy5jc3MnOiAndGV4dC9jc3MnLFxuICAgICAgICAgICAgICAnLnBuZyc6ICdpbWFnZS9wbmcnLFxuICAgICAgICAgICAgICAnLmpwZyc6ICdpbWFnZS9qcGVnJyxcbiAgICAgICAgICAgICAgJy5qcGVnJzogJ2ltYWdlL2pwZWcnLFxuICAgICAgICAgICAgICAnLnN2Zyc6ICdpbWFnZS9zdmcreG1sJyxcbiAgICAgICAgICAgICAgJy5qc29uJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgICAnLndlYnAnOiAnaW1hZ2Uvd2VicCcsXG4gICAgICAgICAgICAgICcubXA0JzogJ3ZpZGVvL21wNCcsXG4gICAgICAgICAgICAgICcud2FzbSc6ICdhcHBsaWNhdGlvbi93YXNtJyxcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoKHJlcSwgcmVzLCBuZXh0KSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IHVybCA9IHJlcS51cmwgfHwgJyc7XG4gICAgICAgICAgICAgIGlmICh1cmwuc3RhcnRzV2l0aCgnL2FpLXZmeC8nKSB8fCB1cmwgPT09ICcvYWktdmZ4Jykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlbGF0aXZlUGF0aCA9IHVybC5yZXBsYWNlKCcvYWktdmZ4JywgJycpLnJlcGxhY2UoL15cXC8vLCAnJykgfHwgJ2luZGV4Lmh0bWwnO1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVQYXRoID0gcGF0aC5qb2luKGFpVmZ4T3V0RGlyLCByZWxhdGl2ZVBhdGgpO1xuICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGZpbGVQYXRoKSAmJiBmcy5zdGF0U3luYyhmaWxlUGF0aCkuaXNGaWxlKCkpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGV4dCA9IHBhdGguZXh0bmFtZShmaWxlUGF0aCk7XG4gICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCBtaW1lVHlwZXNbZXh0XSB8fCAnYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtJyk7XG4gICAgICAgICAgICAgICAgICBmcy5jcmVhdGVSZWFkU3RyZWFtKGZpbGVQYXRoKS5waXBlKHJlcyk7XG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBpZiAodXJsLnN0YXJ0c1dpdGgoJy9fbmV4dC9zdGF0aWMvJykpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZWxhdGl2ZVBhdGggPSB1cmwuc2xpY2UoJy9fbmV4dC9zdGF0aWMvJy5sZW5ndGgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVQYXRoID0gcGF0aC5qb2luKGFpVmZ4T3V0RGlyLCAnX25leHQnLCAnc3RhdGljJywgcmVsYXRpdmVQYXRoKTtcbiAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhmaWxlUGF0aCkgJiYgZnMuc3RhdFN5bmMoZmlsZVBhdGgpLmlzRmlsZSgpKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBleHQgPSBwYXRoLmV4dG5hbWUoZmlsZVBhdGgpO1xuICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgbWltZVR5cGVzW2V4dF0gfHwgJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbScpO1xuICAgICAgICAgICAgICAgICAgZnMuY3JlYXRlUmVhZFN0cmVhbShmaWxlUGF0aCkucGlwZShyZXMpO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgbmV4dCgpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoYXN5bmMgKHJlcSwgcmVzLCBuZXh0KSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IHVybCA9IHJlcS51cmwgfHwgJyc7XG4gICAgICAgICAgICAgIGlmICghdXJsLnN0YXJ0c1dpdGgoJy9hcGkvcHJveHktbXVhcGknKSkgcmV0dXJuIG5leHQoKTtcblxuICAgICAgICAgICAgICBjb25zdCBjaHVua3MgPSBbXTtcbiAgICAgICAgICAgICAgcmVxLm9uKCdkYXRhJywgY2h1bmsgPT4gY2h1bmtzLnB1c2goY2h1bmspKTtcbiAgICAgICAgICAgICAgcmVxLm9uKCdlbmQnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgYm9keSA9IEJ1ZmZlci5jb25jYXQoY2h1bmtzKTtcbiAgICAgICAgICAgICAgICBjb25zdCBxdWVyeSA9IG5ldyBVUkxTZWFyY2hQYXJhbXMocmVxLnVybC5zcGxpdCgnPycpWzFdIHx8ICcnKTtcbiAgICAgICAgICAgICAgICBjb25zdCBhcGlLZXkgPSByZXEuaGVhZGVyc1sneC1hcGkta2V5J107XG4gICAgICAgICAgICAgICAgbGV0IHRhcmdldFBhdGg7XG4gICAgICAgICAgICAgICAgaWYgKHJlcS5tZXRob2QgPT09ICdQT1NUJykge1xuICAgICAgICAgICAgICAgICAgdGFyZ2V0UGF0aCA9ICcvYXBpL3YxL2dlbmVyYXRlX3dhbl9haV9lZmZlY3RzJztcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHJlcS5tZXRob2QgPT09ICdHRVQnICYmIHF1ZXJ5LmhhcygnaWQnKSkge1xuICAgICAgICAgICAgICAgICAgdGFyZ2V0UGF0aCA9IGAvYXBpL3YxL3ByZWRpY3Rpb25zLyR7cXVlcnkuZ2V0KCdpZCcpfS9yZXN1bHRgO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDQwNTtcbiAgICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ01ldGhvZCBub3QgYWxsb3dlZCcgfSkpO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgICBob3N0bmFtZTogJ2FwaS5tdWFwaS5haScsXG4gICAgICAgICAgICAgICAgICBwb3J0OiA0NDMsXG4gICAgICAgICAgICAgICAgICBwYXRoOiB0YXJnZXRQYXRoLFxuICAgICAgICAgICAgICAgICAgbWV0aG9kOiByZXEubWV0aG9kLFxuICAgICAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgICAgICAgICAnY29udGVudC1sZW5ndGgnOiBib2R5Lmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICByZWplY3RVbmF1dGhvcml6ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgaWYgKGFwaUtleSkge1xuICAgICAgICAgICAgICAgICAgb3B0aW9ucy5oZWFkZXJzWyd4LWFwaS1rZXknXSA9IGFwaUtleTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBwcm94eVJlcSA9IGh0dHBzLnJlcXVlc3Qob3B0aW9ucywgKHByb3h5UmVzKSA9PiB7XG4gICAgICAgICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IHByb3h5UmVzLnN0YXR1c0NvZGU7XG4gICAgICAgICAgICAgICAgICBPYmplY3QuZW50cmllcyhwcm94eVJlcy5oZWFkZXJzKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcihrZXksIHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgcHJveHlSZXMucGlwZShyZXMpO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgcHJveHlSZXEub24oJ2Vycm9yJywgKGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignW2FpLXZmeC1hcGldIHJlcXVlc3QgZXJyb3I6JywgZXJyKTtcbiAgICAgICAgICAgICAgICAgIGlmICghcmVzLmhlYWRlcnNTZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAyO1xuICAgICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdQcm94eSBlcnJvcicsIGRldGFpbHM6IGVyci5tZXNzYWdlIH0pKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIGlmIChib2R5Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgIHByb3h5UmVxLndyaXRlKGJvZHkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBwcm94eVJlcS5lbmQoKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgIF0sXG4gICAgb3B0aW1pemVEZXBzOiB7XG4gICAgICAgIC8vIFBvaW50IHRoZSBkZXBlbmRlbmN5IHNjYW5uZXIgYXQgYSBjbGVhbiBlbnRyeSAoc2NyaXB0cy9jbGVyay1vcHRpbWl6ZS1lbnRyeS5qcylcbiAgICAgICAgLy8gaW5zdGVhZCBvZiB0aGUgZnVsbCBpbmRleC5odG1sIGdyYXBoLiBtYWluLmpzIHN0YXRpY2FsbHkgaW1wb3J0cyB0aGVcbiAgICAgICAgLy8gbGVnYWN5IGNvbXBvbmVudCB0cmVlLCB3aG9zZSBzdGFsZSBuYW1lZC1leHBvcnQgaW1wb3J0cyAoZ2V0U3RvcmUsXG4gICAgICAgIC8vIEZvcm1TZWxlY3QgZGVmYXVsdCwgXHUyMDI2KSBhYm9ydCBWaXRlJ3MgaW5pdGlhbCBzY2FuLCB3aGljaCBmb3JjZXNcbiAgICAgICAgLy8gb24tZGVtYW5kIHJlLW9wdGltaXphdGlvbi4gVGhhdCByZS1vcHRpbWl6ZSBzZXJ2ZXMgYSBzZWNvbmQgUmVhY3QgY29weVxuICAgICAgICAvLyB0byBAY2xlcmsvcmVhY3QgYW5kIGxlYXZlcyB0aGUgc2lnbi1pbiAvIHNpZ24tdXAgYnV0dG9ucyBkaXNhYmxlZC5cbiAgICAgICAgLy8gU2Nhbm5pbmcgdGhlIGNsZWFuIGVudHJ5IHByZS1idW5kbGVzIHRoZSBhcHAncyBkZXBzIGluIG9uZSBzdGFibGUgcGFzcztcbiAgICAgICAgLy8gdGhlIGxlZ2FjeSB0cmVlIGlzIHN0aWxsIHNlcnZlZCBhcyBzb3VyY2Ugb24gZGVtYW5kIChpdCBpcyBvdXRzaWRlIHRoZVxuICAgICAgICAvLyBhdXRoL3N0dWRpbyBjcml0aWNhbCBwYXRoKSB3aXRob3V0IGJyZWFraW5nIHRoZSBzY2FuLlxuICAgICAgICBlbnRyaWVzOiBbJ3NjcmlwdHMvY2xlcmstb3B0aW1pemUtZW50cnkuanMnXSxcbiAgICAgICAgaW5jbHVkZTogW1xuICAgICAgICAgICAgJ3JlYWN0JywgJ3JlYWN0LWRvbScsICdyZWFjdC1kb20vY2xpZW50JywgJ0BjbGVyay9yZWFjdCcsXG4gICAgICAgICAgICAnQGNoYWtyYS11aS9yZWFjdCcsXG4gICAgICAgICAgICAvLyBDb21tb24gcnVudGltZSBkZXBzIHB1bGxlZCBpbiBieSBtYWluLmpzIC8gdGhlIHN0dWRpbyAvIHBvcGNvcm4gc29cbiAgICAgICAgICAgIC8vIHRoZXkgYXJlIHByZS1idW5kbGVkIHVwIGZyb250LiBQcmUtYnVuZGxpbmcgYXZvaWRzIHRoZSBsYXRlXG4gICAgICAgICAgICAvLyByZS1vcHRpbWl6ZSB0aGF0IDUwNHMgaW4tZmxpZ2h0IHJlcXVlc3RzIChpbmNsdWRpbmcgdGhlIENsZXJrIGF1dGhcbiAgICAgICAgICAgIC8vIGltcG9ydCkgd2hlbiBhIHByZXZpb3VzbHktdW5zZWVuIGRlcCBpcyBkaXNjb3ZlcmVkIG9uIGZpcnN0IGxvYWQuXG4gICAgICAgICAgICAnanF1ZXJ5JyxcbiAgICAgICAgICAgICdAZW1vdGlvbi9yZWFjdCcsICdAZW1vdGlvbi9zdHlsZWQnLCAnZnJhbWVyLW1vdGlvbicsXG4gICAgICAgICAgICAnaW50ZXJhY3RqcycsICdsb3R0aWUtd2ViJywgJ21pdHQnLCAnbG9kYXNoJywgJ2dsLXRyYW5zaXRpb25zJyxcbiAgICAgICAgICAgICdyZWFjdC1kcm9wem9uZScsICdtb2J4JywgJ21vYngtcmVhY3QnLFxuICAgICAgICBdLFxuICAgICAgICAvLyBTb21lIGxlZ2FjeSBhcHAgbW9kdWxlcyAoZS5nLiBjb21wb25lbnRzL2NvbW1vbi9JbWdseUltYWdlRWRpdG9yKi5qcylcbiAgICAgICAgLy8gYXJlIGF1dGhvcmVkIGFzIC5qcyBidXQgY29udGFpbiBKU1guIFZpdGUncyBkZXAgc2Nhbm5lciBvdGhlcndpc2VcbiAgICAgICAgLy8gcGFyc2VzIHRoZW0gd2l0aCB0aGUgcGxhaW4ganMgbG9hZGVyIGFuZCBmYWlscyB3aXRoXG4gICAgICAgIC8vIFwiVGhlIEpTWCBzeW50YXggZXh0ZW5zaW9uIGlzIG5vdCBjdXJyZW50bHkgZW5hYmxlZFwiLlxuICAgICAgICBlc2J1aWxkT3B0aW9uczogeyBsb2FkZXI6IHsgJy5qcyc6ICdqc3gnIH0gfSxcbiAgICB9LFxuICAgIC8vIE1hbnkgbGVnYWN5IG1vZHVsZXMgdW5kZXIgY29tcG9uZW50cy8gYXJlIGF1dGhvcmVkIGFzIC5qcyBmaWxlcyB0aGF0XG4gICAgLy8gbmV2ZXJ0aGVsZXNzIGNvbnRhaW4gSlNYLiBAdml0ZWpzL3BsdWdpbi1yZWFjdCBvbmx5IHJlbGlhYmx5IHRyYW5zZm9ybXNcbiAgICAvLyAuanN4Ly50c3ggKGFuZCBza2lwcyAuanMgZmlsZXMgdmlhIGNhblNraXBCYWJlbCksIHNvIHRob3NlIG1vZHVsZXMgcmVhY2hcbiAgICAvLyBlc2J1aWxkIHVudHJhbnNmb3JtZWQgYW5kIHRoZSAuanMgbG9hZGVyIHJlamVjdHMgSlNYLiBUZWxsIGVzYnVpbGQgdG8gdXNlXG4gICAgLy8gdGhlIGpzeCBsb2FkZXIgKGF1dG9tYXRpYyBydW50aW1lKSBmb3IgLmpzLy5qc3ggd2hpbGUgbGVhdmluZyAudHMvLnRzeCB0b1xuICAgIC8vIHBsdWdpbi1yZWFjdC9CYWJlbCBmb3IgdHlwZSBzdHJpcHBpbmcuXG4gICAgZXNidWlsZDoge1xuICAgICAgICBsb2FkZXI6ICd0c3gnLFxuICAgICAgICBpbmNsdWRlOiAvXFwuanN4PyQvLFxuICAgICAgICBleGNsdWRlOiAvXFwudHN4PyQvLFxuICAgICAgICBqc3g6ICdhdXRvbWF0aWMnLFxuICAgICAgICB0c2NvbmZpZ1JhdzogeyBjb21waWxlck9wdGlvbnM6IHsgZXhwZXJpbWVudGFsRGVjb3JhdG9yczogdHJ1ZSB9IH0sXG4gICAgfSxcbiAgICBzZXJ2ZXI6IHtcbiAgICAgICAgaG9zdDogJzEyNy4wLjAuMScsXG4gICAgICAgIHBvcnQ6IDMwMDAsXG4gICAgICAgIC8vIElnbm9yZSB0b29sL3Rlc3Qgc2NyYXRjaCBkaXJzIHNvIHRoZWlyIHdyaXRlcyBkb24ndCB0cmlnZ2VyIGRldi1zZXJ2ZXJcbiAgICAgICAgLy8gcmVsb2Fkcy9yZXN0YXJ0cyBtaWQgbW9kdWxlLWdyYXBoIGxvYWQgKHdoaWNoIGNvcnJ1cHRzIHRoZSBicm93c2VyXG4gICAgICAgIC8vIG1vZHVsZSByZWdpc3RyeSBkdXJpbmcgdmVyaWZpY2F0aW9uKS5cbiAgICAgICAgd2F0Y2g6IHtcbiAgICAgICAgICAgIGlnbm9yZWQ6IFsnKiovLnBsYXl3cmlnaHQtbWNwLyoqJywgJyoqLy5raWxvLyoqJ10sXG4gICAgICAgIH0sXG4gICAgICAgIHByb3h5OiB7XG4gICAgICAgICAgICAnL2FpLXZmeCc6IHtcbiAgICAgICAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjMwMDAnLFxuICAgICAgICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgICAgICAgICB3czogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAnL19uZXh0L3N0YXRpYyc6IHtcbiAgICAgICAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjMwMDAnLFxuICAgICAgICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAnL19uZXh0L2ltYWdlJzoge1xuICAgICAgICAgICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMCcsXG4gICAgICAgICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICcvX25leHQvZGF0YSc6IHtcbiAgICAgICAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjMwMDAnLFxuICAgICAgICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAnL2FwaS9haS1hZ2VudCc6IHtcbiAgICAgICAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjMwMDEnLFxuICAgICAgICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAnL2FwaS9hdWRpdC9yZXBvcnQnOiB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdDozMDAxJyxcbiAgICAgICAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgJy9hcGkvc2NlbmUtZGV0ZWN0aW9uJzoge1xuICAgICAgICAgICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMScsXG4gICAgICAgICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICcvYXBpL3NlbWFudGljLXNlYXJjaCc6IHtcbiAgICAgICAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjMwMDEnLFxuICAgICAgICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAnL2FwaS9zcGVlY2gtdHJhbnNjcmlwdGlvbic6IHtcbiAgICAgICAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjMwMDEnLFxuICAgICAgICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAnL2FwaS9hZ2VudHMnOiB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdDozMDAxJyxcbiAgICAgICAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgJy9hcGkvdGVtcGxhdGVzJzoge1xuICAgICAgICAgICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMScsXG4gICAgICAgICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICcvdmlkZW9hZ2VudCc6IHtcbiAgICAgICAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjMwMDEnLFxuICAgICAgICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAvLyAvYXBpL21vZGVsLWNhdGFsb2cgaXMgc2VydmVkIGJ5IG1vZGVsQ2F0YWxvZ0RldlBsdWdpbiBmcm9tIHRoZVxuICAgICAgICAgICAgLy8gc3RhdGljIHB1YmxpYy9hcGkvbW9kZWwtY2F0YWxvZy5qc29uIGZpbGUgKG1pcnJvcnMgdGhlIE5ldGxpZnlcbiAgICAgICAgICAgIC8vIHByb2R1Y3Rpb24gcmV3cml0ZSkuIE5vIHByb3h5IG5lZWRlZC5cbiAgICAgICAgICAgIC8vIC9hcGkvZ3RtLWJvb3N0IGlzIHNlcnZlZCBieSBndG1Cb29zdERldlBsdWdpbiB3aGljaCBtb3VudHMgdGhlXG4gICAgICAgICAgICAvLyBiYWNrZW5kIHNlcnZpY2UgZGlyZWN0bHkgYXMgVml0ZSBtaWRkbGV3YXJlLiBObyBwcm94eSBuZWVkZWQuXG4gICAgICAgICAgICAnL2RpcmVjdG9yLWFwaSc6IHtcbiAgICAgICAgICAgICAgICB0YXJnZXQ6IHByb2Nlc3MuZW52LlZJVEVfRElSRUNUT1JfQVBJX1VSTCB8fCAnaHR0cDovL2xvY2FsaG9zdDo4MDAwJyxcbiAgICAgICAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgICAgICAgICAgcmV3cml0ZTogKHApID0+IHAucmVwbGFjZSgvXlxcL2RpcmVjdG9yLWFwaS8sICcnKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAnL21jcCc6IHtcbiAgICAgICAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjMwMDEnLFxuICAgICAgICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAvLyBQZXJzb25hbGl6YXRpb24vaW50ZWxsaWdlbmNlIEFQSSBtdXN0IGNvbWUgQkVGT1JFIHRoZSBnZW5lcmljIC9hcGlcbiAgICAgICAgICAgIC8vIHJ1bGUgc28gaXQgaXNuJ3Qgcm91dGVkIHRvIHRoZSBNdUFQSSBiYWNrZW5kLiBJbiBkZXYsIHNlcnZlIGZyb20gdGhlXG4gICAgICAgICAgICAvLyBOZXRsaWZ5IGZ1bmN0aW9ucyBDTEkgb24gOjg4ODggaWYgYXZhaWxhYmxlOyBvdGhlcndpc2UgZmFsbCBiYWNrIHRvXG4gICAgICAgICAgICAvLyBhIHNhbWUtb3JpZ2luIHBsYWNlaG9sZGVyIHNvIHRoZSBkZXYgc2VydmVyIGRvZXNuJ3QgY3Jhc2guXG4gICAgICAgICAgICAnL2FwaS9pbnRlbGxpZ2VuY2UnOiB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0OiBwcm9jZXNzLmVudi5WSVRFX0lOVEVMTElHRU5DRV9BUElfVVJMIHx8ICdodHRwOi8vbG9jYWxob3N0Ojg4ODgnLFxuICAgICAgICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aC5yZXBsYWNlKC9eXFwvYXBpXFwvaW50ZWxsaWdlbmNlLywgJy8ubmV0bGlmeS9mdW5jdGlvbnMvaW50ZWxsaWdlbmNlLWFwaScpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICcvYXBpL3BlcnNvbmFsaXplcic6IHtcbiAgICAgICAgICAgICAgICB0YXJnZXQ6IHByb2Nlc3MuZW52LlZJVEVfSU5URUxMSUdFTkNFX0FQSV9VUkwgfHwgJ2h0dHA6Ly9sb2NhbGhvc3Q6ODg4OCcsXG4gICAgICAgICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICAgICAgICAgIHJld3JpdGU6IChwYXRoKSA9PiBwYXRoLnJlcGxhY2UoL15cXC9hcGlcXC9wZXJzb25hbGl6ZXIvLCAnLy5uZXRsaWZ5L2Z1bmN0aW9ucy9wZXJzb25hbGl6ZXItYXBpJyksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgJy9hcGkvYW5hbHl0aWNzJzoge1xuICAgICAgICAgICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMScsXG4gICAgICAgICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICcvYXBpL3BleGVscyc6IHtcbiAgICAgICAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjMwMDEnLFxuICAgICAgICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAnL2FwaSc6IHtcbiAgICAgICAgICAgICAgICB0YXJnZXQ6IHByb2Nlc3MuZW52LlZJVEVfTVVBUElfVVJMIHx8ICdodHRwczovL2FwaS5tdWFwaS5haScsXG4gICAgICAgICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICAgICAgICAgIHNlY3VyZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aC5yZXBsYWNlKC9eXFwvYXBpLywgJycpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICcvcHJveHkvdmlkZW8nOiB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0OiAnaHR0cHM6Ly92aWRlby50d2ltZy5jb20nLFxuICAgICAgICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aC5yZXBsYWNlKC9eXFwvcHJveHlcXC92aWRlby8sICcnKSxcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICdVc2VyLUFnZW50JzogJ01vemlsbGEvNS4wIChXaW5kb3dzIE5UIDEwLjA7IFdpbjY0OyB4NjQpIEFwcGxlV2ViS2l0LzUzNy4zNiAoS0hUTUwsIGxpa2UgR2Vja28pIENocm9tZS8xMjAuMC4wLjAgU2FmYXJpLzUzNy4zNicsXG4gICAgICAgICAgICAgICAgICAgICdSZWZlcmVyJzogJ2h0dHBzOi8veC5jb20vJyxcbiAgICAgICAgICAgICAgICAgICAgJ09yaWdpbic6ICdodHRwczovL3guY29tLycsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgfSxcbiAgICBidWlsZDoge1xuICAgICAgICB0YXJnZXQ6ICdlc25leHQnLFxuICAgICAgICBtaW5pZnk6ICd0ZXJzZXInLFxuICAgIGVzYnVpbGQ6IHtcbiAgICAgICAganN4OiAnYXV0b21hdGljJyxcbiAgICAgICAgbG9hZGVyOiAndHN4JyxcbiAgICAgICAgaW5jbHVkZTogL1xcLihqc3h8dHN4fHRzKSQvLFxuICAgICAgICB0c2NvbmZpZ1JhdzogeyBjb21waWxlck9wdGlvbnM6IHsgZXhwZXJpbWVudGFsRGVjb3JhdG9yczogdHJ1ZSB9IH0sXG4gICAgfSxcbiAgICAgICAgdGVyc2VyT3B0aW9uczoge1xuICAgICAgICAgICAgY29tcHJlc3M6IHtcbiAgICAgICAgICAgICAgICBkcm9wX2NvbnNvbGU6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGRyb3BfZGVidWdnZXI6IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgICAgICAgb3V0cHV0OiB7XG4gICAgICAgICAgICAgICAgLy8gR3JvdXAgaGVhdnksIHNlbGYtY29udGFpbmVkIHZlbmRvciBsaWJzIGludG8gc3RhYmxlIGNodW5rcyBzb1xuICAgICAgICAgICAgICAgIC8vIFJvbGx1cCBkb2Vzbid0IGF1dG8tbWVyZ2UgdGhlbSBpbnRvIHRoZSBlZGl0b3IncyBjaHVuayBncmFwaFxuICAgICAgICAgICAgICAgIC8vICh0aGF0IG1lcmdlIGlzIHdoYXQgc3VyZmFjZWQgdGhlIHByb2R1Y3Rpb24gVERaIGNyYXNoKS5cbiAgICAgICAgICAgICAgICBtYW51YWxDaHVua3MoaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdub2RlX21vZHVsZXMnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdAc3VwYWJhc2UnKSkgcmV0dXJuICd2ZW5kb3InO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdtcDRib3gnKSkgcmV0dXJuICd2ZW5kb3ItbXA0Ym94JztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkOyAvLyBldmVyeXRoaW5nIGVsc2U6IGxldCBSb2xsdXAgZGVjaWRlXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlbnRyeUZpbGVOYW1lczogJ2Fzc2V0cy9bbmFtZV0tW2hhc2hdLmpzJyxcbiAgICAgICAgICAgICAgICBjaHVua0ZpbGVOYW1lczogJ2Fzc2V0cy9bbmFtZV0tW2hhc2hdLmpzJyxcbiAgICAgICAgICAgICAgICBhc3NldEZpbGVOYW1lczogJ2Fzc2V0cy9bbmFtZV0tW2hhc2hdLltleHRdJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBzb3VyY2VtYXA6IHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicsXG4gICAgICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMTAwMFxuICAgIH0sXG4gICAgcHJldmlldzoge1xuICAgICAgICBwb3J0OiAzMDAwLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAnQ2FjaGUtQ29udHJvbCc6ICdwdWJsaWMsIG1heC1hZ2U9MzE1MzYwMDAnLFxuICAgICAgICAgICAgJ1gtRnJhbWUtT3B0aW9ucyc6ICdTQU1FT1JJR0lOJyxcbiAgICAgICAgICAgICdYLUNvbnRlbnQtVHlwZS1PcHRpb25zJzogJ25vc25pZmYnLFxuICAgICAgICAgICAgJ1gtWFNTLVByb3RlY3Rpb24nOiAnMTsgbW9kZT1ibG9jaycsXG4gICAgICAgICAgICAnUmVmZXJyZXItUG9saWN5JzogJ3N0cmljdC1vcmlnaW4td2hlbi1jcm9zcy1vcmlnaW4nXG4gICAgICAgIH1cbiAgICB9XG59KTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL3NoYXNoZWVtb29yZS9Eb3dubG9hZHMvcmVtaXgtbmV3LWVkaXRvci92aXRlL3BsdWdpbnNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy9zaGFzaGVlbW9vcmUvRG93bmxvYWRzL3JlbWl4LW5ldy1lZGl0b3Ivdml0ZS9wbHVnaW5zL3B1YmxpY0F1ZGl0UmVwb3J0UGx1Z2luLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy9zaGFzaGVlbW9vcmUvRG93bmxvYWRzL3JlbWl4LW5ldy1lZGl0b3Ivdml0ZS9wbHVnaW5zL3B1YmxpY0F1ZGl0UmVwb3J0UGx1Z2luLmpzXCI7Ly8gdml0ZS9wbHVnaW5zL3B1YmxpY0F1ZGl0UmVwb3J0UGx1Z2luLmpzXG4vL1xuLy8gSXNvbGF0ZWQgVml0ZSBwbHVnaW4gZm9yIHRoZSBwdWJsaWMgY2xpZW50IGF1ZGl0IHJlcG9ydC5cbi8vXG4vLyBQcm9kdWN0aW9uIGJlaGF2aW9yIChzZXJ2ZXIuanMgKyBiYWNrZW5kL3NlcnZlci5qcyk6XG4vLyAgIEdFVCAvYXBpL2F1ZGl0L3JlcG9ydC86dG9rZW4gIC0+IGJhY2tlbmRcbi8vICAgR0VUIC9hdWRpdC9yZXBvcnQvOnRva2VuICAgICAgLT4gc3RhdGljIHB1YmxpYy9hdWRpdC1yZXBvcnQuaHRtbCAoRXhwcmVzcylcbi8vXG4vLyBEZXYgYmVoYXZpb3IgKHRoaXMgcGx1Z2luKTpcbi8vICAgLSBTZXJ2ZXMgcHVibGljL2F1ZGl0LXJlcG9ydC5odG1sIGZvciBHRVQgL2F1ZGl0L3JlcG9ydC86dG9rZW5cbi8vICAgLSBHRVQgL2FwaS9hdWRpdC9yZXBvcnQvOnRva2VuIGlzIGhhbmRsZWQgYnkgdGhlIGV4aXN0aW5nIGRldiBzZXJ2ZXJcbi8vICAgICBwcm94eSAodml0ZS5jb25maWcuanMpIHdoaWNoIGFscmVhZHkgZm9yd2FyZHMgL2FwaS8qIHRvIHRoZSBiYWNrZW5kXG4vLyAgICAgb24gOjMwMDEuIElmIHRoZSBiYWNrZW5kIGlzIG5vdCBydW5uaW5nLCB0aGUgVml0ZSBwcm94eSByZXR1cm5zXG4vLyAgICAgRUNPTk5SRUZVU0VELCB3aGljaCBpcyB0aGUgY29ycmVjdCBiZWhhdmlvciBmb3IgcmVhbCBkZXZlbG9wbWVudC5cbi8vXG4vLyBXZSBkZWxpYmVyYXRlbHkgZG8gTk9UIGltcGxlbWVudCBhIHNlY29uZCBwcm9kdWN0aW9uIHJlcG9ydCBBUEkgaW4gVml0ZS5cbi8vIFRoaXMgcGx1Z2luIG9ubHkgaW50ZXJjZXB0cyB0aGUgc3RhdGljIEhUTUwgcm91dGUgZHVyaW5nIGRldiBzbyB0aGVcbi8vIGJyb3dzZXIgY2FuIHJlbmRlciB0aGUgcGFnZTsgdGhlIEFQSSBzdGF5cyB3aXRoIHRoZSByZWFsIGJhY2tlbmQuXG5cbmltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tICd1cmwnO1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBwYXRoLmRpcm5hbWUoZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpKTtcblxuY29uc3QgUFVCTElDX0hFQURFUlMgPSB7XG4gICdDYWNoZS1Db250cm9sJzogJ3ByaXZhdGUsIG5vLXN0b3JlJyxcbiAgJ1gtUm9ib3RzLVRhZyc6ICdub2luZGV4LCBub2ZvbGxvdycsXG4gICdSZWZlcnJlci1Qb2xpY3knOiAnbm8tcmVmZXJyZXInLFxuICAnQ29udGVudC1TZWN1cml0eS1Qb2xpY3knOiBbXG4gICAgXCJkZWZhdWx0LXNyYyAnc2VsZidcIixcbiAgICBcInNjcmlwdC1zcmMgJ3NlbGYnICd1bnNhZmUtaW5saW5lJ1wiLFxuICAgIFwic3R5bGUtc3JjICdzZWxmJyAndW5zYWZlLWlubGluZSdcIixcbiAgICBcImltZy1zcmMgJ3NlbGYnIGh0dHBzOiBkYXRhOlwiLFxuICAgIFwibWVkaWEtc3JjICdzZWxmJyBodHRwczpcIixcbiAgICBcImNvbm5lY3Qtc3JjICdzZWxmJ1wiLFxuICAgIFwiZnJhbWUtc3JjICdub25lJ1wiLFxuICAgIFwib2JqZWN0LXNyYyAnbm9uZSdcIixcbiAgICBcImJhc2UtdXJpICdub25lJ1wiLFxuICAgIFwiZnJhbWUtYW5jZXN0b3JzICdub25lJ1wiLFxuICBdLmpvaW4oJzsgJyksXG4gICdYLUNvbnRlbnQtVHlwZS1PcHRpb25zJzogJ25vc25pZmYnLFxuICAnWC1GcmFtZS1PcHRpb25zJzogJ0RFTlknLFxufTtcblxuZnVuY3Rpb24gaXNSZXBvcnRQYXRoKHBhdGhuYW1lKSB7XG4gIHJldHVybiAvXlxcL2F1ZGl0XFwvcmVwb3J0XFwvW14vXSskLy50ZXN0KHBhdGhuYW1lKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHB1YmxpY0F1ZGl0UmVwb3J0UGx1Z2luKCkge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdzbWFydHZpZGVvLXB1YmxpYy1hdWRpdC1yZXBvcnQnLFxuXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgLy8gU2VydmUgL2F1ZGl0L3JlcG9ydC86dG9rZW4gLT4gcHVibGljL2F1ZGl0LXJlcG9ydC5odG1sXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKChyZXEsIHJlcywgbmV4dCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHVybCA9IG5ldyBVUkwocmVxLnVybCB8fCAnJywgJ2h0dHA6Ly9sb2NhbGhvc3QnKTtcbiAgICAgICAgICBpZiAoIWlzUmVwb3J0UGF0aCh1cmwucGF0aG5hbWUpKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV4dCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gJ0dFVCcgJiYgcmVxLm1ldGhvZCAhPT0gJ0hFQUQnKSB7XG4gICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDQwNTtcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0FsbG93JywgJ0dFVCwgSEVBRCcpO1xuICAgICAgICAgICAgcmVzLmVuZCgnTWV0aG9kIE5vdCBBbGxvd2VkJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGh0bWxQYXRoID0gcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uJywgJy4uJywgJ3B1YmxpYycsICdhdWRpdC1yZXBvcnQuaHRtbCcpO1xuICAgICAgICAgIGNvbnN0IGh0bWwgPSBmcy5yZWFkRmlsZVN5bmMoaHRtbFBhdGgsICd1dGY4Jyk7XG4gICAgICAgICAgZm9yIChjb25zdCBbaywgdl0gb2YgT2JqZWN0LmVudHJpZXMoUFVCTElDX0hFQURFUlMpKSB7XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKGssIHYpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAndGV4dC9odG1sOyBjaGFyc2V0PXV0Zi04Jyk7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSAyMDA7XG4gICAgICAgICAgcmVzLmVuZChyZXEubWV0aG9kID09PSAnSEVBRCcgPyAnJyA6IGh0bWwpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgbmV4dChlKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSxc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
