// [remix] Browser replacement for CineGen's lib/cloud/funding.ts (Electron IPC + Firebase funding).
// Same export surface (`runWorkflow`, `WorkflowRunParams`, `WorkflowRunOptions`); generation runs on the
// user's own keys: images → OpenAI Images 2.6, video/audio → MuAPI (/api/timeline-ai). No fal, no Render.
import { generateImages, DEFAULT_IMAGE_MODEL, DETAIL_IMAGE_MODEL } from '../../../lib/editor/ai/openaiImages.js';

export interface WorkflowRunParams {
  apiKey?: string;
  kieKey?: string;
  runpodKey?: string;
  runpodEndpointId?: string;
  podUrl?: string;
  nodeId: string;
  nodeType: string;
  modelId: string;
  outputType?: 'image' | 'video' | 'audio' | 'text' | '3d';
  inputs: Record<string, unknown>;
}

export interface WorkflowRunOptions { [key: string]: unknown }

const asArray = (v: unknown): string[] => (Array.isArray(v) ? v : v ? [v] : []).filter((x): x is string => typeof x === 'string');

export async function runWorkflow(params: WorkflowRunParams, _options: WorkflowRunOptions = {}): Promise<unknown> {
  if ((params.outputType ?? 'image') !== 'image') {
    throw new Error(`${params.outputType} generation from this panel is routed through the MuAPI timeline tools (not wired yet).`);
  }
  const inputs = params.inputs ?? {};
  const prompt = String(inputs.prompt ?? '');
  const refs = [...asArray(inputs.image_urls), ...asArray(inputs.image_url), ...asArray(inputs.reference_image_urls)]
    .filter((u) => /^https:\/\//i.test(u));
  const { assets } = await generateImages(prompt, {
    model: refs.length ? DETAIL_IMAGE_MODEL : DEFAULT_IMAGE_MODEL,
    aspectRatio: (['16:9', '9:16', '1:1'].includes(String(inputs.aspect_ratio)) ? String(inputs.aspect_ratio) : '16:9') as string,
    refs,
  });
  if (!assets.length) throw new Error('OpenAI returned no image');
  return { data: { images: [{ url: assets[0].url }], url: assets[0].url } };
}

// [remix] verbatim from CineGen lib/cloud/funding.ts
export function workflowMediaInputs(inputs: Record<string, unknown>, outputType: string): Array<{ value: string; role: string }> {
  const media: Array<{ value: string; role: string }> = [];
  const add = (value: unknown, role: string) => {
    if (typeof value === 'string' && value.trim()) media.push({ value: value.trim(), role });
    if (Array.isArray(value)) value.forEach((entry) => add(entry, role));
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      if (typeof record.value === 'string') add(record.value, typeof record.role === 'string' ? record.role : role);
    }
  };
  // Reference lists carry whatever the user attached; frames below are frames by
  // definition, so only these are classified per file.
  const addReferences = (value: unknown) => add(value, 'reference');
  addReferences(inputs.higgsfield_media_inputs);
  addReferences(inputs.medias);
  addReferences(inputs.image_urls);
  addReferences(inputs.input_image_urls);
  addReferences(inputs.image_references);
  add(inputs.video_references, 'video');
  add(inputs.audio_references, 'audio');
  add(inputs.input_video, 'video');
  add(inputs.input_audio, 'audio');
  addReferences(inputs.reference_images);
  add(inputs.image_url, outputType === 'video' ? 'start_image' : 'image');
  add(inputs.first_frame, 'start_image');
  add(inputs.first_frame_url, 'start_image');
  add(inputs.reference_audio, 'audio');
  add(inputs.audio_url, 'audio');
  add(inputs.audio_urls, 'audio');
  add(inputs.video_urls, 'video');
  add(inputs.end_frame, 'end_image');
  add(inputs.end_frame_url, 'end_image');
  return media
    .map((entry) => (entry.role === 'reference' || entry.role === 'image'
      ? { ...entry, role: referenceRoleFor(entry.value, 'image') }
      : entry))
    .filter((entry, index, all) => all.findIndex((candidate) => (
      candidate.value === entry.value && candidate.role === entry.role
    )) === index);
}
