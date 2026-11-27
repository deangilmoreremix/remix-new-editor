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
