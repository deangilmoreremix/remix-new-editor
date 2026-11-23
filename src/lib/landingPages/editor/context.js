import { createContext, useContext } from 'react';

/** What every editor component needs from the page it is on: the page row, contact tokens, event handlers. */
export const PageContext = createContext({ page: null, tokens: {}, handlers: {}, preview: true, getStyle: () => null, getTray: () => [] });
export const usePage = () => useContext(PageContext);

/** The message shown after a visitor signs up with an email box (edited on the page settings, "Thank-you message"). */
export const ThanksContext = createContext('Thanks! Check your inbox.');
export const useThanks = () => useContext(ThanksContext);

/** Page-level "After the form is sent" settings (root props of the page): { afterSubmitAction, afterSubmitUrl, afterSubmitButtonText }. */
export const AfterSubmitContext = createContext({});
export const useAfterSubmit = () => useContext(AfterSubmitContext);

/** Viewer options (type, alt text, shape, controls, autoplay, loop, caption) from the component that holds the video slot. */
export const ViewerContext = createContext({});
export const useViewer = () => useContext(ViewerContext);
