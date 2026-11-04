import { create } from "zustand";
import { useStore } from "../store";
import { CARDS } from "../cards/registry";
import type { HostAsset } from "./importAssets";
import { appendAssets } from "./importAssets";
import { probe, requestUpload, useHost } from "./bridge";

/** SmartVid: add the user's own files (upload button / drag from the desktop).
 *  A file shows up at once from a local blob: URL; when the Workbench runs inside
 *  SmartVid the parent uploads it to storage and the clip is switched to the
 *  permanent URL (store.replaceFile), so the project survives a reload and exports. */
import { ACCEPT, UPLOAD_LIMITS, checkFile, kindOfFile, type MediaKind } from "./uploadRules";
export { ACCEPT, UPLOAD_LIMITS, checkFile, kindOfFile };
export type { MediaKind };

type UploadState = "uploading" | "done" | "local" | "error";
interface UploadItem { id: string; name: string; state: UploadState; message?: string }
export const useUploads = create<{ items: UploadItem[] }>(() => ({ items: [] }));
export const setUpload = (id: string, patch: Partial<UploadItem>) =>
  useUploads.setState((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
const pushUpload = (item: UploadItem) => useUploads.setState((s) => ({ items: [...s.items.slice(-19), item] }));
export const reportUploadError = (name: string, message: string) =>
  pushUpload({ id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name, state: "error", message });

const FPS_UNIT = 30; // card default lengths are in 30fps frames (see cards/types CARD_FPS)

/**
 * Add files to the project.
 * - With `at` (+ optional `trackId`): drop position on the timeline (frame).
 * - Without: appended after the current end, like "Add your generations".
 */
export const addFiles = async (list: FileList | File[], at?: { trackId?: string; frame: number }) => {
  const files = Array.from(list);
  const accepted: { file: File; asset: HostAsset }[] = [];
  for (const file of files) {
    const res = checkFile(file);
    if ("error" in res) { reportUploadError(file.name, res.error); continue; }
    const url = URL.createObjectURL(file);
    const asset = await probe({ url, kind: res.kind, name: file.name.replace(/\.[^.]+$/, "") });
    accepted.push({ file, asset });
  }
  if (!accepted.length) return 0;

  const s = useStore.getState();
  if (at) {
    let frame = Math.max(0, Math.round(at.frame));
    for (const { asset } of accepted) {
      const cardId = asset.kind === "video" ? "video-clip" : asset.kind === "audio" ? "audio-clip" : "image-clip";
      const card = CARDS[cardId];
      const sec = asset.kind === "image" ? 3 : asset.durationSec || 5;
      const duration = Math.max(2, Math.round(sec * FPS_UNIT));
      s.addClip(cardId, at.trackId, frame, {
        props: asset.kind === "image" ? { file: asset.url, fit: "contain" } : asset.kind === "video" ? { file: asset.url, fit: "contain" } : { file: asset.url, volume: 1 },
        label: asset.name,
        duration: card ? duration : undefined,
      });
      frame += Math.round(sec * useStore.getState().project.fps);
    }
  } else {
    s.setProject(appendAssets(s.project, accepted.map((a) => a.asset)));
  }

  const embedded = useHost.getState().embedded;
  for (const { file, asset } of accepted) {
    const id = `up_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    if (embedded) {
      pushUpload({ id, name: file.name, state: "uploading" });
      requestUpload(id, file, asset.kind, asset.url);
    } else {
      pushUpload({ id, name: file.name, state: "local", message: "Kept in this browser session only." });
    }
  }
  return accepted.length;
};
