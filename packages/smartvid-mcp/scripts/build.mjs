// Bundle the server into dist/index.js (one file, shebang, Node 22+). Run by `npm run build` and before `npm pack` / `npm publish`.
import { build } from 'esbuild';
import { chmodSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
mkdirSync(path.join(root, 'dist'), { recursive: true });
// The app's model list carries the upstream's name in provider fields and sample-media addresses. None of it is used by the MCP tools
// (they only read ids, names and input shapes), so it is dropped from the shipped file.
const scrubModels = {
  name: 'scrub-model-data',
  setup(b) {
    b.onLoad({ filter: /src[\\/]lib[\\/]models\.js$/ }, (args) => {
      const src = readFileSync(args.path, 'utf8')
        .replace(/^\s*"?provider(_name)?"?\s*:.*$/gm, '')
        .replace(/https?:\/\/[^\s"']*mu-?api[^\s"']*/gi, 'https://example.invalid/sample');
      return { contents: src, loader: 'js' };
    });
  },
};
await build({
  plugins: [scrubModels],
  entryPoints: [path.join(root, 'src/index.js')],
  outfile: path.join(root, 'dist/index.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  minifyWhitespace: true, // also drops the source-path comments
  legalComments: 'none',
  banner: { js: '#!/usr/bin/env node\nimport { createRequire as __cr } from "node:module";\nconst require = __cr(import.meta.url);' },
  logLevel: 'warning',
});
chmodSync(path.join(root, 'dist/index.js'), 0o755);
