// Copies ONLY the customer-enabled HyperFrames blocks (src/lib/hyperframes/catalog.enabled.json) from a checkout of the
// pinned upstream into public/hyperframes/blocks/, verifying every file's sha256 against the manifest, and vendors the
// external scripts those blocks reference (so nothing is fetched from a CDN at render time).
//
//   node scripts/hyperframes/vendor-enabled.mjs --upstream /path/to/checkout [--out public/hyperframes/blocks]
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const a = process.argv.slice(2); const get = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const up = get('upstream'); if (!up) throw new Error('--upstream <dir> is required');
const out = get('out', 'public/hyperframes/blocks');
const enabled = JSON.parse(readFileSync('src/lib/hyperframes/catalog.enabled.json', 'utf8'));
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: up, encoding: 'utf8' }).trim();
if (sha !== enabled.upstreamCommit) throw new Error(`upstream checkout is ${sha}, but the enabled list is pinned to ${enabled.upstreamCommit}`);
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
// start clean so nothing that is no longer enabled stays shipped
for (const d of [out, join(out, '..', 'components'), join(out, '..', 'examples')]) rmSync(d, { recursive: true, force: true });
mkdirSync(join(out, '_cdn'), { recursive: true });
const urls = new Set(); let files = 0;
for (const item of enabled.items) {
  const kind = item.type === 'example' ? 'examples' : item.type === 'component' ? 'components' : 'blocks';
  for (const f of item.files) {
    const src = join(up, 'registry', kind, item.id, f.path);
    const buf = readFileSync(src);
    if (sha256(buf) !== f.sha256) throw new Error(`${item.id}/${f.path}: sha256 does not match the manifest`);
    let dest, isMain = false;
    if (kind === 'blocks') { isMain = f.path === item.id + '.html'; dest = isMain ? join(out, item.id + '.html') : join(out, f.target.replace(/^compositions\//, '')); }
    else if (kind === 'components') { isMain = f.path === item.id + '.html'; dest = join(out, '..', 'components', f.path); }
    else { isMain = f.path.endsWith('.html'); dest = join(out, '..', 'examples', item.id, f.path); }
    mkdirSync(dirname(dest), { recursive: true }); cpSync(src, dest); files++;
    if (kind === 'blocks' && isMain && f.sha256 !== item.sourceSha256) throw new Error(`${item.id}: main file hash differs from sourceSha256`);
    if (isMain) for (const m of buf.toString('utf8').matchAll(/<script[^>]*\ssrc="((?:https?:)?\/\/[^"]+)"/g)) urls.add(m[1].startsWith('//') ? `https:${m[1]}` : m[1]);
  }
}
const map = {}; const integrity = {};
for (const u of [...urls].sort()) {
  const local = '_cdn/' + u.replace(/^https?:\/\//, '').replace(/[^\w.-]+/g, '_');
  execFileSync('curl', ['-fsS', '-o', join(out, local), u], { stdio: 'inherit' });
  map[u] = local; integrity[local] = { url: u, sha256: sha256(readFileSync(join(out, local))) };
}
writeFileSync(join(out, '_cdn', 'map.json'), JSON.stringify(map, null, 1));
writeFileSync(join(out, '_cdn', 'integrity.json'), JSON.stringify(integrity, null, 1));
writeFileSync(join(out, '_PINNED.json'), JSON.stringify({ upstreamCommit: sha, items: enabled.items.length, files }, null, 1));
console.log(`vendored ${enabled.items.length} enabled blocks (${files} files) and ${urls.size} external scripts from ${sha.slice(0, 12)} -> ${out}`);
