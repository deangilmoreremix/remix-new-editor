// Test harness: serves the REAL netlify/functions/video-events.js handler over HTTP (what Netlify does in production).
import http from 'node:http';
import { handler } from '../../../netlify/functions/video-events.js';
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const out = await handler({ httpMethod: req.method, headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), String(v)])), body: Buffer.concat(chunks).toString('utf8') });
  res.writeHead(out.statusCode, { ...(out.headers || {}), 'Access-Control-Allow-Origin': '*' }); res.end(out.body);
}).listen(8890, '127.0.0.1', () => console.log('video-events adapter on 8890'));
