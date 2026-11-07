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
