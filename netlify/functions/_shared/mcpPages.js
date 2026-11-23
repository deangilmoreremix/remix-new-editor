// Video Pages for the MCP: the app's own landing-page data layer (src/lib/landingPages/client.js) run with the key owner's identity.
// Every call goes through that code, so sanitizing, https-only video links and row-level security are exactly the app's.
import * as pages from '../../../src/lib/landingPages/client.js';
import { getTemplate, defaultConfig, applyTemplate, TEMPLATES } from '../../../src/lib/landingPages/templates.js';
import { ownerSupabase } from './ownerSupabase.js';

const ok = (data) => ({ statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
const err = (statusCode, message) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: { message } }) });
const ID = pages.PAGE_ID_RE;

export const PAGE_ACTIONS = {
  templates: 'read', list: 'read', get: 'read', stats: 'read', contacts: 'read',
  create: 'write', update: 'write', add_contacts: 'write',
  publish: 'publish', unpublish: 'write',
  delete: 'destructive', remove_contact: 'destructive',
};

export function createPagesStudio({ env = process.env, clientFor = (who) => ownerSupabase(who, env), origin = env.URL || '' } = {}) {
  return async function pagesStudio(body, who) {
    if (!who?.userId || who.userId === 'byok') return err(401, 'This needs a signed-in SmartVid MCP key.');
    const action = String(body?.action || '');
    if (!Object.hasOwn(PAGE_ACTIONS, action)) return err(400, `Unknown action "${action.slice(0, 40)}".`);
    if (action === 'templates') return ok({ templates: TEMPLATES.map((t) => ({ id: t.id, name: t.name, family: t.family })) });
    const id = body?.id;
    if (['get', 'update', 'publish', 'unpublish', 'delete', 'stats', 'contacts', 'add_contacts'].includes(action) && !ID.test(String(id || ''))) return err(400, 'A valid page id is required.');
    try {
      const client = await clientFor(who);
      switch (action) {
        case 'list': return ok({ pages: (await pages.listPages(client)).map((p) => ({ ...p, url: pages.pageUrl(p.id, origin) })) });
        case 'get': {
          const p = (await pages.listPages(client)).find((x) => x.id === id);
          return p ? ok({ page: { ...p, url: pages.pageUrl(p.id, origin), embed: pages.embedCode(p.id, origin) } }) : err(404, 'No such page.');
        }
        case 'create': {
          const t = body?.template ? getTemplate(body.template) : null;
          const config = body?.config ? (t ? applyTemplate(body.config, t.id) : body.config) : defaultConfig(t?.id || 'clean', { title: body?.title || '' });
          const page = await pages.createPage(client, { title: body?.title, videoUrl: body?.video_url, posterUrl: body?.poster_url, duration: body?.duration, source: { via: 'mcp' }, config });
          return ok({ page: { ...page, url: pages.pageUrl(page.id, origin) } });
        }
        case 'update': {
          const patch = {};
          if (body?.title !== undefined) patch.title = body.title;
          if (body?.config !== undefined) patch.config = body.config;
          if (body?.poster_url !== undefined) patch.posterUrl = body.poster_url;
          return ok({ page: await pages.updatePage(client, id, patch) });
        }
        case 'publish': case 'unpublish': {
          const page = await pages.setPagePublished(client, id, action === 'publish');
          return ok({ page: { ...page, url: pages.pageUrl(page.id, origin) } });
        }
        case 'delete': await pages.deletePage(client, id); return ok({ deleted: true });
        case 'stats': return ok({ stats: await pages.fetchPageStats(client, id), contacts: await pages.fetchContactStats(client, id) });
        case 'contacts': return ok({ contacts: await pages.listContacts(client, id) });
        case 'add_contacts': {
          const list = (Array.isArray(body?.contacts) ? body.contacts : []).slice(0, 500).map((c) => ({ fields: c && typeof c === 'object' ? c : {} }));
          return ok({ contacts: await pages.addContacts(client, id, list) });
        }
        case 'remove_contact': await pages.removeContact(client, String(body?.contact_id || '')); return ok({ removed: true });
        default: return err(400, 'Unknown action.');
      }
    } catch (e) {
      return err(e?.status || (/Sign in/.test(e?.message) ? 403 : 400), String(e?.message || 'Could not do that.').slice(0, 300));
    }
  };
}
