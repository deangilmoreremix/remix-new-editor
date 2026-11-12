// Vendors catalog items from a PINNED upstream checkout into public/blocks/ (flat) for the evaluation harness.
//   node setup-pinned.mjs --upstream <checkout> [--only a,b,c]
// Blocks: <name>.html plus each file's target (compositions/ prefix removed). Components (snippets): <name>.html.
// External CDN scripts referenced by the HTML are downloaded once into public/blocks/_cdn/ with a map.json.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
const a = process.argv.slice(2); const get = (k) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : null; };
const up = get('upstream'); const only = get('only')?.split(',');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: up, encoding: 'utf8' }).trim();
const out = 'public/blocks'; mkdirSync(out, { recursive: true });
const urls = new Set(); let n = 0;
for (const [dir, type] of [['blocks', 'block'], ['components', 'component']]) {
  const base = join(up, 'registry', dir);
  for (const name of readdirSync(base)) {
    if (only && !only.includes(name)) continue;
    const p = join(base, name, 'registry-item.json'); if (!existsSync(p)) continue;
    const j = JSON.parse(readFileSync(p, 'utf8'));
    for (const f of j.files || []) {
      const src = join(base, name, f.path);
      let dest;
      if (!existsSync(src)) { // large binary assets live on the registry CDN, not in git: fetch them from the item's `url`
        if (f.type === 'hyperframes:asset' && f.url) { const d = join(out, f.target.replace(/^compositions\//, '')); if (!existsSync(d)) { mkdirSync(dirname(d), { recursive: true }); try { execFileSync('curl', ['-fsS', '-o', d, f.url], { stdio: 'inherit' }); } catch { console.warn('could not fetch', f.url); } } }
        continue;
      }
      if (f.kind === 'x') continue;
      if (f.type === 'hyperframes:composition' || (f.type === 'hyperframes:snippet' && f.path === name + '.html')) dest = join(out, name + '.html');
      else if (f.type === 'hyperframes:asset') dest = join(out, f.target.replace(/^compositions\//, ''));
      else continue;
      mkdirSync(dirname(dest), { recursive: true }); cpSync(src, dest);
      if (dest.endsWith(name + '.html') && dest === join(out, name + '.html')) { n++; for (const m of readFileSync(src, 'utf8').matchAll(/<script[^>]*\ssrc="(https?:[^"]+)"/g)) urls.add(m[1]); }
    }
  }
}
mkdirSync(join(out, '_cdn'), { recursive: true });
const mapPath = join(out, '_cdn', 'map.json'); const map = existsSync(mapPath) ? JSON.parse(readFileSync(mapPath, 'utf8')) : {};
for (const u of urls) {
  if (map[u]) continue;
  const local = '_cdn/' + u.replace(/^https?:\/\//, '').replace(/[^\w.-]+/g, '_');
  try { execFileSync('curl', ['-fsS', '-o', join(out, local), u], { stdio: 'inherit' }); map[u] = local; } catch { console.warn('could not fetch', u); }
}
writeFileSync(mapPath, JSON.stringify(map, null, 1));
writeFileSync(join(out, '_PINNED.json'), JSON.stringify({ upstreamCommit: sha, items: n }));
console.log(`vendored ${n} items from ${sha.slice(0, 12)}; CDN scripts: ${Object.keys(map).length}`);
