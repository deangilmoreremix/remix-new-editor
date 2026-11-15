#!/usr/bin/env node
// Rebuilds docs/features/README.md from page front-matter and checks `code:` paths exist.
// Usage: node scripts/build-feature-index.mjs [--check]   (--check exits 1 on problems, writes nothing)
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dir = path.join(root, 'docs/features');
const STATUSES = ['planned', 'beta', 'live', 'deprecated'];
const check = process.argv.includes('--check');

function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return walk(p);
    return e.name.endsWith('.md') && e.name !== 'README.md' && !e.name.startsWith('_') ? [p] : [];
  });
}

function parse(file) {
  const m = fs.readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const meta = { code: [] };
  let list = null;
  for (const raw of m[1].split('\n')) {
    const line = raw.replace(/\s+#\s.*$/, '');
    const item = line.match(/^\s+-\s+(.+)$/);
    if (item && list) { meta[list].push(item[1].trim()); continue; }
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    list = kv[2] === '' ? kv[1] : null;
    if (kv[2] !== '') meta[kv[1]] = kv[2].trim();
    else meta[kv[1]] = meta[kv[1]] || [];
  }
  return meta;
}

const problems = [];
const rows = walk(dir).map((f) => {
  const rel = path.relative(dir, f);
  const meta = parse(f);
  if (!meta) { problems.push(`${rel}: missing front-matter`); return null; }
  for (const k of ['name', 'status', 'added', 'route']) if (!meta[k]) problems.push(`${rel}: missing "${k}"`);
  if (meta.status && !STATUSES.includes(meta.status)) problems.push(`${rel}: bad status "${meta.status}"`);
  for (const c of meta.code) if (!fs.existsSync(path.join(root, c))) problems.push(`${rel}: code path not found: ${c}`);
  return { rel, ...meta };
}).filter(Boolean).sort((a, b) => (a.area || '').localeCompare(b.area || '') || a.name.localeCompare(b.name));

const table = rows.map((r) => `| ${r.name} | ${r.area || ''} | ${r.status} | ${r.route || ''} | ${r.added || ''} | [page](${r.rel}) |`).join('\n');
const out = `# Feature Registry

One page per feature, kept in the same PR that ships it. Copy \`_TEMPLATE.md\` into \`docs/features/<area>/<feature>.md\`,
fill it in, then run \`node scripts/build-feature-index.mjs\` to refresh this table.
Use \`--check\` in CI or before committing to catch bad status values and dead code paths.

<!-- generated: do not edit below this line -->

| Feature | Area | Status | Where in app | Added | Details |
|---|---|---|---|---|---|
${table}
`;

if (problems.length) console.error(problems.join('\n'));
if (!check) fs.writeFileSync(path.join(dir, 'README.md'), out);
console.log(`${rows.length} feature page(s), ${problems.length} problem(s)`);
process.exit(check && problems.length ? 1 : 0);
