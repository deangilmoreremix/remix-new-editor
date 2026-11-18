// [remix] Stage 4: one call for the export hand-off: bake EQ (browser only), then build the composition state with master volume.
import { buildExportState, type BuildExportStateInput, type ExportItem, type ExportClipInput } from '../editor/export-mapping';
import { bakeEqForExport, type EqClip } from './export-audio';
import { bakeEqToBlobUrl } from './eq-bake';
import { bakePitchForExport, type PitchBakeFn, type PitchClip } from './export-pitch'; // [remix] Stage 11
import { bakePitchToBlobUrl, clearPitchDecodeCache } from './pitch-bake';

export async function buildExportStateWithAudio(
  input: BuildExportStateInput, makeItem: (c: ExportClipInput, i: number) => ExportItem, signal?: AbortSignal,
  bake: typeof bakeEqToBlobUrl = bakeEqToBlobUrl,
  bakePitch: PitchBakeFn = (r, s) => bakePitchToBlobUrl(r, s),
): Promise<ReturnType<typeof buildExportState>> {
  // [remix] Stage 11: pitch / stretch first (it renders only the clip's source range), then the EQ on that result, as in the preview chain
  const pitched = await bakePitchForExport(input.clips as PitchClip[], input.tracks, bakePitch, signal).finally(clearPitchDecodeCache);
  const baked = await bakeEqForExport(pitched.clips as EqClip[], input.tracks, bake, signal);
  const built = buildExportState({ ...input, clips: baked.clips }, makeItem);
  return { ...built, warnings: [...new Set([...pitched.warnings, ...baked.warnings, ...built.warnings])] };
}
