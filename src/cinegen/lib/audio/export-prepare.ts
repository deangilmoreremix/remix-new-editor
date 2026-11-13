// [remix] Stage 4: one call for the export hand-off: bake EQ (browser only), then build the composition state with master volume.
import { buildExportState, type BuildExportStateInput, type ExportItem, type ExportClipInput } from '../editor/export-mapping';
import { bakeEqForExport, type EqClip } from './export-audio';
import { bakeEqToBlobUrl } from './eq-bake';

export async function buildExportStateWithAudio(
  input: BuildExportStateInput, makeItem: (c: ExportClipInput, i: number) => ExportItem, signal?: AbortSignal,
  bake: typeof bakeEqToBlobUrl = bakeEqToBlobUrl,
): Promise<ReturnType<typeof buildExportState>> {
  const baked = await bakeEqForExport(input.clips as EqClip[], input.tracks, bake, signal);
  const built = buildExportState({ ...input, clips: baked.clips }, makeItem);
  return { ...built, warnings: [...new Set([...baked.warnings, ...built.warnings])] };
}
