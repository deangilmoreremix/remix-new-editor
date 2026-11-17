#!/usr/bin/env node
/**
 * Keep the Caption Studio identical in remix-new-editor and OpenHiggsBolt.
 *
 *   node scripts/sync-caption-studio.mjs <path-to-OpenHiggsBolt>           copy the core + adapter into that checkout
 *   node scripts/sync-caption-studio.mjs <path-to-OpenHiggsBolt> --check   exit 1 if the checkout differs (use in CI / before a release)
 *
 * remix-new-editor src/lib/captionStudio/*.js                      → OpenHiggsBolt src/shared/captionStudio/
 * remix-new-editor src/lib/captionStudio/hosts/openhiggsbolt/*.js  → OpenHiggsBolt components/
 * Tests, README and the other host adapters are not copied.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const core = resolve(here, '../src/lib/captionStudio');
const [target, flag] = process.argv.slice(2);
if (!target) { console.error('usage: sync-caption-studio.mjs <OpenHiggsBolt checkout> [--check]'); process.exit(2); }
const root = resolve(target);
if (!existsSync(join(root, 'package.json'))) { console.error(`${root} does not look like a repo checkout (no package.json)`); process.exit(2); }

const jobs = [
  ...readdirSync(core).filter((f) => f.endsWith('.js')).map((f) => [join(core, f), join(root, 'src/shared/captionStudio', f)]),
  ...readdirSync(join(core, 'hosts/openhiggsbolt')).filter((f) => f.endsWith('.js')).map((f) => [join(core, 'hosts/openhiggsbolt', f), join(root, 'components', f)]),
];
let differs = 0;
for (const [from, to] of jobs) {
  const next = readFileSync(from, 'utf8');
  const prev = existsSync(to) ? readFileSync(to, 'utf8') : null;
  if (prev === next) continue;
  differs += 1;
  if (flag === '--check') { console.log(`${prev === null ? 'missing' : 'differs'}: ${to}`); continue; }
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, next);
  console.log(`${prev === null ? 'added  ' : 'updated'}: ${to}`);
}
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const need = { '@remotion/captions': 'match your remotion version', '@huggingface/transformers': '4.3.1', mediabunny: '1.64.0' };
const have = { ...pkg.dependencies, ...pkg.devDependencies };
const missing = Object.keys(need).filter((d) => !have[d]);
if (missing.length) console.log(`\nAdd these dependencies in ${root} (then reinstall so the lockfile updates):\n  ${missing.map((d) => `${d}@${need[d]}`).join('\n  ')}`);
console.log(differs ? (flag === '--check' ? `\n${differs} file(s) out of sync` : `\n${differs} file(s) synced`) : '\nIn sync');
process.exit(flag === '--check' && differs ? 1 : 0);
