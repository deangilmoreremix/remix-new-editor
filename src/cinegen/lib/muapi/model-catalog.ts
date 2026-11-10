// [remix] CineGen's model registry, built from the app's MuAPI catalog (+ OpenAI Images 2.6) instead of fal.
// Same ModelDefinition shape CineGen's Spaces canvas, Studio and Director already consume.
import type { ModelDefinition, ModelInputField } from '@cinegen/types/workflow';
// @ts-expect-error plain JS shared with the Netlify function
import { allCatalogModels } from '../../../lib/muapi/genericModels.js';
// Full live MuAPI catalog (api.muapi.ai/api/v1/models) with real field types — see scripts/build-muapi-catalog.mjs.
import live from '../../../lib/muapi/liveModels.json';

type Field = { type?: string; title?: string; description?: string; enum?: unknown[]; default?: unknown; minValue?: number; maxValue?: number; step?: number; name?: string; items?: unknown };
const MEDIA = /image|frame|mask|reference/i;

function fieldFor(name: string, f: Field): ModelInputField | null {
  const label = f.title || name.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  const base = { id: name, label, falParam: name, required: name === 'prompt', description: f.description } as const;
  if (name === 'prompt') return { ...base, portType: 'text', fieldType: 'port', required: true };
  if (f.type === 'array' || /(^|_)(images?_list|image_urls?|images)$/i.test(name)) {
    return { ...base, portType: 'image', fieldType: 'port', multiple: true, mediaRole: 'image', schemaType: 'array' };
  }
  if (MEDIA.test(name) && f.type === 'string' && !f.enum) return { ...base, portType: 'image', fieldType: 'port', mediaRole: 'image' };
  if (Array.isArray(f.enum) && f.enum.length) {
    return { ...base, portType: 'text', fieldType: 'select', default: f.default, options: f.enum.map((v) => ({ value: String(v), label: String(v) })), schemaType: f.type === 'int' || f.type === 'integer' ? 'integer' : 'string' };
  }
  if (f.type === 'int' || f.type === 'integer' || f.type === 'number') {
    return { ...base, portType: 'number', fieldType: 'number', default: f.default, min: f.minValue, max: f.maxValue, step: f.step, schemaType: f.type === 'number' ? 'number' : 'integer' };
  }
  if (f.type === 'boolean') return { ...base, portType: 'number', fieldType: 'toggle', default: f.default ?? false, schemaType: 'boolean' };
  if (f.type === 'string') return { ...base, portType: 'text', fieldType: name === 'negative_prompt' ? 'textarea' : 'text', default: f.default, schemaType: 'string' };
  return null;
}

function toDefinition(entry: { key: string; kind: string; category: ModelDefinition['category']; outputType: ModelDefinition['outputType']; model: Record<string, any> }): ModelDefinition {
  const { key, category, outputType, model } = entry;
  const inputs: ModelInputField[] = [];
  const declared = (model.inputs ?? {}) as Record<string, Field>;
  if (declared.prompt || model.hasPrompt !== false) inputs.push(fieldFor('prompt', declared.prompt ?? {})!);
  for (const [mediaKey, role] of [[model.imageField, 'image'], [model.videoField, 'video']] as const) {
    if (mediaKey && !declared[mediaKey]) inputs.push({ id: mediaKey, portType: role === 'video' ? 'video' : 'image', label: role === 'video' ? 'Video' : 'Image', required: true, falParam: mediaKey, fieldType: 'port', mediaRole: role });
  }
  for (const [name, f] of Object.entries(declared)) {
    if (name === 'prompt') continue;
    const field = fieldFor(name, f);
    if (field) inputs.push(field);
  }
  return {
    id: key, nodeType: key, name: model.name, category, outputType, provider: 'muapi',
    description: model.description || `${model.provider_name ?? ''} · MuAPI`.trim(),
    inputs, responseMapping: { path: 'url' },
  };
}

const OPENAI_IMAGE: ModelDefinition = {
  id: 'gpt-image-2.6-flare', nodeType: 'gpt-image-2.6-flare', name: 'GPT Image 2.6 Flare', category: 'image', outputType: 'image', provider: 'openai',
  description: 'OpenAI Images 2.6 (fast) — your OpenAI key', responseMapping: { path: 'url' },
  inputs: [
    { id: 'prompt', portType: 'text', label: 'Prompt', required: true, falParam: 'prompt', fieldType: 'port' },
    { id: 'image_urls', portType: 'image', label: 'Reference images', required: false, falParam: 'image_urls', fieldType: 'port', multiple: true, mediaRole: 'image', schemaType: 'array' },
    { id: 'aspect_ratio', portType: 'text', label: 'Aspect', required: false, falParam: 'aspect_ratio', fieldType: 'select', default: '16:9', options: ['16:9', '9:16', '1:1'].map((v) => ({ value: v, label: v })) },
  ],
};
const OPENAI_IMAGE_DETAIL: ModelDefinition = { ...OPENAI_IMAGE, id: 'gpt-image-2.6-sunburst', nodeType: 'gpt-image-2.6-sunburst', name: 'GPT Image 2.6 Sunburst', description: 'OpenAI Images 2.6 (detail, edits) — your OpenAI key' };

type LiveField = { name: string; type?: string; required?: number; title?: string; enum?: unknown[]; default?: unknown; minValue?: number; maxValue?: number };
type LiveModel = { name: string; endpoint: string; category: string; group: string; fields: LiveField[] };
const LIVE_OUT: Record<string, ['image' | 'video' | 'audio' | 'model3d', ModelDefinition['category']]> = {
  image: ['image', 'image'], 'image-tools': ['image', 'image-edit'], video: ['video', 'video'], 'video-tools': ['video', 'video'],
  'video-edit': ['video', 'video'], avatar: ['video', 'video'], 'ai-effects': ['video', 'video'], music: ['audio', 'audio'], audio: ['audio', 'audio'], '3d': ['model3d', 'model3d'],
};
function liveEntry(m: LiveModel) {
  const [outputType, category] = LIVE_OUT[m.group];
  const inputs: Record<string, Field> = {};
  for (const f of m.fields) inputs[f.name] = { type: f.type, title: f.title, enum: f.enum, default: f.default, minValue: f.minValue, maxValue: f.maxValue };
  return { key: m.name, kind: 'live', category, outputType, model: { id: m.name, name: m.name, endpoint: m.endpoint, inputs, hasPrompt: 'prompt' in inputs, provider_name: m.category } };
}

let registry: Record<string, ModelDefinition> | null = null;
export function buildMuapiRegistry(): Record<string, ModelDefinition> {
  if (registry) return registry;
  registry = { [OPENAI_IMAGE.nodeType]: OPENAI_IMAGE, [OPENAI_IMAGE_DETAIL.nodeType]: OPENAI_IMAGE_DETAIL };
  for (const entry of allCatalogModels()) registry[entry.key] = toDefinition(entry);
  // Models MuAPI offers that the bundled snapshot lacks (the server validates them against the live catalog).
  for (const m of (live as { models: LiveModel[] }).models) {
    if (!LIVE_OUT[m.group] || registry[m.name]) continue;
    registry[m.name] = toDefinition(liveEntry(m) as Parameters<typeof toDefinition>[0]);
  }
  addReferencePorts(registry);
  return registry;
}

/** MuAPI ships reference-image generation as a separate `<model>-edit` endpoint. CineGen's image nodes take Element references
 * directly, so a text-to-image model that has such a sibling gets an optional multi-image port; the request is routed to the sibling
 * when references are attached (see referenceSibling + cloud/funding.runWorkflow). */
export const REFERENCE_PORT_ID = 'images_list';
export function referenceSibling(reg: Record<string, ModelDefinition>, nodeType: string): string | undefined {
  const sib = reg[`${nodeType}-edit`];
  return sib && sib.outputType === 'image' && sib.inputs.some((f) => f.id === REFERENCE_PORT_ID && f.fieldType === 'port') ? sib.nodeType : undefined;
}
function addReferencePorts(reg: Record<string, ModelDefinition>): void {
  for (const def of Object.values(reg)) {
    if (def.provider !== 'muapi' || def.outputType !== 'image' || def.nodeType.endsWith('-edit')) continue;
    if (def.inputs.some((f) => f.fieldType === 'port' && (f.portType === 'image' || f.portType === 'media'))) continue;
    if (!referenceSibling(reg, def.nodeType)) continue;
    def.inputs = [...def.inputs, { id: REFERENCE_PORT_ID, portType: 'image', label: 'Reference images', required: false, falParam: REFERENCE_PORT_ID, fieldType: 'port', multiple: true, mediaRole: 'image', schemaType: 'array' }];
  }
}
