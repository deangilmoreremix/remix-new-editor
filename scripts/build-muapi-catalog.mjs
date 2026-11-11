#!/usr/bin/env node
/**
 * Builds src/lib/muapi/liveModels.json: every enabled MuAPI model with its real input schema, from
 * https://api.muapi.ai/api/v1/models (list) and https://api.muapi.ai/openapi.json (request schemas).
 * Run `node scripts/build-muapi-catalog.mjs` to refresh. Used by the Spaces model catalog and by the server's
 * `generate` tool (validation), so both see the same models and fields.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/lib/muapi/liveModels.json');
const get = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`); return r.json(); };

const [list, openapi] = await Promise.all([get('https://api.muapi.ai/api/v1/models'), get('https://api.muapi.ai/openapi.json')]);
const models = Array.isArray(list) ? list : list.models || list.data || [];
const comps = openapi.components?.schemas || {};
const deref = (s) => (s?.$ref ? comps[s.$ref.split('/').pop()] : s);
const unwrap = (v) => {
  if (!v) return {};
  if (v.$ref) return unwrap(deref(v));
  if (v.anyOf) {
    const real = v.anyOf.map(unwrap).find((x) => x.type && x.type !== 'null');
    return { ...(real || {}), nullable: true, ...(v.default !== undefined ? { default: v.default } : {}), title: v.title };
  }
  return v;
};

const out = [];
for (const m of models) {
  if (m.is_enabled === 0 || m.is_enabled === false || m.is_coming_soon) continue;
  const p = openapi.paths?.[`/api/v1/${m.endpoint_url || m.name}`]?.post;
  const body = p?.requestBody?.content && Object.values(p.requestBody.content)[0]?.schema;
  const schema = unwrap(body);
  if (!schema?.properties) continue;
  const required = new Set(schema.required || []);
  const fields = [];
  for (const [name, raw] of Object.entries(schema.properties)) {
    if (/^webhook/.test(name)) continue;
    const v = unwrap(raw);
    const f = { name, type: v.type || 'string' };
    if (required.has(name)) f.required = 1;
    if (v.enum) f.enum = v.enum;
    if (v.default !== undefined) f.default = v.default;
    if (v.minimum !== undefined) f.min = v.minimum;
    if (v.maximum !== undefined) f.max = v.maximum;
    if (v.multipleOf !== undefined) f.step = v.multipleOf;
    if (v.type === 'array') f.items = unwrap(v.items).type || 'string';
    if (v.title) f.title = v.title;
    fields.push(f);
  }
  out.push({ name: m.name, endpoint: m.endpoint_url || m.name, category: m.category, family: m.family, group: m.group_of, cost: m.cost, fields });
}
fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), count: out.length, models: out }));
console.log(`wrote ${out.length} models → ${path.relative(process.cwd(), OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
