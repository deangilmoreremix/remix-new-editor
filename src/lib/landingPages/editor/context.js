import { createContext, useContext } from 'react';

/** What every editor component needs from the page it is on: the page row, contact tokens, event handlers. */
export const PageContext = createContext({ page: null, tokens: {}, handlers: {}, preview: true });
export const usePage = () => useContext(PageContext);
