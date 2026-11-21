/**
 * Configure the social media channels that you can display in the endcard here.
 * and the links that you can show.
 */

import { staticFile } from "remotion";
import { z } from "zod";

// TODO: 1. Replace with your own channels (e.g personal and company)
// "custom" (added for the browser studio) uses the scene's own `profile`.
export const brand = z.enum(["custom", "jonny", "remotion"]);
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

export const channelProfile = z.object({
  avatar: z.string().default(""),
  youtube: z.string().nullable().default(null),
  linkedin: z.string().nullable().default(null),
  instagram: z.string().nullable().default(null),
  discord: z.string().nullable().default(null),
  x: z.string().nullable().default(null),
  isLinkedInBusinessPage: z.boolean().default(false),
});
export type ChannelProfile = z.infer<typeof channelProfile>;

export const channels: {
  [key in Exclude<Brand, "custom">]: ChannelConfigAndBusinessPage;
} = {
  // TODO: 2. Fill out the socials
  jonny: {
    instagram: null,
    linkedin: "Jonny Burger",
    x: "@JNYBGR",
    youtube: "/JonnyBurger",
    discord: null,
    isLinkedInBusinessPage: false,
  },
  remotion: {
    instagram: "@remotion",
    linkedin: "Remotion",
    x: "@remotion",
    youtube: "@remotion_dev",
    discord: null,
    isLinkedInBusinessPage: true,
  },
};

// TODO: 3. Add your own avatars
export const avatars: { [key in Exclude<Brand, "custom">]: string } = {
  jonny: "https://www.jonny.io/avatar.png",
  remotion: staticFile("recorder/remotion.png"),
};

export const linkType = z.object({
  link: z.string(),
});

export type LinkType = z.infer<typeof linkType>;

export const getChannel = (
  channel: Brand,
  profile?: ChannelProfile | null,
): ChannelConfigAndBusinessPage => {
  if (channel !== "custom") return channels[channel];
  const { avatar: _avatar, ...rest } = channelProfile.parse(profile ?? {});
  return rest;
};

export const getAvatar = (channel: Brand, profile?: ChannelProfile | null) =>
  channel === "custom" ? (profile?.avatar ?? "") : avatars[channel];
