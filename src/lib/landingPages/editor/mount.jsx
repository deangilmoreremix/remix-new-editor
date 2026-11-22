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
// One stylesheet per design (styles/page-editor/NN-name.css), loaded AFTER the base styles so a design can override them.
import './designCss.js';
import { PageContext } from './context.js';
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

export function mountPageEditor(container, { page, data, tokens = {}, onChange, onPublish, bookingDefaults }) {
  // A new Booking calendar section starts with this person's own Cal.diy address and booking link.
  if (bookingDefaults?.host && bookingDefaults?.link) {
    Object.assign(editorConfig.components.BookingCalendar.defaultProps, { host: bookingDefaults.host, link: bookingDefaults.link });
  }
  const root = createRoot(container);
  root.render(
    <PageContext.Provider value={{ page, tokens, handlers: {}, preview: true }}>
      <PageEditor config={editorConfig} data={data} onChange={onChange} onPublish={onPublish} />
    </PageContext.Provider>,
  );
  return { destroy: () => root.unmount() };
}
