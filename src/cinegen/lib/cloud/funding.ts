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
