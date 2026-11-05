import React, { createContext } from "react";
import { AbsoluteFill, Freeze, useCurrentFrame } from "remotion";
import type { ClipData, ProjectData } from "../types";
import type { CardDef } from "../cards/types";
import { cardSize } from "../cards/types";
import { THEME_MANIFEST } from "../cards/projectCards";
import { themedProps } from "../theme";

/** 时间重映射：clip 本地帧 → 卡片源帧（inOffset + f × speed）。
 *  卡片全部是 frame 的纯函数（tween 均 clamp），因此变速/裁入/超时长定格都安全。
 *  不变速且不裁入时直通不包 Freeze——含 Audio/Video 的卡需要原生播放（Freeze 会掐掉声音）。 */
export const TimeRemap: React.FC<{ inOffset: number; speed: number; children: React.ReactNode }> = ({ inOffset, speed, children }) => {
  const frame = useCurrentFrame();
  if (speed === 1 && inOffset === 0) return <>{children}</>;
  return <Freeze frame={Math.max(0, inOffset + frame * speed)}>{children}</Freeze>;
};

/** Cards drawn on a fixed design stage (recipes, title cards, brand scenes, insets): the rest fill the frame themselves. */
export const STAGED = (id: string) => id.startsWith("demo:") || id.startsWith("brand-") || id === "inkpress-title-card" || id === "site-inset";

/**
 * A 16:9 design stage in a 9:16 / 1:1 film: scaled to fit and centred, so nothing runs off the frame
 * (the recipes are designed at 1920×1080; drawing them unscaled in 1080 wide showed only their left part).
 */
export const FitStage: React.FC<{ width: number; height: number; stageW: number; stageH: number; children: React.ReactNode }> = ({ width, height, stageW, stageH, children }) => {
  if (stageW === width && stageH === height) return <>{children}</>;
  const s = Math.min(width / stageW, height / stageH);
  return (
    <div style={{ position: "absolute", left: (width - stageW * s) / 2, top: (height - stageH * s) / 2, width: stageW, height: stageH, transform: `scale(${s})`, transformOrigin: "0 0", overflow: "hidden" }}>
      {children}
    </div>
  );
};

/** The props a clip's card is drawn with: its theme, and its source length for cards that fade out by it. */
export function clipProps(project: ProjectData, card: CardDef, clip: ClipData): Record<string, unknown> {
  const props: Record<string, unknown> = themedProps(THEME_MANIFEST, card, project.themeId, clip.props, project.themeColors);
  const duration = Math.max(1, Math.round(clip.duration));
  if (card.durationProp) props[card.durationProp] = Math.max(1, Math.round(clip.inOffset + duration * clip.speed));
  return props;
}

/**
 * One visual clip's picture (layer opacity / position / scale, time remap, design stage) at the current
 * frame, read as clip-local time. `inOffset` overrides the clip's own (the seams draw a shot from earlier
 * or later than its place on the timeline).
 */
export const ClipBody: React.FC<{ clip: ClipData; card: CardDef; project: ProjectData; inOffset?: number; style?: React.CSSProperties }> = ({ clip, card, project, inOffset, style }) => {
  const Comp = card.component;
  const props = clipProps(project, card, clip);
  const offset = inOffset ?? clip.inOffset;
  return (
    <AbsoluteFill style={{ opacity: clip.opacity, transform: `translate(${clip.x}px, ${clip.y}px) scale(${clip.scale})`, ...style }}>
      {card.kind === "video" ? (
        <Comp {...props} inOffset={offset} speed={clip.speed} />
      ) : (
        <TimeRemap inOffset={offset} speed={clip.speed}>
          {STAGED(clip.cardId) ? (
            <FitStage width={project.width} height={project.height} stageW={cardSize(card).width} stageH={cardSize(card).height}>
              <Comp {...props} />
            </FitStage>
          ) : (
            <Comp {...props} />
          )}
        </TimeRemap>
      )}
    </AbsoluteFill>
  );
};

/** The film being drawn, for cards that draw other clips (connected seams). */
export const FilmContext = createContext<{ project: ProjectData; cards: Record<string, CardDef> } | null>(null);
