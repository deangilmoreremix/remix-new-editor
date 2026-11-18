// [remix] Which overlay is selected (shared by the timeline lane, the viewer layer and the inspector).
import { useSyncExternalStore } from 'react';

let selected: string | null = null;
const listeners = new Set<() => void>();
export const selectOverlay = (id: string | null) => { if (selected !== id) { selected = id; listeners.forEach((l) => l()); } };
export const getSelectedOverlay = () => selected;
export function useSelectedOverlay(): string | null {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => selected, () => null);
}
