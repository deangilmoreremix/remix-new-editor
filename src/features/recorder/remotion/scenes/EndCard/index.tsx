import React from "react";
import { AbsoluteFill } from "remotion";
import type { Brand, ChannelProfile, LinkType, Platform } from "../../../config/endcard";
import type { CanvasLayout } from "../../../config/layout";
import type { Theme } from "../../../config/themes";
import { COLORS } from "../../../config/themes";
import { LeftSide } from "./LeftSide";
import { ThumbnailContainers } from "./RightSide";

export const EndCard: React.FC<{
  channel: Brand;
  profile?: ChannelProfile;
  canvasLayout: CanvasLayout;
  platform: Platform;
  links: LinkType[];
  theme: Theme;
}> = ({ canvasLayout, platform, channel, profile, links, theme }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS[theme].BACKGROUND,
      }}
    >
      <LeftSide
        theme={theme}
        links={links}
        channel={channel}
        profile={profile}
        platform={platform}
      />
      {canvasLayout === "landscape" ? (
        <ThumbnailContainers theme={theme} />
      ) : null}
    </AbsoluteFill>
  );
};
