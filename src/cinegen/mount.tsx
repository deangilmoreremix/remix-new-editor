// [remix] Page entry for the router: returns a DOM element hosting the CineGen workspace (React 19 island).
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import './styles/edit-tab.css';
import './styles/director-tab.css';
import './styles/theme-remix.css';
import { installElectronShim } from './adapters/electron-shim';
import { registerWebApi } from './adapters/web-api';
import { WebWorkspace } from './components/workspace/web-workspace';

export function CineGenEditorPage(): HTMLElement {
  installElectronShim();
  registerWebApi(); // real implementations must be in place before the workspace subscribes to media events
  const el = document.createElement('div');
  el.id = 'cinegen-editor-page';
  const root = createRoot(el);
  const back = () => { window.location.hash = '#/home'; };
  root.render(<WebWorkspace onBack={back} />);
  (el as HTMLElement & { cleanup?: () => void }).cleanup = () => { setTimeout(() => root.unmount(), 0); };
  return el;
}
