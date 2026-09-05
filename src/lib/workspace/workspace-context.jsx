/**
 * Ported from CineGen: src/components/workspace/workspace-shell.tsx
 * Original: https://github.com/deangilmoreremix/CineGen/blob/main/src/components/workspace/workspace-shell.tsx
 *
 * Extracted and simplified to only the workflow/space state management
 * needed for the Spaces page canvas.
 */

import { createContext, useContext, useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { Node, Edge } from '@xyflow/react';
import { WorkflowNodeData } from '@/types/workflow.js';
import { NODE_REGISTRY } from '@/lib/workflows/node-registry.js';
import { getModelDefinition } from '../fal/models.js';

// ---------------------------------------------------------------------------
// Helpers (ported from workspace-shell.tsx)
// ---------------------------------------------------------------------------

export function generateId() {
  return crypto.randomUUID();
}

export function timestamp() {
  return new Date().toISOString();
}

export function getActiveTimeline(state) {
  const timelines = state.timelines ?? [];
  if (timelines.length > 0) return timelines[0];
  return {
    id: generateId(),
    name: 'Timeline 1',
    tracks: [{ id: generateId(), name: 'Track 1', clips: [] }],
    duration: 30,
    currentTime: 0,
  };
}

function createWorkflowSpace(name, nodes = [], edges = []) {
  return {
    id: generateId(),
    name,
    createdAt: timestamp(),
    nodes: normalizeWorkflowNodes(nodes),
    edges,
  };
}

function normalizeWorkflowNodes(nodes) {
  return nodes.map((node) => {
    if (node.data.type === 'shotPrompt' || node.type === 'shotPrompt') {
      node = {
        ...node,
        type: 'multiPrompt',
        data: {
          ...node.data,
          type: 'multiPrompt',
        },
      };
    }

    if (node.data.type !== 'layer-decompose-cloud') return node;

    const configVersion = Number(node.data.config.__layerDecomposeVersion ?? 1);
    const currentMaxMasks = Number(node.data.config.max_masks ?? 12);
    const nextConfig = {
      ...node.data.config,
      __layerDecomposeVersion: 2,
    };

    if (configVersion < 2 && currentMaxMasks === 4) {
      nextConfig.max_masks = 12;
    }

    if (
      nextConfig.max_masks === node.data.config.max_masks
      && nextConfig.__layerDecomposeVersion === node.data.config.__layerDecomposeVersion
    ) {
      return node;
    }

    return {
      ...node,
      data: {
        ...node.data,
        config: nextConfig,
      },
    };
  });
}

function normalizeWorkflowSpaces(spaces, fallbackNodes, fallbackEdges) {
  if (spaces.length > 0) {
    return spaces.map((space) => ({
      ...space,
      createdAt: space.createdAt || timestamp(),
      nodes: normalizeWorkflowNodes(space.nodes ?? []),
      edges: space.edges ?? [],
    }));
  }
  return [createWorkflowSpace('Space 1', fallbackNodes, fallbackEdges)];
}

function updateActiveSpace(spaces, activeSpaceId, patch) {
  return spaces.map((space) => (
    space.id === activeSpaceId
      ? { ...space, ...patch }
      : space
  ));
}

function resolveActiveSpace(spaces, activeSpaceId) {
  return spaces.find((space) => space.id === activeSpaceId) ?? spaces[0];
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** @typedef {'SET_TAB'|'SET_NODES'|'SET_EDGES'|'ADD_SPACE'|'RENAME_SPACE'|'REMOVE_SPACE'|'CLOSE_SPACE'|'OPEN_SPACE'|'SET_ACTIVE_SPACE'|'UPDATE_NODE_CONFIG'|'HYDRATE'|'UNDO'|'REDO'} WorkspaceActionType */

/**
 * @typedef {Object} SetNodesAction
 * @property {'SET_NODES'} type
 * @property {Node<WorkflowNodeData>[]} nodes
 */

/**
 * @typedef {Object} SetEdgesAction
 * @property {'SET_EDGES'} type
 * @property {Edge[]} edges
 */

/**
 * @typedef {Object} AddSpaceAction
 * @property {'ADD_SPACE'} type
 * @property {WorkflowSpace} space
 */

/**
 * @typedef {Object} RenameSpaceAction
 * @property {'RENAME_SPACE'} type
 * @property {string} spaceId
 * @property {string} name
 */

/**
 * @typedef {Object} RemoveSpaceAction
 * @property {'REMOVE_SPACE'} type
 * @property {string} spaceId
 */

/**
 * @typedef {Object} CloseSpaceAction
 * @property {'CLOSE_SPACE'} type
 * @property {string} spaceId
 */

/**
 * @typedef {Object} OpenSpaceAction
 * @property {'OPEN_SPACE'} type
 * @property {string} spaceId
 */

/**
 * @typedef {Object} SetActiveSpaceAction
 * @property {'SET_ACTIVE_SPACE'} type
 * @property {string} spaceId
 */

/**
 * @typedef {Object} UpdateNodeConfigAction
 * @property {'UPDATE_NODE_CONFIG'} type
 * @property {string} nodeId
 * @property {Record<string, unknown>} config
 */

/**
 * @typedef {Object} HydrateAction
 * @property {'HYDRATE'} type
 * @property {Object} payload
 * @property {Node<WorkflowNodeData>[]} payload.nodes
 * @property {Edge[]} payload.edges
 * @property {WorkflowSpace[]} payload.spaces
 * @property {string} payload.activeSpaceId
 * @property {string[]} payload.openSpaceIds
 */

/**
 * @typedef {SetNodesAction|SetEdgesAction|AddSpaceAction|RenameSpaceAction|RemoveSpaceAction|CloseSpaceAction|OpenSpaceAction|SetActiveSpaceAction|UpdateNodeConfigAction|HydrateAction|{type:'UNDO'}|{type:'REDO'}|{type:'SET_TAB', tab: string}|{type:'SET_NODE_RUNNING', nodeId:string, running:boolean}|{type:'SET_NODE_RESULT', nodeId:string, result:Record<string,unknown>}|{type:'ADD_GENERATION', nodeId:string, url:string}|{type:'ADD_ASSET', asset:{id:string,name:string,type:'image'|'video',url:string,thumbnailUrl?:string,duration?:number,createdAt:string,metadata?:Record<string,unknown>}}|{type:'UPDATE_ASSET', asset:{id:string,thumbnailUrl?:string,metadata?:Record<string,unknown>}}|{type:'SET_TIMELINE', timelineId:string, timeline:Record<string,unknown>}} WorkspaceAction
 */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const defaultSpace = createWorkflowSpace('Space 1');

const initialState = {
  nodes: defaultSpace.nodes,
  edges: defaultSpace.edges,
  spaces: [defaultSpace],
  activeSpaceId: defaultSpace.id,
  openSpaceIds: new Set([defaultSpace.id]),
  assets: [],
  runningNodeIds: new Set(),
  timelines: [],
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function workspaceReducer(state, action) {
  switch (action.type) {
    case 'SET_NODES':
      return {
        ...state,
        nodes: action.nodes,
        spaces: updateActiveSpace(state.spaces, state.activeSpaceId, { nodes: action.nodes }),
      };

    case 'UPDATE_NODE_CONFIG':
      return {
        ...state,
        nodes: state.nodes.map((n) =>
          n.id === action.nodeId
            ? { ...n, data: { ...n.data, config: { ...n.data.config, ...action.config } } }
            : n,
        ),
        spaces: updateActiveSpace(
          state.spaces,
          state.activeSpaceId,
          {
            nodes: state.nodes.map((n) =>
              n.id === action.nodeId
                ? { ...n, data: { ...n.data, config: { ...n.data.config, ...action.config } } }
                : n,
            ),
          },
        ),
      };

    case 'SET_NODE_RUNNING':
      return {
        ...state,
        nodes: state.nodes.map((n) =>
          n.id === action.nodeId
            ? { ...n, data: { ...n.data, running: action.running } }
            : n,
        ),
      };

    case 'SET_NODE_RESULT':
      return {
        ...state,
        nodes: state.nodes.map((n) =>
          n.id === action.nodeId
            ? { ...n, data: { ...n.data, result: action.result } }
            : n,
        ),
      };

    case 'ADD_GENERATION':
      return {
        ...state,
        nodes: state.nodes.map((n) => {
          if (n.id !== action.nodeId) return n;
          const generations = Array.isArray(n.data.generations) ? [...n.data.generations, action.url] : [action.url];
          return {
            ...n,
            data: {
              ...n.data,
              generations,
              activeGeneration: generations.length - 1,
              result: { ...n.data.result, url: action.url },
            },
          };
        }),
      };

    case 'ADD_ASSET':
      return {
        ...state,
        assets: [...(state.assets ?? []), action.asset],
      };

    case 'UPDATE_ASSET':
      return {
        ...state,
        assets: (state.assets ?? []).map((a) =>
          a.id === action.asset.id ? { ...a, ...action.asset } : a,
        ),
      };

    case 'SET_TIMELINE':
      return {
        ...state,
        timelines: state.timelines.map((t) =>
          t.id === action.timelineId ? action.timeline : t,
        ),
      };

    case 'SET_EDGES':
      return {
        ...state,
        edges: action.edges,
        spaces: updateActiveSpace(state.spaces, state.activeSpaceId, { edges: action.edges }),
      };

    case 'ADD_SPACE': {
      const openSpaceIds = new Set(state.openSpaceIds);
      openSpaceIds.add(action.space.id);
      return {
        ...state,
        spaces: [...state.spaces, action.space],
        activeSpaceId: action.space.id,
        openSpaceIds,
        nodes: action.space.nodes,
        edges: action.space.edges,
      };
    }

    case 'RENAME_SPACE': {
      return {
        ...state,
        spaces: state.spaces.map((space) =>
          space.id === action.spaceId ? { ...space, name: action.name } : space,
        ),
      };
    }

    case 'REMOVE_SPACE': {
      if (state.spaces.length <= 1) return state;
      const spaces = state.spaces.filter((space) => space.id !== action.spaceId);
      const nextActiveSpace = resolveActiveSpace(
        spaces,
        state.activeSpaceId === action.spaceId ? spaces[0]?.id ?? '' : state.activeSpaceId,
      );
      const openSpaceIds = new Set(state.openSpaceIds);
      openSpaceIds.delete(action.spaceId);
      if (!openSpaceIds.has(nextActiveSpace.id)) {
        openSpaceIds.add(nextActiveSpace.id);
      }
      return {
        ...state,
        spaces,
        activeSpaceId: nextActiveSpace.id,
        openSpaceIds,
        nodes: nextActiveSpace.nodes,
        edges: nextActiveSpace.edges,
      };
    }

    case 'CLOSE_SPACE': {
      const openSpaceIds = new Set(state.openSpaceIds);
      openSpaceIds.delete(action.spaceId);
      if (openSpaceIds.size === 0) {
        const fallback = state.spaces.find((space) => space.id !== action.spaceId) ?? state.spaces[0];
        if (fallback) openSpaceIds.add(fallback.id);
      }
      if (state.activeSpaceId !== action.spaceId) {
        return { ...state, openSpaceIds };
      }
      const nextActiveId = [...openSpaceIds][0] ?? state.spaces[0]?.id ?? state.activeSpaceId;
      const nextActiveSpace = resolveActiveSpace(state.spaces, nextActiveId);
      return {
        ...state,
        openSpaceIds,
        activeSpaceId: nextActiveSpace.id,
        nodes: nextActiveSpace.nodes,
        edges: nextActiveSpace.edges,
      };
    }

    case 'OPEN_SPACE': {
      const openSpaceIds = new Set(state.openSpaceIds);
      openSpaceIds.add(action.spaceId);
      const nextActiveSpace = resolveActiveSpace(state.spaces, action.spaceId);
      return {
        ...state,
        openSpaceIds,
        activeSpaceId: nextActiveSpace.id,
        nodes: nextActiveSpace.nodes,
        edges: nextActiveSpace.edges,
      };
    }

    case 'SET_ACTIVE_SPACE': {
      const openSpaceIds = new Set(state.openSpaceIds);
      openSpaceIds.add(action.spaceId);
      const nextActiveSpace = resolveActiveSpace(state.spaces, action.spaceId);
      return {
        ...state,
        openSpaceIds,
        activeSpaceId: nextActiveSpace.id,
        nodes: nextActiveSpace.nodes,
        edges: nextActiveSpace.edges,
      };
    }

    case 'HYDRATE': {
      const hydratedSpaces = normalizeWorkflowSpaces(action.payload.spaces, action.payload.nodes, action.payload.edges);
      const activeSpace = resolveActiveSpace(hydratedSpaces, action.payload.activeSpaceId);
      const openSpaceIds = new Set(
        action.payload.openSpaceIds.filter((spaceId) => hydratedSpaces.some((space) => space.id === spaceId)),
      );
      if (openSpaceIds.size === 0) {
        openSpaceIds.add(activeSpace.id);
      }
      return {
        ...state,
        nodes: activeSpace.nodes,
        edges: activeSpace.edges,
        spaces: hydratedSpaces,
        activeSpaceId: activeSpace.id,
        openSpaceIds,
      };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Undo / Redo History
// ---------------------------------------------------------------------------

const MAX_HISTORY = 50;
const UNDOABLE_ACTIONS = [
  'SET_NODES', 'SET_EDGES', 'UPDATE_NODE_CONFIG',
  'ADD_SPACE', 'RENAME_SPACE', 'REMOVE_SPACE', 'CLOSE_SPACE', 'OPEN_SPACE', 'SET_ACTIVE_SPACE',
];

const DRAG_DEBOUNCE_MS = 300;

function historyReducer(history, action) {
  if (action.type === 'UNDO') {
    if (history.past.length === 0) return history;
    const prev = history.past[history.past.length - 1];
    return {
      past: history.past.slice(0, -1),
      current: prev,
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
      current: next,
      future: history.future.slice(1),
      lastPushTime: history.lastPushTime,
      lastPushType: history.lastPushType,
    };
  }

  const next = workspaceReducer(history.current, action);

  if (UNDOABLE_ACTIONS.includes(action.type)) {
    const now = Date.now();
    const isDrag =
      (action.type === 'SET_NODES' && history.lastPushType === 'SET_NODES' && now - history.lastPushTime < DRAG_DEBOUNCE_MS);

    if (isDrag) {
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

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------


export const WorkspaceContext = createContext(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceShell');
  return ctx;
}

// ---------------------------------------------------------------------------
// Shell Component
// ---------------------------------------------------------------------------

export function WorkspaceShell({ children, initialNodes = [], initialEdges = [] }) {
  const initialSpace = createWorkflowSpace('Space 1', initialNodes, initialEdges);
  const [history, historyDispatch] = useReducer(historyReducer, {
    current: {
      nodes: initialSpace.nodes,
      edges: initialSpace.edges,
      spaces: [initialSpace],
      activeSpaceId: initialSpace.id,
      openSpaceIds: new Set([initialSpace.id]),
    },
    past: [],
    future: [],
    lastPushTime: 0,
    lastPushType: null,
  });

  const state = history.current;

  // Persist spaces to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('cinegen_spaces', JSON.stringify(state.spaces));
      localStorage.setItem('cinegen_active_space', state.activeSpaceId);
    } catch {}
  }, [state.spaces, state.activeSpaceId]);

  const dispatch = useCallback((action) => {
    historyDispatch(action);
  }, []);

  const value = { state, dispatch };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
