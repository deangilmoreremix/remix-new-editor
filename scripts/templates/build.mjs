// Vendors the three MIT-licensed template repos as pinned source and builds the catalog + lazy loaders for the Animations library.
//   node scripts/templates/build.mjs --free <dir> --video <dir> --rve <dir>
// free  = deangilmoreremix/free-remotion-templates   (Root.tsx registers 50 compositions with defaultProps)
// video = deangilmoreremix/remotion-video-templates  (Root.tsx + Zod schemas, calculateMetadata; public/ sample assets are inlined)
// rve   = deangilmoreremix/remotion-templates        (81 zero-prop components: every fixed text becomes an editable text slot)
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import ts from 'typescript';

const a = process.argv.slice(2); const get = (k) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : undefined; };
const REPOS = { free: get('free'), video: get('video'), rve: get('rve') };
for (const [k, v] of Object.entries(REPOS)) if (!v || !existsSync(v)) throw new Error(`--${k} <repo dir> is required`);
const OUT = 'src/lib/editor/remotion/templates'; const SHIM = `${OUT}/shim`;
const sha = (s) => createHash('sha256').update(s).digest('hex');
const commit = (d) => execFileSync('git', ['-C', d, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const pretty = (s) => s.replace(/[-_]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
const ver = existsSync('src/lib/templates/verification.json') ? JSON.parse(readFileSync('src/lib/templates/verification.json', 'utf8')) : {};
const fieldsFile = existsSync('src/lib/templates/fields.json') ? JSON.parse(readFileSync('src/lib/templates/fields.json', 'utf8')) : null;
for (const k of ['free', 'video', 'rve']) rmSync(join(OUT, k), { recursive: true, force: true });

/** Rewrites imports so vendored source runs in the editor: `remotion` -> our shim, next/image -> <img>. */
function rewrite(src, outFile, extra = {}) {
  const rel = (to) => { const r = relative(dirname(outFile), to).replace(/\\/g, '/'); return r.startsWith('.') ? r : './' + r; };
  let t = src.replace(/\/public\/captions\.sample\.json/g, '/assets/captions.sample.json') // Vite treats a /public/ path as a URL import
    .replace(/from\s+(["'])remotion\1/g, `from "${rel(SHIM)}"`);
  t = t.replace(/import\s+Image\s+from\s+(["'])next\/image\1;?/g, `import { NextImage as Image } from "${rel(SHIM)}";`);
  if (extra.slots) t = extra.slots(t, rel(SHIM));
  return t;
}
const copyTree = (srcDir, dstDir, filter, transform) => {
  for (const f of readdirSync(srcDir)) {
    const p = join(srcDir, f); const q = join(dstDir, f);
    if (statSync(p).isDirectory()) { copyTree(p, q, filter, transform); continue; }
    if (!filter(f)) continue;
    mkdirSync(dirname(q), { recursive: true }); const raw = readFileSync(p, 'utf8');
    writeFileSync(q, transform ? transform(raw, q, p) : raw);
  }
};

// ---------------------------------------------------------------- TypeScript helpers
const parse = (src, name = 'x.tsx') => ts.createSourceFile(name, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const lit = (n) => {
  if (!n) return undefined;
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isNumericLiteral(n)) return Number(n.text);
  if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(n.operand)) return -Number(n.operand.text);
  if (n.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (n.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isAsExpression(n) || ts.isParenthesizedExpression(n)) return lit(n.expression);
  return undefined;
};
/** Literal top-level properties of `export const <name> = { ... }` (anything that is not a plain literal is skipped, but stays in the real defaults). */
function defaultsOf(sf, name) {
  let out = null;
  const visit = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name && n.initializer) {
      let init = n.initializer; while (ts.isAsExpression(init) || ts.isParenthesizedExpression(init)) init = init.expression;
      if (ts.isObjectLiteralExpression(init)) { out = {}; for (const p of init.properties) if (ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) { const v = lit(p.initializer); if (v !== undefined) out[p.name.text] = v; } }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf); return out;
}
/** Property types of `type T = {...}` (string / number / boolean / string-literal unions). */
function typesOf(sf, typeName) {
  const out = {};
  const visit = (n) => {
    if ((ts.isTypeAliasDeclaration(n) || ts.isInterfaceDeclaration(n)) && n.name.text === typeName) {
      const members = ts.isTypeAliasDeclaration(n) ? (ts.isTypeLiteralNode(n.type) ? n.type.members : []) : n.members;
      for (const m of members) if (ts.isPropertySignature(m) && m.type && m.name) {
        const t = m.type; const key = m.name.getText(sf);
        if (t.kind === ts.SyntaxKind.StringKeyword) out[key] = { kind: 'string' }; else if (t.kind === ts.SyntaxKind.NumberKeyword) out[key] = { kind: 'number' }; else if (t.kind === ts.SyntaxKind.BooleanKeyword) out[key] = { kind: 'boolean' };
        else if (ts.isUnionTypeNode(t) && t.types.every((x) => ts.isLiteralTypeNode(x) && ts.isStringLiteral(x.literal))) out[key] = { kind: 'select', options: t.types.map((x) => x.literal.text) };
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf); return out;
}
/** Zod object: z.string() / zColor() / z.number() / z.boolean() / z.enum([...]) -> kinds. */
function zodTypesOf(sf, schemaName) {
  const out = {};
  const root = (e) => { let n = e; while (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && !(ts.isIdentifier(n.expression.expression) && n.expression.expression.text === 'z')) n = n.expression.expression; return n; };
  const visit = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === schemaName && n.initializer) {
      let call = n.initializer; // z.object({...})
      while (ts.isCallExpression(call) && !(ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === 'object')) call = ts.isPropertyAccessExpression(call.expression) ? call.expression.expression : null;
      const obj = call?.arguments?.[0];
      if (obj && ts.isObjectLiteralExpression(obj)) for (const p of obj.properties) if (ts.isPropertyAssignment(p)) {
        const key = p.name.getText(sf); const r = root(p.initializer); const txt = r.getText(sf);
        if (/^zColor\(/.test(txt)) out[key] = { kind: 'color' }; else if (/^z\.string\(/.test(txt)) out[key] = { kind: 'string' }; else if (/^z\.number\(/.test(txt)) out[key] = { kind: 'number' }; else if (/^z\.boolean\(/.test(txt)) out[key] = { kind: 'boolean' };
        else if (/^z\.enum\(/.test(txt) && ts.isCallExpression(r) && r.arguments[0] && ts.isArrayLiteralExpression(r.arguments[0])) out[key] = { kind: 'select', options: r.arguments[0].elements.map((e) => lit(e)).filter((x) => typeof x === 'string') };
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf); return out;
}
const HEX = /^#[0-9a-f]{3,8}$/i; const SKIP_STR = /\.(svg|png|jpe?g|webp|gif|json|mp4|mp3)$|^https?:|^data:/i;
function editablesFrom(types, defaults) {
  const out = [];
  for (const [key, d] of Object.entries(defaults)) {
    const t = types[key]; if (!t) continue;
    const label = pretty(key); const f = { key, label, hint: '', defaultValue: d };
    if (t.kind === 'color' || (t.kind === 'string' && typeof d === 'string' && HEX.test(d))) { if (typeof d === 'string' && HEX.test(d)) out.push({ ...f, type: 'color' }); }
    else if (t.kind === 'string' && typeof d === 'string') { if (!SKIP_STR.test(d) && d.length <= 200) out.push({ ...f, type: 'text' }); }
    else if (t.kind === 'number' && typeof d === 'number') out.push({ ...f, type: 'number', step: Math.abs(d) < 5 ? 0.05 : 1 });
    else if (t.kind === 'boolean' && typeof d === 'boolean') out.push({ ...f, type: 'boolean' });
    else if (t.kind === 'select' && t.options.includes(d)) out.push({ ...f, type: 'select', options: t.options });
  }
  return out.slice(0, 14);
}

// ---------------------------------------------------------------- Root.tsx metadata
function rootCompositions(rootSrc, { folders }) {
  const sf = parse(rootSrc, 'Root.tsx'); const comps = []; const importOf = {};
  for (const st of sf.statements) if (ts.isImportDeclaration(st) && st.importClause?.namedBindings && ts.isNamedImports(st.importClause.namedBindings)) for (const el of st.importClause.namedBindings.elements) importOf[el.name.text] = st.moduleSpecifier.text;
  let folder = '';
  const visit = (n) => {
    if (ts.isJsxElement(n) && n.openingElement.tagName.getText(sf) === 'Folder') { const nm = n.openingElement.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.text === 'name'); folder = nm?.initializer?.text ?? ''; ts.forEachChild(n, visit); folder = ''; return; }
    const el = ts.isJsxSelfClosingElement(n) ? n : null;
    if (el && el.tagName.getText(sf) === 'Composition') {
      const at = {}; for (const p of el.attributes.properties) if (ts.isJsxAttribute(p)) { const init = p.initializer; at[p.name.text] = init && ts.isStringLiteral(init) ? init.text : init && ts.isJsxExpression(init) ? init.expression : undefined; }
      const num = (v, d) => { const x = v ? lit(v) : undefined; return typeof x === 'number' ? x : d; };
      comps.push({ id: at.id, component: at.component?.getText(sf), defaults: at.defaultProps?.getText(sf), schema: at.schema?.getText(sf), frames: num(at.durationInFrames, 120), fps: at.fps && ts.isIdentifier(at.fps) ? 30 : num(at.fps, 30), width: num(at.width, 1920), height: num(at.height, 1080), folder, from: importOf[at.component?.getText(sf)] });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf); return comps;
}

const lock = { generated: 'scripts/templates/build.mjs', repos: {}, files: {} }; const items = []; const loaders = [];
const addLock = (key, rel, content) => { (lock.files[key] ??= {})[rel] = sha(content); };

// ---------------------------------------------------------------- repo: free (50)
{
  const dir = REPOS.free; lock.repos.free = { url: 'https://github.com/deangilmoreremix/free-remotion-templates', commit: commit(dir), license: 'MIT (SPDX: Trimora Inc., 2026)' };
  copyTree(join(dir, 'src'), join(OUT, 'free'), (f) => /\.(tsx?|json)$/.test(f) && f !== 'Root.tsx', (raw, out, p) => { addLock('free', relative(dir, p), raw); return rewrite(raw, out); });
  const CAT = { 'Logo-and-Brand': 'Titles & text', 'Text-and-Titles': 'Titles & text', Transitions: 'Transitions', 'Data-and-Charts': 'Data & charts', 'Social-and-UI': 'Social & UI', 'Loops-and-Backgrounds': 'Backgrounds & effects' };
  for (const c of rootCompositions(readFileSync(join(dir, 'src/Root.tsx'), 'utf8'), {})) {
    const file = join(dir, 'src', c.from + '.tsx'); const src = readFileSync(file, 'utf8'); const sf = parse(src);
    const defName = c.defaults; const propsType = defName.replace(/^default/, '').replace(/Props$/, '') + 'Props';
    const defaults = defaultsOf(sf, defName) ?? {}; const eds = editablesFrom(typesOf(sf, propsType), defaults);
    const name = c.id; let category = CAT[c.folder] ?? 'More'; if (/lower-third/.test(name)) category = 'Lower thirds';
    items.push({ id: `tpl:free:${name}`, repo: 'free', name, title: pretty(name), category, width: c.width, height: c.height, fps: c.fps, frames: c.frames, editables: eds, entry: [c.component, `./free/${c.from}.tsx`, defName] });
  }
}
// ---------------------------------------------------------------- repo: video (7)
{
  const dir = REPOS.video; lock.repos.video = { url: 'https://github.com/deangilmoreremix/remotion-video-templates', commit: commit(dir), license: 'MIT (Copyright (c) 2026 Alejandro Brito)' };
  const assets = {}; const pub = join(dir, 'public');
  for (const f of readdirSync(pub)) if (/\.svg$/.test(f)) assets[f] = 'data:image/svg+xml;base64,' + readFileSync(join(pub, f)).toString('base64');
  writeFileSync(`${OUT}/assets.generated.js`, `// GENERATED by scripts/templates/build.mjs: sample assets of the vendored templates as inline data URIs.\nexport const TEMPLATE_ASSETS = ${JSON.stringify(assets, null, 1)};\n`);
  copyTree(join(dir, 'src'), join(OUT, 'video/src'), (f) => /\.(tsx?|json)$/.test(f) && f !== 'Root.tsx' && f !== 'index.ts', (raw, out, p) => { addLock('video', relative(dir, p), raw); return rewrite(raw, out); });
  mkdirSync(join(OUT, 'video/assets'), { recursive: true }); cpSync(join(pub, 'captions.sample.json'), join(OUT, 'video/assets/captions.sample.json'));
  for (const c of rootCompositions(readFileSync(join(dir, 'src/Root.tsx'), 'utf8'), {})) {
    const file = join(dir, 'src', c.from + '.tsx'); const src = readFileSync(file, 'utf8'); const sf = parse(src);
    const defaults = defaultsOf(sf, c.defaults) ?? {}; const eds = editablesFrom(zodTypesOf(sf, c.schema), defaults);
    const category = /LowerThirds/.test(c.id) ? 'Lower thirds' : /Chart/.test(c.id) ? 'Data & charts' : /Kinetic|Logo/.test(c.id) ? 'Titles & text' : 'Social & UI';
    items.push({ id: `tpl:video:${c.id}`, repo: 'video', name: c.id, title: pretty(c.id), category, width: c.width, height: c.height, fps: c.fps, frames: c.frames, editables: eds, entry: [c.component, `./video/src/${c.from}.tsx`, c.defaults] });
  }
}
// ---------------------------------------------------------------- repo: rve (81) - zero-prop components, text slots
{
  const dir = REPOS.rve; lock.repos.rve = { url: 'https://github.com/deangilmoreremix/remotion-templates', commit: commit(dir), license: 'MIT (stated in README: "All templates in this repository are available under the MIT License"; fork of reactvideoeditor/remotion-templates)' };
  const readme = readFileSync(join(dir, 'README.md'), 'utf8'); const meta = {}; let cat = '';
  const CATMAP = { 'Charts & Data': 'Data & charts', Text: 'Titles & text', 'Content Animation': 'Social & UI', Background: 'Backgrounds & effects', Cinematic: 'Backgrounds & effects', Transition: 'Transitions', 'Logo & Branding': 'Titles & text', 'Intro & Outro': 'Titles & text', 'Image & Media': 'Social & UI' };
  for (const line of readme.split('\n')) {
    const h = line.match(/^###\s+(.+?)\s*\(\d+\)/); if (h) { cat = h[1]; continue; }
    const r = line.match(/^\|\s*([^|]+?)\s*\|\s*`([^`]+)\.tsx`\s*\|\s*([^|]*?)\s*\|/); if (r) meta[r[2]] = { title: r[1], description: r[3], category: CATMAP[cat] ?? 'More' };
  }
  let total = 0;
  for (const f of readdirSync(join(dir, 'templates')).filter((x) => x.endsWith('.tsx')).sort()) {
    const name = f.replace(/\.tsx$/, ''); const raw = readFileSync(join(dir, 'templates', f), 'utf8'); addLock('rve', `templates/${f}`, raw);
    const slots = [];
    const slotter = (t, shimRel) => {
      const sf = parse(t, f); const edits = [];
      const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
      const visit = (n) => {
        if (ts.isJsxElement(n) || ts.isJsxFragment(n)) for (const ch of n.children) {
          if (ts.isJsxText(ch)) { const txt = ch.getText(sf); const m = txt.match(/^(\s*)([\s\S]*?)(\s*)$/); const body = decode(m[2]); if (body && /[A-Za-z0-9]/.test(body) && !/^[{}()<>=;:,.\-|/\\*]+$/.test(body) && !/^(use client)$/i.test(body)) { slots.push(body); edits.push([ch.getStart(sf) + m[1].length, ch.getEnd() - m[3].length, `<__T i={${slots.length}} d={${JSON.stringify(body)}} />`]); } }
          else if (ts.isJsxExpression(ch) && ch.expression && (ts.isStringLiteral(ch.expression) || ts.isNoSubstitutionTemplateLiteral(ch.expression)) && /[A-Za-z0-9]/.test(ch.expression.text)) { slots.push(ch.expression.text.replace(/\s+/g, ' ').trim()); edits.push([ch.getStart(sf), ch.getEnd(), `<__T i={${slots.length}} d={${JSON.stringify(ch.expression.text)}} />`]); }
        }
        // text held in a const inside the component ("const text = \"Pulse\"", "const words = [\"a\", \"b\"]"): the hook `__S` returns the customer's value or the original
        if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && /text|title|label|message|quote|subtitle|heading|caption|words|numbers|items|names|lines|steps/i.test(n.name.text)) {
          let inFn = false; for (let p = n.parent; p; p = p.parent) if (ts.isFunctionLike(p)) { inFn = true; break; }
          const strNode = (e) => (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) ? e : ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression) && (ts.isStringLiteral(e.expression.expression) || ts.isNoSubstitutionTemplateLiteral(e.expression.expression)) ? e.expression.expression : null);
          const targets = []; const init = n.initializer;
          if (inFn) { const one = strNode(init); if (one) targets.push(one); else if (ts.isArrayLiteralExpression(init) && init.elements.length && init.elements.length <= 12 && init.elements.every((e) => ts.isStringLiteral(e))) targets.push(...init.elements); }
          for (const lt of targets) if (/[A-Za-z0-9]/.test(lt.text)) { slots.push(lt.text.replace(/\s+/g, ' ').trim()); edits.push([lt.getStart(sf), lt.getEnd(), `__S(${slots.length}, ${JSON.stringify(lt.text)})`]); }
        }
        ts.forEachChild(n, visit);
      };
      visit(sf);
      let out = t; for (const [s, e, r] of edits.sort((x, y) => y[0] - x[0])) out = out.slice(0, s) + r + out.slice(e);
      const imp = `import { __T, __S } from "${shimRel}";\n`; return /^\s*["']use client["'];?/.test(out) ? out.replace(/^(\s*["']use client["'];?\s*)/, `$1${imp}`) : imp + out;
    };
    const outFile = join(OUT, 'rve', f); mkdirSync(dirname(outFile), { recursive: true }); writeFileSync(outFile, rewrite(raw, outFile, { slots: slotter }));
    const m = meta[name] ?? { title: pretty(name), description: '', category: 'More' };
    const eds = slots.slice(0, 12).map((d, i) => ({ key: `t${i + 1}`, label: `Text ${i + 1}: ${d.slice(0, 26)}`, hint: '', type: 'text', defaultValue: d }));
    items.push({ id: `tpl:rve:${name}`, repo: 'rve', name, title: m.title, description: m.description, category: /lower-third/.test(name) ? 'Lower thirds' : m.category, width: 1920, height: 1080, fps: 30, frames: 150, editables: eds, entry: ['default', `./rve/${f}`, null] });
    total++;
  }
}
// ---------------------------------------------------------------- catalog + loaders
const catalog = items.map((x) => {
  const v = ver[x.id] || {}; const fx = fieldsFile?.[x.id];
  return { id: x.id, type: 'remotionui', source: 'Templates', repo: x.repo, name: x.name, title: x.title, description: x.description || `${x.title} template (${x.repo})`, category: x.category, tags: [x.repo], kind: 'templates',
    dimensions: { width: x.width, height: x.height }, fps: x.fps, duration: x.frames / x.fps, editables: fx ? x.editables.filter((e) => fx.includes(e.key)) : x.editables, needs: [], slow: v.slow === true, enabled: v.enabled === true,
    reason: v.enabled === true ? '' : (v.reason || 'not yet verified'), sourceSha256: sha(JSON.stringify(x.entry)) };
});
writeFileSync('src/lib/templates/catalog.json', JSON.stringify({ source: 'MIT-licensed template repos (see docs/third-party-templates.md)', count: catalog.length, items: catalog }, null, 1));
writeFileSync('src/lib/templates/lock.json', JSON.stringify(lock, null, 1));
writeFileSync(`${OUT}/loaders.generated.js`, `// GENERATED by scripts/templates/build.mjs: lazy loaders [exportName, import(), defaultPropsExport] for the vendored templates.\nexport const TEMPLATE_LOADERS = {\n${items.map((x) => `  '${x.id}': [${JSON.stringify(x.entry[0])}, () => import('${x.entry[1]}'), ${JSON.stringify(x.entry[2])}],`).join('\n')}\n};\n`);
const by = {}; for (const c of catalog) by[c.repo] = (by[c.repo] || 0) + 1;
console.log(`templates: ${catalog.length} (${Object.entries(by).map(([k, v]) => `${k} ${v}`).join(', ')}); editable fields: ${catalog.reduce((n, c) => n + c.editables.length, 0)}; enabled ${catalog.filter((c) => c.enabled).length}`);
