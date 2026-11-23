/**
 * SmartVideo Studio — Generation Gateway
 *
 * Handles submission of generation requests to the backend.
 */

import { getModelById, getCatalogSource, type ModelMeta } from './modelRegistry';

export interface GenerationJob {
  id: string;
  modelId: string;
  modelName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  input: Record<string, unknown>;
  output?: unknown;
  /** image | video | audio, when known from the model's category. */
  outputType?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

const OUTPUT_TYPE_BY_GENERATION: Record<string, string> = {
  image: 'image', video: 'video', audio: 'audio', avatar: 'video', lipsync: 'video',
};

/** Remote catalog categories whose output is a video even though they live on the Avatar tab. */
const VIDEO_CATEGORIES = new Set(['talking-avatar', 'lip-sync', 'audio-to-video', 'character-animation']);

function generationTypeFor(meta: ModelMeta): string {
  const fromOverrides = (meta.ui_overrides as { generationType?: string } | undefined)?.generationType;
  if (fromOverrides) return fromOverrides;
  if (VIDEO_CATEGORIES.has(meta.category) || meta.category.includes('video')) return 'video';
  if (meta.category.includes('audio') || ['music', 'speech'].includes(meta.category)) return 'audio';
  return 'image';
}

/** Thrown when /api/generate is not deployed, so the caller falls back to muapi. */
class EndpointUnavailable extends Error {}

async function submitViaApi(params: { modelId: string; values: Record<string, unknown> }, meta?: ModelMeta): Promise<GenerationJob> {
  const parameters = await preparePayload(meta, params.values);
  let response: Response;
  try {
    response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ modelId: params.modelId, parameters }),
    });
  } catch (e) {
    throw new EndpointUnavailable(e instanceof Error ? e.message : 'Network error');
  }
  const isJson = (response.headers.get('content-type') || '').includes('json');
  if (response.status === 404 || response.status === 405 || !isJson) {
    throw new EndpointUnavailable(`/api/generate unavailable (${response.status})`);
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Generation failed' }));
    throw new Error(error.error || `Generation failed: ${response.status}`);
  }
  return (await response.json()) as GenerationJob;
}

const isLocalUrl = (v: unknown): v is string => typeof v === 'string' && (v.startsWith('blob:') || v.startsWith('data:'));

/** blob:/data: URLs from the upload fields are local to this tab; upload them so the API can read them. */
async function hostMedia(value: unknown, upload: (file: File) => Promise<string>): Promise<unknown> {
  if (Array.isArray(value)) return Promise.all(value.map(v => hostMedia(v, upload)));
  if (!isLocalUrl(value)) return value;
  const blob = await (await fetch(value)).blob();
  const ext = (blob.type.split('/')[1] || 'bin').split(';')[0];
  return upload(new File([blob], `upload.${ext}`, { type: blob.type || 'application/octet-stream' }));
}

const hasLocalUrl = (v: unknown): boolean => (Array.isArray(v) ? v.some(hasLocalUrl) : isLocalUrl(v));

/**
 * Drops empty values, uploads browser-local media, and matches each value's shape to the schema:
 * array fields (videos_list, reference audio lists...) get an array, single fields get one value.
 */
async function preparePayload(meta: ModelMeta | undefined, values: Record<string, unknown>): Promise<Record<string, unknown>> {
  const schema = meta?.input_schema || {};
  let upload: ((file: File) => Promise<string>) | null = null;
  const getUpload = async () => {
    if (!upload) {
      // muapi.js pulls in the large model catalog, so load it only when there is something to upload.
      const { muapi } = await import('../../../../lib/muapi.js');
      upload = (file: File) => muapi.uploadFile(file);
    }
    return upload;
  };
  const payload: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(values)) {
    if (raw === undefined || raw === null || raw === '') continue;
    if (Array.isArray(raw) && raw.length === 0) continue;
    let value = hasLocalUrl(raw) ? await hostMedia(raw, await getUpload()) : raw;
    const fieldType = (schema[key] as { type?: string } | undefined)?.type;
    if (fieldType === 'array' && !Array.isArray(value)) value = [value];
    else if (fieldType && fieldType !== 'array' && Array.isArray(value)) value = value[0];
    payload[key] = value;
  }
  return payload;
}

async function submitViaMuapi(meta: ModelMeta, values: Record<string, unknown>): Promise<GenerationJob> {
  const now = new Date().toISOString();
  const generationType = generationTypeFor(meta);
  const job: GenerationJob = {
    id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    modelId: meta.id,
    modelName: meta.display_name || meta.name,
    status: 'processing',
    input: values,
    outputType: OUTPUT_TYPE_BY_GENERATION[generationType],
    createdAt: now,
    updatedAt: now,
  };

  try {
    // muapi.js pulls in the large model catalog, so load it only when generating.
    const { muapi } = await import('../../../../lib/muapi.js');
    if (!muapi.apiKeyManager.hasMuapiKey()) {
      throw new Error('Add your MuAPI key in Settings to generate. No key is configured yet.');
    }

    const payload = await preparePayload(meta, values);
    const result = await muapi.submitAndPoll(meta.endpoint, payload, {
      generationType,
      studioType: generationType,
    });
    const url = result?.url || result?.outputs?.[0] || result?.output?.url;
    if (!url) throw new Error('The model finished but returned no output URL.');
    return { ...job, id: String(result.request_id || result.id || job.id), status: 'completed', output: url, updatedAt: new Date().toISOString() };
  } catch (e) {
    return { ...job, status: 'failed', error: e instanceof Error ? e.message : String(e), updatedAt: new Date().toISOString() };
  }
}

export async function submitGeneration(params: {
  modelId: string;
  values: Record<string, unknown>;
}): Promise<GenerationJob> {
  const meta = getModelById(params.modelId);
  // Models from the local catalog have no backend behind /api/generate: go straight to muapi.
  if (getCatalogSource() !== 'local') {
    try {
      return await submitViaApi(params, meta);
    } catch (e) {
      if (!(e instanceof EndpointUnavailable)) throw e;
    }
  }
  if (!meta) throw new Error(`Model "${params.modelId}" not found.`);
  return submitViaMuapi(meta, params.values);
}

export async function estimateGeneration(params: {
  modelId: string;
  values: Record<string, unknown>;
}): Promise<{ estimatedCost: number; modelName: string }> {
  const meta = getModelById(params.modelId);
  const fallback = { estimatedCost: meta?.cost ?? 0, modelName: meta?.display_name || meta?.name || params.modelId };
  // No estimate endpoint exists for the local catalog; skip the request.
  if (getCatalogSource() === 'local') return fallback;

  const response = await fetch('/api/generate/estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelId: params.modelId,
      parameters: params.values,
    }),
  });

  if (!response.ok || !(response.headers.get('content-type') || '').includes('json')) {
    return fallback;
  }

  const data = await response.json();
  return {
    estimatedCost: data.cost ?? data.estimatedCost ?? 0,
    modelName: data.modelName ?? params.modelId,
  };
}

export function deleteJob(jobId: string): void {
  // In a real app, this would call an API to delete the job
  console.log('[GenerationGateway] Deleting job:', jobId);
}
