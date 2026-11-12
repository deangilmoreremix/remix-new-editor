import { describe, it, expect, vi } from 'vitest';
import {
  slugify, isValidSlug, publicUrl, fetchPublishedVideo, resolveRecipient, sanitizeRecipientVariables,
  setSlug, createRecipients, recipientsCsv, publishDraft, promoteRevision,
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

describe('slugs and public URLs', () => {
  it('slugifies business names and rejects reserved/invalid slugs', () => {
    expect(slugify('Smith Roofing & Sons!')).toBe('smith-roofing-sons');
    expect(slugify('  Café Ñandú ')).toBe('cafe-nandu');
    expect(slugify('!!!')).toBe('');
    expect(isValidSlug('smith-roofing')).toBe(true);
    expect(['watch', 'ab', 'Has Space', '-bad', 'api'].some(isValidSlug)).toBe(false);
  });

  it('builds /v/<slug>, campaign and recipient URLs; falls back to /watch/<id>', () => {
    const o = 'https://smartvid.app';
    const tok = 'a'.repeat(64);
    expect(publicUrl({ id: 'abcdefgh12' }, o)).toBe(`${o}/watch/abcdefgh12`);
    expect(publicUrl({ id: 'abcdefgh12', slug: 'smith-roofing' }, o)).toBe(`${o}/v/smith-roofing`);
    expect(publicUrl({ id: 'x', slug: 'smith-roofing', campaign: 'special-offer' }, o)).toBe(`${o}/v/smith-roofing/special-offer`);
    expect(publicUrl({ id: 'abcdefgh12', slug: 'smith-roofing', recipient: tok }, o)).toBe(`${o}/v/smith-roofing?recipient=${tok}`);
    expect(publicUrl({ id: 'abcdefgh12', recipient: 'short' }, o)).toBe(`${o}/watch/abcdefgh12`); // malformed token never goes in a URL
  });
});

describe('public reads', () => {
  const cfg = (fetchImpl) => ({ url: 'https://sb', key: 'anon', fetchImpl });
  it('loads by slug through the single-row RPC, not the table', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'vidAAAA1111', slug: 'smith-roofing', title: 'T', project: { tracks: [] }, revision: 2, canonical: 'smith-roofing' }) }));
    const v = await fetchPublishedVideo('smith-roofing', cfg(fetchImpl));
    expect(v).toMatchObject({ id: 'vidAAAA1111', revision: 2 });
    expect(fetchImpl.mock.calls.map((c) => c[0])).toContain('https://sb/rest/v1/rpc/get_published_video');
  });
  it('returns null for a missing slug and rejects malformed keys without a request', async () => {
    const miss = vi.fn(async () => ({ ok: true, json: async () => null }));
    expect(await fetchPublishedVideo('no-such-slug', cfg(miss))).toBeNull();
    const never = vi.fn();
    expect(await fetchPublishedVideo('../etc/passwd', cfg(never))).toBeNull();
    expect(never).not.toHaveBeenCalled();
  });
  it('resolves a recipient token, and gives null for bad/revoked tokens', async () => {
    const ok = vi.fn(async () => ({ ok: true, json: async () => ({ FIRSTNAME: 'John', logoUrl: 'https://cdn.test/a.png', evil: { x: 1 } }) }));
    const vars = await resolveRecipient('smith-roofing', 'a'.repeat(64), cfg(ok));
    expect(vars).toEqual({ FIRSTNAME: 'John', logoUrl: 'https://cdn.test/a.png' });
    expect(JSON.parse(ok.mock.calls[0][1].body)).toEqual({ p_video_id: 'smith-roofing', p_token: 'a'.repeat(64) });
    const none = vi.fn(async () => ({ ok: true, json: async () => null }));
    expect(await resolveRecipient('smith-roofing', 'b'.repeat(64), cfg(none))).toBeNull();
    const never = vi.fn();
    expect(await resolveRecipient('smith-roofing', "x' or 1=1 --", cfg(never))).toBeNull();
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
  it('setSlug validates locally and maps uniqueness errors', async () => {
    const eq = vi.fn(async () => ({ error: { code: '23505', message: 'duplicate key' } }));
    const client = { from: () => ({ update: () => ({ eq }) }) };
    await expect(setSlug(client, 'id', 'watch')).rejects.toThrow(/reserved|3-63/);
    await expect(setSlug(client, 'id', 'smith-roofing')).rejects.toThrow(/already taken/);
  });
  it('createRecipients sends sanitized rows and never a token (server generates it)', async () => {
    const select = vi.fn(async () => ({ data: [{ id: '1', token: 't'.repeat(64), label: 'Smith' }], error: null }));
    const insert = vi.fn(() => ({ select }));
    const out = await createRecipients({ from: () => ({ insert }) }, 'vid', [{ label: 'Smith', variables: { FIRSTNAME: 'John', logoUrl: 'blob:no' } }]);
    expect(insert.mock.calls[0][0][0]).toEqual({ video_id: 'vid', label: 'Smith', business_id: null, variables: { FIRSTNAME: 'John' }, expires_at: null });
    expect(insert.mock.calls[0][0][0]).not.toHaveProperty('token');
    expect(out[0].token).toHaveLength(64);
  });
  it('publishDraft numbers revisions and promote calls the RPC', async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const client = {
      from: (t) => (t === 'published_video_revisions' ? {
        select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [{ revision: 4 }], error: null }) }) }) }), insert,
      } : {}),
      rpc: vi.fn(async () => ({ error: null })),
    };
    expect(await publishDraft(client, { id: 'vid', project: {} })).toBe(5);
    expect(insert.mock.calls[0][0]).toMatchObject({ video_id: 'vid', revision: 5, kind: 'draft' });
    await promoteRevision(client, 'vid', 5);
    expect(client.rpc).toHaveBeenCalledWith('promote_video_revision', { p_video_id: 'vid', p_revision: 5 });
  });
  it('exports a CSV with URLs, no PII in the URL, and spreadsheet-formula protection', () => {
    const csv = recipientsCsv([{ label: '=HYPERLINK("x")', token: 'a'.repeat(64), status: 'active' }, { label: 'Wilson, Inc', token: 'b'.repeat(64), status: 'revoked' }], { id: 'vid', slug: 'smith-roofing', origin: 'https://smartvid.app' });
    const lines = csv.split('\n');
    expect(lines[0]).toBe('"name","url","status"');
    expect(lines[1]).toContain(`"'=HYPERLINK(""x"")"`);
    expect(lines[2]).toContain('"Wilson, Inc","https://smartvid.app/v/smith-roofing?recipient=' + 'b'.repeat(64));
    expect(lines[1]).not.toContain('Wilson');
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
