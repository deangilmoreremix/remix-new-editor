/**
 * Mount helpers so the vanilla-DOM app (studio + public page) can host the React-based page editor.
 *   mountEditablePage   public page: renders saved page data with the page's video, tokens and tracking handlers
 *   mountPageEditor studio: the full visual editor over the same components
 */
import { createRoot } from 'react-dom/client';
// the library's editor component is exported under its own name; it is used under a neutral one here
import { Puck as PageEditor, Render } from '@page-editor/core';
import '@page-editor/core/no-external.css';
import '../../../../styles/page-editor.css';
import '../../../../styles/page-editor-theme.css'; // dark chrome (.rx-editor) + the shared accent variables
// One stylesheet per design (styles/page-editor/NN-name.css), loaded AFTER the base styles so a design can override them.
import './designCss.js';
import { PageContext } from './context.js';
import { pageStyleHint } from './styleHint.js';
import { editorConfig } from './config.jsx';

export function mountEditablePage(container, { page, data, tokens = {}, handlers = {}, preview = false }) {
  const root = createRoot(container);
  root.render(
    <PageContext.Provider value={{ page, tokens, handlers, preview }}>
      <Render config={editorConfig} data={data} />
    </PageContext.Provider>,
  );
  return { destroy: () => root.unmount() };
}

export function mountPageEditor(container, { page, data, tokens = {}, onChange, onPublish, getTray = () => [] }) {
  const root = createRoot(container);
  // The page's current look (accent, background, text, dark or light), kept up to date as it is edited, for the AI buttons.
  const look = { current: pageStyleHint(data?.root) };
  const track = (d) => { look.current = pageStyleHint(d?.root); onChange?.(d); };
  root.render(
    <PageContext.Provider value={{ page, tokens, handlers: {}, preview: true, getStyle: () => look.current, getTray }}>
      <PageEditor config={editorConfig} data={data} onChange={track} onPublish={onPublish} />
    </PageContext.Provider>,
  );
  return { destroy: () => root.unmount() };
}
