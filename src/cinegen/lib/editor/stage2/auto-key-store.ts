// [remix] Stage 2: the auto-keyframe toggle (session UI state shared by the Animation and Transform sections). Not saved with the project.
import { useSyncExternalStore } from 'react';

let on = false;
const listeners = new Set<() => void>();
export const getAutoKey = () => on;
export const setAutoKey = (v: boolean) => { if (v !== on) { on = v; listeners.forEach((l) => l()); } };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useAutoKey = (): boolean => useSyncExternalStore(subscribe, getAutoKey, () => false);
