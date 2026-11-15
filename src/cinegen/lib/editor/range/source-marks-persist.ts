// [remix] Fix B2: source-monitor marks are saved with the project, per asset, in `asset.metadata.sourceMarks` (the project save already
// stores asset metadata and UPDATE_ASSET deep-merges it). Pure helpers: read a valid marks object from an asset / make the metadata patch.
import { emptyMarks, MIN_RANGE, type SourceMarks } from '../stage1/source-range';

export const SOURCE_MARKS_KEY = 'sourceMarks';

/** The marks saved on an asset, validated against its duration (bad or out-of-range values are ignored). Never throws. */
export function marksFromAsset(a: { id: string; duration?: number; metadata?: Record<string, unknown> | null }): SourceMarks {
  const raw = a.metadata?.[SOURCE_MARKS_KEY] as { markIn?: unknown; markOut?: unknown } | undefined;
  const dur = a.duration ?? Infinity;
  const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= dur + 1e-6;
  let markIn = ok(raw?.markIn) ? raw!.markIn as number : null;
  const markOut = ok(raw?.markOut) ? raw!.markOut as number : null;
  if (markIn !== null && markOut !== null && markOut - markIn < MIN_RANGE) markIn = null;
  return raw ? { assetId: a.id, markIn, markOut } : emptyMarks(a.id);
}

/** The `metadata` patch for UPDATE_ASSET (null removes the marks). */
export const marksMetadataPatch = (m: SourceMarks): Record<string, unknown> => ({
  [SOURCE_MARKS_KEY]: m.markIn === null && m.markOut === null ? null : { markIn: m.markIn, markOut: m.markOut },
});
