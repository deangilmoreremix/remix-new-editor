// Emits mcp/catalog.json: a brand-neutral, trimmed model catalog for the SmartVid MCP server.
// Run: node scripts/build-mcp-catalog.mjs
import { writeFileSync } from 'node:fs';
import { getImageInputContract, getAuxiliaryImageInputs } from '../src/lib/imageInputContracts.js';
import * as m from '../src/lib/models.js';
import { recastModels, motionControlModels } from '../src/lib/motionModels.js';

// kind -> [source array, studios that use it]
const KINDS = {
  t2i: [m.t2iModels, ['image', 'cinema', 'cinema-template', 'storyboard', 'commercial']],
  i2i: [m.i2iModels, ['image', 'edit', 'influencer', 'character', 'upscale', 'commercial']],
  t2v: [m.t2vModels, ['video', 'cinema', 'cinema-template']],
  i2v: [m.i2vModels, ['video', 'cinema', 'cinema-template']],
  v2v: [m.v2vModels, ['video', 'cinema-template']],
  lipsync: [m.lipsyncModels, ['lipsync']],
  audio: [m.audioModels, ['audio']],
  tools: [m.videoToolsModels, ['videotools']],
  avatar: [m.avatarModels, ['avatar']],
  // Retired in the app (src/lib/router.js RETIRED_ROUTES): training, chat. Not exposed.
};

// Effects Studio runs these catalog models on generate_wan_ai_effects (see WAN_EFFECT_MODEL_IDS in src/lib/muapi.js).
const EFFECT_MODEL_IDS = new Set(['ai-video-effects', 'motion-controls', 'vfx']);

const KEEP = ['type', 'title', 'enum', 'default', 'description', 'minimum', 'maximum', 'required'];
const strip = (s) => String(s ?? '').replace(/mu-?api(\.ai)?/gi, '').trim();

const seen = new Set();
const entries = [];
for (const [kind, [list, studios]] of Object.entries(KINDS)) {
  for (const model of list || []) {
    const key = seen.has(model.id) ? `${model.id}:${kind}` : model.id;
    seen.add(model.id);
    const entryStudios = EFFECT_MODEL_IDS.has(model.id) ? [...studios, 'effects'] : studios;
    const inputs = {};
    for (const [name, def] of Object.entries(model.inputs || {})) {
      inputs[name] = {};
      for (const k of KEEP) if (def[k] !== undefined) inputs[name][k] = k === 'description' ? strip(def[k]) : def[k];
    }
    // Requirements the app enforces before it calls the backend: model.required, promptRequired and the image-input contracts.
    const req = new Set(Array.isArray(model.required) ? model.required : []);
    if (model.promptRequired) req.add('prompt');
    const mode = kind === 'i2i' ? 'i2i' : kind === 't2i' ? 't2i' : null;
    if (mode) {
      const c = getImageInputContract(model, mode);
      if (c.promptRequired) req.add(c.promptField || 'prompt');
      if (c.primaryImageRequired) req.add(model.imageField || 'image_url');
      for (const a of getAuxiliaryImageInputs(model, mode)) if (a.required) req.add(a.field);
    }
    if (kind === 'i2i' || kind === 'i2v') req.add(model.imageField || 'image_url');
    if (kind === 'v2v') req.add(model.videoField || 'video_url');
    for (const name of req) {
      inputs[name] = { ...(inputs[name] || { type: 'string', title: name }), required: true };
    }
    entries.push({
      key, kind, studios: entryStudios, id: model.id, name: strip(model.name), family: model.family,
      endpoint: model.endpoint || model.id, hasPrompt: model.hasPrompt, imageField: model.imageField, videoField: model.videoField, inputs,
    });
  }
}
// Fixed-route studios (src/lib/muapi.js). Input contracts mirror the client functions.
const S = (title, description) => ({ type: 'string', title, description });
const AR = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];
entries.push(
  { key: 'motion-graphics', kind: 'graphics', studios: ['effects'], id: 'motion-graphics', name: 'Motion graphics', endpoint: 'motion-graphics', hasPrompt: true,
    inputs: { prompt: { ...S('Prompt', 'Describe the motion graphic.'), required: true }, aspect_ratio: { type: 'string', title: 'Aspect ratio', enum: AR, default: '16:9' }, duration_seconds: { type: 'integer', title: 'Duration (s)', default: 6 } } },
  { key: 'motion-graphics-edit', kind: 'graphics', studios: ['effects'], id: 'motion-graphics-edit', name: 'Motion graphics: edit a previous clip', endpoint: 'motion-graphics-edit', hasPrompt: false,
    inputs: { request_id: { ...S('Request id', 'request_id of the motion-graphics clip to edit.'), required: true }, edit_prompt: { ...S('Edit prompt', 'The change to make.'), required: true }, aspect_ratio: { type: 'string', title: 'Aspect ratio', enum: AR, default: '16:9' }, duration_seconds: { type: 'integer', title: 'Duration (s)', default: 6 } } },
);
for (const [id, endpoint, name] of [['commercial-ad', 'seedance-2-vip-omni-reference', 'Commercial ad (omni reference)'], ['commercial-ad-1080p', 'sd-2-vip-omni-reference-1080p', 'Commercial ad 1080p (omni reference)']]) {
  entries.push({ key: id, kind: 'ad', studios: ['commercial'], id, name, endpoint, hasPrompt: true,
    inputs: { prompt: { ...S('Prompt', 'Ad concept and shots.'), required: true }, aspect_ratio: { type: 'string', title: 'Aspect ratio', enum: AR, default: '16:9' }, duration: { type: 'integer', title: 'Duration (s)', default: 5 }, images_list: { type: 'array', title: 'Reference images', description: 'Public https image URLs.' }, video_files: { type: 'array', title: 'Reference videos', description: 'Public https video URLs.' } } });
}
// Motion control (app/studios/MotionPanels): the app prefixes the prompt with a motion-transfer instruction; the MCP accepts the raw fields.
// "spicy" variant is intentionally not exposed through the MCP.
for (const mc of motionControlModels.filter((x) => !/spicy/i.test(x.id))) {
  entries.push({ key: mc.id, kind: 'motion', studios: ['videotools'], id: mc.id, name: mc.name, endpoint: mc.endpoint, hasPrompt: true,
    inputs: { video_url: { ...S('Motion video', 'Public https URL of the reference performance video.'), required: true }, images_list: { type: 'array', title: 'Character images', description: `Public https image URLs (max ${mc.maxImages}).`, required: true },
      prompt: S('Prompt', 'Optional extra direction.'), aspect_ratio: { type: 'string', title: 'Aspect ratio', enum: mc.aspectRatios, default: mc.defaultAspectRatio },
      duration: { type: 'integer', title: 'Duration (s)', default: mc.defaultDuration, minimum: mc.minDuration, maximum: mc.maxDuration }, generate_audio: { type: 'boolean', title: 'Generate audio' } } });
}
for (const rc of recastModels) {
  entries.push({ key: rc.id, kind: 'recast', studios: ['videotools'], id: rc.id, name: rc.name, endpoint: rc.endpoint, hasPrompt: !!rc.hasPrompt, imageField: rc.imageField, videoField: rc.videoField || 'video_url',
    inputs: { [rc.videoField || 'video_url']: { ...S('Motion video', 'Public https video URL.'), required: true }, ...(rc.imageField ? { [rc.imageField]: { ...S('Character image', 'Public https image URL.'), required: true } } : {}),
      ...(rc.hasPrompt ? { prompt: S('Prompt', 'Optional direction.') } : {}), aspect_ratio: S('Aspect ratio', 'Optional.'), character_orientation: S('Character orientation', 'Optional.') } });
}

writeFileSync(new URL('../mcp/catalog.json', import.meta.url), JSON.stringify(entries));
console.log(`mcp/catalog.json: ${entries.length} models`);
