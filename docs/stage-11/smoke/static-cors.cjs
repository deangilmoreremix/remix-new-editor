// Tiny static file server with CORS, used by local-ai-audio-smoke.cjs so the 92 MB model is streamed to Chromium over HTTP instead of
// through Playwright's 100 MB devtools pipe. Usage: node static-cors.cjs <dir> <port>
const http = require('http'); const fs = require('fs'); const path = require('path');
const [dir, port] = [path.resolve(process.argv[2]), Number(process.argv[3])];
http.createServer((q, r) => {
  const f = path.join(dir, decodeURIComponent(new URL(q.url, 'http://x').pathname));
  r.setHeader('access-control-allow-origin', '*'); r.setHeader('cross-origin-resource-policy', 'cross-origin');
  if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.statusCode = 404; return r.end('nf'); }
  r.setHeader('content-length', fs.statSync(f).size); r.setHeader('content-type', 'application/octet-stream'); fs.createReadStream(f).pipe(r);
}).listen(port, '127.0.0.1');
