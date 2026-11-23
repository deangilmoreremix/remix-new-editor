// Host shim (not upstream): the web port has no desktop auto-updater.
const noop = () => undefined;
export const autoUpdater = new Proxy({}, { get: (_t, p) => (p === 'then' ? undefined : noop), set: () => true });
export default { autoUpdater };
