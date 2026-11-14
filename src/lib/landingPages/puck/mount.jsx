/**
 * Mount helpers so the vanilla-DOM app (studio + public page) can host React-based Puck.
 *   mountPuckPage   public page: renders saved Puck data with the page's video, tokens and tracking handlers
 *   mountPuckEditor studio: the full visual editor over the same components
 */
import { createRoot } from 'react-dom/client';
import { Puck, Render } from '@puckeditor/core';
import '@puckeditor/core/no-external.css';
import '../../../../styles/puck-pages.css';
import { PageContext } from './context.js';
import { puckConfig } from './config.jsx';

export function mountPuckPage(container, { page, data, tokens = {}, handlers = {}, preview = false }) {
  const root = createRoot(container);
  root.render(
    <PageContext.Provider value={{ page, tokens, handlers, preview }}>
      <Render config={puckConfig} data={data} />
    </PageContext.Provider>,
  );
  return { destroy: () => root.unmount() };
}

export function mountPuckEditor(container, { page, data, tokens = {}, onChange, onPublish }) {
  const root = createRoot(container);
  root.render(
    <PageContext.Provider value={{ page, tokens, handlers: {}, preview: true }}>
      <Puck config={puckConfig} data={data} onChange={onChange} onPublish={onPublish} />
    </PageContext.Provider>,
  );
  return { destroy: () => root.unmount() };
}
