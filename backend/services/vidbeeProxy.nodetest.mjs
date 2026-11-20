import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { installVidBee, isAllowed } from './vidbeeProxy.js';

describe('vidbee gate allowlist', () => {
  it('denies everyone outside development when unset', () => {
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
