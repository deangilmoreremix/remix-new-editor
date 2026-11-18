// [remix] Fix C: session state shared by the effects inspector and the preview handle overlay (small external store, not saved with the project).
// While an effect with a preview editor (path mask, corner pin) is "being edited", the inspector publishes the clip, the effect index, the
// clip time at the playhead and an `apply` callback that writes a patch to the clip; the overlay reads it and calls `apply` while dragging.
import { useSyncExternalStore } from 'react';
import type { Clip } from '@cinegen/types/timeline';
import type { ClipPatch } from '../editor/stage2/prop-edit';

export interface FxEditSession { clip: Clip; fxIndex: number; clipT: number; apply: (patch: ClipPatch) => void }
export type MaskTool = 'edit' | 'pen';

let session: FxEditSession | null = null;
let tool: MaskTool = 'edit';
let selected = -1;
const listeners = new Set<() => void>();
let version = 0;
const emit = () => { version++; listeners.forEach((l) => l()); };

export const getFxEditSession = () => session;
export function setFxEditSession(next: FxEditSession | null) { session = next; if (!next) { selected = -1; tool = 'edit'; } emit(); }
export const getMaskTool = () => tool;
export function setMaskTool(t: MaskTool) { if (t !== tool) { tool = t; emit(); } }
export const getSelectedVertex = () => selected;
export function selectVertex(i: number) { if (i !== selected) { selected = i; emit(); } }

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snap = () => version;
/** Re-renders on any change; read the getters for the values. */
export function useFxEdit(): { session: FxEditSession | null; tool: MaskTool; selected: number } {
  useSyncExternalStore(subscribe, snap, snap);
  return { session, tool, selected };
}
