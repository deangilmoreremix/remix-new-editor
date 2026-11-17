#!/usr/bin/env node
/**
 * Keep the Caption Studio identical in remix-new-editor and OpenHiggsBolt.
 *
 *   node scripts/sync-caption-studio.mjs <path-to-OpenHiggsBolt>                         copy the core + adapters (+ NEW personalization files)
 *   node scripts/sync-caption-studio.mjs <path-to-OpenHiggsBolt> --check                 exit 1 if the checkout differs (CI / before a release)
 *   node scripts/sync-caption-studio.mjs <path-to-OpenHiggsBolt> --include-modified      ALSO overwrite the existing personalization files this work changed
 *
 * remix-new-editor src/lib/captionStudio/*.js                       -> OpenHiggsBolt src/shared/captionStudio/
 * remix-new-editor src/lib/captionStudio/hosts/openhiggsbolt/*.js   -> OpenHiggsBolt components/
 * remix-new-editor src/lib/captionStudio/layout.js(+.d.ts)          -> OpenHiggsBolt src/shared/personalization/captions/studioLayout.js(+.d.ts)
 * New personalization files (studioCaptions, captionStudioBridge, StudioCaptionLine and their tests) are copied outright. Existing shared files
 * that this work edited (captionStyle, useCaptions, CaptionsLayer, types, CaptionsPanel) are only reported unless --include-modified is given,
 * because the OpenHiggsBolt copy may have changed on its own: diff them first. Tests, README and other host adapters are not copied.
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

const pz = resolve(here, '../src/features/personalization/shared/personalization');
const pzTarget = join(root, 'src/shared/personalization');
const NEW_PERSONALIZATION = ['captions/studioCaptions.ts', 'captions/captionStudioBridge.ts', 'preview/StudioCaptionLine.tsx',
  'captions/__tests__/studioCaptions.test.ts', 'preview/__tests__/StudioCaptionLine.test.tsx', 'guided/__tests__/captionsPanel.studio.test.tsx'];
const MODIFIED_PERSONALIZATION = ['captions/captionStyle.ts', 'captions/useCaptions.ts', 'preview/CaptionsLayer.tsx', 'preview/types.ts', 'guided/CaptionsPanel.tsx'];
const includeModified = process.argv.includes('--include-modified');
const jobs = [
  ...readdirSync(core).filter((f) => f.endsWith('.js')).map((f) => [join(core, f), join(root, 'src/shared/captionStudio', f)]),
  ...readdirSync(join(core, 'hosts/openhiggsbolt')).filter((f) => f.endsWith('.js')).map((f) => [join(core, 'hosts/openhiggsbolt', f), join(root, 'components', f)]),
  [join(core, 'layout.js'), join(pzTarget, 'captions/studioLayout.js')],
  [join(core, 'layout.d.ts'), join(pzTarget, 'captions/studioLayout.d.ts')],
  ...NEW_PERSONALIZATION.map((f) => [join(pz, f), join(pzTarget, f)]),
  ...(includeModified ? MODIFIED_PERSONALIZATION.map((f) => [join(pz, f), join(pzTarget, f)]) : []),
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
const mergeByHand = MODIFIED_PERSONALIZATION.filter((f) => !includeModified && existsSync(join(pzTarget, f)) && readFileSync(join(pzTarget, f), 'utf8') !== readFileSync(join(pz, f), 'utf8'));
if (mergeByHand.length) console.log(`\nThese existing personalization files differ and were NOT touched (diff, merge by hand, or rerun with --include-modified):\n  ${mergeByHand.join('\n  ')}`);
const need = { '@remotion/captions': 'match your remotion version', '@huggingface/transformers': '4.3.1', mediabunny: '1.64.0' };
const have = { ...pkg.dependencies, ...pkg.devDependencies };
const missing = Object.keys(need).filter((d) => !have[d]);
if (missing.length) console.log(`\nAdd these dependencies in ${root} (then reinstall so the lockfile updates):\n  ${missing.map((d) => `${d}@${need[d]}`).join('\n  ')}`);
console.log(differs ? (flag === '--check' ? `\n${differs} file(s) out of sync` : `\n${differs} file(s) synced`) : '\nIn sync');
process.exit(flag === '--check' && differs ? 1 : 0);
