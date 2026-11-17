// Build-time rebrand of the vendored upstream dashboard. The sources in apps/warmbly-web are never edited;
// this plugin rewrites user-facing text as Vite reads them. See README.md for what is and is not touched.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const brand = JSON.parse(fs.readFileSync(path.join(here, "brand.json"), "utf8"));
const MARK = fs.readFileSync(path.join(here, "mark-path.txt"), "utf8").trim();
const NAME = brand.name;
const UP = brand.upstream.name;
const HELP = brand.paths.help.replace(/\/$/, "");
const word = new RegExp(`\\b${UP}\\b`, "g");

// Links to the original docs become the in-app Help site; its marketing site, hosted app and community become the About page.
const docsUrl = /https?:\/\/docs\.warmbly\.com/g;
const serviceUrl = /https?:\/\/(?:www\.|app\.|dc\.)?warmbly\.com[^"'`\s)<>\\]*/g;

const LOGO_PATH = /<path d="M222\.805 644\.772[^"]*" fill="currentColor" \/>/;

/** Demo data: present the workspace as the hosted product under the new name. */
function brandFixtures(text) {
  const json = JSON.parse(text.replace(/warmbly\.test/g, `${brand.slug}.test`));
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (n && typeof n === "object") {
      if ("self_hosted" in n) n.self_hosted = false;
      for (const v of Object.values(n)) walk(v);
    }
  };
  walk(json);
  const cfg = json["GET /v1/auth/config"]?.b;
  if (cfg) cfg.billing_enabled = true;
  // The hosted workspace lists no linked self-hosted instances.
  json["GET /v1/pool-link/instances"] = { s: 200, b: { data: [], plan: { tier: "paid", enrolled: 0, subscription_required: false } } };
  if (cfg) cfg.brand = { ...(cfg.brand ?? {}), name: NAME, website_url: "", website_label: "", support_email: "", terms_url: "", privacy_url: "" };
  return JSON.stringify(json);
}

export default function rebrand() {
  let outDir = "dist";
  return {
    name: "brand:rebrand",
    enforce: "pre",
    configResolved(c) { outDir = path.resolve(c.root, c.build.outDir); },
    transform(code, id) {
      const file = id.split("?")[0];
      if (!file.includes("/src/") || /\.test\.|node_modules|\/lib\/demo\/server\./.test(file)) return null;
      if (!/\.(tsx?|css|json)$/.test(file)) return null;
      let out = code;
      if (file.endsWith("/components/svg.tsx")) out = out.replace(LOGO_PATH, `<path fillRule="evenodd" clipRule="evenodd" d="${MARK}" fill="currentColor" />`);
      if (file.endsWith("/lib/demo/fixtures.json")) out = brandFixtures(out);
      out = out.replace(docsUrl, `${HELP}`).replace(serviceUrl, `${HELP}/about/`).replace(word, NAME);
      return out === code ? null : { code: out, map: null };
    },
    transformIndexHtml(html) { return html.replace(word, NAME); },
    closeBundle() {
      // Icons and the web manifest.
      for (const f of fs.readdirSync(path.join(here, "icons"))) if (/\.(png|ico)$/.test(f) && fs.existsSync(outDir)) fs.copyFileSync(path.join(here, "icons", f), path.join(outDir, f));
      const mf = path.join(outDir, "site.webmanifest");
      if (fs.existsSync(mf)) fs.writeFileSync(mf, fs.readFileSync(mf, "utf8").replace(word, NAME));
    },
  };
}
