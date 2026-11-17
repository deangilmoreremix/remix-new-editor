// Generates rebranded copies of the upstream README, contributing guide, agent rules and skills into ./agent.
// Originals stay untouched in ./upstream. Prose is rebranded; code, commands and settings are not.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import { visit } from "unist-util-visit";
import YAML from "yaml";

const here = path.dirname(fileURLToPath(import.meta.url));
const brand = JSON.parse(fs.readFileSync(path.join(here, "../smartkiln-brand/brand.json"), "utf8"));
const UP = brand.upstream.name, NAME = brand.name, SLUG = brand.slug;
const word = new RegExp(`\\b${UP}\\b`, "g");
const skillRef = /\bwarmbly-(cli|ops|api|install)\b/g;
const rebrand = (s) => String(s ?? "").replace(word, NAME).replace(skillRef, `${SLUG}-$1`);
const serviceHost = /^https?:\/\/([a-z0-9-]+\.)*warmbly\.com(?=[/:?#]|$)/i;
const dropHost = [/^https?:\/\/(www\.)?x\.com\/WarmblyHQ/i, /^https?:\/\/github\.com\/sponsors\/warmbly/i];

const BANNER = (what) => `> **Reference copy.** ${what} It was written for the open-source upstream project and has been rebranded to ${NAME}: the product name in prose is changed, while commands, binary names, settings, API paths and code blocks keep their original names because the software still uses them. Sections about the backend (workers, migrations, installers, security process) apply to a connected upstream-compatible backend, not to how this repository is maintained.\n\n`;

function transform(md) {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(md);
  visit(tree, (node, i, parent) => {
    if (node.type === "html" && parent) { parent.children.splice(i, 1); return i; }
    if (node.type === "text") node.value = rebrand(node.value);
    if (node.type === "inlineCode" && /^warmbly-(cli|ops|api|install)$/.test(node.value)) node.value = node.value.replace(/^warmbly-/, `${SLUG}-`); // a skill name, not a command
    if (node.type === "image" && parent && !/^https?:/i.test(node.url)) { parent.children.splice(i, 1); return i; }
    if (node.type === "link" && parent) {
      if (dropHost.some((r) => r.test(node.url)) || (serviceHost.test(node.url) && !/docs\.warmbly\.com/i.test(node.url))) { parent.children.splice(i, 1, ...node.children); return i; }
      if (/docs\.warmbly\.com/i.test(node.url)) node.url = node.url.replace(/https?:\/\/docs\.warmbly\.com/i, brand.paths.help.replace(/\/$/, ""));
      if (!/^(https?:|mailto:|#|\/)/i.test(node.url)) { parent.children.splice(i, 1, ...node.children); return i; } // relative repo links do not exist here
    }
  });
  return unified().use(remarkGfm).use(remarkStringify, { bullet: "-", emphasis: "_", fences: true, listItemIndent: "one" }).stringify(tree);
}

function emit(rel, source, what) {
  let raw = fs.readFileSync(path.join(here, "upstream", source), "utf8"); let fm = null;
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (m) { fm = YAML.parse(m[1]) ?? {}; raw = raw.slice(m[0].length); }
  let out = BANNER(what) + transform(raw);
  if (fm) {
    if (fm.name) fm.name = String(fm.name).replace(/^warmbly-/, `${SLUG}-`);
    if (fm.description) fm.description = rebrand(fm.description);
    out = `---\n${YAML.stringify(fm).trim()}\n---\n\n${out}`;
  }
  const dest = path.join(here, "agent", rel); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, out);
}

fs.rmSync(path.join(here, "agent"), { recursive: true, force: true });
emit("README.md", "README.md", "This is the upstream project overview.");
emit("CONTRIBUTING.md", "CONTRIBUTING.md", "This is the upstream contributing guide.");
emit("AGENTS.md", "AGENTS.md", "These are the upstream instructions for AI agents and contributors (`AGENTS.md` and `CLAUDE.md` are identical upstream).");
for (const s of fs.readdirSync(path.join(here, "upstream/skills"))) emit(`skills/${s.replace(/^warmbly-/, `${SLUG}-`)}/SKILL.md`, `skills/${s}/SKILL.md`, "This is an upstream agent skill.");
console.log("agent docs written:", fs.readdirSync(path.join(here, "agent")).length, "entries");
