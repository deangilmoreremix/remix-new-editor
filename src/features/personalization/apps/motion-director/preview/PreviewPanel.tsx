import React, { useEffect, useMemo, useState } from "react";
import { Player } from "@remotion/player";
import { MainComposition } from "./Composition";
import { playerRef, seekTo, togglePlay } from "../playerRef";
import { projectDuration, useStore } from "../store";
import type { PreviewItem } from "../store";
import { fmtFrames } from "../time";
import { CARDS } from "../cards/registry";
import { cardFps, cardSize } from "../cards/types";
import { THEME_MANIFEST } from '../cards/projectCards';
import { themedProps } from '../theme';
import { cardName, t, useLocale, useT, useTx } from "../i18n";
import MotionFullscreenPlayer from "../components/MotionFullscreenPlayer";
import type { CardDef } from "../cards/types";

type FullscreenPayload =
  | { kind: "video" | "image"; url: string; mediaType: "video" | "image" }
  | { kind: "card"; card: CardDef };

const ItemPreview: React.FC<{ item: NonNullable<PreviewItem>; onClose: () => void; onFullscreen?: (payload: FullscreenPayload) => void }> = ({
  item,
  onClose,
  onFullscreen,
}) => {
  const themeId = useStore(s => s.project.themeId);
  const themeColors = useStore(s => s.project.themeColors);
  const t = useT();
  const tx = useTx();
  let body: React.ReactNode = null;
  let title = "";
  if (item.kind === "card") {
    const card = CARDS[item.cardId];
    title = card ? cardName(card) : item.cardId;
    if (card && card.kind !== "audio") {
      const { width, height } = cardSize(card);
      body = (
        <Player
          component={card.component}
          inputProps={themedProps(THEME_MANIFEST, card, themeId, {}, themeColors)}
          durationInFrames={Math.max(2, card.durationInFrames)}
          compositionWidth={width}
          compositionHeight={height}
          fps={cardFps(card)}
          autoPlay
          loop
          controls={false}
          clickToPlay
          numberOfSharedAudioTags={32}
          acknowledgeRemotionLicense
          style={{ width: "100%", height: "100%" }}
        />
      );
    } else {
      body = <div className="preview-audio">{t("prev.audioCard")}</div>;
    }
  } else {
    // 素材标签（文件名 / BGM / 音效名）与卡片名同路：过 tx，查不到词典的技术名原样返回
    title = tx(item.label);
    if (item.kind === "video")
      body = <video className="preview-media" src={`/${item.file}`} controls autoPlay loop />;
    else if (item.kind === "image")
      body = <img className="preview-media" src={`/${item.file}`} />;
    else
      body = (
        <div className="preview-audio">
          🔊 {tx(item.label)}
          <audio src={`/${item.file}`} controls autoPlay />
        </div>
      );
  }
  return (
    <>
      <div className="preview-stage">{body}</div>
      <div className="transport">
        <span className="preview-tag">{t("prev.tag")}</span>
        <b>{title}</b>
        <span className="dim">{t("prev.dragHint")}</span>
        {onFullscreen && item.kind !== "audio" && (
          <button
            className="btn"
            onClick={() => {
              if (item.kind === "card") {
                const card = CARDS[item.cardId];
                if (card) onFullscreen({ kind: "card", card });
              } else {
                const mediaType = item.kind === "image" ? "image" : "video";
                onFullscreen({ kind: mediaType, url: `/${item.file}`, mediaType });
              }
            }}
          >
            ⛶
          </button>
        )}
        <button className="btn" style={{ marginLeft: "auto" }} onClick={onClose}>
          {t("prev.back")}
        </button>
      </div>
    </>
  );
};

/** 走带控制：唯一订阅 playhead 的预览端组件——播放中每帧只重渲染它，
 *  不能让 frameupdate 波及包含 <Player> 的父组件。 */
const Transport: React.FC<{
  duration: number;
  fps: number;
  loop: boolean;
  setLoop: (b: boolean) => void;
  sizeLabel: string;
}> = ({ duration, fps, loop, setLoop, sizeLabel }) => {
  const playhead = useStore((s) => s.playhead);
  const playing = useStore((s) => s.playing);
  const setPlayhead = useStore((s) => s.setPlayhead);
  const setPlaying = useStore((s) => s.setPlaying);

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => setPlayhead(e.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    p.addEventListener("frameupdate", onFrame);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    return () => {
      p.removeEventListener("frameupdate", onFrame);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
    };
  }, [setPlayhead, setPlaying]);

  return (
    <div className="transport">
      <button className="btn" title={t("prev.toStart")} onClick={() => seekTo(0)}>
        ⏮
      </button>
      <button className="btn btn-play" title={t("prev.playPause")} onClick={togglePlay}>
        {playing ? "⏸" : "▶"}
      </button>
      <span className="timecode">
        {fmtFrames(playhead, fps)} <span className="dim">/ {fmtFrames(duration, fps)}</span>
      </span>
      <label className="loop-toggle">
        <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
        {t("prev.loop")}
      </label>
      <span className="dim" style={{ marginLeft: "auto" }}>
        {sizeLabel}
      </span>
    </div>
  );
};

export const PreviewPanel: React.FC = () => {
  useLocale((s) => s.locale); // 语言切换时连带走带条一起重渲染
  const project = useStore((s) => s.project);
  const previewItem = useStore((s) => s.previewItem);
  const setPreview = useStore((s) => s.setPreview);
  const [loop, setLoop] = useState(true);
  const [fullscreenMedia, setFullscreenMedia] = useState<FullscreenPayload | null>(null);

  const themeId = useStore((s) => s.project.themeId);
  const themeColors = useStore((s) => s.project.themeColors);
  const duration = projectDuration(project);
  const inputProps = useMemo(() => ({ project }), [project]);

  const handleCloseFullscreen = () => setFullscreenMedia(null);

  return (
    <div className="preview-panel">
      {fullscreenMedia &&
        (fullscreenMedia.kind === "card" ? (
          <div
            className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center"
            onClick={handleCloseFullscreen}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="relative max-h-[90vh] max-w-[90vw]"
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const card = fullscreenMedia.card;
                const { width, height } = cardSize(card);
                return (
                  <Player
                    component={card.component}
                    inputProps={themedProps(THEME_MANIFEST, card, themeId, {}, themeColors)}
                    durationInFrames={Math.max(2, card.durationInFrames)}
                    compositionWidth={width}
                    compositionHeight={height}
                    fps={cardFps(card)}
                    autoPlay
                    loop
                    controls={false}
                    clickToPlay
                    numberOfSharedAudioTags={32}
                    acknowledgeRemotionLicense
                    style={{ width: "100%", height: "100%" }}
                  />
                );
              })()}
              <button
                type="button"
                onClick={handleCloseFullscreen}
                className="absolute top-2 right-2 z-[201] flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Close"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          <MotionFullscreenPlayer
            url={fullscreenMedia.url}
            mediaType={fullscreenMedia.mediaType}
            onClose={handleCloseFullscreen}
          />
        ))}
      {previewItem && (
        <ItemPreview
          item={previewItem}
          onClose={() => setPreview(null)}
          onFullscreen={(payload) => setFullscreenMedia(payload)}
        />
      )}
      <div className="preview-stage" style={previewItem ? { display: "none" } : undefined}>
        <Player
          ref={playerRef}
          component={MainComposition}
          inputProps={inputProps}
          durationInFrames={duration}
          compositionWidth={project.width}
          compositionHeight={project.height}
          fps={project.fps}
          loop={loop}
          controls={false}
          clickToPlay
          numberOfSharedAudioTags={32}
          acknowledgeRemotionLicense
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      {!previewItem && (
        <Transport
          duration={duration}
          fps={project.fps}
          loop={loop}
          setLoop={setLoop}
          sizeLabel={`${project.width}×${project.height} · ${project.fps}fps`}
        />
      )}
    </div>
  );
};
