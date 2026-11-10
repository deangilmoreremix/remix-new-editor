// Build-time: turns each block's published `var CONFIG = {...}` (the catalog's own customisation contract) into inspector
// fields. The literal is evaluated in an empty vm context on PINNED, sha256-verified upstream sources only (never in the app).
//   node scripts/hyperframes/extract-config.mjs --upstream <checkout> --classification <json> --dom-editables <json> --out <json>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { join } from 'node:path';
import { findConfigLiteral, configLeaves } from '../../src/lib/editor/remotion/hyperframes/config.js';

const a = process.argv.slice(2); const get = (k) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : undefined; };
const up = get('upstream'); const cls = JSON.parse(readFileSync(get('classification'), 'utf8')).items;
const dom = existsSync(get('dom-editables') || '') ? JSON.parse(readFileSync(get('dom-editables'), 'utf8')) : {};
const TEXT_KEYS = /^(text|title|label|name|subtitle|caption|heading|headline|description|author|username|handle|message|quote|kicker|line|body|comment|sub|tagline|cta|brand|company)\d*$/i;
const SKIP_NUM = /(seed|^x$|^y$|index|^id$)/i;
const HEX = /^#[0-9a-f]{6}$/i;
const words = (p) => p.split('.').map((s) => s.replace(/([a-z])([A-Z])/g, '$1 $2')).join(' › ').replace(/^./, (c) => c.toUpperCase());
const out = {}; let withCfg = 0;
const decodeAttr = (x) => x.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
function variableFields(html) {
  const m = /data-composition-variables=(?:'([^']*)'|"([^"]*)")/.exec(html); if (!m) return [];
  let decls; try { decls = JSON.parse(decodeAttr(m[1] ?? m[2])); } catch { return []; } if (!Array.isArray(decls)) return [];
  const rank = { string: 0, image: 1, color: 2, enum: 3, boolean: 4, number: 5 };
  return decls.filter((d) => d && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(String(d.id)) && d.type in rank).map((d) => {
    const f = { key: 'var_' + d.id, label: String(d.label || d.id).slice(0, 60), target: { kind: 'var', id: d.id }, order: rank[d.type] + (d.role === 'content' ? 0 : 0.5) };
    if (d.type === 'string') { f.type = 'text'; f.defaultValue = String(d.default ?? ''); }
    else if (d.type === 'image') { f.type = 'text'; f.label += ' (image URL)'; f.defaultValue = String(d.default ?? ''); }
    else if (d.type === 'color') { f.type = 'color'; f.defaultValue = String(d.default ?? '#ffffff'); if (!HEX.test(f.defaultValue)) return null; }
    else if (d.type === 'enum') { f.type = 'select'; f.options = (d.options || []).map((o) => (typeof o === 'object' ? { value: String(o.value), label: String(o.label ?? o.value) } : String(o))); f.defaultValue = String(d.default ?? ''); }
    else if (d.type === 'boolean') { f.type = 'boolean'; f.defaultValue = !!d.default; }
    else { f.type = 'number'; f.defaultValue = Number(d.default ?? 0); f.min = d.min ?? 0; f.max = d.max ?? Math.max(10, Math.abs(f.defaultValue) * 3); f.step = d.step ?? (Number.isInteger(f.defaultValue) ? 1 : 0.1); }
    return f;
  }).filter(Boolean);
}
for (const [id, v] of Object.entries(cls)) {
  if (v.type !== 'block' || v.status !== 'verified-export') continue;
  const html = readFileSync(join(up, 'registry/blocks', id, id + '.html'), 'utf8');
  const lit = findConfigLiteral(html); const fields = [];
  if (lit) {
    let obj; try { obj = runInNewContext('(' + html.slice(lit[0], lit[1]) + ')', Object.create(null), { timeout: 200 }); } catch { obj = null; }
    const lines = html.slice(lit[0], lit[1]).split('\n');
    for (const [path, val] of obj ? configLeaves(obj) : []) {
      const leaf = path.split('.').pop(); const f = { key: 'cfg_' + path.replace(/\./g, '_'), label: words(path), defaultValue: val, target: { kind: 'cfg', path } };
      if (typeof val === 'string') {
        const line = lines.find((l) => new RegExp('\\b' + leaf + '\\s*:').test(l)) || '';
        const alts = [...(line.split('//')[1] || '').matchAll(/"([\w-]+)"/g)].map((m) => m[1]);
        if (HEX.test(val)) { f.type = 'color'; f.order = 1; }
        else if (alts.length > 1 && alts.includes(val)) { f.type = 'select'; f.options = alts; f.order = 2; }
        else if ((TEXT_KEYS.test(leaf) || /\s/.test(val)) && val.length >= 2 && val.length <= 120 && !/^(https?:|\/|#|\.|[a-z]+\()/i.test(val) && !/^[MmLlCcQqZz][\s\d.-]/.test(val)) { f.type = 'text'; f.order = 0; }
        else continue;
      } else if (typeof val === 'boolean') { f.type = 'boolean'; f.order = 3; }
      else { if (SKIP_NUM.test(leaf) || !Number.isFinite(val)) continue; f.type = 'number'; f.order = 4; if (val >= 0 && val <= 1) { f.min = 0; f.max = 1; f.step = 0.05; } else { f.min = 0; f.max = Math.max(10, Math.ceil(Math.abs(val) * 3)); f.step = Number.isInteger(val) ? 1 : 0.1; } }
      fields.push(f);
    }
  }
  const vf = variableFields(html);
  fields.sort((x, y) => x.order - y.order); const cfg = [...vf.sort((x, y) => x.order - y.order), ...fields].slice(0, 16).map(({ order, ...f }) => f);
  if (cfg.length) withCfg++;
  out[id] = { editables: [...(dom[id]?.editables || []), ...cfg], ...(dom[id]?.visibleText ? { visibleText: dom[id].visibleText } : {}), hasConfig: !!lit, hasVariables: vf.length > 0, cfgFields: cfg.length };
}
writeFileSync(get('out'), JSON.stringify(out, null, 1));
console.log('blocks', Object.keys(out).length, 'with CONFIG-backed fields', withCfg, 'with any editable', Object.values(out).filter((x) => x.editables.length).length);
