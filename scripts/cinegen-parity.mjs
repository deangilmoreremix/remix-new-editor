// Generates the per-file CineGen parity data used by docs/cinegen-timeline-parity-matrix.md.
// For every upstream renderer source file (christopherjohnogden/CineGen src/ + web/src/platform): is it in src/cinegen, is it identical after
// alias normalisation, how many lines differ ([remix] edits), and is it reachable from the active editor (src/cinegen/mount.tsx import graph).
import fs from 'node:fs';
import path from 'node:path';
const UP = process.env.CINEGEN_UPSTREAM || '/home/user/deangilmoreremix/cinegen';
const OURS = 'src/cinegen';
const walk = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!/node_modules|__tests__/.test(p)) walk(p, out); } else if (/\.(tsx?|css)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) out.push(p); } return out; };
const norm = (s) => s.replace(/@\/(?=[a-z])/g, '@cinegen/').replace(/@cinegen\/(styles)/g, '@cinegen/$1');
const rows = [];
for (const f of walk(path.join(UP, 'src'))) {
  const rel = path.relative(path.join(UP, 'src'), f);
  const ours = path.join(OURS, rel);
  if (!fs.existsSync(ours)) { rows.push({ rel, up: 'src', status: 'missing', diff: null }); continue; }
  const a = norm(fs.readFileSync(f, 'utf8')).split('\n'); const b = fs.readFileSync(ours, 'utf8').split('\n');
  const setB = new Set(b); const setA = new Set(a);
  const diff = a.filter((l) => !setB.has(l)).length + b.filter((l) => !setA.has(l)).length;
  rows.push({ rel, up: 'src', status: diff === 0 ? 'identical' : 'adapted', diff });
}
// reachability from mount.tsx
const exts = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
const resolve = (from, spec) => {
  let base;
  if (spec.startsWith('@cinegen/')) base = path.join(OURS, spec.slice(9));
  else if (spec.startsWith('.')) base = path.join(path.dirname(from), spec);
  else return null;
  for (const e of exts) { const p = base + e; if (fs.existsSync(p) && fs.statSync(p).isFile()) return p; }
  return null;
};
const seen = new Set(); const stack = [path.join(OURS, 'mount.tsx')];
const IMPORT = /(?:import|export)[^'"`]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;
while (stack.length) {
  const f = stack.pop(); if (seen.has(f)) continue; seen.add(f);
  if (!/\.(tsx?|jsx?)$/.test(f)) continue;
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(IMPORT)) { const r = resolve(f, m[1] || m[2] || m[3]); if (r && !seen.has(r)) stack.push(r); }
}
// the same walk over upstream (from its renderer entry) to tell "unused upstream too" from "disconnected in our port"
const upSeen = new Set(); const upStack = [path.join(UP, 'src/main.tsx')];
const upResolve = (from, spec) => { let base; if (spec.startsWith('@/')) base = path.join(UP, 'src', spec.slice(2)); else if (spec.startsWith('.')) base = path.join(path.dirname(from), spec); else return null; for (const e of exts) { const q = base + e; if (fs.existsSync(q) && fs.statSync(q).isFile()) return q; } return null; };
while (upStack.length) { const f = upStack.pop(); if (upSeen.has(f)) continue; upSeen.add(f); if (!/\.(tsx?|jsx?)$/.test(f)) continue; const src = fs.readFileSync(f, 'utf8'); for (const m of src.matchAll(IMPORT)) { const r = upResolve(f, m[1] || m[2] || m[3]); if (r && !upSeen.has(r)) upStack.push(r); } }
for (const r of rows) r.upstreamReachable = upSeen.has(path.join(UP, 'src', r.rel));
for (const r of rows) r.reachable = r.status !== 'missing' && seen.has(path.join(OURS, r.rel));
const out = { upstreamSha: fs.existsSync(path.join(UP, '.git')) ? fs.readFileSync(path.join(UP, '.git/HEAD'), 'utf8').trim() : '', rows };
fs.mkdirSync('docs/evidence', { recursive: true });
fs.writeFileSync('docs/evidence/cinegen-parity.json', JSON.stringify(out, null, 1));
const c = (f) => rows.filter(f).length;
console.log('upstream files', rows.length, '| identical', c((r) => r.status === 'identical'), '| adapted', c((r) => r.status === 'adapted'), '| missing', c((r) => r.status === 'missing'));
console.log('reachable from mount.tsx', c((r) => r.reachable), '| present but NOT reachable', c((r) => r.status !== 'missing' && !r.reachable));
console.log('present-not-reachable but REACHABLE upstream (real gaps):', rows.filter((r) => r.status !== 'missing' && !r.reachable && r.upstreamReachable).map((r) => r.rel).join(', '));
console.log('missing:', rows.filter((r) => r.status === 'missing').map((r) => r.rel).join(', '));
console.log('present-not-reachable:', rows.filter((r) => r.status !== 'missing' && !r.reachable).map((r) => r.rel).join(', '));
