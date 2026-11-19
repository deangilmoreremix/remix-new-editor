// src/lib/onboarding/toolCatalog.js
//
// What the onboarding tool picker shows: all 38 studios (src/lib/studioDirectory.js, the same list as the Apps page)
// with name, one-line description, image and link. Here: the goals, the "video type" -> recommended studios map used
// to sort the picker, and the helpers around them.
import { directoryByGroup } from '../studioDirectory.js';

/** The picker's menu: [{ title, items: [{ id, label, name, description, thumb, fallback, icon, group, href }] }].
 *  All 38 studios from the studio directory (src/lib/studioDirectory.js), grouped Discover / Image / Video / Agents / My Work. */
export function buildToolGroups() {
  return directoryByGroup().map((g) => ({
    title: g.title,
    items: g.items.map((s) => ({
      id: s.id,
      label: s.name,
      name: s.name,
      description: s.description,
      thumb: s.image,
      fallback: s.fallback,
      icon: s.icon,
      group: g.title,
      href: s.href,
    })),
  }));
}

export const toolIds = () => buildToolGroups().flatMap((g) => g.items.map((t) => t.id));

// Step 1: what the person wants to do (sets which video types are offered first).
export const GOAL_CARDS = Object.freeze([
  { id: 'ai-video', title: 'Create AI videos', text: 'Turn a prompt, an image or a script into a finished video.', tags: ['Text to video', 'Image to video'] },
  { id: 'images', title: 'Create and edit images', text: 'Generate, edit, upscale and brand images and product shots.', tags: ['Image Studio', 'Edit Studio'] },
  { id: 'personal', title: 'Personalised videos', text: 'Record once and send a version for every prospect, with their name and website.', tags: ['Video Outreach', 'Landing pages'] },
  { id: 'edit', title: 'Edit and polish footage', text: 'Cut, caption, enhance and finish videos you already have.', tags: ['Timeline', 'Video Tools'] },
  { id: 'marketing', title: 'Ads and marketing content', text: 'Product videos, social clips, landing pages and brand content.', tags: ['Product shots', 'Viral clips'] },
  { id: 'explore', title: 'Explore everything', text: 'See every tool and decide as you go.', tags: ['All tools'] },
]);

// Step 6a: the kind of video. Each lists the tools to put first (ids from NAV_GROUPS), best first.
export const VIDEO_TYPES = Object.freeze([
  { id: 'text-to-video', title: 'AI video from text or an image', text: 'Generate clips from a prompt or a still.', tools: ['video', 'cinema', 'animate', 'video-agent'] },
  { id: 'talking', title: 'Talking avatar or lip sync', text: 'Presenters, avatars and dubbed speech.', tools: ['avatar', 'lipsync', 'audio', 'character', 'influencer'] },
  { id: 'cinematic', title: 'Cinematic scenes and trailers', text: 'Camera control, storyboards and ready-made cinema templates.', tools: ['cinema', 'cinema-template', 'storyboard', 'zackd'] },
  { id: 'effects', title: 'Effects and VFX', text: 'Motion effects, camera moves and AI VFX.', tools: ['effects', 'ai-vfx', 'animate', 'videotools'] },
  { id: 'product', title: 'Product and ad videos', text: 'Product shots, brand content and ad creative.', tools: ['commercial', 'brand', 'video-agent', 'viral', 'find-my-brand'] },
  { id: 'outreach', title: 'Personalised outreach videos', text: 'One recording, a personal version per prospect.', tools: ['outreach', 'personalizer', 'video-pages', 'recorder', 'leadfinder', 'avatar', 'website-builder'] },
  { id: 'agent-edit', title: 'Let an agent make or edit it', text: 'Describe the video and let an AI agent build or cut it.', tools: ['video-agent', 'director', 'motion-director', 'workbench', 'timeline', 'render'] },
  { id: 'images', title: 'Images and photos', text: 'Generate, edit, upscale and brand pictures.', tools: ['image', 'edit', 'upscale', 'character', 'commercial', 'brand', 'influencer'] },
]);

// Which video types each goal puts first.
export const GOAL_TO_TYPES = Object.freeze({
  'ai-video': ['text-to-video', 'cinematic', 'talking', 'effects'],
  images: ['images', 'product'],
  personal: ['outreach', 'talking', 'agent-edit'],
  edit: ['agent-edit', 'effects', 'talking'],
  marketing: ['product', 'outreach', 'text-to-video'],
  explore: [],
});

/** Video types in display order for a goal: the goal's own first, then the rest. */
export function orderedVideoTypes(goal) {
  const first = GOAL_TO_TYPES[goal] || [];
  const byId = new Map(VIDEO_TYPES.map((t) => [t.id, t]));
  return [...first.map((id) => byId.get(id)).filter(Boolean), ...VIDEO_TYPES.filter((t) => !first.includes(t.id))];
}

/** Tool ids recommended for the chosen video types, in order, without repeats. */
export function recommendedTools(typeIds = []) {
  const known = new Set(toolIds());
  const out = [];
  typeIds.forEach((tid) => {
    (VIDEO_TYPES.find((t) => t.id === tid)?.tools || []).forEach((id) => { if (known.has(id) && !out.includes(id)) out.push(id); });
  });
  return out;
}
