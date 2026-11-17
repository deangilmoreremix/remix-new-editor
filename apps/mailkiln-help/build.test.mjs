import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || "/tmp"), "help-"));
execFileSync("node", [path.join(here, "build.mjs"), OUT], { stdio: "pipe" });
const brand = JSON.parse(fs.readFileSync(path.join(here, "../mailkiln-brand/brand.json"), "utf8"));
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const pages = walk(OUT).filter((f) => f.endsWith("index.html"));
const srcCount = walk(path.join(here, "content/docs")).filter((f) => /\.mdx?$/.test(f)).length + walk(path.join(here, "agent")).filter((f) => f.endsWith(".md")).length;
const prose = (h) => h.replace(/<(pre|code|script|footer)\b[\s\S]*?<\/\1>/g, "").replace(/<[^>]+>/g, " ");

test("every upstream docs page and every agent document is built, plus the landing and about pages", () => assert.equal(pages.length, srcCount + 2));
test("the upstream product name never appears in page prose (attribution lives in the footer and About page)", () => {
  for (const f of pages.filter((p) => !p.endsWith("about/index.html"))) assert.ok(!/\bWarmbly\b/.test(prose(fs.readFileSync(f, "utf8"))), f);
});
test("the new brand name is used", () => assert.ok(fs.readFileSync(path.join(OUT, "guides/mailboxes/index.html"), "utf8").includes(brand.name)));
test("code blocks keep technical names untouched", () => {
  const all = pages.map((f) => fs.readFileSync(f, "utf8")).join("\n");
  assert.ok(/<code[^>]*>[^<]*warmbly/i.test(all), "commands and settings in code must keep their original names");
  assert.ok(!all.includes(brand.name.toLowerCase() + "ctl"));
});
test("no unconverted MDX components leak into the output", () => {
  for (const f of pages) assert.ok(!/&lt;(Fold|Callout|Steps?|Cards?|Tabs?|ShortVersion)\b/.test(fs.readFileSync(f, "utf8")), f);
});
test("every internal link resolves to a built page or asset", () => {
  for (const f of pages) for (const m of fs.readFileSync(f, "utf8").matchAll(/href="(\/mailkiln-help\/[^"#]*)/g)) {
    const p = path.join(OUT, m[1].slice(brand.paths.help.length));
    assert.ok(fs.existsSync(p) || fs.existsSync(path.join(p, "index.html")), `${f} -> ${m[1]}`);
  }
});
test("links to the original site, hosted app and community are removed", () => {
  for (const f of pages) assert.ok(!/href="https?:\/\/([a-z0-9-]+\.)*warmbly\.com/.test(fs.readFileSync(f, "utf8")), f);
});
test("search index covers every page and carries no upstream name in titles", () => {
  const idx = JSON.parse(fs.readFileSync(path.join(OUT, "assets/search-index.json"), "utf8"));
  assert.equal(idx.length, srcCount);
  assert.ok(idx.every((p) => !/\bWarmbly\b/.test(p.t + p.d)));
});
test("images referenced by the guides are shipped", () => {
  for (const f of pages) for (const m of fs.readFileSync(f, "utf8").matchAll(/src="(\/mailkiln-help\/[^"]+)"/g)) assert.ok(fs.existsSync(path.join(OUT, m[1].slice(brand.paths.help.length))), m[1]);
});

test("agent documents are rebranded: skills are renamed and cross-references follow", () => {
  const skill = fs.readFileSync(path.join(here, "agent/skills/mailkiln-cli/SKILL.md"), "utf8");
  assert.match(skill, /^name: mailkiln-cli$/m);
  assert.ok(!/\bwarmbly-(cli|ops|api|install)\b/.test(skill.split("\n").filter((l) => !l.startsWith("    ") && !l.startsWith("```")).join("\n")));
  assert.ok(skill.includes("`warmbly`"), "the CLI binary name inside code must be kept");
});
test("the originals are kept verbatim next to the rebranded copies", () => {
  assert.ok(/Warmbly Agent Notes/.test(fs.readFileSync(path.join(here, "upstream/AGENTS.md"), "utf8")));
  assert.ok(/Mailkiln Agent Notes/.test(fs.readFileSync(path.join(here, "agent/AGENTS.md"), "utf8")));
});
