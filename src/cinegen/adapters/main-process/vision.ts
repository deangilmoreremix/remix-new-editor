// [remix] CineGen's analyzeAssetVisualSummary (electron/ipc/vision.ts): same prompt and result shape, run on
// OpenAI vision through the user's own key instead of fal any-llm/vision.
import type { AssetVisualSummary } from '@cinegen/lib/llm/editorial-workflow';
import { responsesChat } from '../llm-responses';

const DEFAULT_VISION_MODEL = 'openai/gpt-5.6-sol';

/** https and data: images pass through; blob:/relative URLs are downscaled to a data: URL. */
export async function toVisionImage(url: string, maxSide = 768): Promise<string | null> {
  if (/^data:image\/(jpeg|png|webp);base64,/i.test(url) || /^https:\/\//i.test(url)) return url;
  try {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  } catch { return null; }
}

function extractJsonText(raw: string): string | null {
  const t = raw.trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : t;
  const s = candidate.indexOf('{'); const e = candidate.lastIndexOf('}');
  return s >= 0 && e > s ? candidate.slice(s, e + 1) : null;
}

export async function analyzeAssetVisualSummary(params: { apiKey?: string; assetId: string; assetName: string; framePaths: string[]; model?: string }): Promise<AssetVisualSummary> {
  const model = params.model?.trim() || DEFAULT_VISION_MODEL;
  const images = (await Promise.all(params.framePaths.slice(0, 6).map((p) => toVisionImage(p)))).filter((u): u is string => Boolean(u));
  if (images.length === 0) return { assetId: params.assetId, status: 'missing', model, error: 'No visual frames were available to analyze.' };
  const out = await responsesChat({
    images,
    user: [
      `Analyze these frames from asset "${params.assetName}" for editorial planning.`,
      'Return compact JSON only with this shape:',
      '{"summary":"...","tone":["..."],"pacing":"...","shotTypes":["..."],"subjects":["..."],"brollIdeas":["..."],"confidence":0.82}',
      'Focus on emotional tone, coverage value, pacing feel, character presence, likely shot type, and practical b-roll opportunities.',
    ].join('\n'),
  });
  const jsonText = extractJsonText(out.message);
  if (!jsonText) return { assetId: params.assetId, status: 'failed', model, error: 'Vision analysis did not return valid JSON.' };
  try {
    const p = JSON.parse(jsonText) as Record<string, unknown>;
    const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined);
    return {
      assetId: params.assetId, status: 'ready',
      summary: typeof p.summary === 'string' ? p.summary.trim() : undefined,
      tone: strs(p.tone), pacing: typeof p.pacing === 'string' ? p.pacing.trim() : undefined,
      shotTypes: strs(p.shotTypes), subjects: strs(p.subjects), brollIdeas: strs(p.brollIdeas),
      confidence: typeof p.confidence === 'number' && Number.isFinite(p.confidence) ? p.confidence : undefined,
      updatedAt: new Date().toISOString(), model, sourceFrameCount: images.length,
    };
  } catch {
    return { assetId: params.assetId, status: 'failed', model, error: 'Vision analysis returned unreadable JSON.' };
  }
}

// [remix] CineGen's vision.detectObjects (Auto Segment proposals) on-device: DETR in the browser (free, no key) instead of a
// fal vision LLM. Same result shape: normalized [center_x, center_y, width, height] boxes with score + priority.
export async function detectObjectsInImage(params: { imagePath: string; maxObjects?: number }): Promise<{
  status: 'ready' | 'failed' | 'missing'; model: string; objects: Array<{ label: string; box: [number, number, number, number]; score: number; priority: number }>; error?: string;
}> {
  const model = 'detr-resnet-50 (on-device)';
  try {
    const [{ grabFrame, canvasImageData }, { runLocalTask }] = await Promise.all([
      import('../../../lib/editor/ml/frameGrab.js'), import('../../../lib/editor/ml/mlClient.js'),
    ]) as unknown as [{ grabFrame: (s: string, t: number, o: object) => Promise<HTMLCanvasElement>; canvasImageData: (c: HTMLCanvasElement) => ImageData },
      { runLocalTask: (t: string, i: object, o: object) => Promise<Array<{ label: string; score: number; box: { xmin: number; ymin: number; xmax: number; ymax: number } }>> }];
    if (!params.imagePath) return { status: 'missing', model, objects: [], error: 'No image was available for auto segmentation.' };
    const canvas = await grabFrame(params.imagePath, 0, { image: true, maxSize: 768 });
    const data = canvasImageData(canvas);
    const pixels = new Uint8ClampedArray(data.data);
    const dets = await runLocalTask('detr.detect', { image: { data: pixels, width: data.width, height: data.height }, threshold: 0.5 }, { transfer: [pixels.buffer] });
    const max = Math.min(12, Math.max(1, Math.round(params.maxObjects ?? 6)));
    const objects = dets.map((d) => {
      const w = d.box.xmax - d.box.xmin; const h = d.box.ymax - d.box.ymin;
      return { label: d.label, score: d.score, box: [d.box.xmin + w / 2, d.box.ymin + h / 2, w, h] as [number, number, number, number], priority: Math.min(1, d.score * (0.5 + Math.sqrt(w * h))) };
    }).sort((a, b) => b.priority - a.priority).slice(0, max);
    return { status: 'ready', model, objects };
  } catch (error) {
    return { status: 'failed', model, objects: [], error: error instanceof Error ? error.message : 'On-device detection failed.' };
  }
}
