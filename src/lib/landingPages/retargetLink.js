// A landing page embeds a raw video address, so on its own it has no viewer analytics and nothing for Retarget to read. This gives the page's
// video a published-video record (the same record /watch/<id> uses) and a Retarget project row, and remembers its id on the page
// (`source.videoId`), so plays on /p/<slug> are recorded against that video and the page shows up in Analytics and Retarget.
import { buildMinimalProject } from '../resultActions/minimalProject.js';
import { preparePublishProject, publishVideo, makeSlug, setPublished, setVideoPrivacy } from '../editor/publish/publishClient.js';

export const VIDEO_ID_RE = /^[A-Za-z0-9_-]{8,32}$/;

/** The published-video id stored on a landing page, or null. */
export const pageVideoId = (page) => (VIDEO_ID_RE.test(String(page?.source?.videoId || '')) ? page.source.videoId : null);

/**
 * Publish the page's video as its own record (hidden until the page itself is published, and unlisted so search engines do not index
 * /watch/<id>) and turn Retarget on for it. Best effort: resolves to the video id, or null when it cannot be done (no known length,
 * a picture-only page, a guest, an error). The page works either way.
 */
export async function publishPageVideo(client, { videoUrl, title, duration, link = null }) {
  if (!(Number(duration) > 0)) return null;
  try {
    const project = preparePublishProject(buildMinimalProject({ fileUrl: videoUrl, title, durationSec: duration }), { title });
    const id = makeSlug();
    await publishVideo(client, { id, project });
    await setPublished(client, id, false); // follows the page: shown only once the page is published
    await setVideoPrivacy(client, id, 'unlisted').catch(() => {});
    await (link || (await import('../../cinegen/lib/leads/project-link.ts')).enableRetargetForVideo)(client, id).catch(() => {});
    return id;
  } catch { return null; }
}

/** Keep the page's video in step with the page: published when the page is, hidden when it is not. */
export async function mirrorPublished(client, page, published) {
  const id = pageVideoId(page);
  if (!id) return;
  try { await setPublished(client, id, !!published); } catch { /* the page itself is already saved */ }
}

/** The video's length in seconds, read in the browser (null when it cannot be read in a few seconds). */
export function readVideoDuration(url, documentImpl = globalThis.document) {
  if (!documentImpl) return Promise.resolve(null);
  return new Promise((resolve) => {
    const v = documentImpl.createElement('video');
    const timer = setTimeout(() => resolve(null), 6000);
    v.preload = 'metadata';
    v.onloadedmetadata = () => { clearTimeout(timer); resolve(Number.isFinite(v.duration) ? v.duration : null); };
    v.onerror = () => { clearTimeout(timer); resolve(null); };
    v.src = url;
  });
}

/**
 * The owner replaced the page's video: keep the linked record about the video the page really shows. Rebuilds the record's project
 * for the new address (the old section mapping described the old video, so it goes). When the new video's length cannot be read the
 * record is hidden and detached instead, so plays are never counted against the wrong video. Best effort, never throws.
 */
export async function refreshPageVideo(client, page, { readDuration = readVideoDuration } = {}) {
  const id = pageVideoId(page);
  if (!id || !/^https:\/\//i.test(String(page?.video_url || ''))) return;
  try {
    const { data: current } = await client.from('published_videos').select('project').eq('id', id).maybeSingle();
    const shown = current?.project?.tracks?.[0]?.items?.[0]?.src;
    if (shown === page.video_url) return; // the same video: nothing to do
    const duration = await readDuration(page.video_url);
    if (duration > 0) {
      const title = page.title || 'Untitled page';
      const project = preparePublishProject(buildMinimalProject({ fileUrl: page.video_url, title, durationSec: duration }), { title });
      await client.from('published_videos').update({ project, title: project.title }).eq('id', id);
    } else {
      await setPublished(client, id, false);
      const { videoId: _gone, ...rest } = page.source || {};
      await client.from('landing_pages').update({ source: rest }).eq('id', page.id);
    }
  } catch { /* the page itself is already saved */ }
}

/**
 * A page made before Retarget was linked to landing pages: give its video a tracked record now, the same way a new page gets one,
 * and remember it on the page. Throws a readable message when it cannot be done. Resolves to the page with its new `source.videoId`.
 */
export async function linkExistingPage(client, page, { publish = publishPageVideo, readDuration = readVideoDuration } = {}) {
  if (pageVideoId(page)) return page;
  if (!/^https:\/\//i.test(String(page?.video_url || '')) || IMAGE_URL.test(String(page.video_url))) throw new Error('Retarget is for pages with a video. This page shows a picture.');
  const duration = Number(page.duration) > 0 ? Number(page.duration) : await readDuration(page.video_url);
  const videoId = await publish(client, { videoUrl: page.video_url, title: page.title, duration });
  if (!videoId) throw new Error('Retarget could not be set up for this video. Check that you are signed in and the video link still works.');
  const source = { ...(page.source && typeof page.source === 'object' ? page.source : {}), videoId };
  const { error } = await client.from('landing_pages').update({ source }).eq('id', page.id);
  if (error) throw new Error(error.message || 'Could not save the link to the page');
  const linked = { ...page, source };
  await mirrorPublished(client, linked, !!page.published); // a published page shows its video record too
  return linked;
}

const IMAGE_URL = /\.(png|jpe?g|webp|gif|avif)(?:[?#]|$)/i;
