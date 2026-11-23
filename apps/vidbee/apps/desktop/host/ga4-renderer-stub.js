// Host shim (not upstream): analytics is not part of the web port; every method is a no-op.
const noop = () => undefined;
export const getDesktopGoogleAnalytics = () => new Proxy({}, { get: () => noop });
