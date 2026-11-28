// [remix] Bring in a video made elsewhere (an uploaded file or an https link to a video file), publish it as a SmartVideo page and turn
// Retarget on for it. The viewer sections are typed as timestamps ("0:00 Intro"); each becomes a back-to-back clip of the same
// source, which is exactly what the Retarget "Map sections to interests" panel reads as scenes.
import { enableRetargetForVideo } from './project-link';
// @ts-expect-error plain JS
import * as pub from '../../../lib/editor/publish/publishClient.js';

export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // the storage upload gives up after 60 seconds, so keep files modest
export const MAX_SECONDS = 30 * 60;
// @ts-expect-error plain JS
import { MAX_SECTIONS as SHARED_MAX, parseSections as sharedParseSections, parseTimestamp as sharedParseTimestamp } from '../../../lib/editor/projectLibrary/sectionsText.js';

export const MAX_SECTIONS: number = SHARED_MAX;
export interface Section { title: string; start: number; end: number }
export const parseTimestamp = sharedParseTimestamp as (raw: string) => number | null;
export const parseSections = sharedParseSections as (text: string, duration: number) => { sections: Section[]; error?: string };

const PAGE_HOSTS = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|instagram\.com|facebook\.com|loom\.com|wistia\.com)$/i;

export function validateVideoUrl(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return 'Enter a full link, like https://example.com/video.mp4'; }
  if (u.protocol !== 'https:') return 'Use a link that starts with https://';
  if (PAGE_HOSTS.test(u.hostname)) return 'That is a video page, not a video file. Download the video and upload the file, or paste a direct link to an mp4 or webm file.';
  return null;
}

/** The classic project state the player and publish client understand: one video track, one clip per section. */
export function buildExternalProject({ src, title, duration, sections }: { src: string; title: string; duration: number; sections: Section[] }) {
  const parts = sections.length ? sections : [{ title: 'Video', start: 0, end: duration }];
  return {
    projectTitle: title, timelineSeconds: duration,
    tracks: [{ id: 'v', name: 'Video', type: 'video', items: parts.map((s, i) => ({ id: `s${i}`, name: s.title, type: 'video', src, start: s.start, end: s.end, trimIn: s.start, playbackRate: 1, volume: 1 })) }],
  };
}

/** Publish the video and turn Retarget on. Resolves to the published video id. */
export async function publishExternalVideo(client: unknown, input: { src: string; title: string; duration: number; sections: Section[] }): Promise<string> {
  if (!(input.duration > 0) || input.duration > MAX_SECONDS) throw new Error(`The video must be between 1 second and ${MAX_SECONDS / 60} minutes long`);
  const title = input.title.trim() || 'Untitled video';
  const project = pub.preparePublishProject(buildExternalProject({ ...input, title }), { title });
  const id = pub.makeSlug();
  await pub.publishVideo(client, { id, project });
  await enableRetargetForVideo(client as never, id);
  return id;
}
