// Production static server for the Vite `dist` build.
// Serves dist with correct MIME types and NO SPA fallback that would
// intercept /assets/*.js requests (which causes
// "Failed to fetch dynamically imported module" errors).
//
// Usage:
//   node server-dist.mjs            # serves on 0.0.0.0:3001
//   PORT=8080 node server-dist.mjs  # custom port
//
// The app uses hash-based routing (#/video), so every navigation is to "/".
// We never rewrite asset requests to index.html.

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = resolve(__dirname, 'dist');
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Correct MIME types — critical for ES modules.
const MIME_TYPES = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
};

const securityHeaders = {
  // NOTE: We deliberately do NOT send X-Content-Type-Options: nosniff in a
  // way that conflicts with module loading. MIME types above are correct, so
  // strict checking is safe, but we keep it simple to avoid module-load blocks.
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cache-Control': 'no-cache',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const decoded = decodeURIComponent(req.url.split('?')[0]);
    // Prevent path traversal.
    const safePath = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
    let filePath = join(DIST_DIR, safePath);

    // Security: never escape DIST_DIR.
    if (!filePath.startsWith(DIST_DIR)) {
      return send(res, 403, 'Forbidden');
    }

    let info;
    try {
      info = await stat(filePath);
    } catch {
      info = null;
    }

    // Directory -> index.html
    if (info && info.isDirectory()) {
      filePath = join(filePath, 'index.html');
      try {
        info = await stat(filePath);
      } catch {
        info = null;
      }
    }

    // Missing file: only "/" and unknown non-asset navigations fall back to
    // index.html. Asset requests (/assets/*) are NEVER rewritten, so a missing
    // chunk returns a real 404 instead of HTML (which would break module loading).
    if (!info) {
      const isAsset = safePath.startsWith('/assets/') || extname(safePath) !== '';
      if (isAsset) {
        return send(res, 404, 'Not found');
      }
      filePath = join(DIST_DIR, 'index.html');
    }

    const data = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const headers = {
      'Content-Type': contentType,
      'Content-Length': data.length,
      ...securityHeaders,
    };
    // Long cache for hashed assets (they are content-addressed).
    if (safePath.startsWith('/assets/')) {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    }
    return send(res, 200, data, headers);
  } catch (err) {
    console.error('[server-dist] Error:', err);
    return send(res, 500, 'Internal Server Error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`> Serving dist on http://${HOST}:${PORT} (LAN: http://192.168.1.103:${PORT})`);
});
