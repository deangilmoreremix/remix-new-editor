import type { MotionPresetId } from './motionPreset';

/**
 * Upstream's finished film has music: a BGM from the library, the cuts snapped to its beat, mixed at 0.34
 * under the sound effects. When the person attaches no track, one of the library's licensed tracks is used,
 * chosen by the film's motion voice. (`bgm-tech-house` stays out: its licence is untraced. Not listened to
 * by ear: the pairing below is by each track's style, not by an audition.)
 */
export interface DefaultTrack {
  /** Path under public/, as the library's Sound tab uses it. */
  file: string;
  name: string;
  why: string;
}

const TRACKS: Record<string, DefaultTrack> = {
  'cat-walk': { file: 'motion-studio/bgmlib/cat-walk.mp3', name: 'cat-walk', why: 'an easy, steady groove' },
  'house-vibez': { file: 'motion-studio/bgmlib/house-vibez.mp3', name: 'house-vibez', why: 'a clean four-on-the-floor pulse' },
  'tonight-hiphop': { file: 'motion-studio/bgmlib/tonight-hiphop.mp3', name: 'tonight-hiphop', why: 'a hard-hitting beat' },
};

const BY_VOICE: Record<MotionPresetId, keyof typeof TRACKS> = {
  trust: 'house-vibez',
  premium: 'cat-walk',
  bold: 'tonight-hiphop',
  playful: 'house-vibez',
  calm: 'cat-walk',
  friendly: 'house-vibez',
};

export const defaultTrackFor = (voice: MotionPresetId): DefaultTrack => TRACKS[BY_VOICE[voice]];
