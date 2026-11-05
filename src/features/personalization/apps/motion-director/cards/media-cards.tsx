import React from "react";
import { AbsoluteFill, Img, staticFile, interpolate, useCurrentFrame } from "remotion";
import { Audio, Video } from "@remotion/media";
import type { CardDef } from "./types";

// —— 媒体卡：视频 / 图片 / 音频文件直接上轨（成片工程 public/ 与仓库音效库都走它们）——
// 视频/音频卡 kind:"video"/"audio"：裁入=trimBefore、变速=playbackRate（不能包 Freeze，会掐死原生播放）

/**
 * 素材地址 → 播放地址。
 *
 * public/ 下的相对路径要走 staticFile()（Remotion 的静态资源基址）；
 * 本地 object URL（blob:，工作台直接拖进来的素材）、data: 与绝对 http(s) 地址
 * 已经是可直接播放的地址，再套一层 staticFile 会拼出坏链接。
 */
const mediaSrc = (file: string): string =>
  /^(?:blob:|data:|https?:\/\/)/i.test(file) ? file : staticFile(file);

const VideoClip: React.FC<{
  file?: string;
  fit?: string;
  muted?: boolean;
  volume?: number;
  inOffset?: number;
  speed?: number;
}> = ({ file = "", fit = "contain", muted = false, volume = 1, inOffset = 0, speed = 1 }) => {
  if (!file) return null;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Video
        src={mediaSrc(file)}
        // No trimAfter: the clip's Sequence ends playback. `trimAfter={0}` meant "end at
        // frame 0" — a zero-length video, which the web renderer rejects on export.
        trimBefore={Math.round(inOffset)}
        playbackRate={speed}
        muted={muted}
        volume={volume}
        style={{ width: "100%", height: "100%", objectFit: fit as React.CSSProperties["objectFit"] }}
      />
    </AbsoluteFill>
  );
};

export const videoClipCard: CardDef = {
  id: "video-clip",
  name: "视频素材",
  category: "素材",
  categoryEn: "Media",
  kind: "video",
  timing: "realtime",
  durationInFrames: 150,
  accent: "#30d158",
  component: VideoClip as React.ComponentType<Record<string, unknown>>,
  schema: [
    { type: "text", key: "file", label: "文件（public/ 下）", default: "" },
    {
      type: "select", key: "fit", label: "适配", default: "contain",
      options: [
        { value: "contain", label: "完整显示" },
        { value: "cover", label: "铺满裁切" },
      ],
    },
    { type: "boolean", key: "muted", label: "静音", default: false },
    { type: "slider", key: "volume", label: "音量", default: 1, min: 0, max: 1, step: 0.01 },
  ],
};

const ImageClip: React.FC<{ file?: string; fit?: string }> = ({ file = "", fit = "contain" }) => {
  if (!file) return null;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Img
        src={mediaSrc(file)}
        style={{ width: "100%", height: "100%", objectFit: fit as React.CSSProperties["objectFit"] }}
      />
    </AbsoluteFill>
  );
};

export const imageClipCard: CardDef = {
  id: "image-clip",
  name: "图片素材",
  category: "素材",
  categoryEn: "Media",
  timing: "realtime",
  durationInFrames: 90,
  accent: "#64d2ff",
  component: ImageClip as React.ComponentType<Record<string, unknown>>,
  schema: [
    { type: "text", key: "file", label: "文件（public/ 下）", default: "" },
    {
      type: "select", key: "fit", label: "适配", default: "contain",
      options: [
        { value: "contain", label: "完整显示" },
        { value: "cover", label: "铺满裁切" },
      ],
    },
  ],
};

/** 音频卡（BGM / 音效通用）：裁入=trimBefore、变速=playbackRate，裁剪变速不哑音。
 *  可选 fadeInFrames / fadeOutFrames 做入淡出（volume 按当前帧插值），durationFrames 用于算出场淡出终点。 */
const AudioClip: React.FC<{
  file?: string;
  volume?: number;
  inOffset?: number;
  speed?: number;
  fadeInFrames?: number;
  fadeOutFrames?: number;
  durationFrames?: number;
}> = ({ file = "", volume = 1, inOffset = 0, speed = 1, fadeInFrames = 0, fadeOutFrames = 0, durationFrames }) => {
  if (!file) return null;
  const frame = useCurrentFrame();
  let vol = volume;
  if (fadeInFrames > 0) {
    vol = Math.min(vol, interpolate(frame, [0, fadeInFrames], [0, volume]));
  }
  if (fadeOutFrames > 0 && durationFrames) {
    const startFade = Math.max(0, durationFrames - fadeOutFrames);
    vol = Math.min(vol, interpolate(frame, [startFade, durationFrames], [volume, 0]));
  }
  return (
    <Audio
      src={mediaSrc(file)}
      volume={vol}
      trimBefore={Math.round(inOffset)}
      playbackRate={speed}
    />
  );
};

export const audioClipCard: CardDef = {
  id: "audio-clip",
  name: "音频",
  category: "音频",
  categoryEn: "Audio",
  kind: "audio",
  timing: "realtime",
  durationInFrames: 90,
  accent: "#ff9f0a",
  component: AudioClip as React.ComponentType<Record<string, unknown>>,
  schema: [
    { type: "text", key: "file", label: "文件（public/ 下）", default: "" },
    { type: "slider", key: "volume", label: "音量", default: 1, min: 0, max: 1, step: 0.01 },
  ],
};
