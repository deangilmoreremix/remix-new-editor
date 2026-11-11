// [remix] Browser replacement for CineGen's lib/cloud/funding.ts (Electron IPC + Firebase funding).
// Same export surface (`runWorkflow`, `WorkflowRunParams`, `WorkflowRunOptions`); generation runs on the
// user's own keys: images → OpenAI Images 2.6, video/audio → MuAPI (/api/timeline-ai). No fal, no Render.
import { generateImages, DEFAULT_IMAGE_MODEL, DETAIL_IMAGE_MODEL } from '../../../lib/editor/ai/openaiImages.js';
import { ALL_MODELS, getModelDefinition } from '@cinegen/lib/fal/models';
import { REFERENCE_PORT_ID, referenceSibling } from '@cinegen/lib/muapi/model-catalog';
import { runTimelineMuapi } from '../../../lib/editor/ai/timelineMuapi.js';

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

async function runOnDeviceSegment(inputs: Record<string, unknown>): Promise<unknown> {
  const url = String(inputs.image_url ?? '');
  if (!url) throw new Error('No frame to mask.');
  const [{ grabFrame }, ai] = await Promise.all([import('../../../lib/editor/ml/frameGrab.js'), import('../../../lib/editor/ml/localAI.js')]);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => resolve(i); i.onerror = () => reject(new Error('Could not load the frame.')); i.src = url;
  });
  const canvas = await grabFrame(url, 0, { image: true, maxSize: 2048 });
  const k = canvas.width / (img.naturalWidth || canvas.width);
  const pts = (Array.isArray(inputs.point_prompts) ? inputs.point_prompts : []) as Array<{ x: number; y: number; label?: number }>;
  const boxes = (Array.isArray(inputs.box_prompts) ? inputs.box_prompts : []) as Array<{ x_min: number; y_min: number; x_max: number; y_max: number }>;
  const text = String(inputs.prompt ?? '').trim();
  const res = text && !pts.length && !boxes.length
    ? await ai.maskFromText(canvas, text)
    : await ai.maskFromPrompt(canvas, {
        points: pts.map((p) => [p.x * k, p.y * k]),
        labels: pts.map((p) => (p.label === 0 ? 0 : 1)),
        box: boxes[0] ? [boxes[0].x_min * k, boxes[0].y_min * k, boxes[0].x_max * k, boxes[0].y_max * k] : undefined,
      });
  if (!res?.alpha) throw new Error('No object found for that prompt.');
  const png = await ai.alphaToMaskPng(res.alpha, res.width, res.height);
  return { masks: [{ url: URL.createObjectURL(png) }], boxes: [res.bbox ?? []], scores: [res.score ?? 1] };
}

// SAM 3 video tracking -> free on-device SlimSAM, propagated frame to frame (box follows the previous mask), written as alpha WebM.
async function runOnDeviceTrack(inputs: Record<string, unknown>): Promise<unknown> {
  const url = String(inputs.video_url ?? '');
  if (!url) throw new Error('No video to track.');
  const [{ grabFrame }, ai] = await Promise.all([import('../../../lib/editor/ml/frameGrab.js'), import('../../../lib/editor/ml/localAI.js')]);
  const size = await new Promise<{ w: number; h: number }>((resolve, reject) => {
    const v = document.createElement('video'); v.preload = 'metadata'; v.crossOrigin = 'anonymous';
    v.onloadedmetadata = () => resolve({ w: v.videoWidth || 1, h: v.videoHeight || 1 }); v.onerror = () => reject(new Error('Could not read the clip.')); v.src = url;
  });
  const pts = (Array.isArray(inputs.point_prompts) ? inputs.point_prompts : []) as Array<{ x: number; y: number; label?: number }>;
  const boxes = (Array.isArray(inputs.box_prompts) ? inputs.box_prompts : []) as Array<{ x_min: number; y_min: number; x_max: number; y_max: number }>;
  const text = String(inputs.prompt ?? '').trim();
  let boxNorm: number[] | undefined = boxes[0] ? [boxes[0].x_min / size.w, boxes[0].y_min / size.h, boxes[0].x_max / size.w, boxes[0].y_max / size.h] : undefined;
  if (!boxNorm && !pts.length && text) {
    const first = await grabFrame(url, 0, { maxSize: 960 });
    const found = await ai.maskFromText(first, text);
    if (!found?.bbox) throw new Error('No object found for that prompt in the first frame.');
    boxNorm = [found.bbox[0] / first.width, found.bbox[1] / first.height, found.bbox[2] / first.width, found.bbox[3] / first.height];
  }
  if (!boxNorm && !pts.length) throw new Error('Add a text prompt, a click or a box to track something.');
  const scale = Math.min(1, 960 / Math.max(size.w, size.h));
  const blob = await ai.maskWholeClip(url, {
    boxNorm, points: pts.map((p) => [p.x * scale, p.y * scale]), labels: pts.map((p) => (p.label === 0 ? 0 : 1)), every: 2, maxSize: 960,
  });
  const out = URL.createObjectURL(blob);
  return { video: { url: out }, url: out };
}

const asArray = (v: unknown): string[] => (Array.isArray(v) ? v : v ? [v] : []).filter((x): x is string => typeof x === 'string');

export async function runWorkflow(params: WorkflowRunParams, _options: WorkflowRunOptions = {}): Promise<unknown> {
  const inputs = params.inputs ?? {};
  // Layer-decompose vision prepass: describe the image with OpenAI vision (user's key).
  if (params.nodeType === 'layer-decompose-vision') {
    const { responsesChat } = await import('../../adapters/web-api');
    const r = await responsesChat({ user: String(inputs.prompt ?? ''), images: asArray(inputs.image_url) });
    return { output: r.message };
  }
  // SAM 3 (was fal) -> free on-device SlimSAM / Florence-2 in the browser (Transformers.js).
  if (params.nodeType === 'sam3-segment-cloud') return runOnDeviceSegment(inputs);
  if (params.nodeType === 'sam3-track-cloud') {
    return runOnDeviceTrack(inputs);
  }
  // Any MuAPI catalog model (Spaces / Studio nodes): one generic request, validated server-side against the catalog.
  const def = getModelDefinition(params.nodeType);
  if (def?.provider === 'muapi') {
    // Element / image references on a text-to-image model → its `<model>-edit` sibling (same family, takes images_list)
    const refs = asArray(inputs[REFERENCE_PORT_ID]).filter(Boolean);
    const sibling = refs.length && def.outputType === 'image' ? referenceSibling(ALL_MODELS, def.nodeType) : undefined;
    const { url, urls } = await runTimelineMuapi('generate', { model: sibling ?? def.nodeType, inputs });
    if (def.outputType === 'audio') return { audio: { url }, url, resultUrls: urls };
    if (def.outputType === 'image') return { images: urls.map((u) => ({ url: u })), image: { url }, url, resultUrls: urls };
    return { video: { url }, video_url: url, url, resultUrls: urls };
  }
  const outputType = params.outputType ?? (params.nodeType === 'video' ? 'video' : params.nodeType === 'music' ? 'audio' : 'image');
  const [modelTag] = String(params.modelId || '').split('|');

  // Images -> OpenAI Images 2.6 on the user's own key.
  if (outputType === 'image') {
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

  // Video / audio -> MuAPI through /api/timeline-ai (user's own MuAPI key; no fal).
  const frames = asArray(inputs.image_urls).length ? asArray(inputs.image_urls) : [...asArray(inputs.image_url), ...asArray(inputs.start_image_url)];
  const prompt = String(inputs.prompt ?? '');
  const duration = Number(inputs.duration) || undefined;
  const model = modelTag.startsWith('muapi:') ? modelTag.slice(6) : undefined;
  let tool: string;
  let toolParams: Record<string, unknown>;
  if (params.nodeId === 'timeline-fill-gap') {
    tool = 'fill_gap';
    toolParams = { model, firstFrameUrl: frames[0], lastFrameUrl: frames[1] ?? frames[0], prompt, duration };
  } else if (params.nodeId === 'timeline-extend') {
    if (inputs.direction === 'before') { tool = 'extend_before'; toolParams = { model, firstFrameUrl: frames[0], prompt, duration }; }
    else { tool = 'shot_video'; toolParams = { model, imageUrl: frames[0], prompt, duration }; }
  } else if (outputType === 'audio') {
    tool = 'music';
    toolParams = {
      prompt, duration: Math.round((Number(inputs.music_length_ms) || 30000) / 1000),
      instrumental: inputs.force_instrumental !== false,
    };
  } else if (frames.length) {
    tool = 'shot_video';
    toolParams = { model, imageUrl: frames[0], prompt, duration };
  } else {
    throw new Error('Text-to-video is not available yet. Generate an image first, then animate it (image-to-video on MuAPI).');
  }
  const { url, urls } = await runTimelineMuapi(tool, toolParams);
  return outputType === 'audio'
    ? { audio: { url }, url, resultUrls: urls }
    : { resultUrls: urls, video_url: url, url };
}

// [remix] verbatim from CineGen lib/cloud/funding.ts
// [remix] restored verbatim from CineGen (it was dropped when this file was reduced to the browser router)
const VIDEO_REFERENCE_EXTENSIONS = ['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv'];
const AUDIO_REFERENCE_EXTENSIONS = ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'aiff'];

/**
 * A reference list is mixed media. Topview sorts references into stills, clips
 * and audio by the role we send, so read the role off the file rather than off
 * the field it arrived in — otherwise a clip is submitted as a still image.
 */
function referenceRoleFor(value: string, fallback: string): string {
  let path = value.split(/[?#]/)[0];
  try { path = decodeURIComponent(path); } catch { /* Legacy URLs may contain literal percent signs. */ }
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  if (VIDEO_REFERENCE_EXTENSIONS.includes(ext)) return 'video';
  if (AUDIO_REFERENCE_EXTENSIONS.includes(ext)) return 'audio';
  return fallback;
}

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

// [remix] CineGen's owner-funded generation (Firebase) has no counterpart here: generation always runs on the user's own
// MuAPI / OpenAI keys. Same exports so CineGen's workspace shell and settings code run unchanged.
export type FundedProvider = 'fal' | 'higgsfield';
export interface ProjectFundingStatus { enabled: boolean; providers: FundedProvider[]; monthlyLimit: number; used: number; month: string; role: 'owner' | 'editor'; ownerId: string }
let activeProjectId = '';
export function setActiveFundingProject(projectId: string | null): void { activeProjectId = projectId ?? ''; void activeProjectId; }
export async function getProjectFundingStatus(_projectId: string): Promise<ProjectFundingStatus> {
  return { enabled: false, providers: [], monthlyLimit: 0, used: 0, month: new Date().toISOString().slice(0, 7), role: 'owner', ownerId: '' };
}
export async function configureProjectFunding(): Promise<void> { /* no shared funding on the web editor */ }
