// [remix] How a card in the "Add to timeline" modal previews. Kept free of UI imports so tests can check it.
import type { OverlayClip } from '@cinegen/types/workspace';

/** Every catalog entry must carry one of these: a card without a preview does not type-check. New preview kinds are added to this union. */
export type CardPreview =
  | { kind: 'overlay'; build: () => OverlayClip[]; duration: number; frame?: { width: number; height: number }; still?: number; image?: string };

/** True when a preview can be drawn: the registry test uses this so a card can never be added without a working preview. */
export function previewResolves(p: CardPreview): boolean {
  const clips = p.build();
  return Array.isArray(clips) && clips.length > 0 && p.duration > 0;
}
