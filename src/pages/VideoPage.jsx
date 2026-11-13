/**
 * Public video landing page: /p/<slug>  (embed: /p/<slug>?embed=1)
 *
 * No app shell, no sign-in. Personalized links:
 *   /p/<slug>?c=<contactId>             tokens come from that contact's saved fields
 *   /p/<slug>?firstname=Ann&company=Acme  tokens come from the URL
 * (a contact's saved fields win over the URL). Viewer events (view, play,
 * 25/50/75% watched, complete, CTA click, lead) are recorded against the page
 * and, for personal links, the contact.
 */
import '../../styles/video-page.css';
import {
  fetchPublicPage, fetchContactTokens, recordPageEvent, submitPageLead, CONTACT_ID_RE,
} from '../lib/landingPages/client.js';
import { renderLandingPage } from '../lib/landingPages/render.js';
import { tokensFromQuery } from '../lib/landingPages/templates.js';

function message(container, title, text) {
  container.replaceChildren();
  const wrap = document.createElement('main');
  wrap.className = 'vp-message';
  const h1 = document.createElement('h1');
  h1.textContent = title;
  const p = document.createElement('p');
  p.textContent = text;
  wrap.append(h1, p);
  container.appendChild(wrap);
}

/**
 * @param {HTMLElement} container
 * @param {string} id
 * @param {object} deps (tests) { fetchPage, fetchTokens, recordEvent, submitLead }
 */
export async function mountVideoPage(container, id, deps = {}) {
  const params = new URLSearchParams(globalThis.location?.search || '');
  const embed = params.get('embed') === '1';
  document.documentElement.classList.add('vp-root');
  if (embed) document.documentElement.classList.add('vp-embed');
  message(container, 'Loading…', '');

  let page;
  try {
    page = await (deps.fetchPage || fetchPublicPage)(id);
  } catch (err) {
    message(container, 'Page unavailable', err?.message || 'Please try again later.');
    return null;
  }
  if (!page?.video_url) {
    message(container, 'Page not found', 'This page was removed or is no longer shared.');
    return null;
  }

  const rawContact = params.get('c');
  const contactId = rawContact && CONTACT_ID_RE.test(rawContact) ? rawContact : null;
  const fromUrl = tokensFromQuery(globalThis.location?.search || '');
  const fromContact = contactId ? await (deps.fetchTokens || fetchContactTokens)(page.id, contactId) : {};
  const tokens = { ...fromUrl, ...fromContact };

  document.title = page.title || 'Video';
  const track = (kind) => (deps.recordEvent || recordPageEvent)(page.id, { kind, contactId });
  const view = renderLandingPage({
    page,
    tokens,
    handlers: {
      onPlay: () => track('play'),
      onProgress: (kind) => track(kind),
      onComplete: () => track('complete'),
      onCta: () => track('cta_click'),
      onLike: () => track('like'),
      onLead: async (data) => {
        const res = await (deps.submitLead || submitPageLead)({ pageId: page.id, contactId, data });
        if (!res?.error) track('lead');
        return res;
      },
    },
  });

  container.replaceChildren(view.root);
  track('view');
  return view;
}
