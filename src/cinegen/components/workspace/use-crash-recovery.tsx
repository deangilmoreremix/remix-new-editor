// [remix] Stage 11 (port J): crash-recovery hook + prompt for the workspace shell. See lib/recovery/crash-recovery.ts for the data side.
import { useCallback, useEffect, useRef, useState, type MutableRefObject, type ReactElement } from 'react';
import type { Timeline } from '@cinegen/types/timeline';
import { migrateLoadedTimelines } from '@cinegen/lib/editor/project-migrations';
import {
  planRecovery, recoveryStore, sliceFingerprint, summarize,
  type RecoverySlice, type RecoverySnapshot,
} from '@cinegen/lib/recovery/crash-recovery';

export const RECOVERY_WRITE_DEBOUNCE_MS = 150;

interface Args {
  projectId: string;
  slice: RecoverySlice;
  hydrated: boolean;
  savePendingRef: MutableRefObject<boolean>;
  dispatch: (action: never) => void;
}

export function useCrashRecovery({ projectId, slice, hydrated, savePendingRef, dispatch }: Args): { banner: ReactElement | null; markSaved: (saved: RecoverySlice) => void } {
  const [snap, setSnap] = useState<RecoverySnapshot | null>(null);
  const latest = useRef(slice); latest.current = slice;
  const snapShown = useRef(false); snapShown.current = !!snap;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checked = useRef<string | null>(null);

  // 1. on open: is there a snapshot that differs from the project that was just loaded?
  useEffect(() => {
    if (!hydrated || checked.current === projectId) return;
    checked.current = projectId;
    let cancelled = false;
    void recoveryStore.read(projectId).then((s) => {
      if (cancelled || !s) return;
      if (sliceFingerprint(s) === sliceFingerprint(latest.current)) { void recoveryStore.clear(projectId); return; }
      setSnap(s);
    });
    return () => { cancelled = true; };
  }, [hydrated, projectId]);

  // 2. while edits are waiting for the normal save, keep a snapshot (never while the prompt is open: it would overwrite what is offered)
  const writeNow = useCallback(() => { if (!snapShown.current) void recoveryStore.write(projectId, latest.current); }, [projectId]);
  useEffect(() => {
    if (!hydrated || snapShown.current || !savePendingRef.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; writeNow(); }, RECOVERY_WRITE_DEBOUNCE_MS);
  }, [hydrated, slice.timelines, slice.assets, slice.activeTimelineId, savePendingRef, writeNow]);
  useEffect(() => {
    const flush = () => { if (hydrated && savePendingRef.current && timer.current) { clearTimeout(timer.current); timer.current = null; writeNow(); } };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, [hydrated, savePendingRef, writeNow]);

  // 3. the normal save finished: the snapshot is obsolete unless the state moved on meanwhile
  const markSaved = useCallback((saved: RecoverySlice) => {
    const cur = latest.current;
    if (cur.timelines !== saved.timelines || cur.assets !== saved.assets || cur.activeTimelineId !== saved.activeTimelineId) return;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (!snapShown.current) void recoveryStore.clear(projectId);
  }, [projectId]);

  const recover = useCallback(() => {
    if (!snap) return;
    const plan = planRecovery(snap, latest.current);
    const migrate = (t: Timeline[]) => migrateLoadedTimelines(t, snap.schema).timelines;
    const send = dispatch as unknown as (a: Record<string, unknown>) => void;
    for (const asset of plan.addAssets) send({ type: 'ADD_ASSET', asset });
    for (const asset of plan.updateAssets) send({ type: 'UPDATE_ASSET', asset });
    for (const timeline of migrate(plan.setTimelines)) send({ type: 'SET_TIMELINE', timelineId: timeline.id, timeline });
    for (const timeline of migrate(plan.addTimelines)) send({ type: 'ADD_TIMELINE', timeline });
    if (plan.activeTimelineId) send({ type: 'SET_ACTIVE_TIMELINE', timelineId: plan.activeTimelineId });
    setSnap(null);
    // the recovered state is now ordinary pending work: the debounced save (and a fresh snapshot, until it lands) take over
    void recoveryStore.clear(projectId);
  }, [snap, dispatch, projectId]);

  const discard = useCallback(() => { setSnap(null); void recoveryStore.clear(projectId); }, [projectId]);

  let banner: ReactElement | null = null;
  if (snap) {
    const sum = summarize(snap);
    banner = (
      <div role="alertdialog" aria-label="Recover unsaved changes" data-testid="crash-recovery" style={{ position: 'fixed', left: '50%', top: 16, transform: 'translateX(-50%)', zIndex: 10000, background: 'var(--surface-2, #1c1c22)', color: 'var(--text, #eee)', border: '1px solid var(--border, #444)', borderRadius: 8, padding: '12px 16px', boxShadow: '0 8px 30px rgba(0,0,0,.5)', maxWidth: 520, fontSize: 13 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Recover unsaved changes?</div>
        <div style={{ opacity: 0.8, marginBottom: 10 }}>
          The editor closed before the last edits were saved ({sum.clips} clip{sum.clips === 1 ? '' : 's'} in {sum.timelines} timeline{sum.timelines === 1 ? '' : 's'}, last change {new Date(sum.savedAt).toLocaleString()}). Recovering applies them to the saved project and can be undone.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" data-testid="crash-recovery-discard" onClick={discard}>Discard</button>
          <button type="button" data-testid="crash-recovery-recover" onClick={recover} autoFocus>Recover</button>
        </div>
      </div>
    );
  }
  return { banner, markSaved };
}
