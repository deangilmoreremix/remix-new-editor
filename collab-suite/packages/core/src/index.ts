import { useCallback, useEffect, useRef, useState } from "react";
import "./styles.css";

export const uid = () => Math.random().toString(36).slice(2, 10);

/** localStorage-backed state, kept in sync across browser tabs. */
export function useStore<T>(key: string, initial: T) {
  const read = (): T => {
    try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : initial; }
    catch { return initial; }
  };
  const [value, setValue] = useState<T>(read);
  const latest = useRef(value);          // newest value this tab has produced
  const unsaved = useRef(false);         // true after a failed write: memory is ahead of storage
  useEffect(() => {
    const on = (e: StorageEvent) => { if (e.key === key) { const v = read(); latest.current = v; unsaved.current = false; setValue(v); } };
    window.addEventListener("storage", on);
    return () => window.removeEventListener("storage", on);
  }, [key]);
  // Build each update on the latest stored value so another tab's write is not overwritten.
  // If storage writes are failing, build on this tab's in-memory value instead so updates
  // are not lost. Returns false when the value could not be persisted, so callers can keep
  // unsaved input. Updaters should use the functional form.
  const set = useCallback((u: T | ((p: T) => T)): boolean => {
    const base = unsaved.current ? latest.current : read();
    const n = typeof u === "function" ? (u as (p: T) => T)(base) : u;
    let saved = true;
    try { localStorage.setItem(key, JSON.stringify(n)); } catch { saved = false; }
    unsaved.current = !saved;
    latest.current = n;
    setValue(n);
    return saved;
  }, [key]);
  return [value, set] as const;
}
