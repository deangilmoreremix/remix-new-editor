// [remix] How a card in the "Add to timeline" modal previews. Kept free of UI imports so tests can check it.
import type { OverlayClip } from '@cinegen/types/workspace';

export type ArtKind = 'generator';
/** Every catalog entry must carry one of these: a card without a preview does not type-check. */
export type CardPreview =
  | { kind: 'overlay'; build: () => OverlayClip[]; duration: number; frame?: { width: number; height: number }; still?: number; image?: string }
  | { kind: 'video'; src: string; poster?: string }
  | { kind: 'art'; art: ArtKind };

/** True when a preview can be drawn: the registry test uses this so a card can never be added without a working preview. */
export function previewResolves(p: CardPreview): boolean {
  if (p.kind === 'art') return p.art === 'generator';
  if (p.kind === 'video') return typeof p.src === 'string' && p.src.length > 0;
  const clips = p.build();
  return Array.isArray(clips) && clips.length > 0 && p.duration > 0;
}
