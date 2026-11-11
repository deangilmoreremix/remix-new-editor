import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import type { ProjectData } from "../types";
import { CARDS } from "../cards/registry";
import { THEME_MANIFEST } from '../cards/projectCards';
import { resolvePalette, siteFont } from '../lib/palette';
import { setFilmPalette } from '../demosrc/_fixtures/skin';
import { themedBackground } from '../theme';
import { ClipBody, FilmContext, clipProps } from './clipBody';
import { setBrand } from "../demosrc/_fixtures/Brand";

export const MainComposition: React.FC<{ project: ProjectData }> = ({ project }) => {
  setBrand(project.brand);
  // A film with a theme (Themes tab / director) draws every recipe in that theme; older films keep the brand skin.
  if (project.themeId !== undefined) {
    const palette = resolvePalette(project.themeId, project.themeColors, undefined, project.sitePalette);
    const font = siteFont(project.brand?.font);
    setFilmPalette(palette && font ? { ...palette, font } : palette);
  }
  // UI 中 tracks[0] 是最上层轨 → 最后渲染（覆盖在上）
  const ordered = [...project.tracks].reverse();
  return (
    <FilmContext.Provider value={{ project, cards: CARDS }}>
    <AbsoluteFill style={{ background: themedBackground(project, THEME_MANIFEST) ?? "#0e0e10" }}>
      {ordered.map(
        (track) =>
          !track.hidden &&
          track.clips.map((clip) => {
            const card = CARDS[clip.cardId];
            if (!card) return null;
            const duration = Math.max(1, Math.round(clip.duration));
            // 音频卡：裁入/变速交给卡内 <Audio trimBefore playbackRate>，
            // 不能包 Freeze（会掐死原生播放），也无需图层包裹
            if (card.kind === "audio") {
              const Comp = card.component;
              return (
                <Sequence key={clip.id} from={clip.start} durationInFrames={duration}>
                  <Comp {...clipProps(project, card, clip)} inOffset={clip.inOffset} speed={clip.speed} />
                </Sequence>
              );
            }
            return (
              <Sequence key={clip.id} from={clip.start} durationInFrames={duration}>
                <ClipBody clip={clip} card={card} project={project} />
              </Sequence>
            );
          }),
      )}
    </AbsoluteFill>
    </FilmContext.Provider>
  );
};
