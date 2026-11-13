// Builds src/lib/remotionui/catalog.json from the vendored RemotionUI sources + registry.lock.json.
// Editable fields come from each component's exported `...Props` type and its literal destructuring defaults.
// `enabled` comes from src/lib/remotionui/verification.json (written by the render harness), never hand-edited.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { literalAttrs, splitSnippet } from './jsx.mjs';

const usage = JSON.parse(readFileSync('src/lib/remotionui/docs-usage.json', 'utf8')).items;

const lock = JSON.parse(readFileSync('src/lib/remotionui/registry.lock.json', 'utf8'));
const ver = existsSync('src/lib/remotionui/verification.json') ? JSON.parse(readFileSync('src/lib/remotionui/verification.json', 'utf8')) : {};
const CATEGORY = { atoms: 'Primitives', signals: 'Data & media', vectors: 'Paths & shapes', spatial: 'Maps & device', '3d': '3D', shaders: 'Shaders', motion: 'Motion graphics', blocks: 'Scenes', cuts: 'Transitions', reels: 'Compositions' };
const HEAVY = ['@react-three/fiber', '@react-three/drei', '@remotion/three', 'maplibre-gl', '@paper-design/shaders-react', '@turf/turf'];
const SAMPLE = { title: 'Your title here', subtitle: 'A short supporting line', name: 'Alex Morgan', label: 'Label', text: 'Your text here', headline: 'Your headline', description: 'A short description', caption: 'Your caption', badge: 'NEW', eyebrow: 'Chapter 01', quote: 'Say something worth quoting.', author: 'Alex Morgan', role: 'Creator', cta: 'Learn more', message: 'Your message here', question: 'Your question here', value: '42' };
const skipped = existsSync('src/lib/remotionui/skipped.json') ? JSON.parse(readFileSync('src/lib/remotionui/skipped.json', 'utf8')) : {};
const fieldsFile = existsSync('src/lib/remotionui/fields.json') ? JSON.parse(readFileSync('src/lib/remotionui/fields.json', 'utf8')) : null; // keys of the fields measured to change the picture
const byName = new Map(lock.items.map((i) => [i.name, i]));
const sources = (i) => i.files.map((f) => readFileSync(f.path, 'utf8')).join('\n');
const closure = (n, seen = new Set()) => { if (seen.has(n) || !byName.has(n)) return seen; seen.add(n); byName.get(n).registryDependencies.forEach((d) => closure(d, seen)); return seen; };
const pretty = (s) => s.replace(/[-_]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

function editables(src) {
  const t = src.match(/export type (\w+Props)\s*=\s*\{([\s\S]*?)\n\};?/);
  if (!t) return { props: [], component: (src.match(/export (?:const|function) ([A-Z]\w*)/) || [])[1] || null };
  const comp = src.match(/export const (\w+)\s*(?::[^=]+)?=\s*\(\s*\{([\s\S]*?)\}\s*(?::[^)]*)?\)\s*=>/) || src.match(/export function (\w+)\s*\(\s*\{([\s\S]*?)\}\s*(?::[^)]*)?\)/);
  const defaults = {};
  if (comp) for (const m of comp[2].matchAll(/(?:^|[\n,{])\s*(\w+)\s*=\s*("[^"\n]*"|'[^'\n]*'|-?\d+(?:\.\d+)?|true|false)\s*(?=[,\n}])/g)) { const r = m[2]; defaults[m[1]] = r === 'true' ? true : r === 'false' ? false : /^["']/.test(r) ? r.slice(1, -1) : Number(r); }
  const out = [];
  const body = t[2]; const re = /(?:\/\*\*([\s\S]*?)\*\/\s*)?\n?\s*(\w+)(\?)?:\s*([^;\n]+(?:\n\s+\|[^;\n]+)*);/g; let m;
  while ((m = re.exec(body))) {
    const [, doc, key, opt, tyRaw] = m; const ty = tyRaw.replace(/\s+/g, ' ').trim();
    const label = pretty(key); const hint = (doc || '').replace(/\s*\*\s*/g, ' ').trim().slice(0, 140);
    const def = defaults[key];
    const color = /colou?r$/i.test(key) && ty === 'string' && (def === undefined ? !opt : /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(String(def)));
    if (ty === 'string' || color) { const d = def ?? (opt ? undefined : SAMPLE[key.toLowerCase()]); if (d !== undefined) out.push({ key, label, hint, type: color ? 'color' : 'text', defaultValue: d }); }
    else if (ty === 'number') { if (typeof def === 'number') out.push({ key, label, hint, type: 'number', defaultValue: def, step: Math.abs(def) < 5 ? 0.05 : 1 }); }
    else if (ty === 'boolean') { if (typeof def === 'boolean') out.push({ key, label, hint, type: 'boolean', defaultValue: def }); }
    else { const lits = [...ty.matchAll(/"([^"]+)"/g)].map((x) => x[1]); if (lits.length > 1 && lits.length === ty.split('|').length && lits.includes(def)) out.push({ key, label, hint, type: 'select', defaultValue: def, options: lits }); }
  }
  const exp = comp ? comp[1] : (src.match(/export (?:const|function) ([A-Z]\w*)/g) || []).map((x) => x.split(' ').pop())[0] || null;
  return { props: out, component: exp };
}

const items = [];
for (const i of lock.items) {
  if (i.type === 'registry:lib' || i.type === 'registry:hook') continue;
  const src = sources(i); const a = i.atlas || {}; const comp = i.composition;
  const kind = i.files[0].target.includes('/compositions/') ? 'compositions' : i.files[0].target.includes('/scenes/') ? 'scenes' : 'primitives';
  const needs = [...new Set([...closure(i.name)].flatMap((n) => byName.get(n).dependencies))].filter((d) => HEAVY.includes(d));
  const e = editables(src);
  const u = usage[i.name]; const snip = u?.usage?.length ? literalAttrs(splitSnippet(u.usage[u.usage.length - 1]).body.replace(/^\s*\/\/.*$/gm, ''), e.component) : {};
  const byKey = new Map(e.props.map((p) => [p.key, p]));
  for (const [k, val] of Object.entries(snip)) {
    if (['children', 'key', 'style', 'className'].includes(k)) continue;
    const ex = byKey.get(k);
    if (ex) { if (typeof val === typeof ex.defaultValue) ex.defaultValue = val; continue; }
    const ty = typeof val; if (!['string', 'number', 'boolean'].includes(ty)) continue;
    if (typeof val === 'string' && /^(src|url|href|image|video|audio)/i.test(k)) continue;
    byKey.set(k, { key: k, label: pretty(k), hint: '', type: ty === 'string' ? (/colou?r$/i.test(k) && /^#/.test(val) ? 'color' : 'text') : ty, defaultValue: val, ...(ty === 'number' ? { step: Math.abs(val) < 5 ? 0.05 : 1 } : {}) });
  }
  e.props = [...byKey.values()];
  // transition demos show two scenes the customer can restyle: their own props are the scene text and colors
  if (CATEGORY[(i.atlas || {}).lane] === 'Transitions') e.props = [{ key: 'textA', label: 'First scene text', hint: '', type: 'text', defaultValue: 'Scene A' }, { key: 'textB', label: 'Second scene text', hint: '', type: 'text', defaultValue: 'Scene B' }, { key: 'colorA', label: 'First scene color', hint: '', type: 'color', defaultValue: '#2563eb' }, { key: 'colorB', label: 'Second scene color', hint: '', type: 'color', defaultValue: '#f97316' }];
  if (existsSync(`src/lib/editor/remotion/remotionui/demos/${i.name}.jsx`)) { // demo child text turned into fields by demos.mjs
    for (const m of readFileSync(`src/lib/editor/remotion/remotionui/demos/${i.name}.jsx`, 'utf8').matchAll(/__o\.text(\d+) \?\? ("(?:[^"\\]|\\.)*")/g)) e.props.push({ key: `text${m[1]}`, label: `Text ${m[1]}: ${JSON.parse(m[2]).slice(0, 26)}`, hint: '', type: 'text', defaultValue: JSON.parse(m[2]) });
  }
  if (fieldsFile && fieldsFile[i.name]) e.props = e.props.filter((p) => fieldsFile[i.name].includes(p.key));
  const v = ver[i.name] || {};
  items.push({
    id: `rui:${i.name}`, type: 'remotionui', source: 'RemotionUI', name: i.name, title: pretty(i.name), description: i.description,
    category: CATEGORY[a.lane] || 'More', tags: a.tags || [], kind, file: i.files[0].path.replace(/^src\/lib\/editor\/remotion\/remotionui\//, './'),
    component: e.component, dimensions: { width: comp?.width || (u?.preview && u.preview.height > u.preview.width ? 1080 : 1920), height: comp?.height || (u?.preview && u.preview.height > u.preview.width ? 1920 : 1080) }, fps: comp?.fps || 30,
    duration: comp ? comp.durationInFrames / (comp.fps || 30) : (u?.preview ? u.preview.durationInFrames / 30 : (v.duration || 5)), editables: e.props,
    needs, slow: v.slow === true, enabled: v.enabled === true, reason: v.enabled === true ? '' : (needs.length ? `needs ${needs.join(', ')} (WebGL / map tiles): not rendered in the sandbox yet` : (skipped[i.name] || v.reason || 'not yet verified')),
    sourceSha256: i.files[0].sha256,
  });
}
const loaders = items.filter((x) => !x.needs.length && existsSync(`src/lib/editor/remotion/remotionui/demos/${x.name}.jsx`)).map((x) => `  '${x.id}': ['Demo', () => import('./demos/${x.name}.jsx')],`);
writeFileSync('src/lib/editor/remotion/remotionui/loaders.generated.js', `// GENERATED by scripts/remotionui/catalog.mjs: lazy loaders for the vendored RemotionUI components that can render in the sandbox.\nexport const LOADERS = {\n${loaders.join('\n')}\n};\n`);
writeFileSync('src/lib/remotionui/catalog.json', JSON.stringify({ source: lock.source, license: lock.license, count: items.length, items }, null, 1));
console.log(`catalog: ${items.length} items, ${items.filter((x) => x.enabled).length} enabled, ${items.filter((x) => x.needs.length).length} need WebGL/map packages, ${items.filter((x) => !x.component).length} without a detected component export`);
