import { POPCORN_ELEMENT_TYPES } from '../popcorn';

export const CLIP_EDITOR = 'CLIP EDITOR';

export const INITIAL_VALUES = {
  type: POPCORN_ELEMENT_TYPES.SEQUENCER,
};

export const regexpVideo360 = /vr360:\/\/(.)*\.(mp4|m3u8|mpd)/;

export const video360prefix = 'vr360://';

export const VIDEO_TYPES = {
  ADAPTIVE: 'Adaptive',
  VIDEO_360: 'Video360',
  YOUTUBE: 'YouTube',
  VIMEO: 'Vimeo',
  HTML: 'HTML5',
};

export const REGEX_MAP = {
  [VIDEO_TYPES.YOUTUBE]: /^(?:https?:\/\/www\.|https?:\/\/m\.|https?:\/\/|www\.|\.|^)youtu/,
  [VIDEO_TYPES.VIDEO_360]: regexpVideo360,
  [VIDEO_TYPES.ADAPTIVE]: /((.)*\.(mp4|m3u8|mpd)?)+\|((.)*\.(mp4|m3u8|mpd)\|?)+/,
  [VIDEO_TYPES.VIMEO]: /^(?:https?:\/\/www\.|https?:\/\/|www\.|\.|^)(vimeo\.com(\/[A-z0-9]*)+|player\.vimeo\.com\/video\/\d+)/,
  // supports #t=<start>,<duration>
  // where start or duration can be: X, X.X or XX:XX
  null: /^\s*#t=(?:\d*(?:(?:\.|:)?\d+)?),?(\d+(?:(?:\.|:)\d+)?)\s*$/,
};
