// [remix] Runs the analysis-backed assistant steps (scene split, captions) with the OpenChatCut tools, in the browser.
import { splitClip } from '@cinegen/lib/editor/timeline-operations';
import { clipEffectiveDuration, type Timeline } from '@cinegen/types/timeline';
import type { Asset } from '@cinegen/types/project';
import { toFileUrl } from '@cinegen/lib/utils/file-url';
import { detectSceneChanges, sourceToTimeline } from '@cinegen/lib/occ/analysis';
import { generateClipCaptions } from '@cinegen/lib/occ/captions';
import { resolveCaptionTemplate, resolveMotion } from './copilot-look-ops';
import type { SkillAnalyzeClipStep } from './skill-actions';

type Dispatch = (action: { type: 'SET_TIMELINE'; timelineId: string; timeline: Timeline } | { type: 'SET_TAB'; tab: 'edit' }) => void;

/** Pure part: split `clipId` at the given source-time scene changes (descending so ids stay valid). */
export function splitAtSceneChanges(tl: Timeline, clipId: string, sceneMs: number[]): Timeline {
  const clip = tl.clips.find((c) => c.id === clipId);
  if (!clip) return tl;
  const times = sceneMs.map((ms) => sourceToTimeline(clip, ms / 1000)).filter((t): t is number => t != null).sort((a, b) => b - a);
  let out = tl;
  for (const t of times) out = splitClip(out, clipId, t);
  return out;
}

export async function runAnalyzeClipStep(step: SkillAnalyzeClipStep, timeline: Timeline, assets: Asset[], dispatch: Dispatch): Promise<void> {
  const clip = timeline.clips.find((c) => c.id === step.clipId);
  const asset = clip && assets.find((a) => a.id === clip.assetId);
  if (!clip || !asset) return;
  if (step.task === 'split_scenes') {
    const found = await detectSceneChanges(toFileUrl(asset.fileRef || asset.url), { threshold: step.threshold });
    dispatch({ type: 'SET_TIMELINE', timelineId: timeline.id, timeline: splitAtSceneChanges(timeline, clip.id, found.map((f) => f.timeMs)) });
  } else {
    const captions = await generateClipCaptions(clip, asset, {
      template: step.template ? resolveCaptionTemplate(step.template) ?? undefined : undefined,
      motion: step.motion ? resolveMotion(step.motion) ?? undefined : undefined,
      translateTo: step.translateTo,
    });
    dispatch({ type: 'SET_TIMELINE', timelineId: timeline.id, timeline: { ...timeline, clips: timeline.clips.map((c) => (c.id === clip.id ? { ...c, captions } : c)) } });
  }
  dispatch({ type: 'SET_TAB', tab: 'edit' });
  void clipEffectiveDuration;
}
