/**
 * "Get link" for a studio result.
 *
 *   const r = await getLink({ url, kind: 'video', title: 'Spring promo' });
 *   // -> { fileUrl, kind, reused, watchUrl, canonicalUrl, pageError }
 *
 * 1. Copies the result into OUR storage (copyToStorage) -> a permanent direct file URL. Images and audio stop here.
 * 2. Videos also get a page: a one-clip /watch/<id> published through the same code as the Timeline editor, plus the
 *    readable /v/<business>/<slug> address when a signed-in owner has a business name.
 * Idempotent: the same owner + same result gives the same file and the same /watch id; clicks while one is running
 * share the running one. The file link is returned even when the page link fails (pageError says why).
 */
import { preparePublishProject, publishVideo, getMyBusiness, setVideoSlug, slugify, validateSlug, canonicalUrl, watchUrl } from '../editor/publish/publishClient.js';
import { copyToStorage } from './copyToStorage.js';
import { buildMinimalProject } from './minimalProject.js';
import { probeVideo } from './probeVideo.js';
import { createLinkCache } from './linkCache.js';
import { stableId, canonicalSource } from './ids.js';
import { getPublishOwnerClient, getOwnerKey, isSignedIn } from './ownerClient.js';

export class LinkError extends Error {
  constructor(code, message) { super(message); this.name = 'LinkError'; this.code = code; }
}

const inflight = new Map();
let sharedCache = null;
const defaultCache = () => (sharedCache ||= createLinkCache());

/** A person-readable message for a failed page publish. */
export function pageErrorMessage(err) {
  const text = String(err?.message || err || '');
  if (/guest_limit_videos/i.test(text)) return 'Guests can publish up to 10 videos. Sign in to publish more. Your file link still works.';
  if (/sign in/i.test(text) || /jwt|row-level|permission/i.test(text)) return 'Sign in to create a page link. Your file link still works.';
  return `The page link could not be created (${text.slice(0, 120) || 'unknown error'}). Your file link still works.`;
}

async function readableAddress({ client, id, title }) {
  const { business } = await getMyBusiness(client).catch(() => ({ business: null }));
  if (!business) return null;
  const base = slugify(title, 'video').slice(0, 40).replace(/-+$/g, '') || 'video';
  for (const suffix of [id.slice(-4), id.slice(-7)]) {
    const slug = `${base}-${suffix}`;
    if (validateSlug(slug)) continue;
    try { await setVideoSlug(client, id, slug); return canonicalUrl({ id, business, slug }); } catch (err) { if (!/taken/i.test(err?.message || '')) return null; }
  }
  return null;
}

/**
 * @param {object} o { url, kind, title, durationHint, deps } - deps are for tests:
 *   { ownerKey, copy, getClient, signedIn, probe, cache }
 */
export async function getLink({ url, kind = 'video', title = 'Untitled video', durationHint, deps = {} } = {}) {
  if (!url) throw new LinkError('no_url', 'There is no result to link yet.');
  const ownerKey = deps.ownerKey || await getOwnerKey();
  const source = canonicalSource(url);
  const key = stableId(`${ownerKey}|${source}`);
  if (inflight.has(key)) return inflight.get(key);

  const run = async () => {
    const cache = deps.cache || defaultCache();
    const cached = cache.get(key);
    let fileUrl = cached?.fileUrl || null;
    let finalKind = cached?.kind || kind;
    let reused = !!fileUrl;
    if (!fileUrl) {
      const copy = await (deps.copy || copyToStorage)(source, { kind, ownerKey });
      fileUrl = copy.fileUrl;
      finalKind = copy.kind || kind;
      reused = !!copy.reused;
      cache.set(key, { fileUrl, kind: finalKind });
    }
    const result = { fileUrl, kind: finalKind, reused, watchUrl: null, canonicalUrl: null, pageError: null };
    if (finalKind !== 'video') return result;

    const id = `v${stableId(`${ownerKey}|${source}|page`)}`;
    if (cached?.watchId) {
      return { ...result, watchUrl: watchUrl(cached.watchId), canonicalUrl: cached.canonical || null };
    }
    try {
      const probe = durationHint ? { duration: durationHint } : await (deps.probe || probeVideo)(fileUrl);
      if (!probe?.duration) throw new Error('the video could not be read to build a page');
      const client = await (deps.getClient || getPublishOwnerClient)();
      const project = preparePublishProject(buildMinimalProject({ fileUrl, title, durationSec: probe.duration, width: probe.width, height: probe.height }), { title });
      await publishVideo(client, { id, project });
      const address = (deps.signedIn ?? isSignedIn)() ? await readableAddress({ client, id, title }) : null;
      cache.set(key, { watchId: id, canonical: address });
      return { ...result, watchUrl: watchUrl(id), canonicalUrl: address };
    } catch (err) {
      return { ...result, pageError: pageErrorMessage(err) };
    }
  };

  const promise = run().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}
