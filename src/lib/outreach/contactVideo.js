// src/lib/outreach/contactVideo.js
//
// One contact's finished video as an MP4 file: the published campaign drawn for that contact
// (their greeting, their website background) and rendered in the browser by the editor's
// sandboxed export runner. For sending the video as an attachment or posting it elsewhere.
import { contactProfile } from './draft.js';

const loaders = {
  fetchPublishedVideo: async (...a) => (await import('../editor/publish/publishClient.js')).fetchPublishedVideo(...a),
  buildViewerModel: async (...a) => (await import('../editor/publish/interactivePlayer.js')).buildViewerModel(...a),
  exportModel: async (...a) => (await import('../editor/remotion/exportClient.js')).exportModel(...a),
};

/** A safe file name for a contact's video. */
export function contactVideoName(campaignName, contact) {
  const who = [contact.firstName, contact.lastName].filter(Boolean).join('-') || contact.email || contact.id || 'contact';
  return `${String(campaignName || 'video')}-${who}`.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(0, 100);
}

/**
 * @returns {Promise<Blob>} MP4 (or WebM where MP4 can't be encoded)
 */
export async function renderContactVideo({ campaignId, contact, siteShots = {}, onProgress, signal, deps = {} }) {
  const d = { ...loaders, ...deps };
  const video = await d.fetchPublishedVideo(campaignId);
  if (!video?.project) throw new Error('The campaign video could not be loaded. Generate the campaign again.');
  const model = await d.buildViewerModel(video.project, contactProfile(contact, siteShots), { fps: 30, quality: '1080p' });
  try {
    return await d.exportModel(model, { container: 'mp4', quality: '1080p', onProgress, signal });
  } catch (err) {
    if (signal?.aborted) throw Object.assign(new Error('Stopped'), { name: 'AbortError' });
    // Browsers without an H.264 encoder can still make WebM.
    if (/codec|encode|support/i.test(String(err?.message))) return d.exportModel(model, { container: 'webm', quality: '1080p', onProgress, signal });
    throw err;
  }
}
