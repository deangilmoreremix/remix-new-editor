// Save a picture or video to the user's storage and return { url }. The one upload used by the picker, the content tray and the editor's fields.
import { uploadFileToSupabase } from '../uploadService.js';
import { getClerkUserId } from '../supabase.js';
import { MAX_VIDEO_BYTES } from './ingest.js';

export const MAX_PICTURE_BYTES = 15 * 1048576; // the picker's picture limit

export function uploadMedia(file) {
  const isVideo = String(file?.type || '').startsWith('video/');
  return uploadFileToSupabase(file, { category: isVideo ? 'video' : 'image', maxSize: isVideo ? MAX_VIDEO_BYTES : MAX_PICTURE_BYTES, userId: getClerkUserId() || undefined });
}
