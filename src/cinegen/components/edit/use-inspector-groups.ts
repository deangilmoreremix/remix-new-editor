// [remix] Which Inspector groups are open. Remembered in this browser (localStorage, every access wrapped: storage can be blocked or full).
import { useCallback, useState } from 'react';

export type InspectorGroupId = 'basics' | 'look' | 'motion' | 'captions' | 'analyze';
export const INSPECTOR_KEY = 'cinegen_inspector_groups';
/** Captions and Analyze are long and only some clips need them, so they start closed. */
export const DEFAULT_OPEN: Record<InspectorGroupId, boolean> = { basics: true, look: true, motion: true, captions: false, analyze: false };

export function readOpenGroups(): Record<InspectorGroupId, boolean> {
  try {
    const raw = window.localStorage.getItem(INSPECTOR_KEY);
    if (!raw) return { ...DEFAULT_OPEN };
    const j = JSON.parse(raw) as Partial<Record<InspectorGroupId, unknown>>;
    const out = { ...DEFAULT_OPEN };
    for (const k of Object.keys(DEFAULT_OPEN) as InspectorGroupId[]) if (typeof j[k] === 'boolean') out[k] = j[k] as boolean;
    return out;
  } catch { return { ...DEFAULT_OPEN }; }
}

export function useInspectorGroups() {
  const [open, setOpen] = useState(readOpenGroups);
  const toggle = useCallback((id: InspectorGroupId) => {
    setOpen((cur) => {
      const next = { ...cur, [id]: !cur[id] };
      try { window.localStorage.setItem(INSPECTOR_KEY, JSON.stringify(next)); } catch { /* it just will not be remembered */ }
      return next;
    });
  }, []);
  return { open, toggle };
}
