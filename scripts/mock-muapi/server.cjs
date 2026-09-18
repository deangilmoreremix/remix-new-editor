const http = require('http');

const PORT = 9876;
const BASE = `http://localhost:${PORT}`;

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, BASE);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' });
    res.end();
    return;
  }

  if (req.method === 'POST' && url.pathname === '/functions/v1/muapi-proxy') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const model = payload.model || 'test-model';
        const mode = payload.mode || payload.modelType || 't2i';

        if (!payload.prompt && mode !== 'i2i' && mode !== 'i2v' && mode !== 'v2v') {
          return sendJson(res, 400, { error: 'Missing prompt' });
        }
        if ((mode === 'i2v' || mode === 'i2i') && !payload.image_url) {
          return sendJson(res, 400, { error: 'Missing image_url' });
        }
        if (mode === 'v2v' && !payload.video_url) {
          return sendJson(res, 400, { error: 'Missing video_url' });
        }

        const jobId = uuidv4();
        const resultUrl = `${BASE}/results/${jobId}.png`;
        sendJson(res, 200, {
          job_id: jobId,
          status: 'completed',
          result_url: resultUrl,
          model,
          mode,
          received_prompt: Boolean(payload.prompt),
          received_image_url: Boolean(payload.image_url),
          received_video_url: Boolean(payload.video_url),
        });
      } catch (e) {
        sendJson(res, 400, { error: 'Invalid JSON' });
      }
    });
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/results/')) {
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: 'Not found', path: url.pathname });
});

server.listen(PORT, () => {
  console.log(`Mock MuAPI server listening on ${BASE}`);
});
