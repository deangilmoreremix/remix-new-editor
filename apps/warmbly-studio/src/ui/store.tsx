import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Workspace } from '../types';
import type { Action, WarmblyAdapter } from '../api/actions';

interface Ctx { ws: Workspace; dispatch: (a: Action) => Promise<void>; adapter: WarmblyAdapter; toast: (m: string) => void; nav: (v: string, arg?: string) => void; arg?: string }
const C = createContext<Ctx | null>(null);
export const useWb = () => { const c = useContext(C); if (!c) throw new Error('useWb outside <WarmblyProvider>'); return c; };

export function WarmblyProvider({ adapter, children, nav, arg }: { adapter: WarmblyAdapter; children: ReactNode; nav: (v: string, arg?: string) => void; arg?: string }) {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => { let off = () => {}; let live = true;
    adapter.load().then(w => { if (live) { setWs(w); off = adapter.subscribe(setWs); } }).catch(e => setErr(String(e?.message ?? e)));
    return () => { live = false; off(); }; }, [adapter]);
  const toast = useCallback((m: string) => { setMsg(m); clearTimeout(timer.current); timer.current = setTimeout(() => setMsg(null), 2600); }, []);
  const dispatch = useCallback(async (a: Action) => { try { await adapter.dispatch(a); } catch (e) { toast(`Failed: ${(e as Error).message}`); } }, [adapter, toast]);
  const value = useMemo(() => ws ? { ws, dispatch, adapter, toast, nav, arg } : null, [ws, dispatch, adapter, toast, nav, arg]);
  if (err) return <div className="wb-empty" role="alert">Could not load Warmbly workspace: {err}</div>;
  if (!value) return <div className="wb-empty">Loading Warmbly…</div>;
  return <C.Provider value={value}>{children}{msg && <div className="wb-toast" role="status">{msg}</div>}</C.Provider>;
}
