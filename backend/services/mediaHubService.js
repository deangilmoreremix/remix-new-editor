/**
 * Media Hub — Express adapter over ./mediaHub/core.mjs (download · transcribe · AI).
 *
 * Mounted at /api/media-hub. Everything requires auth except signed file links
 * (GET /api/media-hub/file/:id?t=…), which carry an HMAC token so <video>/<a> can load them.
 */
/* global Request */
import express from 'express';
import { Readable } from 'node:stream';
import { handleMediaHub } from './mediaHub/core.mjs';

const BASE = '/api/media-hub';

function toRequest(req) {
  const hasBody = !['GET', 'HEAD'].includes(req.method);
  return new Request(`http://${req.headers.host || 'localhost'}${req.originalUrl}`, {
    method: req.method,
    headers: Object.fromEntries(Object.entries(req.headers).filter(([, v]) => typeof v === 'string')),
    body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
  });
}

async function send(res, response) {
  res.status(response.status);
  response.headers.forEach((v, k) => res.setHeader(k, v));
  if (!response.body) return res.end();
  Readable.fromWeb(response.body).on('error', () => res.destroy()).pipe(res);
}

export function createMediaHubRouter({ auth }) {
  const router = express.Router();
  const handler = async (req, res) => send(res, await handleMediaHub(toRequest(req), { userId: req.user?.id || null, base: BASE }));
  router.get('/file/:id', handler); // signed link, no bearer token
  router.use(auth, handler);
  return router;
}
