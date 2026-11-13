import { describe, it, expect, vi } from 'vitest';
import {
  slugify, isValidSlug, publicUrl, fetchPublishedVideo, resolveRecipient, sanitizeRecipientVariables,
  setSlug, claimBusinessSlug, createRecipients, recipientsCsv, publishDraft, promoteDraft, listDrafts, getDraftProject, deleteDraft,
  updateRecipientVariables, getMyVideo, getMyBusiness, listRevisions,
} from '../publishClient.js';
import { mountWatchPage } from '../../../../pages/WatchPage.jsx';

const T = 20;
const clipAt = (s, e, extra) => ({ left: (s / T) * 100, width: ((e - s) / T) * 100, ...extra });
const project = () => ({
  version: 1, title: 'Demo', timelineSeconds: T,
  tracks: [
    { id: 'v', type: 'video', items: [clipAt(0, 20, { id: 'vid', type: 'video', src: 'https://cdn/x.mp4' })] },
    { id: 't', type: 'text', items: [
      clipAt(1, 15, { id: 'txt', type: 'overlay-text', addon: { text: 'Hello {{FIRSTNAME}} from {{COMPANY}}', geometry: { left: 10, top: 10, width: 30, height: 10 } } }),
    ] },
  ],
});
function fakeEngine() {
  const e = { model: null };
  const create = (host, o) => { e.model = o.model; return { play() {}, pause() {}, seekToFrame() {}, update: (m) => { e.model = m; }, destroy: vi.fn() }; };
  return { e, create };
}
const mount = async (recipientQuery, deps) => {
  window.history.replaceState({}, '', `/v/smith-roofing${recipientQuery}`);
  const box = document.createElement('div'); document.body.appendChild(box);
  const { e, create } = fakeEngine();
  await mountWatchPage(box, 'vidAAAA1111', { fetchVideo: async () => ({ id: 'vidAAAA1111', title: 'Demo', project: project() }), createEngine: create, countView: vi.fn(), onLead: vi.fn(), recordEvent: vi.fn(), ...deps });
  return JSON.stringify(e.model);
};

describe('slugs and public URLs (live rules: /v/<business>/<slug>)', () => {
  it('slugifies names and validates like the database (3-48 chars, no "--", reserved words)', () => {
    expect(slugify('Smith Roofing & Sons!')).toBe('smith-roofing-sons');
    expect(slugify('  Café Ñandú ')).toBe('cafe-nandu');
    expect(slugify('!!!')).toBe('');
    expect(slugify('a'.repeat(80)).length).toBeLessThanOrEqual(48);
    expect(isValidSlug('smith-roofing')).toBe(true);
    expect(['watch', 'ab', 'Has Space', '-bad', 'bad-', 'a--b', 'api', 'smartvideo', 'v'].some(isValidSlug)).toBe(false);
  });

  it('builds /v/<business>/<slug> and recipient URLs; falls back to /watch/<id>', () => {
    const o = 'https://smartvid.app'; const tok = 'a'.repeat(64);
    expect(publicUrl({ id: 'abcdefgh12' }, o)).toBe(`${o}/watch/abcdefgh12`);
    expect(publicUrl({ id: 'abcdefgh12', business: 'smith-roofing' }, o)).toBe(`${o}/watch/abcdefgh12`);   // need both parts
    expect(publicUrl({ id: 'x', business: 'smith-roofing', slug: 'spring-offer' }, o)).toBe(`${o}/v/smith-roofing/spring-offer`);
    expect(publicUrl({ id: 'x', business: 'smith-roofing', slug: 'spring-offer', recipient: tok }, o)).toBe(`${o}/v/smith-roofing/spring-offer?recipient=${tok}`);
    expect(publicUrl({ id: 'abcdefgh12', recipient: 'short' }, o)).toBe(`${o}/watch/abcdefgh12`);          // malformed token never goes in a URL
    expect(publicUrl({ id: 'abcdefgh12', business: 'watch', slug: 'spring-offer' }, o)).toBe(`${o}/watch/abcdefgh12`); // reserved
  });
});

describe('public reads (live get_published_video)', () => {
  const cfg = (fetchImpl) => ({ url: 'https://sb', key: 'anon', fetchImpl });
  const rpc = (value, ok = true) => vi.fn(async () => ({ ok, status: ok ? 200 : 404, json: async () => value }));
  it('loads by business + slug through the RPC with the right parameters', async () => {
    const f = rpc({ id: 'vidAAAA1111', slug: 'spring-offer', business: 'smith-roofing', title: 'T', project: { tracks: [] }, revision: 2 });
    const v = await fetchPublishedVideo({ business: 'Smith-Roofing', slug: 'Spring-Offer' }, cfg(f));
    expect(v).toMatchObject({ id: 'vidAAAA1111', revision: 2 });
    expect(f.mock.calls[0][0]).toBe('https://sb/rest/v1/rpc/get_published_video');
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ p_business: 'smith-roofing', p_slug: 'spring-offer' });
  });
  it('loads a legacy id through the same RPC (private keys stripped by the database)', async () => {
    const f = rpc({ id: 'abcdefgh12', title: 'T', project: { tracks: [] } });
    expect((await fetchPublishedVideo('abcdefgh12', cfg(f))).id).toBe('abcdefgh12');
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ p_id: 'abcdefgh12' });
  });
  it('passes a rename redirect through so the page can move to the new address', async () => {
    const f = rpc({ redirect: { id: 'vidAAAA1111', business: 'smith-roofing', slug: 'new-name' } });
    expect(await fetchPublishedVideo({ business: 'smith-roofing', slug: 'old-name' }, cfg(f))).toEqual({ redirect: { id: 'vidAAAA1111', business: 'smith-roofing', slug: 'new-name' } });
  });
  it('returns null for missing/unpublished, rejects malformed refs without any request', async () => {
    expect(await fetchPublishedVideo({ business: 'a-b', slug: 'no-such' }, cfg(rpc(null)))).toBeNull();
    const never = vi.fn();
    for (const bad of ['../etc/passwd', 'short', { business: 'x', slug: 'y' }, { business: 'ok-name', slug: "a'; drop" }, null]) expect(await fetchPublishedVideo(bad, cfg(never))).toBeNull();
    expect(never).not.toHaveBeenCalled();
  });
  it('falls back to the table read by id when the RPC does not exist (older deployments), but not for slugs', async () => {
    const calls = [];
    const f = vi.fn(async (u) => { calls.push(u); return u.includes('/rpc/') ? { ok: false, status: 404, json: async () => ({}) } : { ok: true, json: async () => [{ id: 'abcdefgh12', project: { tracks: [] } }] }; });
    expect((await fetchPublishedVideo('abcdefgh12', cfg(f))).id).toBe('abcdefgh12');
    expect(calls[1]).toContain('/rest/v1/published_videos?id=eq.abcdefgh12&published=eq.true');
    await expect(fetchPublishedVideo({ business: 'smith-roofing', slug: 'spring-offer' }, cfg(f))).rejects.toThrow(/HTTP 404/);
  });
  it('resolves a recipient token, and gives null for bad/revoked tokens', async () => {
    const ok = vi.fn(async () => ({ ok: true, json: async () => ({ FIRSTNAME: 'John', logoUrl: 'https://cdn.test/a.png', evil: { x: 1 } }) }));
    const vars = await resolveRecipient('vidAAAA1111', 'a'.repeat(64), cfg(ok));
    expect(vars).toEqual({ FIRSTNAME: 'John', logoUrl: 'https://cdn.test/a.png' });
    expect(JSON.parse(ok.mock.calls[0][1].body)).toEqual({ p_video_id: 'vidAAAA1111', p_token: 'a'.repeat(64) });
    const none = vi.fn(async () => ({ ok: true, json: async () => null }));
    expect(await resolveRecipient('vidAAAA1111', 'b'.repeat(64), cfg(none))).toBeNull();
    const never = vi.fn();
    expect(await resolveRecipient('vidAAAA1111', "x' or 1=1 --", cfg(never))).toBeNull();
    expect(never).not.toHaveBeenCalled();
  });
});

describe('recipient variables', () => {
  it('keeps text, and image tokens only when they are durable http(s) URLs', () => {
    expect(sanitizeRecipientVariables({ FIRSTNAME: 'Ann', logoUrl: 'blob:http://x/1', productImageUrl: 'data:image/png;base64,AA', brandImageUrl: 'https://cdn.test/b.png', 'bad key': 'x', n: 5, o: { a: 1 } }))
      .toEqual({ FIRSTNAME: 'Ann', brandImageUrl: 'https://cdn.test/b.png', n: '5' });
  });
});

describe('owner operations', () => {
  it('setSlug / claimBusinessSlug call the live RPCs, validate locally and map their errors', async () => {
    const mk = (error) => ({ rpc: vi.fn(async () => ({ data: error ? null : 'spring-offer', error })) });
    const ok = mk(null);
    expect(await setSlug(ok, 'vid', ' Spring-Offer ')).toBe('spring-offer');
    expect(ok.rpc).toHaveBeenCalledWith('set_video_slug', { p_video_id: 'vid', p_slug: 'spring-offer' });
    await expect(setSlug(ok, 'vid', 'watch')).rejects.toThrow(/3-48/);
    await expect(setSlug(mk({ message: 'business_required' }), 'vid', 'spring-offer')).rejects.toThrow(/business link name first/);
    await expect(setSlug(mk({ code: '23505', message: 'slug_taken' }), 'vid', 'spring-offer')).rejects.toThrow(/already taken/);
    await expect(setSlug(mk({ code: '42501', message: 'not_found' }), 'vid', 'spring-offer')).rejects.toThrow(/owner/);
    const biz = mk(null);
    await claimBusinessSlug(biz, 'Smith-Roofing', 'Smith Roofing');
    expect(biz.rpc).toHaveBeenCalledWith('claim_business_slug', { p_slug: 'smith-roofing', p_display: 'Smith Roofing' });
    await expect(claimBusinessSlug(mk({ message: 'slug_taken', code: '23505' }), 'smith-roofing')).rejects.toThrow(/already taken/);
    await expect(claimBusinessSlug(biz, 'a--b')).rejects.toThrow(/3-48/);
  });
  it('reads the claimed business name, tolerating a project without the table', async () => {
    const good = { from: () => ({ select: () => ({ maybeSingle: async () => ({ data: { business_slug: 'smith-roofing' }, error: null }) }) }) };
    expect((await getMyBusiness(good)).business_slug).toBe('smith-roofing');
    const missing = { from: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'relation does not exist' } }) }) }) };
    expect(await getMyBusiness(missing)).toBeNull();
  });
  it('createRecipients sends sanitized rows and never a token (server generates it)', async () => {
    const select = vi.fn(async () => ({ data: [{ id: '1', token: 't'.repeat(64), label: 'Smith' }], error: null }));
    const insert = vi.fn(() => ({ select }));
    const out = await createRecipients({ from: () => ({ insert }) }, 'vid', [{ label: 'Smith', variables: { FIRSTNAME: 'John', logoUrl: 'blob:no' } }]);
    expect(insert.mock.calls[0][0][0]).toEqual({ video_id: 'vid', label: 'Smith', business_id: null, contact_ref: null, variables: { FIRSTNAME: 'John' }, expires_at: null });
    expect(insert.mock.calls[0][0][0]).not.toHaveProperty('token');
    expect(out[0].token).toHaveLength(64);
  });
  it('chunks large batches, keeps the contact ref, and maps a duplicate-contact error', async () => {
    const calls = [];
    const insert = vi.fn((rows) => { calls.push(rows.length); return { select: async () => ({ data: rows.map((r, i) => ({ id: String(i), token: 't', label: r.label, contact_ref: r.contact_ref })), error: null }) }; });
    const rows = Array.from({ length: 250 }, (_, i) => ({ label: `P${i}`, contactRef: `c${i}`, variables: {} }));
    const out = await createRecipients({ from: () => ({ insert }) }, 'vid', rows);
    expect(calls).toEqual([100, 100, 50]);
    expect(out).toHaveLength(250);
    expect(insert.mock.calls[0][0][7].contact_ref).toBe('c7');
    const dup = { from: () => ({ insert: () => ({ select: async () => ({ data: null, error: { code: '23505', message: 'duplicate' } }) }) }) };
    await expect(createRecipients(dup, 'vid', [{ contactRef: 'c1' }])).rejects.toThrow(/already have an active link/);
  });
  it('updates one recipient with sanitized variables only', async () => {
    const eq = vi.fn(async () => ({ error: null })); const update = vi.fn(() => ({ eq }));
    await updateRecipientVariables({ from: () => ({ update }) }, 'r1', { logoUrl: 'blob:no', brandImageUrl: 'https://cdn/b.png', FIRSTNAME: 'Ann' });
    expect(update).toHaveBeenCalledWith({ variables: { brandImageUrl: 'https://cdn/b.png', FIRSTNAME: 'Ann' } });
    expect(eq).toHaveBeenCalledWith('id', 'r1');
  });
  it('getMyVideo falls back when the slug/revision columns are not installed', async () => {
    let n = 0;
    const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => (++n === 1 ? { data: null, error: { message: 'column published_videos.slug does not exist' } } : { data: { id: 'v' }, error: null }) }) }) }) };
    expect(await getMyVideo(client, 'v')).toEqual({ id: 'v' });
    expect(n).toBe(2);
  });
  it('saves, lists, loads, promotes and discards drafts (the live link is only touched by promote)', async () => {
    const insert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: { id: 'd1' }, error: null }) }) }));
    const order = vi.fn(async () => ({ data: [{ id: 'd1', title: 'T', created_at: 'x' }], error: null }));
    const maybeSingle = vi.fn(async () => ({ data: { project: { tracks: [] } }, error: null }));
    const del = vi.fn(async () => ({ error: null }));
    const client = {
      from: (t) => { expect(t).toBe('published_video_drafts'); return { insert, select: (cols) => ({ eq: (k) => (k === 'video_id' ? { order } : { maybeSingle }) }), delete: () => ({ eq: del }) }; },
      rpc: vi.fn(async () => ({ data: 7, error: null })),
    };
    expect(await publishDraft(client, { id: 'vid', project: { title: 'P', tracks: [] }, title: 'Spring v2' })).toBe('d1');
    expect(insert.mock.calls[0][0]).toMatchObject({ video_id: 'vid', title: 'Spring v2' });
    expect(await listDrafts(client, 'vid')).toHaveLength(1);
    expect(await getDraftProject(client, 'd1')).toEqual({ tracks: [] });
    expect(await promoteDraft(client, 'd1')).toBe(7);
    expect(client.rpc).toHaveBeenCalledWith('promote_video_draft', { p_draft_id: 'd1' });
    await deleteDraft(client, 'd1');
    expect(del).toHaveBeenCalledWith('id', 'd1');
  });
  it('maps a failed promote to a sign-in message and lists the history without bodies', async () => {
    await expect(promoteDraft({ rpc: async () => ({ data: null, error: { message: 'JWT expired' } }) }, 'd1')).rejects.toThrow(/Sign in/);
    const order = vi.fn(async () => ({ data: [{ revision: 2, title: 'T', created_at: 'x' }], error: null }));
    const sel = vi.fn(() => ({ eq: () => ({ order }) }));
    expect(await listRevisions({ from: () => ({ select: sel }) }, 'vid')).toHaveLength(1);
    expect(sel.mock.calls[0][0]).not.toMatch(/project/);
  });
  it('exports a CSV with URLs, no PII in the URL, and spreadsheet-formula protection', () => {
    const csv = recipientsCsv([{ label: '=HYPERLINK("x")', token: 'a'.repeat(64), status: 'active' }, { label: 'Wilson, Inc', token: 'b'.repeat(64), status: 'revoked' }], { id: 'vid', business: 'smith-roofing', slug: 'spring-offer', origin: 'https://smartvid.app' });
    const lines = csv.split('\n');
    expect(lines[0]).toBe('"name","url","status"');
    expect(lines[1]).toContain(`"'=HYPERLINK(""x"")"`);
    expect(lines[2]).toContain('"Wilson, Inc","https://smartvid.app/v/smith-roofing/spring-offer?recipient=' + 'b'.repeat(64));
    expect(lines[1]).not.toContain('Wilson');
  });
});

describe('renamed links', () => {
  it('moves to the new address and loads the video by id, keeping ?recipient=', async () => {
    window.history.replaceState({}, '', `/v/smith-roofing/old-name?recipient=${'a'.repeat(64)}`);
    const box = document.createElement('div'); document.body.appendChild(box);
    const { create } = fakeEngine();
    const calls = [];
    const fetchVideo = vi.fn(async (ref) => { calls.push(ref); return typeof ref === 'string' ? { id: 'vidAAAA1111', title: 'Demo', project: project() } : { redirect: { id: 'vidAAAA1111', business: 'smith-roofing', slug: 'new-name' } }; });
    await mountWatchPage(box, { business: 'smith-roofing', slug: 'old-name' }, { fetchVideo, createEngine: create, countView: vi.fn(), recordEvent: vi.fn(), onLead: vi.fn(), resolveRecipient: async () => ({ FIRSTNAME: 'John' }) });
    expect(calls).toEqual([{ business: 'smith-roofing', slug: 'old-name' }, 'vidAAAA1111']);
    expect(window.location.pathname).toBe('/v/smith-roofing/new-name');
    expect(window.location.search).toBe(`?recipient=${'a'.repeat(64)}`);
    expect(box.querySelector('h1').textContent).toBe('Demo');
  });
  it('shows "not found" for an unknown link', async () => {
    const box = document.createElement('div');
    expect(await mountWatchPage(box, { business: 'x-y', slug: 'nope' }, { fetchVideo: async () => null })).toBeNull();
    expect(box.textContent).toContain('Video not found');
  });
});

describe('player personalization by recipient token', () => {
  const tokenA = 'a'.repeat(64); const tokenB = 'b'.repeat(64);
  const resolver = async (_id, t) => ({ [tokenA]: { FIRSTNAME: 'John', COMPANY: 'Smith Roofing' }, [tokenB]: { FIRSTNAME: 'Sarah', COMPANY: 'Johnson Construction' } }[t] || null);

  it('shows each recipient only their own text from the same source video', async () => {
    const a = await mount(`?recipient=${tokenA}`, { resolveRecipient: resolver });
    const b = await mount(`?recipient=${tokenB}`, { resolveRecipient: resolver });
    expect(a).toContain('Hello John from Smith Roofing');
    expect(a).not.toContain('Sarah'); expect(a).not.toContain('Johnson');
    expect(b).toContain('Hello Sarah from Johnson Construction');
    expect(b).not.toContain('John from');
  });
  it('a revoked/unknown token shows the generic video with no raw {{tokens}}', async () => {
    const m = await mount(`?recipient=${'c'.repeat(64)}`, { resolveRecipient: resolver });
    expect(m).not.toContain('{{'); expect(m).not.toContain('John');
  });
  it('ignores query-string values when a recipient token is present (no spoofing)', async () => {
    const m = await mount(`?recipient=${tokenA}&firstname=Mallory&company=Evil`, { resolveRecipient: resolver });
    expect(m).toContain('Hello John from Smith Roofing');
    expect(m).not.toContain('Mallory'); expect(m).not.toContain('Evil');
  });
});

import { resolveCtaField, personalizeCta, ctaElement, linkBoxElement } from '../viewerOverlays.js';

describe('recipient-specific call and link destinations', () => {
  const A = { variables: { businessPhone: '+15551230001', website: 'https://smith.example/', COMPANY: 'Smith Roofing' } };
  const B = { variables: { businessPhone: '+15551230002', website: 'https://wilson.example/', COMPANY: 'Wilson Plumbing' } };

  it('fills a phone number and a website from each recipient, never the other\'s', () => {
    const cta = { id: 'c', type: 'click-to-call', linkMode: 'phone', phoneNumber: '{{businessPhone}}', buttonText: 'Call {{COMPANY}}' };
    const a = ctaElement(personalizeCta(cta, A)); const b = ctaElement(personalizeCta(cta, B));
    expect(a.getAttribute('href')).toBe('tel:+15551230001');
    expect(b.getAttribute('href')).toBe('tel:+15551230002');
    expect(a.getAttribute('aria-label')).toContain('Call Smith Roofing');
    const link = { id: 'l', type: 'overlay-text', addon: { text: 'Visit {{COMPANY}}', linkMode: 'url', linkUrl: '{{website}}' } };
    expect(linkBoxElement(personalizeCta(link, A)).getAttribute('href')).toBe('https://smith.example/');
    expect(linkBoxElement(personalizeCta(link, B)).getAttribute('href')).toBe('https://wilson.example/');
  });

  it('drops a destination whose token has no value (no button, no raw token, no wrong link)', () => {
    expect(resolveCtaField('{{website}}', { variables: {} })).toBe('');
    expect(resolveCtaField('{{d website "https://fallback.example/"}}', { variables: {} })).toBe('https://fallback.example/');
    const cta = { id: 'c', type: 'click-to-call', linkMode: 'phone', phoneNumber: '{{businessPhone}}' };
    expect(ctaElement(personalizeCta(cta, { variables: {} }))).toBeNull();
    expect(ctaElement(personalizeCta(cta, null))).toBeNull();
  });

  it('does not mutate the master clip and leaves plain destinations alone', () => {
    const cta = { id: 'c', type: 'click-to-call', linkMode: 'url', linkUrl: 'https://static.example/', buttonText: 'Go' };
    const copy = JSON.parse(JSON.stringify(cta));
    expect(personalizeCta(cta, A).linkUrl).toBe('https://static.example/');
    expect(cta).toEqual(copy);
  });
});
