const AUDIO_CONTENT_TYPE = 'audio/*';
const VIDEO_CONTENT_TYPE = 'video/*';
const IMAGE_CONTENT_TYPE = 'image/*';

const ASSET_TYPES = {
  VIDEO: 'video',
  AUDIO: 'audio',
  IMAGE: 'image',
};

const ASSET_SCOPES = {
  LIBRARY: 'LIBRARY',
  UPLOADS: 'UPLOADS',
};

const ACCEPTED_MEDIA_TYPES = [AUDIO_CONTENT_TYPE, VIDEO_CONTENT_TYPE, IMAGE_CONTENT_TYPE];

export default {
  AUDIO_CONTENT_TYPE,
  VIDEO_CONTENT_TYPE,
  IMAGE_CONTENT_TYPE,
  ASSET_SCOPES,
  ASSET_TYPES,
  ACCEPTED_MEDIA_TYPES,
};

export const NOT_SUPPORTED_IMAGE_FORMAT = 'This image format is not supported.';
