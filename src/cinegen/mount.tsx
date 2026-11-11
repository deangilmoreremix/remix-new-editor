// [remix] Page entry for the router: returns a DOM element hosting the CineGen workspace (React 19 island).
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import './styles/edit-tab.css';
import './styles/director-tab.css';
import './styles/theme-remix.css';
import { installElectronShim } from './adapters/electron-shim';
import { registerWebApi } from './adapters/web-api';
import { registerWebStore } from './adapters/web-store';
import { importLegacyProjects } from './adapters/legacy-import';
import { ErrorBoundary } from '@cinegen/components/error-boundary';
import { WebApp } from './WebApp';
import { hydratePlugins } from '@cinegen/lib/occ/plugins';

export function CineGenEditorPage(): HTMLElement {
  installElectronShim();
  registerWebStore();
  void hydratePlugins(); // [remix] OpenChatCut plugin packs installed earlier register their fx / LUTs / transitions / zoom presets
  registerWebApi(); // real implementations must be in place before the workspace subscribes to media events
  const el = document.createElement('div');
  el.id = 'cinegen-editor-page';
  // [remix] host frame: the workspace fills the page above the app's rail, as CineGen's own window does.
  el.className = 'cinegen-root';
  Object.assign(el.style, { position: 'fixed', inset: '0', zIndex: '60', background: 'var(--bg-void)', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', display: 'flex', flexDirection: 'column' });
  const root = createRoot(el);
  // Bring over projects saved by the earlier build (once), then show the project manager.
  void importLegacyProjects().finally(() => root.render(<ErrorBoundary><WebApp /></ErrorBoundary>));
  (el as HTMLElement & { cleanup?: () => void }).cleanup = () => { setTimeout(() => root.unmount(), 0); };
  return el;
}
