import { useCallback, useEffect, useState } from "react";
import "./styles.css";

export const uid = () => Math.random().toString(36).slice(2, 10);

/** localStorage-backed state, kept in sync across browser tabs. */
export function useStore<T>(key: string, initial: T) {
  const read = (): T => {
    try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : initial; }
    catch { return initial; }
  };
  const [value, setValue] = useState<T>(read);
  useEffect(() => {
    const on = (e: StorageEvent) => { if (e.key === key) setValue(read()); };
    window.addEventListener("storage", on);
    return () => window.removeEventListener("storage", on);
  }, [key]);
  // Re-read storage on every write so an update from another tab that this tab has not
  // seen yet is built on, not overwritten. Updaters should use the functional form.
  const set = useCallback((u: T | ((p: T) => T)) => {
    const n = typeof u === "function" ? (u as (p: T) => T)(read()) : u;
    try { localStorage.setItem(key, JSON.stringify(n)); } catch { /* quota/private mode */ }
    setValue(n);
  }, [key]);
  return [value, set] as const;
}
