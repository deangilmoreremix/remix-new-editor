import { describe, it, expect, afterEach } from 'vitest';
import handle, { ROUTES } from '../website-builder-api.mts';

const call = (path, init) => handle(new Request(`https://smartvid.app${path}`, init));

describe('website-builder-api adapter', () => {
  afterEach(() => { delete ROUTES.echo; });

  it('answers unknown routes with 404 JSON, not the SPA page', async () => {
    const res = await call('/openthorn/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });

  it('does not treat inherited object keys as routes', async () => {
    expect((await call('/openthorn/api/constructor')).status).toBe(404);
    expect((await call('/openthorn/api/__proto__')).status).toBe(404);
  });

  it('routes to the real handlers (method check, then auth)', async () => {
    const get = await call('/openthorn/api/deploy');
    expect(get.status).toBe(405);
    const noToken = await call('/openthorn/api/deploy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: 'p', html: '<p/>' }),
    });
    expect(noToken.status).toBe(401);
  });

  it('passes method, lower-cased headers, parsed JSON body and url to the handler', async () => {
    let seen;
    ROUTES.echo = (req, res) => { seen = req; res.status(201).setHeader('X-Test', '1'); res.json({ ok: true }); };
    const res = await call('/openthorn/api/echo?a=1', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: '{"x":2}',
    });
    expect(res.status).toBe(201);
    expect(res.headers.get('x-test')).toBe('1');
    expect(await res.json()).toEqual({ ok: true });
    expect(seen.method).toBe('POST');
    expect(seen.headers.authorization).toBe('Bearer t');
    expect(seen.body).toEqual({ x: 2 });
    expect(seen.url).toBe('/openthorn/api/echo?a=1');
    expect(seen.query).toEqual({ a: '1' });
    expect(seen.headers['x-app-base-path']).toBe('/openthorn');
    expect(seen.headers.host).toBe('smartvid.app');
  });

  it('supports redirects via Location + end()', async () => {
    ROUTES.echo = (_req, res) => { res.setHeader('Location', 'https://example.com/x'); res.status(302).end(); };
    const res = await call('/openthorn/api/echo');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://example.com/x');
  });

  it('turns a throwing or silent handler into a 500 instead of hanging', async () => {
    ROUTES.echo = () => { throw new Error('boom'); };
    expect((await call('/openthorn/api/echo')).status).toBe(500);
    ROUTES.echo = () => {};
    expect((await call('/openthorn/api/echo')).status).toBe(500);
  });
});
