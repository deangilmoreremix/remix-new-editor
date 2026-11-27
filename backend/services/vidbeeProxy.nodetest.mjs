import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { installVidBee, isAllowed, isSameOriginMutation, userKey } from './vidbeeProxy.js';

describe('vidbee gate allowlist', () => {
  it('without an allowlist, opens to every signed-in user only when libraries are private (VIDBEE_PER_USER=1)', () => {
    assert.equal(isAllowed({ id: 'u1' }, { NODE_ENV: 'production', VIDBEE_PER_USER: '1' }), true);
    assert.equal(isAllowed({ id: 'u1' }, { NODE_ENV: 'production' }), false);
    assert.equal(isAllowed({ id: 'u1' }, { NODE_ENV: 'development' }), true);
  });
  it('matches user id or email case-insensitively', () => {
    const env = { NODE_ENV: 'production', VIDBEE_ALLOWED_USERS: 'U1, Admin@X.com' };
    assert.equal(isAllowed({ id: 'u1' }, env), true);
    assert.equal(isAllowed({ id: 'z', email: 'admin@x.com' }, env), true);
    assert.equal(isAllowed({ id: 'other', email: 'o@x.com' }, env), false);
    assert.equal(isAllowed(undefined, env), false);
  });
});

/** Send one real HTTP request to an app and return the status and lower-cased headers. */
const request = (app, method, path, headers) =>
  new Promise((resolve, reject) => {
    const server = http.createServer(app).listen(0, '127.0.0.1', () => {
      const req = http.request({ host: '127.0.0.1', port: server.address().port, method, path, headers }, (res) => {
        res.resume();
        res.on('end', () => server.close(() => resolve({ status: res.statusCode, headers: res.headers })));
      });
      req.on('error', reject);
      req.end();
    });
  });

const preflight = { Origin: 'https://app.example.com', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization' };

describe('vidbee gate CORS order', () => {
  const auth = (req, res, next) => next();

  it('answers the session preflight with credentialed CORS (cookie can be set cross-origin)', async () => {
    const app = express();
    installVidBee(app, { auth, cors: cors() });
    const { status, headers } = await request(app, 'OPTIONS', '/api/vidbee/session', preflight);
    assert.equal(status, 204);
    assert.equal(headers['access-control-allow-origin'], 'https://app.example.com');
    assert.equal(headers['access-control-allow-credentials'], 'true');
  });

  it('leaves the rest of the app on the global CORS handler', async () => {
    const app = express();
    installVidBee(app, { auth, cors: cors() });
    app.get('/other', (req, res) => res.json({ ok: true }));
    const { headers } = await request(app, 'GET', '/other', { Origin: 'https://app.example.com' });
    assert.equal(headers['access-control-allow-origin'], '*');
    assert.equal(headers['access-control-allow-credentials'], undefined);
  });

  it('the old order (global cors first) would block it: no credentials header', async () => {
    const app = express();
    app.use(cors());
    // what the code did before installVidBee existed
    const { createVidBeeRouters } = await import('./vidbeeProxy.js');
    app.use('/api/vidbee', createVidBeeRouters({ auth }).session);
    const { headers } = await request(app, 'OPTIONS', '/api/vidbee/session', preflight);
    assert.equal(headers['access-control-allow-credentials'], undefined);
    assert.equal(headers['access-control-allow-origin'], '*');
  });
});

describe('vidbee proxy cross-site protection', () => {
  const req = (method, headers) => ({ method, headers });
  it('blocks a cross-site POST', () => {
    assert.equal(isSameOriginMutation(req('POST', { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example', host: 'api.example.com' })), false);
    assert.equal(isSameOriginMutation(req('POST', { origin: 'https://evil.example', host: 'api.example.com' })), false);
    assert.equal(isSameOriginMutation(req('POST', { origin: 'null', host: 'api.example.com' })), false);
  });
  it('allows VidBee\'s own pages and reads', () => {
    assert.equal(isSameOriginMutation(req('POST', { 'sec-fetch-site': 'same-origin', host: 'api.example.com' })), true);
    assert.equal(isSameOriginMutation(req('POST', { origin: 'https://api.example.com', host: 'api.example.com' })), true);
    assert.equal(isSameOriginMutation(req('POST', { origin: 'https://api.example.com', 'x-forwarded-host': 'api.example.com', host: 'internal:3000' })), true);
    assert.equal(isSameOriginMutation(req('GET', { 'sec-fetch-site': 'cross-site' })), true);
  });
});

describe('vidbee gate error responses', () => {
  const auth = (req, res, next) => next();
  it('shows the iframe a reconnect page when the session cookie is missing or expired', async () => {
    const app = express();
    installVidBee(app, { auth, cors: cors() });
    const page = await request(app, 'GET', '/vidbee/', { 'Sec-Fetch-Dest': 'iframe', Accept: 'text/html' });
    assert.equal(page.status, 401);
    assert.match(page.headers['content-type'], /text\/html/);
    const api = await request(app, 'GET', '/vidbee/api/tasks', { 'Sec-Fetch-Dest': 'empty', Accept: 'application/json' });
    assert.equal(api.status, 401);
    assert.match(api.headers['content-type'], /text\/plain/);
  });
  it('flags API calls (not the page) for reconnect when the session is gone', async () => {
    const app = express();
    installVidBee(app, { auth, cors: cors() });
    const api = await request(app, 'POST', '/vidbee/ipc/invoke', { 'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Site': 'same-origin' });
    assert.equal(api.status, 401);
    assert.equal(api.headers['x-smartvid-reconnect'], '1');
    const page = await request(app, 'GET', '/vidbee/', { 'Sec-Fetch-Dest': 'iframe' });
    assert.equal(page.headers['x-smartvid-reconnect'], undefined);
  });
  it('flags API calls for reconnect when the VidBee service is down (502), but not blocked cross-site calls', async () => {
    const prevUrl = process.env.VIDBEE_WEB_URL;
    const prevEnv = process.env.NODE_ENV;
    // a port nothing listens on
    const closed = await new Promise((resolve) => { const s = http.createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
    process.env.VIDBEE_WEB_URL = `http://127.0.0.1:${closed}`;
    process.env.NODE_ENV = 'development';
    try {
      const app = express();
      installVidBee(app, { auth: (req, res, next) => { req.user = { id: 'u1' }; next(); }, cors: cors() });
      const session = await request(app, 'POST', '/api/vidbee/session', {});
      assert.equal(session.status, 200);
      const cookie = String(session.headers['set-cookie']).split(';')[0];
      const api = await request(app, 'GET', '/vidbee/api/tasks', { Cookie: cookie, 'Sec-Fetch-Dest': 'empty' });
      assert.equal(api.status, 502);
      assert.equal(api.headers['x-smartvid-reconnect'], '1');
      const page = await request(app, 'GET', '/vidbee/', { Cookie: cookie, 'Sec-Fetch-Dest': 'iframe' });
      assert.equal(page.status, 502);
      assert.match(page.headers['content-type'], /text\/html/);
      assert.equal(page.headers['x-smartvid-reconnect'], undefined);
      const blocked = await request(app, 'POST', '/vidbee/ipc/invoke', { Cookie: cookie, 'Sec-Fetch-Site': 'cross-site' });
      assert.equal(blocked.status, 403);
      assert.equal(blocked.headers['x-smartvid-reconnect'], undefined);
    } finally {
      if (prevUrl === undefined) delete process.env.VIDBEE_WEB_URL; else process.env.VIDBEE_WEB_URL = prevUrl;
      if (prevEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prevEnv;
    }
  });
  it('escapes the page text and only adds the button when asked', async () => {
    const { errorPage } = await import('./vidbeeProxy.js');
    const html = errorPage('<x>', 'a & b');
    assert.match(html, /&lt;x&gt;/);
    assert.match(html, /a &amp; b/);
    assert.doesNotMatch(html, /Reconnect<\/button>/);
    // The reconnect message goes only to the embedding app's origin; without one there is no button.
    const withOrigin = errorPage('t', 'd', { reconnect: true, parentOrigin: 'https://smartvid.app' });
    assert.match(withOrigin, /smartviddownloader:reconnect/);
    assert.match(withOrigin, /data-origin="https:\/\/smartvid\.app"/);
    assert.doesNotMatch(withOrigin, /'\*'/);
    assert.doesNotMatch(errorPage('t', 'd', { reconnect: true }), /Reconnect<\/button>/);
  });
  it('accepts only a plain http(s) origin as ?parent=', async () => {
    const { parentOriginOf } = await import('./vidbeeProxy.js');
    const q = (parent) => ({ query: { parent } });
    assert.equal(parentOriginOf(q('https://smartvid.app')), 'https://smartvid.app');
    assert.equal(parentOriginOf(q('http://localhost:3100')), 'http://localhost:3100');
    assert.equal(parentOriginOf(q('https://smartvid.app/path')), null);
    assert.equal(parentOriginOf(q('javascript:alert(1)')), null);
    assert.equal(parentOriginOf(q('*')), null);
    assert.equal(parentOriginOf({ query: {} }), null);
  });
});

describe('vidbee proxy upstream secret', () => {
  it('sends the shared secret upstream, drops a visitor-supplied one, and keeps blocking users without a session', async () => {
    const seen = [];
    const upstream = http.createServer((req, res) => { seen.push(req.headers); res.end('ok'); });
    await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
    process.env.VIDBEE_WEB_URL = `http://127.0.0.1:${upstream.address().port}`;
    process.env.VIDBEE_GATE_TOKEN = 'gate-secret-xyz';
    try {
      const app = express();
      installVidBee(app, { auth: (req, _res, next) => { req.user = { id: 'u1' }; next(); }, cors: cors() });
      const get = (path, headers) => new Promise((resolve, reject) => {
        const server = http.createServer(app).listen(0, '127.0.0.1', () => {
          http.request({ host: '127.0.0.1', port: server.address().port, method: path === '/api/vidbee/session' ? 'POST' : 'GET', path, headers }, (res) => {
            res.resume(); res.on('end', () => server.close(() => resolve(res)));
          }).on('error', reject).end();
        });
      });
      const noSession = await get('/vidbee/', {});
      assert.equal(noSession.statusCode, 401);
      assert.equal(seen.length, 0);
      const session = await get('/api/vidbee/session', {});
      const cookie = String(session.headers['set-cookie']).split(';')[0];
      const ok = await get('/vidbee/transcripts', { cookie, 'x-vidbee-gate': 'attacker-value' });
      assert.equal(ok.statusCode, 200);
      assert.equal(seen[0]['x-vidbee-gate'], 'gate-secret-xyz');
      assert.equal(seen[0].cookie, undefined);
    } finally {
      upstream.close();
      delete process.env.VIDBEE_GATE_TOKEN;
      delete process.env.VIDBEE_WEB_URL;
    }
  });
});

describe('vidbee proxy configuration', () => {
  it('refuses to guess the upstream address in production', async () => {
    const before = { env: process.env.NODE_ENV, url: process.env.VIDBEE_WEB_URL };
    process.env.NODE_ENV = 'production';
    delete process.env.VIDBEE_WEB_URL;
    try {
      const app = express();
      installVidBee(app, { auth: (req, _res, next) => { req.user = { id: 'u1' }; next(); }, cors: cors() });
      const call = (path, headers, method = 'GET') => new Promise((resolve, reject) => {
        const server = http.createServer(app).listen(0, '127.0.0.1', () => {
          http.request({ host: '127.0.0.1', port: server.address().port, method, path, headers }, (res) => { res.resume(); res.on('end', () => server.close(() => resolve(res))); }).on('error', reject).end();
        });
      });
      process.env.VIDBEE_ALLOWED_USERS = 'u1';
      const session = await call('/api/vidbee/session', {}, 'POST');
      const cookie = String(session.headers['set-cookie']).split(';')[0];
      const res = await call('/vidbee/', { cookie });
      assert.equal(res.statusCode, 503);
    } finally {
      process.env.NODE_ENV = before.env;
      if (before.url) process.env.VIDBEE_WEB_URL = before.url;
      delete process.env.VIDBEE_ALLOWED_USERS;
    }
  });
});

describe('vidbee per-user library id', () => {
  const env = { VIDBEE_GATE_TOKEN: 'k' };
  it('is a stable opaque 32-hex id that differs per user and hides the account id', () => {
    assert.match(userKey('u1', env), /^[a-f0-9]{32}$/);
    assert.equal(userKey('u1', env), userKey('u1', env));
    assert.notEqual(userKey('u1', env), userKey('u2', env));
    assert.ok(!userKey('u1', env).includes('u1'));
  });
  it('tells the web edition who is asking, ignoring a header the visitor made up', async () => {
    const seen = [];
    const upstream = http.createServer((req, res) => { seen.push(req.headers); res.end('ok'); });
    await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
    process.env.VIDBEE_WEB_URL = `http://127.0.0.1:${upstream.address().port}`;
    process.env.VIDBEE_GATE_TOKEN = 'k';
    process.env.VIDBEE_PER_USER = '1'; // no allowlist: open to signed-in users only in per-user mode
    try {
      const callAs = async (id, extra) => {
        const app = express();
        installVidBee(app, { auth: (req, _res, next) => { req.user = { id }; next(); }, cors: cors() });
        const send = (path, headers) => new Promise((resolve, reject) => {
          const server = http.createServer(app).listen(0, '127.0.0.1', () => {
            http.request({ host: '127.0.0.1', port: server.address().port, method: path.includes('session') ? 'POST' : 'GET', path, headers }, (res) => {
              res.resume(); res.on('end', () => server.close(() => resolve(res)));
            }).on('error', reject).end();
          });
        });
        const session = await send('/api/vidbee/session', {});
        await send('/vidbee/', { cookie: String(session.headers['set-cookie']).split(';')[0], ...extra });
      };
      await callAs('alice', { 'x-smartvid-user': 'f'.repeat(32) });
      await callAs('bob', {});
      assert.equal(seen[0]['x-smartvid-user'], userKey('alice', process.env));
      assert.equal(seen[1]['x-smartvid-user'], userKey('bob', process.env));
      assert.notEqual(seen[0]['x-smartvid-user'], seen[1]['x-smartvid-user']);
    } finally {
      upstream.close();
      delete process.env.VIDBEE_GATE_TOKEN;
      delete process.env.VIDBEE_PER_USER;
      delete process.env.VIDBEE_WEB_URL;
    }
  });
});
