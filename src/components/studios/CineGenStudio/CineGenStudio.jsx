/**
 * CineGen Studio — hosts the full CineGen web build (vendored in apps/cinegen,
 * upstream https://github.com/deangilmoremix/CineGen) as its own studio:
 * Elements, Spaces, Director, Edit, LLM and Export.
 *
 * CineGen's web build needs its own Node server (apps/cinegen/web/server) for
 * LLM, FFmpeg export, transcription, SAM3 and provider jobs, so it runs as a
 * separate service (see the `cinegen-web` service in render.yaml) and is
 * embedded here like the other iframe studios.
 *
 * URL: VITE_CINEGEN_WEB_URL, or the local `npm --prefix apps/cinegen/web run
 * start` server in development. When neither is reachable, a lightweight
 * in-app version (Elements / Spaces / Edit) is shown instead.
 */

import { useCallback, useEffect, useRef, useState, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { mountStudioChrome } from '../../../lib/studioChrome.js';
import { WorkspaceShell, useWorkspace, generateId, timestamp } from '../../../lib/workspace/workspace-context.jsx';
import { WorkflowCanvasInner } from '../../SpacesCanvas.jsx';
import { ElementsTab } from '../../elements/elements-tab.jsx';
import './cinegen-studio.css';

const DEV_CINEGEN_WEB_URL = 'http://localhost:8787';

export function getCineGenWebUrl() {
  const configured = import.meta.env.VITE_CINEGEN_WEB_URL;
  if (configured) return configured.replace(/\/+$/, '');
  return import.meta.env.DEV ? DEV_CINEGEN_WEB_URL : '';
}

// ---------------------------------------------------------------------------
// Lightweight fallback (used only when the CineGen web service is unavailable)
// ---------------------------------------------------------------------------

const LITE_TABS = [
  { id: 'elements', label: 'Elements' },
  { id: 'spaces', label: 'Spaces' },
  { id: 'edit', label: 'Edit' },
];

const TAB_STORAGE_KEY = 'cinegen_studio_tab';

function readSavedTab() {
  try {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    return LITE_TABS.some((t) => t.id === saved) ? saved : 'spaces';
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

function CineGenLiteApp({ notice }) {
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
          {LITE_TABS.map((t) => (
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
      {notice && <div className="cgs__notice">{notice}</div>}
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

function mountLite(host, notice) {
  const root = createRoot(host);
  root.render(h(WorkspaceShell, null, h(CineGenLiteApp, { notice })));
  return () => {
    try { root.unmount(); } catch {}
  };
}

// ---------------------------------------------------------------------------
// Full CineGen (iframe)
// ---------------------------------------------------------------------------

async function isReachable(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    await fetch(url, { mode: 'no-cors', signal: controller.signal });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}

export function CineGenStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col overflow-hidden bg-app-bg';
  mountStudioChrome(container, { currentRoute: 'cinegen', title: 'CineGen Studio' });

  const host = document.createElement('div');
  host.className = 'cgs-root';
  container.appendChild(host);

  let unmountLite = null;
  let iframe = null;
  let disposed = false;
  const url = getCineGenWebUrl();

  const showLite = (notice) => {
    if (disposed) return;
    host.innerHTML = '';
    unmountLite = mountLite(host, notice);
  };

  if (!url) {
    // Only developers need to know the full service isn't wired up; end users
    // just get the in-app Elements / Spaces / Edit version.
    showLite(import.meta.env.DEV
      ? 'Full CineGen (Director, LLM, Export) is not configured — set VITE_CINEGEN_WEB_URL to the cinegen-web service. Showing the lightweight version.'
      : null);
  } else {
    isReachable(url).then((ok) => {
      if (disposed) return;
      if (!ok) {
        showLite(`Can't reach the CineGen service at ${url}. Showing the lightweight version.`);
        return;
      }
      iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.title = 'CineGen Studio';
      iframe.className = 'cgs-frame';
      iframe.setAttribute('allow', 'clipboard-read; clipboard-write; fullscreen; microphone');
      host.appendChild(iframe);
    });
  }

  container.cleanup = () => {
    disposed = true;
    unmountLite?.();
    if (iframe) iframe.src = 'about:blank';
  };

  return container;
}

export default CineGenStudio;
