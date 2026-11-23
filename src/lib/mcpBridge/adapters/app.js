// App-level tab tools: where the user is and moving them to another page. Navigating unmounts the current studio (and its tools), so it asks first.
const obj = (properties = {}, required = []) => ({ type: 'object', properties, ...(required.length ? { required } : {}) });

/** @param {{ getCurrentPage: () => string, navigate: (page: string, params?: object) => any, isKnownPage: (p: string) => boolean, title?: () => string }} deps */
export function createAppTools({ getCurrentPage, navigate, isKnownPage, title = () => (typeof document !== 'undefined' ? document.title : '') }) {
  return [
    { name: 'app_state', risk: 'read', description: 'Which page this tab is on.', schema: obj(), run: () => ({ page: getCurrentPage() || null, title: String(title()).slice(0, 80) }) },
    {
      name: 'app_navigate', risk: 'write', description: 'Open another SmartVid page in this tab (for example "image", "video", "timeline"). The previous page\'s tools stop being available.',
      schema: obj({ page: { type: 'string', maxLength: 80 } }, ['page']),
      run: async (a) => { const page = String(a.page || ''); if (!isKnownPage(page)) throw new Error('Unknown page.'); await navigate(page); return { page: getCurrentPage() }; },
    },
  ];
}
