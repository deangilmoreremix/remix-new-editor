// [remix] Drag a Library card onto the timeline. The card carries a small JSON payload (what it is + its id); the timeline decides what the
// drop means from where it lands (an overlay row, a track, a clip, or the cut between two clips).
export const LIBRARY_DND = 'application/x-library-item';

export type LibraryKind = 'mg' | 'hf' | 'overlay' | 'template' | 'sound' | 'fx' | 'lut' | 'transition';
export interface LibraryDrag { kind: LibraryKind; id: string }
/** Where a drop landed. `time` is in seconds on the timeline; `row` is an overlay-row index; clip / track ids come from the element under the pointer. */
export interface LibraryDropCtx { time: number; row?: number; clipId?: string; trackId?: string; trackKind?: 'video' | 'audio' }

export const encodeLibraryDrag = (d: LibraryDrag): string => JSON.stringify(d);

export function decodeLibraryDrag(raw: string | undefined | null): LibraryDrag | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<LibraryDrag>;
    const kinds: LibraryKind[] = ['mg', 'hf', 'overlay', 'template', 'sound', 'fx', 'lut', 'transition'];
    return d && typeof d.id === 'string' && kinds.includes(d.kind as LibraryKind) ? { kind: d.kind as LibraryKind, id: d.id } : null;
  } catch { return null; }
}

export const hasLibraryDrag = (types: ArrayLike<string> | readonly string[] | undefined): boolean => !!types && Array.prototype.includes.call(types, LIBRARY_DND);

/** First free overlay row at or after `desired` where [start,end) overlaps nothing already on that row. */
export function freeOverlayRow(others: Array<{ id: string; start: number; end: number; row?: number }>, self: { id: string; start: number; end: number }, desired: number, autoRows: Map<string, number>): number {
  const rowOf = (o: { id: string; row?: number }) => (typeof o.row === 'number' ? o.row : (autoRows.get(o.id) ?? 0));
  for (let r = Math.max(0, desired); r < desired + 50; r++) {
    const clash = others.some((o) => o.id !== self.id && rowOf(o) === r && o.start < self.end - 1e-6 && o.end > self.start + 1e-6);
    if (!clash) return r;
  }
  return Math.max(0, desired);
}
