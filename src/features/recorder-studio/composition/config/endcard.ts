/**
 * Configure the social media channels that you can display in the endcard here.
 * and the links that you can show.
 */

import { z } from "zod";

// Recorder Studio: a single, user-editable channel (see setCustomBrand) replaces the
// template author's hard-coded accounts.
export const brand = z.enum(["custom"]);
export type Brand = z.infer<typeof brand>;

export const platform = z.enum([
  "youtube",
  "linkedin",
  "instagram",
  "discord",
  "x",
]);

export type Platform = z.infer<typeof platform>;

type ChannelConfig = { [key in Platform]: string | null };
export type ChannelConfigAndBusinessPage = ChannelConfig & {
  isLinkedInBusinessPage: boolean;
};

export const channels: {
  [key in Brand]: ChannelConfigAndBusinessPage;
} = {
  custom: {
    instagram: null,
    linkedin: null,
    x: null,
    youtube: null,
    discord: null,
    isLinkedInBusinessPage: false,
  },
};

const initialAvatar = (name: string) => {
  const letter = (name.trim()[0] ?? "?").toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#3B82EB"/><text x="128" y="128" font-family="Inter,Arial,sans-serif" font-size="128" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">${letter}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const avatars: { [key in Brand]: string } = {
  custom: initialAvatar(""),
};

export type CustomBrand = {
  handles: Partial<Record<Platform, string | null>>;
  isLinkedInBusinessPage?: boolean;
  avatarUrl?: string | null;
  displayName?: string;
};

export const setCustomBrand = ({ handles, isLinkedInBusinessPage, avatarUrl, displayName }: CustomBrand) => {
  for (const p of platform.options) {
    channels.custom[p] = handles[p] ? handles[p]!.trim() || null : null;
  }
  channels.custom.isLinkedInBusinessPage = Boolean(isLinkedInBusinessPage);
  avatars.custom =
    avatarUrl ||
    initialAvatar(displayName || Object.values(handles).find(Boolean) || "");
};

export const linkType = z.object({
  link: z.string(),
});

export type LinkType = z.infer<typeof linkType>;
