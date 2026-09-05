/**
 * Ported from CineGen: src/components/create/workflow-canvas.tsx
 * Original: https://github.com/deangilmoremix/CineGen/blob/main/src/components/create/workflow-canvas.tsx
 *
 * Sub-task 1 port: bare canvas with real registry, no per-node UI, no execution.
 *
 * NOTE: The router calls page loaders as plain functions and appends the
 * returned value to the DOM via `contentArea.appendChild(...)`. That means
 * this module must return a real DOM node, not a React element. We create
 * a container div, render the React tree into it imperatively with
 * `createRoot`, and return the container.
 */

console.log('[SpacesCanvas] module evaluating');

import { useCallback, useState, useRef, useMemo, useEffect, createContext, useContext } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  SelectionMode,
  useReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  applyEdgeChanges,
  Connection,
  Edge,
  Node,
  NodeChange,
  EdgeChange,
} from '@xyflow/react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';

import { nodeTypes } from './create/nodes/index.js';
import { NodePalette } from './create/node-palette.jsx';
import { NODE_REGISTRY, CATEGORY_COLORS, PORT_COLORS } from '../lib/workflows/node-registry.js';
import { getModelDefinition } from '../lib/fal/models.js';
import { useWorkspace, generateId, WorkspaceShell, getActiveTimeline } from '../lib/workspace/workspace-context.jsx';
import { WorkflowNodeData } from '../types/workflow.js';
import { createElement as h, Fragment } from 'react';
import { executeFromNode } from '../lib/workflows/execute.js';

const VIEWPORT_STORAGE_KEY = 'cinegen_canvas_viewport';

const RunNodeContext = createContext(() => {});
export function useRunNode() { return useContext(RunNodeContext); }

function WorkflowCanvasInner() {
  const { state, dispatch } = useWorkspace();
  const { screenToFlowPosition, fitView } = useReactFlow();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [palettePos, setPalettePos] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const mouseRef = useRef({ x: 0, y: 0 });

  const nodesRef = useRef(state.nodes);
  nodesRef.current = state.nodes;
  const edgesRef = useRef(state.edges);
  edgesRef.current = state.edges;

  const onNodesChange = useCallback(
    (changes) => {
      dispatch({
        type: 'SET_NODES',
        nodes: applyNodeChanges(changes, nodesRef.current),
      });
    },
    [dispatch],
  );

  const onEdgesChange = useCallback(
    (changes) => {
      dispatch({ type: 'SET_EDGES', edges: applyEdgeChanges(changes, edgesRef.current) });
    },
    [dispatch],
  );

  const handleConnect = useCallback(
    (connection) => {
      const sourceNode = state.nodes.find((n) => n.id === connection.source);
      const targetNode = state.nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return;

      const sourceNodeDef = NODE_REGISTRY[sourceNode.data.type];
      const targetNodeDef = NODE_REGISTRY[targetNode.data.type];
      if (!sourceNodeDef || !targetNodeDef) return;
      const sourcePort = sourceNodeDef.outputs.find((p) => p.id === connection.sourceHandle);
      const targetPort = targetNodeDef.inputs.find((p) => p.id === connection.targetHandle);

      if (sourcePort && targetPort && sourcePort.type !== targetPort.type) {
        return;
      }

      const newEdge = {
        id: generateId(),
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: 'default',
      };

      dispatch({ type: 'SET_EDGES', edges: [...state.edges, newEdge] });
    },
    [state.nodes, state.edges, dispatch],
  );

  const handlePaletteSelect = useCallback(
    (nodeType) => {
      console.log('[SpacesCanvas] handlePaletteSelect called', nodeType);
      const definition = NODE_REGISTRY[nodeType];
      if (!definition) return;
      const flowPosition = screenToFlowPosition({ x: palettePos.x, y: palettePos.y });
      const modelDef = getModelDefinition(nodeType);
      const newNode = {
        id: generateId(),
        type: nodeType,
        position: flowPosition,
        data: {
          type: nodeType,
          label: definition.label,
          config: { ...definition.defaultData },
          ...(modelDef ? { modelId: modelDef.id } : {}),
        },
      };

      dispatch({ type: 'SET_NODES', nodes: [...nodesRef.current, newNode] });
      setPaletteOpen(false);
    },
    [screenToFlowPosition, palettePos, dispatch],
  );

  const handleClosePalette = useCallback(() => {
    setPaletteOpen(false);
  }, []);

  // Space key opens palette at cursor
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.code === 'Space') {
        e.preventDefault();
        if (paletteOpen) {
          setPaletteOpen(false);
        } else {
          setPalettePos({ x: mouseRef.current.x, y: mouseRef.current.y });
          setPaletteOpen(true);
        }
      } else if (e.key === 'Escape' && paletteOpen) {
        setPaletteOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [paletteOpen]);

  const workflowDispatch = useCallback(() => ({
    setNodeRunning: (nodeId, running) => dispatch({ type: 'SET_NODE_RUNNING', nodeId, running }),
    setNodeResult: (nodeId, result) => dispatch({ type: 'SET_NODE_RESULT', nodeId, result }),
    addGeneration: (nodeId, url) => dispatch({ type: 'ADD_GENERATION', nodeId, url }),
    addAsset: (asset) => dispatch({ type: 'ADD_ASSET', asset }),
    getElements: () => state.elements ?? [],
  }), [dispatch, state.elements]);

  const handleRunNode = useCallback(async (nodeId) => {
    try {
      await executeFromNode(nodeId, state.nodes, state.edges, workflowDispatch());
    } catch (err) {
      console.error('Run failed:', err);
    }
  }, [state.nodes, state.edges, workflowDispatch]);

  return (
    <RunNodeContext.Provider value={handleRunNode}>
    <div
      style={{ width: '100%', height: '100%', position: 'relative', outline: 'none' }}
      onMouseMove={(e) => {
        mouseRef.current = { x: e.clientX, y: e.clientY };
      }}
    >
      <ReactFlow
        nodes={state.nodes}
        edges={state.edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{ type: 'default' }}
        connectionRadius={25}
        minZoom={0.1}
        panOnDrag={[1, 2]}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        onMoveStart={() => setIsPanning(true)}
        onMoveEnd={(_, viewport) => {
          setIsPanning(false);
          try { localStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify(viewport)); } catch {}
        }}
        defaultViewport={(() => {
          try {
            const saved = localStorage.getItem(VIEWPORT_STORAGE_KEY);
            if (saved) return JSON.parse(saved);
          } catch {}
          return { x: 0, y: 0, zoom: 1 };
        })()}
        fitView={false}
        proOptions={{ hideAttribution: true }}
        className={`cinegen-canvas${isPanning ? ' cinegen-canvas--panning' : ''}`}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="rgba(120, 115, 105, 0.35)" />
        <Controls position="bottom-left" />
      </ReactFlow>

      {paletteOpen && (
        <NodePalette
          position={palettePos}
          onSelect={handlePaletteSelect}
          onClose={handleClosePalette}
        />
      )}
    </div>
    </RunNodeContext.Provider>
  );
}

export function SpacesCanvas() {
  const container = document.createElement('div');
  container.style.width = '100%';
  container.style.height = '100%';

  const root = createRoot(container);
  console.log('[SpacesCanvas] createRoot called', !!root);
  try {
    root.render(
      h(ReactFlowProvider, null,
        h(WorkspaceShell, null,
          h(WorkflowCanvasInner)
        )
      )
    );
    console.log('[SpacesCanvas] render called');
  } catch (err) {
    console.error('[SpacesCanvas] mount error', err);
    container.innerHTML = '<pre style="color:red;padding:10px">' + err.message + '</pre>';
  }

  container.cleanup = () => {
    try {
      root.unmount();
    } catch {}
  };

  return container;
}
