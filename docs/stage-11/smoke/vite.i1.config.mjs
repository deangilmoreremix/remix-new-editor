// Dev-server wrapper for the Port I1 smoke: same config as the app, but a private optimizer cache (the worktree's node_modules is a symlink shared with other
// dev servers, whose `.vite` cache otherwise gets overwritten -> 504 "Outdated Optimize Dep" for module workers) and transformers pre-bundled up front. fs.strict=false because the worker pipeline imports vite/client through the symlink's real path (outside the worktree).
import base from '../../../vite.config.js';
export default async (env) => {
  const cfg = typeof base === 'function' ? await base(env) : base;
  return { ...cfg, server: { ...(cfg.server || {}), fs: { ...((cfg.server && cfg.server.fs) || {}), strict: false } }, cacheDir: process.env.I1_VITE_CACHE || '/tmp/i1-vite-cache', optimizeDeps: { ...(cfg.optimizeDeps || {}), include: [...((cfg.optimizeDeps && cfg.optimizeDeps.include) || []), '@huggingface/transformers'] } };
};
