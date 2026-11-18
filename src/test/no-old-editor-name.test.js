// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// The landing-page editor library used to be called by its vendor name all over this code. It is now "editor" everywhere (folders, ids,
// the page-data key, identifiers), and the dependency is installed under a neutral name. This keeps the old word out of source.
// Allowed, because they are not ours to rename:
//   - Google's Gemini voice id/enum and Kokoro's am_puck voice id (values the speech APIs need) in the voice lists, their tests and the generated model catalogs
//   - the unrelated SVG "pucker and bloat" effect
//   - the one import of the library's own export name (mount.jsx)
const WORD = new RegExp(['pu', 'ck'].join(''), 'i');
const SELF = 'src/test/no-old-editor-name.test.js';
const ALLOWED_FILES = new Set([
  'src/lib/models.js', 'src/lib/muapi/liveModels.json', 'src/features/personalization/packages/studio/src/models.js',
  'src/cinegen/adapters/web-elevenlabs.ts', 'src/cinegen/__tests__/adapters/elevenlabs.test.ts', SELF,
  'src/cinegen/components/edit/stage4/local-audio-panel.tsx', // Kokoro's own voice id (am_puck), a value the speech model needs
]);
const TEXT = /\.(js|jsx|ts|tsx|mjs|cjs|css|json|md|html)$/;
const ROOTS = ['src', 'styles', 'scripts', 'docs', 'netlify', 'public'];
const SKIP_DIR = new Set(['node_modules', '.git']);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else yield p;
  }
}

describe('the old landing-editor name is gone from the code', () => {
  const root = process.cwd();
  const hits = [];
  const names = [];
  for (const r of ROOTS) {
    for (const file of walk(join(root, r))) {
      const rel = relative(root, file);
      if (ALLOWED_FILES.has(rel)) continue;
      if (WORD.test(rel.split('/').pop())) names.push(rel);
      if (!TEXT.test(file) || statSync(file).size > 2_000_000) continue;
      const text = readFileSync(file, 'utf8')
        .replace(/pucker\w*/gi, '')                                          // the unrelated SVG effect
        .replace(/import \{ Puck as PageEditor, Render \} from '@page-editor\/core';/, '')   // the library's own export, used under a neutral name
        .replace(/gemini:Puck/g, '');
      if (WORD.test(text)) hits.push(rel);
    }
  }
  it('no file name contains it', () => expect(names).toEqual([]));
  it('no source, style, script or doc mentions it', () => expect(hits).toEqual([]));
  it('the dependency is installed under a neutral name', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(Object.keys(pkg.dependencies).filter((k) => WORD.test(k))).toEqual([]);
    expect(pkg.dependencies['@page-editor/core']).toMatch(/^npm:/);
  });
});
