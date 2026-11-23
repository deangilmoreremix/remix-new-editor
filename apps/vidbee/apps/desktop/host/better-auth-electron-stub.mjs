// Host shim (not upstream): VidBee Cloud sign-in uses an Electron-only Better Auth plugin (custom protocol + safeStorage).
// The self-hosted web port has no cloud account, so the plugin and its storage are inert placeholders.
export const electronClient = () => ({ id: 'electron' });
export const storage = () => ({});
export const setupMain = () => {};
export const setupRenderer = () => {};
export default {};
