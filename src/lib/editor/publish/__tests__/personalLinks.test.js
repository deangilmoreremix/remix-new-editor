import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../../addons/index.js';
import {
  listPersonalLinks, syncPersonalLinks, updatePersonalLink, regeneratePersonalLink, deletePersonalLink,
  sanitizeOverrides, effectiveVariables, personalLinksMissing,
} from '../personalLinksClient.js';
import { profileFromLink, profileFromQuery, fetchPersonalization, personalizedUrl, personalLinkIdFromQuery } from '../publishClient.js';
import { personalLink, personalVariables } from '../../personalize/perContact.js';
import { renderSharePanel } from '../sharePanel.js';
import { mountWatchPage } from '../../../../pages/WatchPage.jsx';

// A tiny in-memory stand-in for the supabase-js query builder (only what personalLinksClient uses).
function fakeClient(initial = [], { failWith = null } = {}) {
  const rows = initial.map((r) => ({ ...r }));
  const result = (data) => ({ data, error: failWith });
  const builder = (filters = [], op = 'select', payload = null) => {
    const run = () => {
      if (failWith) return result(null);
      const match = rows.filter((r) => filters.every(([c, v]) => r[c] === v));
      if (op === 'insert') { rows.push(...payload.map((p) => ({ revoked: false, overrides: {}, variables: {}, created_at: '2026-11-15', updated_at: '2026-11-15', ...p }))); return result(null); }
      if (op === 'update') { match.forEach((r) => Object.assign(r, payload)); return result(match[0] || null); }
      if (op === 'delete') { filters.length && match.forEach((r) => rows.splice(rows.indexOf(r), 1)); return result(null); }
      return result(match);
    };
    const b = {
      eq: (c, v) => builder([...filters, [c, v]], op, payload),
      order: () => b,
      select: () => b,
      maybeSingle: () => Promise.resolve(run()),
      then: (res, rej) => Promise.resolve(run()).then(res, rej),
    };
    return b;
  };
  return {
    rows,
    from: () => ({
      select: () => builder([], 'select'),
      insert: (p) => builder([], 'insert', p),
      update: (p) => builder([], 'update', p),
      delete: () => builder([], 'delete'),
    }),
  };
}

let n = 0;
const ids = () => `gen${String(++n).padStart(17, '0')}`; // 20 chars
const row = (o) => ({ id: 'a'.repeat(20), video_id: 'vid0000001', contact_id: 'c-ann', name: 'Ann', variables: { firstName: 'Ann' }, overrides: {}, revoked: false, created_at: '2026-11-14', updated_at: '2026-11-14', ...o });

describe('personal link owner client', () => {
  it('creates a link per contact, refreshes changed details and leaves unchanged ones alone', async () => {
    const client = fakeClient([row()]);
    const r1 = await syncPersonalLinks(client, 'vid0000001', [
      { contactId: 'c-ann', name: 'Ann', variables: { firstName: 'Ann' } },
      { contactId: 'c-bob', name: 'Bob', variables: { firstName: 'Bob' } },
    ], { makeId: ids });
    expect(r1).toMatchObject({ created: 1, updated: 0 });
    expect(r1.links.map((l) => l.contactId)).toEqual(['c-ann', 'c-bob']);
    expect(r1.links[1].id).toHaveLength(20);
    const r2 = await syncPersonalLinks(client, 'vid0000001', [{ contactId: 'c-ann', name: 'Ann Lee', variables: { firstName: 'Ann', company: 'Acme' } }], { makeId: ids });
    expect(r2).toMatchObject({ created: 0, updated: 1 });
    expect(r2.links.find((l) => l.contactId === 'c-ann').variables.company).toBe('Acme');
  });

  it('keeps the owner\'s edits when details are re-synced, and edits win', async () => {
    const client = fakeClient([row({ overrides: { firstName: 'Annie' } })]);
    const r = await syncPersonalLinks(client, 'vid0000001', [{ contactId: 'c-ann', name: 'Ann', variables: { firstName: 'Ann', company: 'Acme' } }]);
    const link = r.links[0];
    expect(link.overrides).toEqual({ firstName: 'Annie' });
    expect(effectiveVariables(link)).toEqual({ firstName: 'Annie', company: 'Acme' });
  });

  it('edits values, turns a link off and on, and refuses values a link cannot carry', async () => {
    const client = fakeClient([row()]);
    const id = 'a'.repeat(20);
    expect((await updatePersonalLink(client, id, { overrides: { firstName: ' Annie ', offer: '10% off', empty: '  ' } })).overrides).toEqual({ firstName: 'Annie', offer: '10% off' });
    expect((await updatePersonalLink(client, id, { revoked: true })).revoked).toBe(true);
    expect((await updatePersonalLink(client, id, { revoked: false })).revoked).toBe(false);
    await expect(updatePersonalLink(client, id, { overrides: { logoUrl: 'data:image/png;base64,xx' } })).rejects.toThrow(/https/);
    await expect(updatePersonalLink(client, 'z'.repeat(20), { revoked: true })).rejects.toThrow(/no longer exists/);
  });

  it('gives a link a new address and removes links', async () => {
    const client = fakeClient([row({ revoked: true, overrides: { firstName: 'Annie' } })]);
    const next = await regeneratePersonalLink(client, 'a'.repeat(20), { makeId: () => 'N'.repeat(20) });
    expect(next).toMatchObject({ id: 'N'.repeat(20), revoked: false, overrides: { firstName: 'Annie' } });
    await deletePersonalLink(client, 'N'.repeat(20));
    expect(await listPersonalLinks(client, 'vid0000001')).toEqual([]);
  });

  it('sanitizes overrides', () => {
    expect(sanitizeOverrides({ firstName: 'A', 'bad key!': 'x', logoUrl: 'https://cdn.test/l.png', productImageUrl: 'javascript:alert(1)' })).toEqual({
      overrides: { firstName: 'A', logoUrl: 'https://cdn.test/l.png' }, rejected: ['bad key!', 'productImageUrl'],
    });
  });

  it('reports a database without the personal-links update as unavailable', async () => {
    const client = fakeClient([], { failWith: { message: 'relation "public.video_personalizations" does not exist' } });
    await expect(listPersonalLinks(client, 'vid0000001')).rejects.toMatchObject({ code: 'links_unavailable' });
    expect(personalLinksMissing({ message: 'Could not find the table in the schema cache', code: 'PGRST205' })).toBe(true);
    expect(personalLinksMissing({ message: 'permission denied' })).toBe(false);
  });
});

describe('viewer side of a personal link', () => {
  it('rebuilds the profile from stored values, like the address form', () => {
    const p = profileFromLink({ contactId: 'c-ann', variables: { firstName: 'Ann', logoUrl: 'https://cdn.test/l.png', logoUrl__f: '40,60', note: 'x'.repeat(400) } });
    expect(p.id).toBe('c-ann');
    expect(p.variables.firstName).toBe('Ann');
    expect(p.variables.note).toHaveLength(400); // stored values are not cut at 200
    expect(p.personalization.assets.savedReferences[0]).toMatchObject({ url: 'https://cdn.test/l.png', focus: { x: 40, y: 60 } });
    expect(profileFromLink({ variables: {} })).toBeNull();
  });

  it('personalVariables is what the address form carries', () => {
    const profile = { id: 'c-ann', contact: { firstName: 'Ann' }, variables: { firstName: 'Ann' } };
    const vars = personalVariables(profile, ['firstName', 'company']);
    expect(vars).toEqual({ firstName: 'Ann' });
    const url = new URL(personalLink('https://app.test/watch/x', profile, ['firstName']));
    expect(url.searchParams.get('c')).toBe('c-ann');
    expect(url.searchParams.get('firstName')).toBe('Ann');
    expect(profileFromQuery('?c=c-ann&firstName=Ann&p=zzz').variables).toEqual({ firstName: 'Ann' });
  });

  it('reads ?p= and builds the address', () => {
    expect(personalLinkIdFromQuery(`?p=${'A'.repeat(20)}&embed=1`)).toBe('A'.repeat(20));
    expect(personalLinkIdFromQuery('?p=short')).toBeNull();
    expect(personalizedUrl({ id: 'abc12345XY' }, 'L'.repeat(20), 'https://app.test')).toBe(`https://app.test/watch/abc12345XY?p=${'L'.repeat(20)}`);
    expect(personalizedUrl({ id: 'abc12345XY', business: 'acme', slug: 'promo' }, 'L'.repeat(20), 'https://app.test')).toBe(`https://app.test/v/acme/promo?p=${'L'.repeat(20)}`);
  });

  it('fetches a link through the RPC and treats a bad id or an empty answer as no link', async () => {
    const post = vi.fn(async () => ({ ok: true, json: async () => ({ videoId: 'abc12345XY', contactId: 'c-ann', variables: { firstName: 'Ann' } }) }));
    const got = await fetchPersonalization('P'.repeat(20), { url: 'https://sb', key: 'anon', fetchImpl: post });
    expect(got.contactId).toBe('c-ann');
    expect(post.mock.calls[0][0]).toBe('https://sb/rest/v1/rpc/get_personalization');
    expect(JSON.parse(post.mock.calls[0][1].body)).toEqual({ p_id: 'P'.repeat(20) });
    expect(await fetchPersonalization('nope', { url: 'https://sb', key: 'anon', fetchImpl: post })).toBeNull();
    expect(post).toHaveBeenCalledTimes(1);
    expect(await fetchPersonalization('P'.repeat(20), { url: 'https://sb', key: 'k', fetchImpl: async () => ({ ok: true, json: async () => null }) })).toBeNull();
  });
});

// ---------------------------------------------------------------- the watch page
const T = 20;
const project = () => ({
  version: 1, title: 'Demo', timelineSeconds: T,
  tracks: [
    { id: 'v', type: 'video', items: [{ left: 0, width: 100, id: 'vid', type: 'video', src: 'https://cdn/x.mp4' }] },
    { id: 't', type: 'text', items: [{ left: 0, width: 100, id: 'txt', type: 'overlay-text', addon: { text: 'Hello {{firstName}}', geometry: { left: 10, top: 10, width: 30, height: 10 } } }] },
  ],
  listBuilder: null,
});
function engineFactory() {
  const e = { model: null };
  return { e, create: (host, o) => { e.model = o.model; return { play() {}, pause() {}, seekToFrame() {}, update: (m) => { e.model = m; }, destroy() {} }; } };
}
const LINK = 'K'.repeat(20);

describe('watch page with a personal link', () => {
  let box;
  beforeEach(() => {
    document.body.innerHTML = '';
    box = document.createElement('div');
    document.body.appendChild(box);
  });
  const open = (search, deps) => {
    globalThis.history.replaceState(null, '', `/watch/abcdefgh12${search}`);
    return mountWatchPage(box, 'abcdefgh12', { fetchVideo: async () => ({ id: 'abcdefgh12', title: 'Demo', project: project() }), analytics: { track: vi.fn(), onPlayerChange: vi.fn(), destroy: vi.fn() }, onLead: vi.fn(), ...deps });
  };

  it('personalizes from the stored values, ignoring values typed into the address', async () => {
    const { e, create } = engineFactory();
    const fetchPersonalization = vi.fn(async () => ({ videoId: 'abcdefgh12', contactId: 'c-ann', variables: { firstName: 'Ann' } }));
    const player = await open(`?p=${LINK}&firstName=Mallory`, { createEngine: create, fetchPersonalization });
    expect(fetchPersonalization).toHaveBeenCalledWith(LINK);
    expect(e.model.layers.find((l) => l.id === 'txt').options.text).toBe('Hello Ann');
    player.destroy();
  });

  it('does not play a revoked, unknown or other-video link', async () => {
    const { create } = engineFactory();
    expect(await open(`?p=${LINK}`, { createEngine: create, fetchPersonalization: async () => null })).toBeNull();
    expect(box.textContent).toContain('no longer active');
    expect(await open(`?p=${LINK}`, { createEngine: create, fetchPersonalization: async () => ({ videoId: 'someoneelse', variables: {} }) })).toBeNull();
    expect(box.textContent).toContain('no longer active');
  });

  it('says so (not "revoked") when the service cannot be reached', async () => {
    const { create } = engineFactory();
    expect(await open(`?p=${LINK}`, { createEngine: create, fetchPersonalization: async () => { throw new Error('Could not load this personal link (HTTP 503)'); } })).toBeNull();
    expect(box.textContent).toContain('Video unavailable');
    expect(box.textContent).toContain('HTTP 503');
  });

  it('still takes details from the address when there is no ?p=', async () => {
    const { e, create } = engineFactory();
    const fetchPersonalization = vi.fn();
    const player = await open('?c=c-ann&firstName=Ann', { createEngine: create, fetchPersonalization });
    expect(fetchPersonalization).not.toHaveBeenCalled();
    expect(e.model.layers.find((l) => l.id === 'txt').options.text).toBe('Hello Ann');
    player.destroy();
  });
});

// ---------------------------------------------------------------- the share panel
describe('share panel: stored personal links', () => {
  let host;
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const info = { id: 'abcdefgh12', title: 'Demo', published: true, view_count: 0 };
  const link = (o) => ({ id: 'L'.repeat(20), contactId: 'c-ann', name: 'Ann Lee', variables: { firstName: 'Ann', businessName: 'Acme' }, overrides: {}, revoked: false, ...o });
  beforeEach(() => { document.body.innerHTML = ''; host = document.createElement('div'); document.body.appendChild(host); });

  function panel(links, extra = {}) {
    return renderSharePanel(host, {
      getInfo: async () => info, publish: vi.fn(), setPublished: vi.fn(), countLeads: async () => 0, copy: vi.fn(async () => {}), downloadCsv: vi.fn(),
      links: { list: vi.fn(async () => links), sync: vi.fn(async () => ({ links, created: 1, updated: 0 })), update: vi.fn(async (id, patch) => ({ ...links[0], ...patch })), regenerate: vi.fn(async () => ({})), remove: vi.fn(async () => {}), tokens: () => ['firstName', 'businessName'], label: (k) => k, contact: () => ({ email: 'ann@x.test', company: 'Acme' }) },
      ...extra,
    });
  }

  it('lists links and copies the personal address', async () => {
    const copy = vi.fn(async () => {});
    panel([link()], { copy });
    await tick(); await tick();
    expect(host.textContent).toContain('Ann Lee');
    host.querySelector('[data-link-copy]').click();
    await tick();
    expect(copy).toHaveBeenCalledWith(`https://app.test/watch/abcdefgh12?p=${'L'.repeat(20)}`.replace('https://app.test', globalThis.location.origin));
  });

  it('edits what a link shows: only changed fields are saved as the link\'s own values; reset clears them', async () => {
    const links = [link()];
    const lk = { list: vi.fn(async () => links), sync: vi.fn(), update: vi.fn(async (id, patch) => ({ ...links[0], ...patch })), regenerate: vi.fn(), remove: vi.fn(), tokens: () => ['firstName', 'businessName'], label: (k) => k };
    renderSharePanel(host, { getInfo: async () => info, publish: vi.fn(), setPublished: vi.fn(), countLeads: async () => 0, copy: vi.fn(), downloadCsv: vi.fn(), links: lk });
    await tick(); await tick();
    host.querySelector('[data-link-edit]').click();
    expect(host.querySelector('[data-link-field="businessName"]').value).toBe('Acme');
    host.querySelector('[data-link-field="firstName"]').value = 'Annie';
    host.querySelector('[data-link-save]').click();
    await tick(); await tick();
    expect(lk.update).toHaveBeenCalledWith('L'.repeat(20), { overrides: { firstName: 'Annie' } });
    expect(host.textContent).toContain('Saved');
    host.querySelector('[data-link-edit]').click();
    host.querySelector('[data-link-reset]').click();
    await tick(); await tick();
    expect(lk.update).toHaveBeenLastCalledWith('L'.repeat(20), { overrides: {} });
  });

  it('asks twice before giving a link a new address or removing it, and can turn a link off', async () => {
    const links = [link()];
    const lk = { list: vi.fn(async () => links), sync: vi.fn(), update: vi.fn(async (id, patch) => ({ ...links[0], ...patch })), regenerate: vi.fn(async () => ({})), remove: vi.fn(async () => {}), tokens: () => [], label: (k) => k };
    renderSharePanel(host, { getInfo: async () => info, publish: vi.fn(), setPublished: vi.fn(), countLeads: async () => 0, copy: vi.fn(), downloadCsv: vi.fn(), links: lk });
    await tick(); await tick();
    host.querySelector('[data-link-new]').click();
    await tick();
    expect(lk.regenerate).not.toHaveBeenCalled();
    expect(host.querySelector('[data-link-new]').textContent).toContain('Sure');
    host.querySelector('[data-link-new]').click();
    await tick(); await tick();
    expect(lk.regenerate).toHaveBeenCalledWith('L'.repeat(20));
    host.querySelector('[data-link-revoke]').click();
    await tick(); await tick();
    expect(lk.update).toHaveBeenCalledWith('L'.repeat(20), { revoked: true });
    host.querySelector('[data-link-remove]').click();
    await tick();
    expect(lk.remove).not.toHaveBeenCalled();
    host.querySelector('[data-link-remove]').click();
    await tick(); await tick();
    expect(lk.remove).toHaveBeenCalledWith('L'.repeat(20));
  });

  it('falls back to the older address links until the database update is installed', async () => {
    renderSharePanel(host, {
      getInfo: async () => info, publish: vi.fn(), setPublished: vi.fn(), countLeads: async () => 0, copy: vi.fn(), downloadCsv: vi.fn(),
      personalLinks: (l) => [{ name: 'Ann', email: 'a@x', company: '', link: `${l}?c=c-ann` }],
      links: { list: async () => { throw Object.assign(new Error('needs update'), { code: 'links_unavailable' }); } },
    });
    await tick(); await tick();
    expect(host.textContent).toContain('database update');
    expect(host.querySelector('[data-share-personal]')).not.toBeNull();
  });
});
