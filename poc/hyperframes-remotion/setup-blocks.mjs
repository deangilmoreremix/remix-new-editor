// Installs every HyperFrames registry block into public/blocks/ and vendors the CDN scripts they
// reference into public/blocks/_cdn/ so the PoC (and a real app) never hits a CDN at render time.
// Usage: node setup-blocks.mjs            (fresh install into .hf-cache/)
//        SRC=/path/to/project node setup-blocks.mjs   (reuse a project that already ran `hyperframes add`)
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const HF = 'hyperframes@0.9.28';
const sh = (c, o = {}) => execSync(c, { stdio: 'inherit', ...o });
let src = process.env.SRC;
if (!src) {
  src = '.hf-cache';
  if (!existsSync(src)) {
    sh(`npx -y ${HF} init ${src} --example blank --non-interactive --skip-skills --skip-transcribe`, { env: { ...process.env, HYPERFRAMES_SKIP_SKILLS: '1' } });
    const cat = execSync(`npx -y ${HF} catalog --type block --json`, { encoding: 'utf8', maxBuffer: 1 << 28 });
    const names = JSON.parse(cat.slice(cat.indexOf('['))).map((x) => x.name);
    sh(`npx -y ${HF} add ${names.join(' ')} --no-clipboard --json > /dev/null`, { cwd: src });
  }
}
const comp = join(src, 'compositions');
mkdirSync('public/blocks', { recursive: true });
cpSync(comp, 'public/blocks', { recursive: true });
if (existsSync(join(src, 'assets'))) cpSync(join(src, 'assets'), 'public/blocks/assets', { recursive: true });

const urls = new Set();
for (const f of readdirSync('public/blocks').filter((f) => f.endsWith('.html'))) {
  for (const m of readFileSync(join('public/blocks', f), 'utf8').matchAll(/<script[^>]*\ssrc="(https?:[^"]+)"/g)) urls.add(m[1]);
}
mkdirSync('public/blocks/_cdn', { recursive: true });
const map = {};
for (const u of urls) {
  const local = '_cdn/' + u.replace(/^https?:\/\//, '').replace(/[^\w.-]+/g, '_');
  try { sh(`curl -fsS -o public/blocks/${local} "${u}"`); map[u] = local; } catch { console.warn('could not fetch', u); }
}
writeFileSync('public/blocks/_cdn/map.json', JSON.stringify(map, null, 1));
console.log(`blocks copied; ${Object.keys(map).length}/${urls.size} CDN scripts vendored`);
