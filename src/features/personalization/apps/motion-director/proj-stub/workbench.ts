/**
 * Motion Studio ships without a linked film project, so `@proj/workbench`
 * resolves here. The library / SFX / background / preview / export features all
 * work as they do in the original workbench; only the "decompose an external
 * film project into tracks" import needs a real manifest.
 */
export const WORKBENCH = null as import('../cards/manifest').WorkbenchManifest | null;
