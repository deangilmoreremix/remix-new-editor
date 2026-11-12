// [remix] Which form the Leads tab is filtered to ("View leads →" on a form's settings sets it before switching tabs).
import { useSyncExternalStore } from 'react';

let current = 'all';
const listeners = new Set<() => void>();
export const setLeadsForm = (key: string) => { if (current !== key) { current = key; listeners.forEach((l) => l()); } };
export const getLeadsForm = () => current;
export function useLeadsForm(): string {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => current, () => 'all');
}
