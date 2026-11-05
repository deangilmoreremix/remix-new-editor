/**
 * 本地素材（图片 / 视频 / 音频）接入工作台。
 *
 * 素材一律走浏览器本地的 object URL（`blob:`）——不上传、不调用任何外部 / 付费 API。
 * 落进工程的方式是工程自己的媒体卡（`image-clip` / `video-clip` / `audio-clip`）：
 * `addClip(cardId, track, at, { props: { file: <objectURL> } })`，
 * Remotion 合成读同一个 `file` prop 渲染（见 `cards/media-cards.tsx`）。
 */
import { CARD_FPS } from "../cards/types";
import { findClip, useStore } from "../store";
import { uid } from "../types";

export type MediaKind = "image" | "video" | "audio";

export interface MediaAttachment {
  id: string;
  kind: MediaKind;
  name: string;
  /** 本地 object URL（`blob:`）——只存在于当前浏览器，不上传 */
  url: string;
  size: number;
  /** 媒体自身时长（秒）；图片没有时长 */
  durationSec?: number;
  /** 落进工程后的 clip id（attach 之后才有） */
  clipId?: string;
}

/** 素材类型 → 媒体卡 id（`cards/media-cards.tsx`） */
export const MEDIA_CARD_IDS: Record<MediaKind, string> = {
  image: "image-clip",
  video: "video-clip",
  audio: "audio-clip",
};

/** 探测不到媒体时长时的兜底长度（秒） */
const FALLBACK_SEC: Record<MediaKind, number> = { image: 3, video: 5, audio: 5 };

/** 扩展名兜底：某些系统不给 MIME type */
const EXT_KINDS: Record<string, MediaKind> = {
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  avif: "image",
  svg: "image",
  bmp: "image",
  mp4: "video",
  webm: "video",
  mov: "video",
  m4v: "video",
  ogv: "video",
  mp3: "audio",
  wav: "audio",
  m4a: "audio",
  aac: "audio",
  ogg: "audio",
  flac: "audio",
};

/** 文件 → 素材类型（认不出来就返回 null，调用方跳过） */
export const mediaKindForFile = (file: File): MediaKind | null => {
  const type = (file?.type || "").toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  const ext = (file?.name || "").toLowerCase().split(".").pop() ?? "";
  return EXT_KINDS[ext] ?? null;
};

/** 读媒体自身时长（秒）：视频 / 音频读 metadata，图片没有时长 */
const probeDuration = (url: string, kind: MediaKind): Promise<number | null> =>
  new Promise((resolve) => {
    if (kind === "image") {
      resolve(null);
      return;
    }
    const el = document.createElement(kind === "video" ? "video" : "audio");
    el.preload = "metadata";
    const done = (value: number | null) => {
      el.removeAttribute("src");
      resolve(value);
    };
    el.onloadedmetadata = () => {
      const d = el.duration;
      done(Number.isFinite(d) && d > 0 ? d : null);
    };
    el.onerror = () => done(null);
    el.src = url;
  });

/** 目标轨道：选中 clip 所在的轨，否则最下面一条 */
const targetTrackId = (): string | undefined => {
  const state = useStore.getState();
  const selected = state.selectedClipId
    ? findClip(state.project, state.selectedClipId)?.track.id
    : undefined;
  return selected ?? state.project.tracks[state.project.tracks.length - 1]?.id;
};

/**
 * 把一份已准备好的素材加进当前工程：走工程自己的媒体卡，素材地址存 `file` prop。
 * 返回新建 clip 的 id（没有可用轨道时返回 undefined）。
 */
export const attachAttachment = (
  attachment: MediaAttachment,
  opts?: { trackId?: string; at?: number },
): string | undefined => {
  const state = useStore.getState();
  const trackId = opts?.trackId ?? targetTrackId();
  if (!trackId) return undefined;
  const seconds = attachment.durationSec ?? FALLBACK_SEC[attachment.kind];
  state.addClip(MEDIA_CARD_IDS[attachment.kind], trackId, opts?.at ?? state.playhead, {
    props: { file: attachment.url, fit: "contain" },
    label: attachment.name,
    // addClip 的 duration 与卡片原始时长同口径（30fps），工程 fps 由 store 换算
    duration: Math.max(2, Math.round(seconds * CARD_FPS)),
  });
  const clipId = useStore.getState().selectedClipId ?? undefined;
  attachment.clipId = clipId;
  return clipId;
};

/** 选中文件 → 准备素材（object URL + 异步探测时长），不碰工程 */
export const prepareMedia = (files: File[]): MediaAttachment[] => {
  const out: MediaAttachment[] = [];
  for (const file of files ?? []) {
    const kind = mediaKindForFile(file);
    if (!kind) continue;
    const attachment: MediaAttachment = {
      id: uid("media"),
      kind,
      name: file.name || `media.${kind}`,
      url: URL.createObjectURL(file),
      size: file.size ?? 0,
    };
    out.push(attachment);
    void probeDuration(attachment.url, kind).then((sec) => {
      if (sec) attachment.durationSec = sec;
    });
  }
  return out;
};

/**
 * 选中文件 → 准备素材并直接落进当前工程。
 * 多份素材按顺序排在时间轴上（第二份接在第一份结尾），不叠在一起。
 */
export const attachMediaFiles = (
  files: File[],
  opts?: { trackId?: string; at?: number },
): MediaAttachment[] => {
  const attachments = prepareMedia(files);
  let at = opts?.at ?? useStore.getState().playhead;
  for (const attachment of attachments) {
    const clipId = attachAttachment(attachment, { ...opts, at });
    if (!clipId) continue;
    const hit = findClip(useStore.getState().project, clipId);
    if (hit) at = hit.clip.start + hit.clip.duration;
  }
  return attachments;
};

/** 已准备好的素材（object URL 就绪）落进当前工程 */
export const attachMediaAttachments = (
  attachments: MediaAttachment[],
  opts?: { trackId?: string; at?: number },
): void => {
  let at = opts?.at ?? useStore.getState().playhead;
  for (const attachment of attachments) {
    const clipId = attachAttachment(attachment, { ...opts, at });
    if (!clipId) continue;
    const hit = findClip(useStore.getState().project, clipId);
    if (hit) at = hit.clip.start + hit.clip.duration;
  }
};

/**
 * 上传素材到持久化存储，返回可跨会话使用的稳定 URL。
 *
 * POST 每个文件到 `/api/motion-studio/upload`；端点不可用（本地开发）时
 * 回落到浏览器本地的 `blob:` URL。回落 URL 只存在于当前会话，不应被
 * 持久化进 localStorage（会被逐条清理，见 store 的自动保存），只用于
 * 当前预览与渲染。
 */
export const uploadMedia = async (files: File[]): Promise<MediaAttachment[]> => {
  const CONCURRENCY = 3;
  const out: MediaAttachment[] = [];
  const fileList = files ?? [];
  for (let i = 0; i < fileList.length; i += CONCURRENCY) {
    const chunk = fileList.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(async (file) => {
      const kind = mediaKindForFile(file);
      if (!kind) return null;
      let url = '';
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/motion-studio/upload', { method: 'POST', body: form });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          url = String(data?.url ?? data?.file ?? '');
        }
        if (!url) throw new Error('upload returned no url');
      } catch {
        url = URL.createObjectURL(file);
      }
      return { id: uid('media'), kind, name: file.name || `media.${kind}`, url, size: file.size ?? 0 };
    }));
    for (const result of results) {
      if (result) out.push(result);
    }
  }
  return out;
};
