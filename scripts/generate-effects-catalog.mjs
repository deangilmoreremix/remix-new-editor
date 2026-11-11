#!/usr/bin/env node
/**
 * Generates src/lib/editor/remotion/effectsCatalog.data.js and
 * src/lib/editor/remotion/effectsLoaders.js from the installed
 * @remotion/effects package.
 *
 * Parameters come from each effect's runtime `*Schema` export when it has
 * one, otherwise from its documented TypeScript `*Params` type (JSDoc
 * "from `a` to `b`" ranges and "Defaults to `x`"). Re-run after upgrading
 * @remotion/effects:   node scripts/generate-effects-catalog.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
const pkgDir = path.dirname(require.resolve('@remotion/effects/package.json'));
const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
const ids = Object.keys(pkg.exports).filter((k) => k !== '.' && k !== './package.json').map((k) => k.slice(2)).sort();

const camel = (id) => id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const titleCase = (s) => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase());

const CATEGORY = [
  ['Color', /^(color-correction|exposure|contrast|brightness|saturation|vibrance|white-balance|levels|curves|lut|hue|tint|duotone|grayscale|invert|shadows-highlights|thermal-vision|color-key)$/],
  ['Blur', /blur/],
  ['Light', /^(glow|light-leak|light-trail|shine|starburst|drop-shadow|long-shadows|bevel-alpha|vignette|film-burn)$/],
  ['Distort', /^(barrel-distortion|fisheye|sphere|cylinder|wave|waves|zigzag|skew|mirror|noise-displacement|turbulent-displace|shatter|tear|liquid-contours|shrinkwrap|corner-pin|translate|scale|tile)$/],
  ['Reveal', /^(iris-wipe|radial-wipe|page-turn|pixel-dissolve|venetian-blinds|linear-progressive-pixelate|radial-progressive-pixelate|evolve)$/],
  ['Generate', /^(checkerboard|pattern|gridlines|rings|linear-gradient|linear-gradient-tint|fractal-noise|white-noise|rain-fall|snow-fall)$/],
];
const categoryOf = (id) => (CATEGORY.find(([, re]) => re.test(id)) || ['Stylize'])[0];

function readDts(file) {
  const full = path.join(pkgDir, 'dist', file);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

/** Follow `export { x } from './y/index.js'` to the file that declares Params. */
function dtsFor(id) {
  let src = readDts(`${id}.d.ts`);
  if (!/Params\s*=\s*\{/.test(src)) {
    const m = src.match(/from '\.\/([^']+)\.js'/);
    if (m) src = readDts(`${m[1]}.d.ts`);
  }
  return src;
}

function parseDocNumber(doc, re) {
  const m = doc.match(re);
  return m ? Number(m[1]) : undefined;
}

function fromParams(src) {
  const block = (src.match(/export type \w+Params\s*=\s*\{([\s\S]*?)\n\};/) || [])[1];
  if (!block) return [];
  const params = [];
  const re = /(?:\/\*\*([\s\S]*?)\*\/\s*)?readonly (\w+)(\??): ([^;]+);/g;
  let m;
  while ((m = re.exec(block))) {
    const [, rawDoc = '', key, optional, type] = m;
    const doc = rawDoc.replace(/\s*\*\s?/g, ' ').trim();
    const p = { key, label: titleCase(key), doc };
    const range = doc.match(/from `(-?[\d.]+)` to `(-?[\d.]+)`/);
    const def = doc.match(/Defaults to `([^`]+)`/);
    if (/^number$/.test(type.trim())) {
      p.type = 'number';
      if (range) { p.min = Number(range[1]); p.max = Number(range[2]); }
      p.default = def ? Number(def[1]) : undefined;
    } else if (/^boolean$/.test(type.trim())) {
      p.type = 'boolean';
      p.default = def ? def[1] === 'true' : undefined;
    } else if (/^(['"][^'"]+['"]\s*\|\s*)+['"][^'"]+['"]$/.test(type.trim())) {
      p.type = 'select';
      p.options = type.split('|').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
      p.default = def ? def[1].replace(/^"|"$/g, '') : p.options[0];
    } else if (/^string$/.test(type.trim()) && /colou?r/i.test(key + doc)) {
      p.type = 'color';
      p.default = def ? def[1].replace(/^"|"$/g, '') : '#000000';
    } else if (/^string$/.test(type.trim())) {
      p.type = 'string';
      p.default = def ? def[1].replace(/^"|"$/g, '') : '';
    } else if (/readonly \[number, number\]|UvCoordinate|Center|Origin/.test(type)) {
      p.type = 'uv';
      const d = def && def[1].match(/\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]/);
      p.default = d ? [Number(d[1]), Number(d[2])] : [0.5, 0.5];
    } else {
      continue; // arrays/objects: advanced, left at the effect's own default
    }
    if (!optional && p.default === undefined) {
      p.default = p.type === 'number' ? (p.min !== undefined && p.min > 0 ? p.min : (/radius|size|amount|strength|distance/i.test(key) ? 10 : 1)) : p.default;
      p.required = true;
    }
    params.push(p);
  }
  return params;
}

function fromSchema(schema) {
  return Object.entries(schema).filter(([, v]) => !v.hiddenFromList || v.hiddenFromList === false).map(([key, v]) => {
    const p = { key, label: v.description || titleCase(key) };
    if (v.type === 'number') Object.assign(p, { type: 'number', min: v.min, max: v.max, step: v.step, default: v.default });
    else if (v.type === 'boolean') Object.assign(p, { type: 'boolean', default: v.default });
    else if (v.type === 'color') Object.assign(p, { type: 'color', default: v.default });
    else if (v.type === 'enum') Object.assign(p, { type: 'select', options: Object.keys(v.variants || {}), default: v.default });
    else if (v.type === 'uv-coordinate') Object.assign(p, { type: 'uv', default: v.default });
    else if (v.type === 'string') Object.assign(p, { type: key === 'content' ? 'cube' : 'string', default: v.default });
    else if (v.type === 'array' && v.item?.type === 'uv-coordinate') Object.assign(p, { type: 'points', default: v.default, min: v.minLength, max: v.maxLength });
    else return null;
    return p;
  }).filter(Boolean);
}

const catalog = [];
for (const id of ids) {
  const mod = await import(`@remotion/effects/${id}`);
  const exportName = Object.keys(mod).find((k) => typeof mod[k] === 'function' && !/^(setup|apply|cleanup|parse|create)/.test(k)) || camel(id);
  const schemaKey = Object.keys(mod).find((k) => /Schema$/.test(k));
  const params = schemaKey ? fromSchema(mod[schemaKey]) : fromParams(dtsFor(id));
  catalog.push({ id, exportName, label: titleCase(id), category: categoryOf(id), params });
}

const header = '// GENERATED by scripts/generate-effects-catalog.mjs from @remotion/effects@' + pkg.version + ' — do not edit.\n';
fs.writeFileSync(
  path.join(root, 'src/lib/editor/remotion/effectsCatalog.data.js'),
  `${header}/* eslint-disable */\nexport const EFFECTS_VERSION = ${JSON.stringify(pkg.version)};\nexport const EFFECTS = ${JSON.stringify(catalog, null, 2)};\n`,
);
fs.writeFileSync(
  path.join(root, 'src/lib/editor/remotion/effectsLoaders.js'),
  `${header}/* eslint-disable */\n/** Lazy loaders so only the effects a project uses are downloaded. */\nexport const EFFECT_LOADERS = {\n${catalog.map((e) => `  ${JSON.stringify(e.id)}: () => import('@remotion/effects/${e.id}'),`).join('\n')}\n};\n`,
);
console.log(`Wrote ${catalog.length} effects (${catalog.filter((e) => e.params.length).length} with parameters).`);
