// [remix] Caption generation for a clip, shared by the inspector and the assistant: on-device Whisper transcript →
// words in timeline ms → OpenChatCut CaptionsData (template, motion, optional translated second line).
// [remix] stable word ids (their identity scheme) so sentence edits follow the same source word
import { backfillCueIdentities } from '../../../openchatcut/transcript/identity';
import type { Clip } from '@cinegen/types/timeline';
import type { Asset } from '@cinegen/types/project';
import { toFileUrl } from '@cinegen/lib/utils/file-url';
import type { CaptionMotionPreset, CaptionsData, CaptionTemplate } from '../../../openchatcut/captions/types';
import { phrasesFromWords, translateCues } from './translate';

export async function generateClipCaptions(
  clip: Clip, asset: Asset,
  opts: { template?: CaptionTemplate; motion?: CaptionMotionPreset; translateTo?: string } = {},
): Promise<CaptionsData> {
  const { transcribeInBrowser, WHISPER_MODELS } = await import('../../../lib/editor/remotion/transcribe.js');
  const model = (navigator as Navigator & { gpu?: unknown }).gpu ? WHISPER_MODELS[0][0] : WHISPER_MODELS[1][0];
  const out = await transcribeInBrowser(toFileUrl(asset.fileRef || asset.url), { model, onProgress: () => {} });
  const sp = clip.speed || 1;
  const end = (clip.startTime + (clip.duration - clip.trimStart - clip.trimEnd) / sp) * 1000;
  const words = (out.captions as Array<{ text: string; startMs: number; endMs: number }>)
    .map((w) => ({ text: w.text, start: Math.round(clip.startTime * 1000 + (w.startMs - clip.trimStart * 1000) / sp), end: Math.round(clip.startTime * 1000 + (w.endMs - clip.trimStart * 1000) / sp) }))
    .filter((w) => w.end > clip.startTime * 1000 && w.start < end);
  if (!words.length) throw new Error('No speech found to caption.');
  const caps: CaptionsData = { enabled: true, template: opts.template ?? 'tiktok', pacing: 'phrase', motionPreset: opts.motion ?? 'pop', words: backfillCueIdentities(words, clip.id), offsetFrames: 0 };
  if (opts.translateTo) {
    const cues = await translateCues(phrasesFromWords(words.map((w) => ({ text: w.text, startMs: w.start, endMs: w.end }))), opts.translateTo);
    caps.bilingual = true; caps.translationLang = opts.translateTo;
    caps.translation = cues.map((c) => ({ start: c.startMs, end: c.endMs, text: c.text }));
  }
  return caps;
}
