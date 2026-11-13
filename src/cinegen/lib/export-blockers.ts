// [remix] Why a clip cannot be rendered. The Export tab drops clips whose media is unusable; this names the reason so
// the Render button can say what is wrong instead of a generic "add clips" message when clips are on the timeline.
import { clipEffectiveDuration, type Clip } from '@cinegen/types/timeline';

export type BlockReason = 'media-missing' | 'no-file-link' | 'zero-length';
export interface BlockedClip { clipId: string; name: string; reason: BlockReason }

type AssetLike = { id: string; name?: string; fileRef?: string; url?: string };

export function exportBlockers(clips: Clip[], assets: AssetLike[]): BlockedClip[] {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const out: BlockedClip[] = [];
  for (const clip of clips) {
    const asset = byId.get(clip.assetId);
    if (!asset) { out.push({ clipId: clip.id, name: 'Unknown media', reason: 'media-missing' }); continue; }
    if (!(asset.fileRef || asset.url)) { out.push({ clipId: clip.id, name: asset.name || 'Untitled media', reason: 'no-file-link' }); continue; }
    if (!(clipEffectiveDuration(clip) > 0)) out.push({ clipId: clip.id, name: asset.name || 'Untitled media', reason: 'zero-length' });
  }
  return out;
}

const WHY: Record<BlockReason, string> = {
  'media-missing': 'its media is no longer in this project — add it again from the Media tab',
  'no-file-link': 'its media has no usable file link — re-add it from the Media tab (a saved link may not have loaded; sign in and reload)',
  'zero-length': 'it has no length after trimming',
};

/** One short sentence for the UI, or '' when nothing is blocked. */
export function describeBlockers(blocked: BlockedClip[]): string {
  if (!blocked.length) return '';
  const first = blocked[0];
  const more = blocked.length > 1 ? ` (and ${blocked.length - 1} more)` : '';
  return `“${first.name}”${more} can't be rendered: ${WHY[first.reason]}.`;
}
