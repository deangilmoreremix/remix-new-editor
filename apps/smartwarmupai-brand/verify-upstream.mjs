// Proves the vendored upstream material is still upstream's true code and content.
// Usage: node apps/smartwarmupai-brand/verify-upstream.mjs <path-to-upstream-clone>
// (clone https://github.com/warmbly/warmbly at the commit named in brand.json). Exits 1 on any undocumented difference.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const brand = JSON.parse(fs.readFileSync(path.join(here, "brand.json"), "utf8"));
const upstream = process.argv[2] && path.resolve(process.argv[2]);
if (!upstream || !fs.existsSync(path.join(upstream, "web/package.json"))) { console.error("Pass the path to a clone of the upstream repository."); process.exit(2); }

const skip = /(^|\/)(node_modules|dist|\.vite|\.git)(\/|$)/;
const walk = (d, base = d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []).flatMap((e) => {
  const p = path.join(d, e.name); const rel = path.relative(base, p);
  if (skip.test(rel)) return [];
  return e.isDirectory() ? walk(p, base) : [rel];
});
const hash = (f) => crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex");

// Documented local changes (apps/warmbly-web/UPSTREAM.md). Anything else must be byte-identical.
const dashboard = {
  modified: ["vite.config.ts", "src/router.tsx", "src/lib/information.ts", "src/lib/api/client/Client.ts", "src/main.tsx"],
  addedPrefixes: ["UPSTREAM.md", "src/lib/demo/"],
};
const checks = [
  { name: "dashboard (web/)", ours: path.join(root, "apps/warmbly-web"), theirs: path.join(upstream, "web"), allowModified: dashboard.modified, allowAdded: dashboard.addedPrefixes },
  { name: "documentation content (docs/content/docs)", ours: path.join(root, "apps/smartwarmupai-help/content/docs"), theirs: path.join(upstream, "docs/content/docs"), allowModified: [], allowAdded: [] },
  // Screenshots were re-captured from the rebranded dashboard on purpose; the OpenAPI files must match.
  { name: "documentation assets (docs/public)", ours: path.join(root, "apps/smartwarmupai-help/assets"), theirs: path.join(upstream, "docs/public"), allowModified: [/^guides\//, "dashboard-campaigns.png"].map(String), allowAdded: [], regexModified: [/^guides\//, /^dashboard-campaigns\.png$/], ignoreMissing: [/^_headers$/, /^logo\.svg$/] },
  { name: "backend and services (cmd, internal, deploy, tracking, realtime, forms, portal, admin, ...)", ours: path.join(root, "apps/warmbly-server"), theirs: upstream,
    include: ["cmd", "internal", "deploy", "tracking", "realtime", "forms", "portal", "admin", "scripts", "resources", "integrations", "hubspot-app", "pipedrive-app", "site", "qa", "ios", "skills", ".github", ".greptile", "go.mod", "go.sum", "tools.go", "Makefile", "docker-compose.yml", "docker-compose.dev.yml", ".env.example", ".golangci.yml", ".dockerignore", ".gitignore", ".trivyignore", "LICENSE"],
    allowAdded: ["UPSTREAM.md", "docs/", "bin/"] },
  { name: "docs app (Fumadocs source, embed.go, content, OpenAPI)", ours: path.join(root, "apps/warmbly-server/docs"), theirs: path.join(upstream, "docs") },
  { name: "agent and contributor originals", ours: path.join(root, "apps/smartwarmupai-help/upstream"), theirs: upstream, only: ["README.md", "CONTRIBUTING.md", "AGENTS.md", "skills/warmbly-cli/SKILL.md", "skills/warmbly-ops/SKILL.md", "skills/warmbly-api/SKILL.md", "skills/warmbly-install/SKILL.md"] },
];

let failed = false;
for (const c of checks) {
  const inc = (f) => !c.include || c.include.some((i) => f === i || f.startsWith(`${i}/`));
  const ours = c.only ?? walk(c.ours).filter(inc); const theirs = c.only ?? walk(c.theirs).filter(inc);
  const theirSet = new Set(theirs); const ourSet = new Set(ours);
  const identical = [], modified = [], added = [], missing = [];
  for (const f of ours) {
    if (!theirSet.has(f)) { added.push(f); continue; }
    (hash(path.join(c.ours, f)) === hash(path.join(c.theirs, f)) ? identical : modified).push(f);
  }
  for (const f of theirs) if (!ourSet.has(f) && !(c.ignoreMissing ?? []).some((r) => r.test(f))) missing.push(f);
  const okMod = (f) => (c.allowModified ?? []).includes(f) || (c.regexModified ?? []).some((r) => r.test(f));
  const okAdd = (f) => (c.allowAdded ?? []).some((p) => f === p || f.startsWith(p));
  const badMod = modified.filter((f) => !okMod(f)); const badAdd = added.filter((f) => !okAdd(f));
  const bad = badMod.length || badAdd.length || missing.length;
  console.log(`${bad ? "FAIL" : "ok  "} ${c.name}: ${identical.length} byte-identical, ${modified.length - badMod.length} documented changes, ${added.length - badAdd.length} documented additions${bad ? "" : "."}`);
  for (const [label, list] of [["undocumented change", badMod], ["undocumented addition", badAdd], ["missing from vendored copy", missing]]) for (const f of list.slice(0, 15)) console.log(`      ${label}: ${f}`);
  if (modified.length - badMod.length) console.log(`      documented changes: ${modified.filter(okMod).slice(0, 8).join(", ")}${modified.filter(okMod).length > 8 ? ", …" : ""}`);
  if (bad) failed = true;
}
const head = (() => { try { return fs.readFileSync(path.join(upstream, ".git/HEAD"), "utf8").trim(); } catch { return ""; } })();
console.log(`expected upstream commit: ${brand.upstream.commit}${head ? ` (clone HEAD: ${head.slice(0, 40)})` : ""}`);
process.exit(failed ? 1 : 0);
