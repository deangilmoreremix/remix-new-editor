// Host shim (not upstream): @electron-toolkit/utils helpers that only matter inside an Electron window.
export const electronApp = { setAppUserModelId() {} };
export const optimizer = { watchWindowShortcuts() {} };
export const is = { dev: false };
export const platform = { isMacOS: false, isWindows: false, isLinux: true };
