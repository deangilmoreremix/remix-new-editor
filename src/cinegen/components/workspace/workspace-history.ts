// [remix] The workspace's undo / redo history, kept in its own file so it can be unit-tested without loading the whole workspace UI.
// (Moved unchanged from workspace-shell.tsx; the only addition is the 'BATCH' action: a group of actions that is ONE undo step.)
import { workspaceReducer, type WorkspaceAction } from '@cinegen/lib/mcp/workspace-state';
import type { WorkspaceState } from '@cinegen/types/workspace';

const MAX_HISTORY = 50;
export const UNDOABLE_ACTIONS: WorkspaceAction['type'][] = [
  'SET_NODES', 'SET_EDGES', 'UPDATE_NODE_CONFIG', 'APPLY_ELEMENT_MENTION',
  'ADD_SPACE', 'RENAME_SPACE', 'REMOVE_SPACE', 'CLOSE_SPACE', 'OPEN_SPACE', 'SET_ACTIVE_SPACE',
  'ADD_ASSET', 'UPDATE_ASSET', 'REMOVE_ASSET', 'REMOVE_ASSETS',
  'ADD_FOLDER', 'UPDATE_FOLDER', 'REMOVE_FOLDER',
  'SET_TIMELINE', 'ADD_TIMELINE', 'REMOVE_TIMELINE', 'CLOSE_TIMELINE', 'OPEN_TIMELINE',
  'ADD_ELEMENT', 'UPDATE_ELEMENT', 'REMOVE_ELEMENT', 'REMOVE_ELEMENTS',
  'MOVE_ELEMENTS', 'ADD_ELEMENT_FOLDER', 'UPDATE_ELEMENT_FOLDER', 'REMOVE_ELEMENT_FOLDER',
  'SET_DIRECTOR',
  'ADD_SET', 'UPDATE_SET', 'REMOVE_SET',
  'BATCH', // [remix] one undo step for a group of actions
  'ADD_OVERLAY', 'REMOVE_OVERLAY', // [remix] adding / removing an overlay can be undone (moving one is not pushed per pixel)
];

export interface HistoryState {
  current: WorkspaceState;
  past: WorkspaceState[];
  future: WorkspaceState[];
  /** Timestamp of last undoable push — used to debounce rapid SET_NODES (drag) */
  lastPushTime: number;
  lastPushType: WorkspaceAction['type'] | null;
}

const DRAG_DEBOUNCE_MS = 300;

export function historyReducer(history: HistoryState, action: WorkspaceAction): HistoryState {
  if (action.type === 'HYDRATE' || action.type === 'SYNC_CLOUD_PROJECT') {
    return { current: workspaceReducer(history.current, action), past: [], future: [], lastPushTime: 0, lastPushType: null };
  }
  if (action.type === 'UNDO') {
    if (history.past.length === 0) return history;
    const prev = history.past[history.past.length - 1];
    return {
      past: history.past.slice(0, -1),
      current: {
        ...prev,
        activeTab: history.current.activeTab,
        runningNodeIds: history.current.runningNodeIds,
        currentRun: history.current.currentRun,
      },
      future: [history.current, ...history.future].slice(0, MAX_HISTORY),
      lastPushTime: history.lastPushTime,
      lastPushType: history.lastPushType,
    };
  }

  if (action.type === 'REDO') {
    if (history.future.length === 0) return history;
    const next = history.future[0];
    return {
      past: [...history.past, history.current].slice(-MAX_HISTORY),
      current: {
        ...next,
        activeTab: history.current.activeTab,
        runningNodeIds: history.current.runningNodeIds,
        currentRun: history.current.currentRun,
      },
      future: history.future.slice(1),
      lastPushTime: history.lastPushTime,
      lastPushType: history.lastPushType,
    };
  }

  const next = workspaceReducer(history.current, action);

  if (UNDOABLE_ACTIONS.includes(action.type)) {
    const now = Date.now();
    // Debounce rapid dispatches during drag operations (node dragging, clip move/trim/roll)
    const isDrag =
      (action.type === 'SET_NODES' && history.lastPushType === 'SET_NODES' && now - history.lastPushTime < DRAG_DEBOUNCE_MS) ||
      (action.type === 'SET_TIMELINE' && history.lastPushType === 'SET_TIMELINE' && now - history.lastPushTime < DRAG_DEBOUNCE_MS);

    if (isDrag) {
      // Replace the current state without pushing to undo stack
      return { ...history, current: next };
    }

    return {
      past: [...history.past, history.current].slice(-MAX_HISTORY),
      current: next,
      future: [],
      lastPushTime: now,
      lastPushType: action.type,
    };
  }

  return { ...history, current: next };
}

