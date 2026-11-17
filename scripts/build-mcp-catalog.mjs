// Emits mcp/catalog.json: a brand-neutral, trimmed model catalog for the SmartVid MCP server.
// Run: node scripts/build-mcp-catalog.mjs
import { writeFileSync } from 'node:fs';
import * as m from '../src/lib/models.js';

// kind -> [source array, studios that use it]
const KINDS = {
  t2i: [m.t2iModels, ['image', 'cinema', 'cinema-template', 'template', 'storyboard', 'commercial']],
  i2i: [m.i2iModels, ['image', 'edit', 'effects', 'influencer', 'character', 'upscale', 'commercial']],
  t2v: [m.t2vModels, ['video', 'cinema', 'cinema-template', 'template']],
  i2v: [m.i2vModels, ['video', 'effects', 'cinema', 'cinema-template', 'template']],
  v2v: [m.v2vModels, ['video', 'cinema-template', 'template']],
  lipsync: [m.lipsyncModels, ['lipsync']],
  audio: [m.audioModels, ['audio']],
  tools: [m.videoToolsModels, ['videotools']],
  avatar: [m.avatarModels, ['avatar']],
  training: [m.trainingModels, ['training']],
  text: [m.textModels, ['chat']],
};

const KEEP = ['type', 'title', 'enum', 'default', 'description', 'minimum', 'maximum', 'required'];
const strip = (s) => String(s ?? '').replace(/mu-?api(\.ai)?/gi, '').trim();

const seen = new Set();
const entries = [];
for (const [kind, [list, studios]] of Object.entries(KINDS)) {
  for (const model of list || []) {
    const key = seen.has(model.id) ? `${model.id}:${kind}` : model.id;
    seen.add(model.id);
    const inputs = {};
    for (const [name, def] of Object.entries(model.inputs || {})) {
      inputs[name] = {};
      for (const k of KEEP) if (def[k] !== undefined) inputs[name][k] = k === 'description' ? strip(def[k]) : def[k];
    }
    entries.push({
      key, kind, studios, id: model.id, name: strip(model.name), family: model.family,
      endpoint: model.endpoint || model.id, hasPrompt: model.hasPrompt, imageField: model.imageField, videoField: model.videoField, inputs,
    });
  }
}
writeFileSync(new URL('../mcp/catalog.json', import.meta.url), JSON.stringify(entries));
console.log(`mcp/catalog.json: ${entries.length} models`);
