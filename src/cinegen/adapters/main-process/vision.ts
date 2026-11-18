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

// [remix] CineGen's detectObjectsInImage (electron/ipc/vision.ts): the object-proposal prompts and the box/score normalizer below
// are CineGen's code verbatim; only the model call changed (fal vision LLM -> OpenAI vision on the user's key).
interface VisionDetectedObject {
  label: string;
  box: [number, number, number, number];
  score: number;
  priority: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function tryParseJson(candidate: string): string | null {
  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    return null;
  }
}

function extractTextFromUnknown(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((entry) => extractTextFromUnknown(entry)).filter(Boolean).join('\n');
  }
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map((entry) => extractTextFromUnknown(entry))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function parseFractionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.endsWith('%')) {
    const parsedPercent = Number(trimmed.slice(0, -1));
    return Number.isFinite(parsedPercent) ? parsedPercent / 100 : null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDetectedObjects(
  parsed: Record<string, unknown>,
  maxObjects: number,
): VisionDetectedObject[] {
  const rawObjects = Array.isArray(parsed.objects)
    ? parsed.objects
    : Array.isArray(parsed.detections)
      ? parsed.detections
      : Array.isArray(parsed.items)
        ? parsed.items
        : Array.isArray(parsed.regions)
          ? parsed.regions
          : Array.isArray(parsed.subjects)
            ? parsed.subjects
            : (typeof parsed.label === 'string' || typeof parsed.name === 'string' || typeof parsed.object === 'string')
              ? [parsed]
              : [];
  const nextObjects = rawObjects
    .map((rawObject) => {
      if (!rawObject || typeof rawObject !== 'object') return null;
      const record = rawObject as Record<string, unknown>;
      const label = [
        record.label,
        record.name,
        record.object,
        record.subject,
        record.class,
        record.type,
      ].find((value) => typeof value === 'string' && value.trim());
      const nextLabel = typeof label === 'string' ? label.trim() : '';
      if (!nextLabel) return null;

      let x: number | null = null;
      let y: number | null = null;
      let w: number | null = null;
      let h: number | null = null;

      const centerBox = Array.isArray(record.box) ? record.box : Array.isArray(record.cxcywh) ? record.cxcywh : null;
      if (centerBox && centerBox.length >= 4) {
        x = parseFractionalNumber(centerBox[0]);
        y = parseFractionalNumber(centerBox[1]);
        w = parseFractionalNumber(centerBox[2]);
        h = parseFractionalNumber(centerBox[3]);
      }

      const cornerArray = Array.isArray(record.bbox)
        ? record.bbox
        : Array.isArray(record.bounds)
          ? record.bounds
          : Array.isArray(record.rect)
            ? record.rect
            : Array.isArray(record.xyxy)
              ? record.xyxy
              : null;
      if ((x === null || y === null || w === null || h === null) && cornerArray && cornerArray.length >= 4) {
        const x0 = parseFractionalNumber(cornerArray[0]);
        const y0 = parseFractionalNumber(cornerArray[1]);
        const x1 = parseFractionalNumber(cornerArray[2]);
        const y1 = parseFractionalNumber(cornerArray[3]);
        if ([x0, y0, x1, y1].every((value) => value !== null)) {
          x = ((x0 as number) + (x1 as number)) / 2;
          y = ((y0 as number) + (y1 as number)) / 2;
          w = (x1 as number) - (x0 as number);
          h = (y1 as number) - (y0 as number);
        }
      }

      const box3d = Array.isArray(record.box_3d) ? record.box_3d : Array.isArray(record.box3d) ? record.box3d : null;
      if ((x === null || y === null || w === null || h === null) && box3d && box3d.length >= 6) {
        const centerX = parseFractionalNumber(box3d[0]);
        const centerY = parseFractionalNumber(box3d[1]);
        const dimA = parseFractionalNumber(box3d[3]);
        const dimB = parseFractionalNumber(box3d[4]);
        const dimC = parseFractionalNumber(box3d[5]);
        if ([centerX, centerY, dimA, dimB, dimC].every((value) => value !== null)) {
          x = centerX;
          y = centerY;
          w = Math.max(dimA as number, dimB as number);
          h = Math.max(dimB as number, dimC as number);
        }
      }

      if (x === null || y === null || w === null || h === null) {
        const cx = parseFractionalNumber(record.center_x ?? record.cx ?? record.mid_x);
        const cy = parseFractionalNumber(record.center_y ?? record.cy ?? record.mid_y);
        const width = parseFractionalNumber(record.width ?? record.w);
        const height = parseFractionalNumber(record.height ?? record.h);
        if ([cx, cy, width, height].every((value) => value !== null)) {
          x = cx;
          y = cy;
          w = width;
          h = height;
        }
      }

      if (x === null || y === null || w === null || h === null) {
        const xMin = parseFractionalNumber(record.x_min ?? record.left);
        const yMin = parseFractionalNumber(record.y_min ?? record.top);
        const xMax = parseFractionalNumber(record.x_max ?? record.right);
        const yMax = parseFractionalNumber(record.y_max ?? record.bottom);
        if ([xMin, yMin, xMax, yMax].every((value) => value !== null)) {
          x = ((xMin as number) + (xMax as number)) / 2;
          y = ((yMin as number) + (yMax as number)) / 2;
          w = (xMax as number) - (xMin as number);
          h = (yMax as number) - (yMin as number);
        }
      }

      if ([x, y, w, h].some((value) => value === null || !Number.isFinite(value as number))) return null;
      const width = clamp(w, 0.02, 1);
      const height = clamp(h, 0.02, 1);
      const nextBox: [number, number, number, number] = [
        clamp(x, width / 2, 1 - width / 2),
        clamp(y, height / 2, 1 - height / 2),
        width,
        height,
      ];
      const rawScore = parseFractionalNumber(record.score ?? record.confidence ?? record.probability);
      const score = rawScore !== null
        ? clamp(rawScore, 0, 1)
        : 0.75;
      const rawPriority = parseFractionalNumber(record.priority ?? record.salience ?? record.importance);
      const priority = rawPriority !== null
        ? clamp(rawPriority, 0, 1)
        : score;
      return {
        label: nextLabel,
        box: nextBox,
        score,
        priority,
      } satisfies VisionDetectedObject;
    })
    .filter((entry): entry is VisionDetectedObject => Boolean(entry))
    .sort((left, right) => right.priority - left.priority || right.score - left.score);

  const deduped: VisionDetectedObject[] = [];
  for (const candidate of nextObjects) {
    const duplicate = deduped.some((existing) => {
      const sameLabel = existing.label.toLowerCase() === candidate.label.toLowerCase();
      const dx = Math.abs(existing.box[0] - candidate.box[0]);
      const dy = Math.abs(existing.box[1] - candidate.box[1]);
      const dw = Math.abs(existing.box[2] - candidate.box[2]);
      const dh = Math.abs(existing.box[3] - candidate.box[3]);
      return sameLabel && dx < 0.06 && dy < 0.06 && dw < 0.08 && dh < 0.08;
    });
    if (!duplicate) deduped.push(candidate);
    if (deduped.length >= maxObjects) break;
  }

  return deduped;
}

function extractObjectPayload(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    return { objects: value };
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (
      Array.isArray(record.objects)
      || Array.isArray(record.detections)
      || Array.isArray(record.items)
      || Array.isArray(record.regions)
      || Array.isArray(record.subjects)
    ) {
      return record;
    }
    if (
      typeof record.label === 'string'
      || typeof record.name === 'string'
      || typeof record.object === 'string'
      || Array.isArray(record.box_3d)
      || Array.isArray(record.box3d)
      || Array.isArray(record.box)
      || Array.isArray(record.bbox)
    ) {
      return { objects: [record] };
    }
    for (const key of ['output', 'text', 'content', 'message', 'result', 'data', 'response']) {
      if (key in record) {
        const nested = extractObjectPayload(record[key]);
        if (nested) return nested;
      }
    }
  }

  const text = extractTextFromUnknown(value);
  if (!text) return null;
  const jsonText = extractJsonText(text);
  if (!jsonText) return null;

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (Array.isArray(parsed)) return { objects: parsed };
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

const DEFAULT_DETECT_MODEL = 'openai/gpt-5.6-sol';

async function runVisionObjectProposal(imageUrl: string, prompt: string): Promise<Record<string, unknown> | null> {
  const r = await responsesChat({ user: prompt, images: [imageUrl], json: true });
  return extractObjectPayload(r.message);
}

export async function detectObjectsInImage(params: { imagePath: string; maxObjects?: number; context?: string; model?: string }): Promise<{ status: 'ready' | 'failed' | 'missing'; model: string; objects: VisionDetectedObject[]; error?: string }> {
  const maxObjects = Math.min(12, Math.max(1, Math.round(params.maxObjects ?? 6)));
  const model = params.model?.trim() || DEFAULT_DETECT_MODEL;
  const uploaded = await toVisionImage(params.imagePath, 1024);
  if (!uploaded) {
    return { status: 'missing', model, objects: [], error: 'No image was available to upload for auto segmentation.' };
  }
  const primaryPrompt = [
    'You are preparing object proposals for a promptable segmentation model.',
    params.context ? `Context: ${params.context}` : null,
    `Return compact JSON only with this shape: {"objects":[{"label":"person","box":[0.52,0.48,0.28,0.7],"score":0.96,"priority":0.99}]}`,
    'Each object must include a normalized box in [center_x, center_y, width, height] with values between 0 and 1.',
    `List up to ${maxObjects} distinct, mask-worthy objects.`,
    'Prefer people, faces, pets, products, props, vehicles, furniture, signs, devices, and other clearly isolated subjects.',
    'Include partially visible or cropped people, cars, trucks, bikes, and handheld objects if they are recognizably present.',
    'Do not return an empty list unless there are truly no identifiable objects in the frame.',
  ].filter(Boolean).join('\n');
  const retryPrompt = [
    'Retry object proposal extraction for image segmentation.',
    params.context ? `Context: ${params.context}` : null,
    'Be less selective. Return the most salient visible objects even if they are partially cropped, small, or overlapping.',
    `Return strict JSON only: {"objects":[{"label":"car","box":[0.5,0.5,0.4,0.3],"score":0.81,"priority":0.8}]}`,
    `Return between 1 and ${maxObjects} objects whenever any recognizable object exists.`,
  ].filter(Boolean).join('\n');
  try {
    const primary = await runVisionObjectProposal(uploaded, primaryPrompt);
    const primaryObjects = primary ? normalizeDetectedObjects(primary, maxObjects) : [];
    if (primaryObjects.length > 0) return { status: 'ready', model, objects: primaryObjects };
    const retry = await runVisionObjectProposal(uploaded, retryPrompt);
    const retryObjects = retry ? normalizeDetectedObjects(retry, maxObjects) : [];
    return { status: 'ready', model, objects: retryObjects };
  } catch (error) {
    return { status: 'failed', model, objects: [], error: (error instanceof Error ? error.message : String(error)) || 'Vision auto-segmentation failed.' };
  }
}
