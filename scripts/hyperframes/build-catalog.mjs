// Builds the HyperFrames catalog manifest from a checkout of the upstream repo at a PINNED commit.
//
//   node scripts/hyperframes/build-catalog.mjs --upstream /path/to/hyperframes-checkout [--out src/lib/hyperframes/catalog.manifest.json]
//
// The checkout must contain registry/ (and LICENSE). The upstream commit SHA is read from the checkout's git HEAD,
// so the manifest cannot silently describe a different revision. Item sources are NOT copied into the repo here:
// the manifest records every file's path and sha256 so the exact upstream revision can be re-fetched and verified
// (see scripts/hyperframes/vendor-enabled.mjs for the files that ship to customers).
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const up = args.upstream; if (!up) throw new Error('--upstream <dir> is required');
const out = args.out || 'src/lib/hyperframes/catalog.manifest.json';
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const sha = execSync('git rev-parse HEAD', { cwd: up, encoding: 'utf8' }).trim();
const KINDS = [['blocks', 'block'], ['components', 'component'], ['examples', 'example']];
const GENERIC = /^(sans-serif|serif|monospace|cursive|fantasy|system-ui|ui-[a-z-]+|inherit|initial|unset|emoji|math)$/i;

function analyse(html) {
  const scripts = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
  const fonts = new Set();
  for (const m of html.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) for (const f of m[1].split(',')) { const n = f.replace(/!important/i, '').replace(/["']/g, '').trim(); if (n && !GENERIC.test(n) && !n.startsWith('var(') && /^[A-Za-z0-9 _-]+$/.test(n)) fonts.add(n); }
  const has = (re) => re.test(html);
  return {
    scripts, fonts: [...fonts].sort(),
    features: {
      gsapTimeline: has(/__timelines/),
      canvas: has(/<canvas/i), webgl: has(/getContext\(\s*['"]webgl/i) || has(/WebGLRenderer/), webgpu: has(/data-requires-webgpu|webgpu/i),
      three: scripts.some((s) => /three/i.test(s)) || has(/THREE\./),
      video: has(/<video/i), audio: has(/<audio/i), subcomposition: has(/data-composition-src/),
      unseededRandom: has(/Math\.random\(/), infiniteRepeat: has(/repeat\s*:\s*-1/), htmlInCanvas: has(/drawElementImage/),
      remoteImages: [...html.replace(/<link[^>]*rel=["'](?:preconnect|dns-prefetch)["'][^>]*>/gi, '').matchAll(/(?:src|href)=["'](https?:\/\/[^"']+)["']/g)].map((m) => m[1]).filter((u) => !/\.js(\?|$)|fonts\.googleapis|fonts\.gstatic\.com\/?$/.test(u)).slice(0, 5),
    },
  };
}

const items = [];
for (const [dir, type] of KINDS) {
  const base = join(up, 'registry', dir); if (!existsSync(base)) continue;
  for (const name of readdirSync(base).sort()) {
    const p = join(base, name, 'registry-item.json'); if (!existsSync(p)) continue;
    const j = JSON.parse(readFileSync(p, 'utf8'));
    const files = (j.files || []).map((f) => {
      const fp = join(base, name, f.path); const ok = existsSync(fp);
      const buf = ok ? readFileSync(fp) : null;
      // Large binary assets are not in the upstream git repo: they are hosted at `url` (static.heygen.ai). They are
      // pinned by sha256 in catalog.assets.lock.json when vendored (see vendor-enabled.mjs), not here.
      return { path: f.path, target: f.target, kind: f.type, bytes: buf ? buf.length : null, sha256: buf ? sha256(buf) : null, ...(f.url && !ok ? { remoteUrl: f.url } : {}) };
    });
    const mainFile = files.find((f) => f.kind === 'hyperframes:composition' || (f.kind === 'hyperframes:snippet' && f.path.endsWith('.html')));
    const html = mainFile?.sha256 ? readFileSync(join(base, name, mainFile.path), 'utf8') : '';
    const a = html ? analyse(html) : { scripts: [], fonts: [], features: {} };
    const thirdParty = files.filter((f) => /THIRD-PARTY|LICENSE/i.test(f.path)).map((f) => f.path);
    items.push({
      id: name, type, title: j.title || name, description: j.description || '', tags: j.tags || [],
      dimensions: j.dimensions || null, duration: j.duration ?? null,
      mainFile: mainFile?.path || null, sourceSha256: mainFile?.sha256 || null,
      files, totalBytes: files.reduce((n, f) => n + (f.bytes || 0), 0),
      dependencies: { scripts: a.scripts, fonts: a.fonts, assetFiles: files.filter((f) => f.kind === 'hyperframes:asset').length, remoteAssetFiles: files.filter((f) => f.remoteUrl).length, thirdPartyLicenseFiles: thirdParty },
      features: a.features,
      license: thirdParty.length ? 'Apache-2.0 (upstream) + third-party notices in item files' : 'Apache-2.0 (upstream)',
    });
  }
}
const licenseBuf = readFileSync(join(up, 'LICENSE'));
const manifest = {
  schemaVersion: 1,
  upstream: { repo: 'https://github.com/heygen-com/hyperframes', commit: sha, license: 'Apache-2.0', licenseSha256: sha256(licenseBuf), creditsSha256: existsSync(join(up, 'CREDITS.md')) ? sha256(readFileSync(join(up, 'CREDITS.md'))) : null, hyperframesPackageVersion: '0.9.28' },
  counts: Object.fromEntries(KINDS.map(([, t]) => [t, items.filter((i) => i.type === t).length])),
  items,
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(manifest, null, 1) + '\n');
console.log(`manifest: ${items.length} items`, JSON.stringify(manifest.counts), 'commit', sha.slice(0, 12), '->', out);
