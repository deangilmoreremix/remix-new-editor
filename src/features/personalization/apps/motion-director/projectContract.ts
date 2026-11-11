/**
 * Motion Studio Entry Contract — maps Video Studio inputs + Personalization assets
 * to a Motion Studio ProjectData configuration.
 *
 * Reuses existing typed shapes from Video Studio and Personalization where possible.
 */

import type { ProjectData, TrackData, ClipData } from './types';
import { uid } from './types';
import { motionCardId, resolveMotionTemplate } from '../../data/motionRecipeCatalog';

/** Aspect ratios supported by Video Studio UI and Motion Studio */
export type AspectRatio = '16:9' | '9:16' | '1:1';

/** Personalization person shape — aligned to assets returned from personalization flow */
export interface PersonalizationPerson {
  businessName?: string;
  brandColors?: { primary?: string; secondary?: string; accent?: string; background?: string };
  logos?: { main?: string; light?: string; dark?: string };
  identities?: string[];
  products?: { name?: string; description?: string; images?: string[] }[];
  brandReferences?: string[];
  firstFrame?: string;
  lastFrame?: string;
  notes?: string;
}

/** Entry payload from the guided Motion Studio UI */
export interface MotionStudioEntry {
  /** Natural-language video description from Video Studio prompt field */
  description: string;
  /** Aspect ratio selector (matches VideoGenerate 16:9/9:16/1:1) */
  aspectRatio: AspectRatio;
  /** Duration in seconds (matches VideoGenerate duration control) */
  duration: number;
  /** Optional personalization context — populated when user clicks "Use My Brand" */
  person?: PersonalizationPerson;
  /** Selected ShotCraft recipe ID — populated when user chooses a motion design */
  recipeId?: string;
}

/** Convert aspect ratio to canonical pixel dimensions */
export const aspectRatioToDimensions = (ratio: AspectRatio): { width: number; height: number } => {
  switch (ratio) {
    case '16:9': return { width: 1280, height: 720 };
    case '9:16': return { width: 720, height: 1280 };
    case '1:1': return { width: 1080, height: 1080 };
  }
};

/** Generate a ProjectData name from description */
const nameFromDescription = (desc: string): string => {
  const words = desc.trim().split(/\s+/);
  return words.slice(0, 8).join(' ') || 'Motion Studio Project';
};

/** Create a Motion Studio ProjectData from an entry payload */
export const createProjectFromEntry = (entry: MotionStudioEntry): ProjectData => {
  const { width, height } = aspectRatioToDimensions(entry.aspectRatio);
  const fps = 30;
  const durationFrames = entry.duration * fps;

  const track: TrackData = {
    id: uid('track'),
    name: 'Shots',
    clips: [],
    hidden: false,
  };

  // If a recipe is selected, add an initial clip using that recipe.
  // The entry page hands over a CATALOG id (`<category>/<slug>/<Component>`),
  // but a clip needs a CARD id (`demo:<Stem>`) — an unmapped id makes
  // `CARDS[clip.cardId]` miss, and the composition then renders nothing.
  const template = entry.recipeId ? resolveMotionTemplate(entry.recipeId) : undefined;
  const cardId = template ? motionCardId(template) : entry.recipeId;
  if (cardId) {
    const clip: ClipData = {
      id: uid('clip'),
      cardId,
      start: 0,
      duration: durationFrames,
      inOffset: 0,
      speed: 1,
      opacity: 1,
      scale: 1,
      x: 0,
      y: 0,
      props: {
        description: entry.description,
        recipeId: entry.recipeId,
      },
    };
    track.clips.push(clip);
  }

  return {
    name: nameFromDescription(entry.description),
    fps,
    width,
    height,
    background: '#000000',
    tracks: [track],
    // Preserve entry metadata for downstream use (theming, personalization injection)
    // These are not part of the official ProjectData type but can be attached
    // via a wrapper or stored separately in localStorage.
  };
};

/** Legacy: maps entry to ProjectData with metadata attached as non-standard props */
export const entryToProjectData = (entry: MotionStudioEntry): ProjectData & { _entryMeta?: MotionStudioEntry } => {
  const project = createProjectFromEntry(entry);
  return { ...project, _entryMeta: entry };
};