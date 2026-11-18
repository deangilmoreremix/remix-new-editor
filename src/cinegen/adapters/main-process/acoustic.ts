// [remix] CineGen's analyzeAssetAcoustics (electron/ipc/acoustic-analysis.ts): same prompt, parsing and result shape.
// Two transports swapped: ffmpeg `silencedetect` -> PCM silence detection in the browser (same -30 dB / 0.3 s thresholds),
// and the Gemini-CLI/fal descriptor pass -> OpenAI vision on sampled frames + the transcript (user's own key).
import {
  ACOUSTIC_ANALYSIS_VERSION, buildAcousticPrompt, normalizeAcousticSegments, SILENCE_MIN_DURATION, SILENCE_NOISE_DB,
  type AcousticAnalysisResult, type PromptTranscriptSegment,
} from '@cinegen/lib/llm/acoustic-analysis';
// @ts-expect-error plain JS ML helpers from the main app
import { detectSilences } from '../../../lib/editor/ml/localAI.js';
// @ts-expect-error plain JS ML helpers from the main app
import { grabFrame, canvasToBlob } from '../../../lib/editor/ml/frameGrab.js';
import { responsesChat } from '../llm-responses';

export interface AcousticAnalyzeParams {
  apiKey?: string; assetId: string; assetName: string; mediaPath: string; isVideo: boolean;
  durationSec?: number; transcript: PromptTranscriptSegment[]; model?: string;
}

const MODEL_LABEL = 'openai-responses';
const FRAMES = 6;

async function sampleFrames(src: string, durationSec: number): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < FRAMES; i++) {
    try {
      const canvas = await grabFrame(src, ((i + 0.5) / FRAMES) * durationSec, { maxSize: 640 });
      const blob: Blob = await canvasToBlob(canvas, 'image/jpeg', 0.7);
      out.push(await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(blob); }));
    } catch { /* skip an unreadable frame */ }
  }
  return out;
}

export async function analyzeAssetAcoustics(params: AcousticAnalyzeParams): Promise<AcousticAnalysisResult> {
  const base: AcousticAnalysisResult = {
    assetId: params.assetId, status: 'failed', version: ACOUSTIC_ANALYSIS_VERSION, model: MODEL_LABEL,
    silenceMap: [], segments: [], hasSpeech: params.transcript.length > 0, sourceDurationSec: params.durationSec,
  };
  try {
    const thresholdDb = SILENCE_NOISE_DB;
    const silenceMap = (await detectSilences(params.mediaPath, { thresholdDb, minSec: SILENCE_MIN_DURATION }).catch(() => [])) as Array<{ start: number; end: number }>;
    const prompt = buildAcousticPrompt({ assetName: params.assetName, transcript: params.transcript });
    const frames = params.isVideo && params.durationSec ? await sampleFrames(params.mediaPath, params.durationSec) : [];
    const silenceNote = silenceMap.length ? `\nMeasured silences (seconds): ${silenceMap.slice(0, 40).map((s) => `${s.start.toFixed(1)}-${s.end.toFixed(1)}`).join(', ')}.` : '';
    const r = await responsesChat({ user: prompt + silenceNote, images: frames, json: true });
    return {
      ...base, status: 'ready', updatedAt: new Date().toISOString(), silenceMap,
      segments: normalizeAcousticSegments(r.message),
      error: silenceMap.length === 0 ? 'Silence detection returned no intervals.' : undefined,
    };
  } catch (error) {
    return { ...base, error: (error instanceof Error ? error.message : String(error)) || 'Acoustic analysis failed.' };
  }
}
