// vite/plugins/publicAuditReportPlugin.js
//
// Isolated Vite plugin for the public client audit report.
//
// Production behavior (server.js + backend/server.js):
//   GET /api/audit/report/:token  -> backend
//   GET /audit/report/:token      -> static public/audit-report.html (Express)
//
// Dev behavior (this plugin):
//   - Serves public/audit-report.html for GET /audit/report/:token
//   - GET /api/audit/report/:token is handled by the existing dev server
//     proxy (vite.config.js) which already forwards /api/* to the backend
//     on :3001. If the backend is not running, the Vite proxy returns
//     ECONNREFUSED, which is the correct behavior for real development.
//
// We deliberately do NOT implement a second production report API in Vite.
// This plugin only intercepts the static HTML route during dev so the
// browser can render the page; the API stays with the real backend.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PUBLIC_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data:",
    "media-src 'self' https:",
    "connect-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

function isReportPath(pathname) {
  return /^\/audit\/report\/[^/]+$/.test(pathname);
}

export function publicAuditReportPlugin() {
  return {
    name: 'smartvideo-public-audit-report',

    configureServer(server) {
      // Serve /audit/report/:token -> public/audit-report.html
      server.middlewares.use((req, res, next) => {
        try {
          const url = new URL(req.url || '', 'http://localhost');
          if (!isReportPath(url.pathname)) {
            return next();
          }
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.statusCode = 405;
            res.setHeader('Allow', 'GET, HEAD');
            res.end('Method Not Allowed');
            return;
          }
          const htmlPath = path.resolve(__dirname, '..', '..', 'public', 'audit-report.html');
          const html = fs.readFileSync(htmlPath, 'utf8');
          for (const [k, v] of Object.entries(PUBLIC_HEADERS)) {
            res.setHeader(k, v);
          }
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.statusCode = 200;
          res.end(req.method === 'HEAD' ? '' : html);
        } catch (e) {
          next(e);
        }
      });
    },
  };
}
