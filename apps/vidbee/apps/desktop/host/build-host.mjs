import { build } from 'esbuild';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const desktop = path.resolve(import.meta.dirname, '..');
const root = path.resolve(desktop, '../..'); // vendored workspace root (skills/, packages/)
const host = import.meta.dirname;

// Vite-only imports used by upstream's main/shared code, resolved for a plain esbuild bundle.
const viteCompat = {
  name: 'vite-compat',
  setup(b) {
    // `?asset` → absolute file path string (electron-vite semantics)
    b.onResolve({ filter: /\?asset$/ }, (a) => ({ path: path.resolve(a.resolveDir, a.path.replace(/\?asset$/, '')), namespace: 'asset' }));
    b.onLoad({ filter: /.*/, namespace: 'asset' }, (a) => ({ contents: `export default ${JSON.stringify(a.path)}`, loader: 'js' }));
    // `?raw` → file contents
    b.onResolve({ filter: /\?raw$/ }, (a) => ({ path: path.resolve(a.resolveDir, a.path.replace(/\?raw$/, '')), namespace: 'raw' }));
    b.onLoad({ filter: /.*/, namespace: 'raw' }, (a) => ({ contents: `export default ${JSON.stringify(readFileSync(a.path, 'utf8'))}`, loader: 'js' }));
    // shared/builtin-skills.ts uses import.meta.glob over skills/*/SKILL.md → inline the same files.
    b.onLoad({ filter: /shared\/builtin-skills\.ts$/ }, () => {
      const dir = `${root}/skills`;
      const docs = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort().map((n) => readFileSync(`${dir}/${n}/SKILL.md`, 'utf8'));
      return { loader: 'ts', contents: `import { parse } from 'yaml'
const documents = ${JSON.stringify(docs)}
export const BUILTIN_SKILLS = documents.map((document) => {
  const match = document.match(/^---\\r?\\n([\\s\\S]*?)\\r?\\n---\\r?\\n/)
  if (!match?.[1]) throw new Error('Built-in SKILL.md requires YAML frontmatter')
  const metadata = parse(match[1])
  return { name: metadata.name, description: metadata.description, content: document.slice(match[0].length).trim(), document }
})` };
    });
    // analytics package is not vendored (blocked + not wanted in a web port)
    b.onResolve({ filter: /^electron-ga4-telemetry/ }, () => ({ path: 'ga4-stub', namespace: 'ga4' }));
    b.onLoad({ filter: /.*/, namespace: 'ga4' }, () => ({ contents: 'const noop = () => {}; export const installGoogleTagPreload = noop; export const installGoogleAnalytics = () => ({}); export const initializeTelemetry = noop; export const trackEvent = noop; export default {};', loader: 'js' }));
    // crash reporting is not part of a web port
    b.onResolve({ filter: /^@sentry\// }, () => ({ path: 'sentry-stub', namespace: 'sentry' }));
    b.onLoad({ filter: /.*/, namespace: 'sentry' }, () => ({ contents: 'const noop = () => {}; export const init = noop, captureException = noop, captureMessage = noop, addBreadcrumb = noop, setUser = noop, setTag = noop, setContext = noop, withScope = (f) => f && f({ setTag: noop, setExtra: noop, setContext: noop }), flush = async () => true, close = async () => true, getClient = () => undefined, setExtra = noop, startSpan = (_o, f) => f && f(), logger = { info: noop, warn: noop, error: noop, debug: noop }; export default {};', loader: 'js' }));
  },
};

const common = {
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  logLevel: 'warning',
  absWorkingDir: root,
  alias: { '@better-auth/electron/client': `${host}/better-auth-electron-stub.mjs`, '@better-auth/electron/storage': `${host}/better-auth-electron-stub.mjs`, '@better-auth/electron/main': `${host}/better-auth-electron-stub.mjs`, '@electron-toolkit/utils': `${host}/electron-toolkit-stub.mjs`, 'electron-updater': `${host}/electron-updater-stub.mjs`, 'electron-log/main': `${host}/electron-log-stub.mjs`, 'electron-log': `${host}/electron-log-stub.mjs`, electron: `${host}/electron-stub.mjs`, '@main': `${desktop}/src/main`, '@shared': `${desktop}/src/shared` },
  external: ['better-sqlite3', 'sherpa-onnx-node', 'sherpa-onnx-*', 'jiti', '@gotgenes/*', '@mzwing/*'],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  define: { __GLITCHTIP_DSN__: '""', __GLITCHTIP_ENVIRONMENT__: '"web"', __GLITCHTIP_RELEASE__: '"vidbee-web"' },
  plugins: [viteCompat],
  nodePaths: [`${desktop}/node_modules`],
};
const out = `${desktop}/out-web`;
await build({ ...common, entryPoints: [`${host}/server.ts`], outfile: `${out}/server.mjs` });
await build({ ...common, entryPoints: [`${root}/packages/transcription/src/worker/entry.ts`], outfile: `${out}/transcription-worker.js` });
await build({ ...common, entryPoints: [`${desktop}/src/main/lib/local-speech-worker.ts`], outfile: `${out}/speech-worker.js` });
console.log('built');
