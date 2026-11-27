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
import { createEditorBanner } from '../lib/thumbnails.js';

export function CineGenEditorPage(): HTMLElement {
  installElectronShim();
  registerWebStore();
  void hydratePlugins(); // [remix] OpenChatCut plugin packs installed earlier register their fx / LUTs / transitions / zoom presets
  registerWebApi(); // real implementations must be in place before the workspace subscribes to media events
  const el = document.createElement('div');
  el.id = 'cinegen-editor-page';
  // [remix] host frame: the workspace fills the app's content area, so the app header and left menu stay visible and usable.
  el.className = 'cinegen-root';
  Object.assign(el.style, { position: 'absolute', inset: '0', zIndex: '0', minHeight: '0', overflowX: 'hidden', overflowY: 'auto', contain: 'layout', background: 'var(--bg-void)', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', display: 'flex', flexDirection: 'column' });
  // Same studio banner as every other page; the editor renders in the host below it.
  const banner = createEditorBanner('timeline', 'Timeline Editor', 'Edit, caption, personalise and export your video');
  // CineGen's unlayered `* { padding: 0 }` reset beats Tailwind's layered px-*/pt-* utilities, so set the banner's padding inline.
  banner.style.padding = '24px 24px 0';
  const bannerText = banner.querySelector('h1')?.parentElement as HTMLElement | null;
  if (bannerText) bannerText.style.paddingLeft = '28px';
  el.appendChild(banner);
  const host = document.createElement('div');
  // [remix] the editor never gets squeezed below 640px by the banner: when the window is short the page scrolls instead of clipping the workspace.
  Object.assign(host.style, { flex: '0 0 auto', height: 'max(640px, 100%)', minHeight: '0', position: 'relative', overflow: 'hidden', contain: 'layout', display: 'flex', flexDirection: 'column' });
  el.appendChild(host);
  const root = createRoot(host);
  // Bring over projects saved by the earlier build (once), then show the project manager.
  void importLegacyProjects().finally(() => root.render(<ErrorBoundary><WebApp /></ErrorBoundary>));
  (el as HTMLElement & { cleanup?: () => void }).cleanup = () => { setTimeout(() => root.unmount(), 0); };
  return el;
}
