const AUDIO = 'audio';
const VIDEO = 'video';
const IMAGE = 'image';

const AUDIO_CONTENT_TYPE = 'audio/*';
const VIDEO_CONTENT_TYPE = 'video/*';
const IMAGE_CONTENT_TYPE = 'image/*';

const ASSET_TYPES = {
  VIDEOS: 'videos',
  AUDIOS: 'audios',
  IMAGES: 'images',
};

const ASSET_SCOPES = {
  LIBRARY: 'LIBRARY',
  UPLOADS: 'UPLOADS',
};

const ACCEPTED_MEDIA_TYPES = [AUDIO_CONTENT_TYPE, VIDEO_CONTENT_TYPE, IMAGE_CONTENT_TYPE];

export default {
  AUDIO,
  VIDEO,
  IMAGE,
  AUDIO_CONTENT_TYPE,
  VIDEO_CONTENT_TYPE,
  IMAGE_CONTENT_TYPE,
  ASSET_SCOPES,
  ASSET_TYPES,
  ACCEPTED_MEDIA_TYPES,
};
