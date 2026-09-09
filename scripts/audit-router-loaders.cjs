const fs = require('fs');
const path = require('path');
const routerPath = 'src/lib/router.js';
const router = fs.readFileSync(routerPath, 'utf8');
const pageLoaderMatch = router.match(/const pageLoaders = ({[\s\S]*?});/);
if (!pageLoaderMatch) {
  console.log('No pageLoaders block found');
  process.exit(1);
}
const pageLoadersStr = pageLoaderMatch[1];
const routes = [...pageLoadersStr.matchAll(/^\s*([^:]+):\s*\(\)\s*=>\s*import\(["']([^"']+)["']\)/gm)].map(m => ({ route: m[1].trim(), importPath: m[2].trim() }));
const results = [];
for (const r of routes) {
  const raw = r.importPath.replace(/^\.\.\//, '').replace(/\.js$/, '');
  const ext = raw.endsWith('.tsx') ? '.tsx' : '.js';
  const base = raw.replace(/\.tsx$/, '').replace(/\.js$/, '');
  const p = path.join('src', base + ext);
  if (!fs.existsSync(p)) {
    results.push({ route: r.route, status: 'missing-file', expected: p });
    continue;
  }
  const code = fs.readFileSync(p, 'utf8');
  const baseName = path.basename(base);
  const hasNamedExport = code.includes('export function ' + baseName + '(') || code.includes('export async function ' + baseName + '(');
  const hasDefaultExport = /export\s+default\s+(async\s+function|function)/.test(code);
  if (!hasNamedExport && !hasDefaultExport) {
    results.push({ route: r.route, status: 'missing-export', file: p });
    continue;
  }
  results.push({ route: r.route, status: 'ok', file: p });
}
const missing = results.filter(r => r.status !== 'ok');
console.log(JSON.stringify({ total: results.length, ok: results.length - missing.length, broken: missing.length, brokenDetails: missing }, null, 2));
