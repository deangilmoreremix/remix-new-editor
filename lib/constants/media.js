const AUDIO_CONTENT_TYPE = 'audio/*';
const VIDEO_CONTENT_TYPE = 'video/*';
const IMAGE_CONTENT_TYPE = 'image/*';
const JSON_CONTENT_TYPE = 'application/json';

export const ASSET_TYPES = {
  VIDEO: 'video',
  AUDIO: 'audio',
  IMAGE: 'image',
};

const ASSET_SCOPES = {
  LIBRARY: 'library',
  UPLOADS: 'uploads',
};

export const REMOTE_ASSET_TYPES = {
  VIDEOS: 'videos',
  AUDIOS: 'audios',
  IMAGES: 'images',
};


const ACCEPTED_MEDIA_TYPES = [
  AUDIO_CONTENT_TYPE,
  VIDEO_CONTENT_TYPE,
  IMAGE_CONTENT_TYPE,
  JSON_CONTENT_TYPE,
];

export default {
  AUDIO_CONTENT_TYPE,
  VIDEO_CONTENT_TYPE,
  IMAGE_CONTENT_TYPE,
  JSON_CONTENT_TYPE,
  ASSET_SCOPES,
  ACCEPTED_MEDIA_TYPES,
};

export const NOT_SUPPORTED_IMAGE_FORMAT = 'This image format is not supported.';

export const CANVAS_SIZES = [
  { width: 4, height: 5 },
  { width: 16, height: 9 },
  { width: 9, height: 16 },
  { width: 1, height: 1 },
];

export const IMAGE_FORMATS = [
  'image/jpeg',
  'image/png',
  'image/svg',
  'image/svg+xml',
];
