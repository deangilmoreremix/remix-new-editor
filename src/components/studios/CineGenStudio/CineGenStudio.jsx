/**
 * CineGen Studio — standalone studio port of
 * https://github.com/deangilmoremix/CineGen (web build).
 *
 * Tabs mirror the upstream app: Elements → Spaces → Edit. All tabs share one
 * WorkspaceShell so elements created here are available to Element nodes and
 * `@` mentions in Spaces.
 *
 * Like the other studios, the router appends the returned DOM node, so the
 * React tree is rendered imperatively into a container.
 */

import { useCallback, useEffect, useRef, useState, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { WorkspaceShell, useWorkspace, generateId, timestamp } from '../../../lib/workspace/workspace-context.jsx';
import { WorkflowCanvasInner } from '../../SpacesCanvas.jsx';
import { ElementsTab } from '../../elements/elements-tab.jsx';
import './cinegen-studio.css';

const TABS = [
  { id: 'elements', label: 'Elements' },
  { id: 'spaces', label: 'Spaces' },
  { id: 'edit', label: 'Edit' },
];

const TAB_STORAGE_KEY = 'cinegen_studio_tab';

function readSavedTab() {
  try {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    return TABS.some((t) => t.id === saved) ? saved : 'spaces';
  } catch {
    return 'spaces';
  }
}

function ElementsPanel() {
  const { state, dispatch } = useWorkspace();

  const handleAdd = useCallback((data) => {
    const now = timestamp();
    dispatch({ type: 'ADD_ELEMENT', element: { ...data, id: generateId(), createdAt: now, updatedAt: now } });
  }, [dispatch]);

  const handleUpdate = useCallback((id, data) => {
    dispatch({ type: 'UPDATE_ELEMENT', element: { ...data, id } });
  }, [dispatch]);

  const handleDelete = useCallback((id) => {
    dispatch({ type: 'REMOVE_ELEMENT', elementId: id });
  }, [dispatch]);

  return (
    <div className="cgs-panel cgs-panel--scroll">
      <ElementsTab
        elements={state.elements ?? []}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  );
}

function SpacesPanel() {
  return (
    <div className="cgs-panel">
      <ReactFlowProvider>
        <WorkflowCanvasInner />
      </ReactFlowProvider>
      <div className="cgs-hint">Press <kbd>Space</kbd> to add a node</div>
    </div>
  );
}

// The timeline editor is a DOM-built page; mount it once and keep it alive
// across tab switches so playback/edit state isn't lost.
function EditPanel() {
  const hostRef = useRef(null);

  useEffect(() => {
    let pageEl = null;
    let cancelled = false;
    import('../../TimelineEditorPage.jsx').then((m) => {
      if (cancelled || !hostRef.current) return;
      pageEl = m.TimelineEditorPage();
      hostRef.current.appendChild(pageEl);
    }).catch((err) => {
      if (hostRef.current) hostRef.current.textContent = `Failed to load editor: ${err.message}`;
    });
    return () => {
      cancelled = true;
      pageEl?.cleanup?.();
      pageEl?.remove();
    };
  }, []);

  return <div className="cgs-panel" ref={hostRef} />;
}

function CineGenStudioApp() {
  const [tab, setTab] = useState(readSavedTab);
  // Edit is mounted lazily on first visit, then kept mounted.
  const [editMounted, setEditMounted] = useState(tab === 'edit');

  const selectTab = useCallback((id) => {
    setTab(id);
    if (id === 'edit') setEditMounted(true);
    try { localStorage.setItem(TAB_STORAGE_KEY, id); } catch {}
  }, []);

  return (
    <div className="cgs">
      <header className="cgs__bar">
        <span className="cgs__brand">CineGen Studio</span>
        <nav className="cgs__tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`cgs__tab${tab === t.id ? ' cgs__tab--active' : ''}`}
              onClick={() => selectTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="cgs__body">
        {tab === 'elements' && <ElementsPanel />}
        {tab === 'spaces' && <SpacesPanel />}
        {editMounted && (
          <div className="cgs__keepalive" hidden={tab !== 'edit'}>
            <EditPanel />
          </div>
        )}
      </main>
    </div>
  );
}

export function CineGenStudio() {
  const container = document.createElement('div');
  container.className = 'cgs-root';

  const root = createRoot(container);
  root.render(h(WorkspaceShell, null, h(CineGenStudioApp)));

  container.cleanup = () => {
    try { root.unmount(); } catch {}
  };

  return container;
}

export default CineGenStudio;
