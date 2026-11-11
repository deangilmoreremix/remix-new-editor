// Vendors the RemotionUI registry (https://remotionui.com, MIT, package remotion-ui) into the editor as pinned, hashed source.
//   node scripts/remotionui/vendor.mjs --items <dir of registry item JSON files> [--registry https://remotionui.com/r]
// Each file is written under src/lib/editor/remotion/remotionui/vendored/ with `@/remotion/...` imports rewritten to relative
// paths and `from "remotion"` pointed at the local shim (so a clip sees its own duration). Writes src/lib/remotionui/registry.lock.json.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const a = process.argv.slice(2); const get = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const dir = get('items'); if (!dir) throw new Error('--items <dir> is required');
const ROOT = 'src/lib/editor/remotion/remotionui/vendored';
const sha = (s) => createHash('sha256').update(s).digest('hex');
rmSync(ROOT, { recursive: true, force: true });
const dest = (target) => {
  const t = target.replace(/^src\//, '');
  return join(ROOT, t.replace(/^remotion\//, ''));            // remotion/lib/x.ts -> lib/x.ts ; compositions/x/index.tsx stays
};
const lock = { source: 'https://remotionui.com/r/presets/default', license: 'MIT (remotion-ui)', items: [] };
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  const it = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const rec = { name: it.name, type: it.type, description: it.description, dependencies: it.dependencies || [], registryDependencies: (it.registryDependencies || []).map((d) => d.replace('@remotionui/', '')),
    composition: it.composition || null, atlas: it.atlas || null, files: [] };
  for (const file of it.files) {
    const out = dest(file.target);
    const src = file.content;
    const rel = (spec) => { // spec like "@/remotion/lib/x" or "@/compositions/x/index"
      const m = spec.match(/^@\/(remotion\/)?(.+)$/); const to = join(ROOT, m[2]);
      const r = relative(dirname(out), to); return r.startsWith('.') ? r : './' + r;
    };
    const shim = relative(dirname(out), join(ROOT, '..', 'shim')); const shimRel = shim.startsWith('.') ? shim : './' + shim;
    const text = src
      .replace(/from\s+(["'])remotion\1/g, `from "${shimRel}"`)
      .replace(/from\s+(["'])(@\/[^"']+)\1/g, (_, q, s) => `from "${rel(s)}"`);
    mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, text);
    rec.files.push({ target: file.target, path: out.replace(/\\/g, '/'), sha256: sha(src), size: src.length });
  }
  lock.items.push(rec);
}
writeFileSync('src/lib/remotionui/registry.lock.json', JSON.stringify(lock, null, 1));
console.log(`vendored ${lock.items.length} registry items (${lock.items.reduce((n, i) => n + i.files.length, 0)} files)`);
