// Which library cards play a live preview: the hovered card first, then the visible cards from the top, capped so only a few
// sandboxed renderers run at once.
export const MAX_LIVE = 6;

export function pickPlaying(order: string[], visible: ReadonlySet<string>, hovered: string | null, max = MAX_LIVE): string[] {
  const out: string[] = [];
  if (hovered) out.push(hovered);
  for (const id of order) {
    if (out.length >= max) break;
    if (visible.has(id) && id !== hovered) out.push(id);
  }
  return out;
}
