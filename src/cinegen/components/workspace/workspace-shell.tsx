// [remix] Browser replacement for CineGen's workspace-shell.tsx (Electron IPC, cloud sync, MCP bridge removed).
// Same context contract ({ state, dispatch, projectId }) and CineGen's own reducer, so the vendored
// Elements / Edit / Director / Create / LLM tabs run unchanged. Persistence is browser storage.
import { createContext, useContext, useEffect, useReducer, useMemo, type ReactNode } from 'react';
import type { WorkspaceState } from '@cinegen/types/workspace';
import type { Timeline } from '@cinegen/types/timeline';
import { workspaceReducer, createInitialWorkspaceState, type WorkspaceAction } from '@cinegen/lib/mcp/workspace-state';

interface WorkspaceContextValue {
  state: WorkspaceState;
  dispatch: React.Dispatch<WorkspaceAction>;
  projectId: string;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceShell');
  return ctx;
}

const STORE = 'remix.cinegen.workspace.v1';
// Everything that makes up a project. Sets (openSpaceIds etc.) are rebuilt on load.
const PERSISTED = ['elements', 'elementFolders', 'assets', 'mediaFolders', 'timelines', 'activeTimelineId', 'spaces', 'activeSpaceId', 'nodes', 'edges', 'director', 'exports'] as const;

function initial(): WorkspaceState {
  const base = createInitialWorkspaceState();
  base.activeTab = 'edit'; // the Timeline Editor opens on Edit
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved) {
      for (const k of PERSISTED) if (saved[k] !== undefined) (base as unknown as Record<string, unknown>)[k] = saved[k];
      const b = base as unknown as Record<string, unknown>;
      b.openTimelineIds = new Set([base.activeTimelineId]);
      b.openSpaceIds = new Set([base.activeSpaceId]);
    }
  } catch { /* ignore */ }
  return base;
}

export function WorkspaceProvider({ projectId = 'timeline-editor', children, init }: { projectId?: string; children: ReactNode; init?: (s: WorkspaceState) => WorkspaceState }) {
  const [state, dispatch] = useReducer(workspaceReducer, undefined, () => (init ? init(initial()) : initial()));
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const out: Record<string, unknown> = {};
        for (const k of PERSISTED) out[k] = (state as unknown as Record<string, unknown>)[k];
        localStorage.setItem(STORE, JSON.stringify(out));
      } catch { /* quota */ }
    }, 800);
    return () => clearTimeout(t);
  }, [state]);
  const value = useMemo(() => ({ state, dispatch, projectId }), [state, dispatch, projectId]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export { workspaceReducer } from '@cinegen/lib/mcp/workspace-state';
export type { WorkspaceAction } from '@cinegen/lib/mcp/workspace-state';

export function getActiveTimeline(state: WorkspaceState): Timeline {
  return state.timelines.find((tl) => tl.id === state.activeTimelineId) ?? state.timelines[0];
}
