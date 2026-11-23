import { create } from "zustand";
import { useStore } from "../store";
import { appendAssets, isHostAsset, projectFromAssets, type HostAsset } from "./importAssets";

/** postMessage protocol between SmartVid (parent window) and the workbench iframe.
 *  Same-origin only: the workbench is served from smartvid.app/workbench-app/.
 *
 *  parent → workbench
 *    { type: "sv:auth", token, openaiKey }            Clerk token + the user's own OpenAI key (BYOK)
 *    { type: "sv:import-assets", assets, mode, name } open AI assets ("new" | "append")
 *    { type: "sv:uploaded", id, url } / { type: "sv:upload-failed", id, error }
 *    { type: "sv:call", id, op, args }                MCP tab control: op = get_project | run_ops | undo | redo
 *  workbench → parent
 *    { type: "sv:call-result", id, ok, result?, error? }
 *    { type: "sv:ready" }
 *    { type: "sv:exported", blob, name }              finished MP4 to save to the library
 *    { type: "sv:upload", id, file, kind }            user's own file to upload to storage
 */
interface HostState {
  embedded: boolean;
  token: string | null;
  /** BYOK: the user's own OpenAI key from SmartVid's API key modal. Memory only. */
  openaiKey: string | null;
}
export const useHost = create<HostState>(() => ({
  embedded: typeof window !== "undefined" && window.parent !== window,
  token: null,
  openaiKey: null,
}));

const post = (msg: Record<string, unknown>) => {
  if (window.parent !== window) window.parent.postMessage(msg, window.location.origin);
};

export const notifyExported = (blob: Blob, name: string) => post({ type: "sv:exported", blob, name });

/** Uploads of the user's own files: id → local blob: URL shown until the parent replies. */
const pendingUploads = new Map<string, string>();
export const requestUpload = (id: string, file: File, kind: string, blobUrl: string) => {
  pendingUploads.set(id, blobUrl);
  post({ type: "sv:upload", id, file, kind });
};

/** Read real media length / size from metadata when the host didn't send it. */
export const probe = (a: HostAsset): Promise<HostAsset> =>
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

/** MCP tab control. Only these ops exist; run_ops goes through the same validator (applyOps) the AI chat uses, so media URLs the project does not already hold are refused. */
const runCall = async (op: unknown, args: Record<string, unknown>) => {
  const { applyOps, compactProject } = await import("../ai/ops");
  const { CARDS } = await import("../cards/registry");
  const s = useStore.getState();
  switch (op) {
    case "get_project":
      return { project: compactProject(s.project), selectedClipId: s.selectedClipId };
    case "run_ops": {
      const res = applyOps(s.project, Array.isArray(args.ops) ? (args.ops as never[]) : [], CARDS);
      if (res.applied > 0) useStore.getState().setProject(res.project);
      return { applied: res.applied, errors: res.errors.slice(0, 20) };
    }
    case "undo": s.undo(); return { ok: true };
    case "redo": s.redo(); return { ok: true };
    default: throw new Error("Unknown call.");
  }
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
      useHost.setState({
        token: typeof d.token === "string" ? d.token : null,
        openaiKey: typeof d.openaiKey === "string" && d.openaiKey.trim() ? d.openaiKey.trim() : null,
      });
    } else if ((d.type === "sv:uploaded" || d.type === "sv:upload-failed") && typeof d.id === "string") {
      const blobUrl = pendingUploads.get(d.id);
      if (!blobUrl) return;
      pendingUploads.delete(d.id);
      // Lazy import: uploads.ts imports this module.
      import("./uploads").then(({ setUpload }) => {
        if (d.type === "sv:uploaded" && typeof d.url === "string" && /^https?:/i.test(d.url)) {
          useStore.getState().replaceFile(blobUrl, d.url);
          setUpload(d.id as string, { state: "done" });
          setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
        } else {
          setUpload(d.id as string, {
            state: "local",
            message: `Not saved to your library${typeof d.error === "string" ? ` (${d.error})` : ""}. It works until you close this tab.`,
          });
        }
      });
    } else if (d.type === "sv:call" && typeof d.id === "string") {
      const id = d.id;
      runCall(d.op, d.args && typeof d.args === "object" ? (d.args as Record<string, unknown>) : {})
        .then((result) => post({ type: "sv:call-result", id, ok: true, result }))
        .catch((err) => post({ type: "sv:call-result", id, ok: false, error: String(err?.message || err).slice(0, 300) }));
    } else if (d.type === "sv:import-assets" && Array.isArray(d.assets)) {
      const assets = d.assets.filter(isHostAsset);
      if (assets.length) importAssets(assets, d.mode, d.name);
    }
  });
  post({ type: "sv:ready" });
};
