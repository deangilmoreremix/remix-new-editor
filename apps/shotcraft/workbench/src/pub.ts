import { staticFile } from "remotion";

/** SmartVid: media may be a remote URL (AI-generated assets live on CDNs / Supabase),
 *  or a path under public/. Remote URLs pass through; local paths go through
 *  staticFile(), which honours window.remotion_staticBase (set in main.tsx when the
 *  workbench is served under a sub-path such as /workbench-app/). */
/** Absolute URLs and site-root paths ("/uploads/x.mp4", served by SmartVid itself)
 *  pass through untouched; only workbench-relative paths go through staticFile(). */
export const isRemote = (file: string) => /^(https?:|data:|blob:|\/)/i.test(file);
export const pub = (file: string) => (isRemote(file) ? file : staticFile(file));
