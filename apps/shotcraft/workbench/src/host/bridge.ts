import { create } from "zustand";
import { useStore } from "../store";
import { appendAssets, isHostAsset, projectFromAssets, type HostAsset } from "./importAssets";

/** postMessage protocol between SmartVid (parent window) and the workbench iframe.
 *  Same-origin only: the workbench is served from smartvid.app/workbench-app/.
 *
 *  parent → workbench
 *    { type: "sv:auth", token }                       Clerk session token for AI chat
 *    { type: "sv:import-assets", assets, mode, name } open AI assets ("new" | "append")
 *  workbench → parent
 *    { type: "sv:ready" }
 *    { type: "sv:exported", blob, name }              finished MP4 to save to the library
 */
interface HostState {
  embedded: boolean;
  token: string | null;
}
export const useHost = create<HostState>(() => ({
  embedded: typeof window !== "undefined" && window.parent !== window,
  token: null,
}));

const post = (msg: Record<string, unknown>) => {
  if (window.parent !== window) window.parent.postMessage(msg, window.location.origin);
};

export const notifyExported = (blob: Blob, name: string) => post({ type: "sv:exported", blob, name });

/** Read real media length / size from metadata when the host didn't send it. */
const probe = (a: HostAsset): Promise<HostAsset> =>
  new Promise((resolve) => {
    if (a.kind === "image" || (a.durationSec && (a.kind === "audio" || (a.width && a.height)))) return resolve(a);
    const m = document.createElement(a.kind === "audio" ? "audio" : "video");
    const done = (extra: Partial<HostAsset>) => {
      clearTimeout(timer);
      m.removeAttribute("src");
      resolve({ ...a, ...extra });
    };
    const timer = setTimeout(() => done({}), 6000);
    m.preload = "metadata";
    m.onloadedmetadata = () => {
      const v = m as HTMLVideoElement;
      done({
        ...(Number.isFinite(m.duration) && m.duration > 0 ? { durationSec: m.duration } : {}),
        ...(a.kind === "video" && v.videoWidth ? { width: v.videoWidth, height: v.videoHeight } : {}),
      });
    };
    m.onerror = () => done({});
    m.src = a.url;
  });

const importAssets = async (raw: HostAsset[], mode: unknown, name: unknown) => {
  const assets = await Promise.all(raw.map(probe));
  const s = useStore.getState();
  const title = typeof name === "string" && name.trim() ? name.trim().slice(0, 80) : undefined;
  s.setProject(mode === "append" ? appendAssets(s.project, assets) : projectFromAssets(assets, title));
};

let started = false;
export const initHostBridge = () => {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("message", (e: MessageEvent) => {
    if (e.origin !== window.location.origin || e.source !== window.parent) return;
    const d = e.data as Record<string, unknown> | null;
    if (!d || typeof d.type !== "string") return;
    if (d.type === "sv:auth") {
      useHost.setState({ token: typeof d.token === "string" ? d.token : null });
    } else if (d.type === "sv:import-assets" && Array.isArray(d.assets)) {
      const assets = d.assets.filter(isHostAsset);
      if (assets.length) importAssets(assets, d.mode, d.name);
    }
  });
  post({ type: "sv:ready" });
};
