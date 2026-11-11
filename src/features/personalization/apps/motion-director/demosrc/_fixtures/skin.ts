import { type FilmPalette, cleanPalette } from '../../lib/palette';

// Which palette the recipes draw in right now. The film palette is set once per render (setBrand /
// the project's theme); the clip palette is set by the demo wrapper while that clip's subtree renders
// (React renders a clip's children before its next sibling), so two clips in one frame stay apart.
let film: FilmPalette | null = null;
let clip: FilmPalette | null | undefined;

export function setFilmPalette(p: FilmPalette | null): void {
  film = p && Object.keys(cleanPalette(p)).length ? cleanPalette(p) : null;
}
/** `undefined` = this clip has no palette of its own (use the film's); `null` = as designed. */
export function setClipPalette(p: FilmPalette | null | undefined): void {
  clip = p === undefined ? undefined : p && Object.keys(p).length ? p : null;
}
export const activePalette = (): FilmPalette | null => (clip === undefined ? film : clip);
