/**
 * Template Generator — background music.
 *
 * The keyless source: the licensed tracks already bundled with the app (public/motion-studio/bgmlib). Only the three tracks the app marks as
 * licensed (motion-director/defaultMusic.ts) are offered. Each is far longer than a template, so the clip is trimmed to the cut length.
 */
export const MUSIC_TRACKS = [
  { id: 'cat-walk', name: 'Cat Walk', mood: 'Smooth, confident', url: '/motion-studio/bgmlib/cat-walk.mp3', duration: 124 },
  { id: 'house-vibez', name: 'House Vibez', mood: 'Upbeat, energetic', url: '/motion-studio/bgmlib/house-vibez.mp3', duration: 111 },
  { id: 'tonight-hiphop', name: 'Tonight', mood: 'Hip-hop, bold', url: '/motion-studio/bgmlib/tonight-hiphop.mp3', duration: 113 },
];

export const musicTrack = (id) => MUSIC_TRACKS.find((t) => t.id === id) || null;
