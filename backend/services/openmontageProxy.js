import express from 'express';
import cors from 'cors';
import http from 'http';
import https from 'https';
import { URL } from 'url';

const router = express.Router();

router.use(cors());
router.use(express.json({ limit: '50mb' }));
router.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Resolve the OpenMontage service URL.
// Priority:
//   1. OPENMONTAGE_URL / OPENMONTAGE_API_URL (server env)
//   2. Default: http://localhost:8000
function resolveTarget() {
  return (process.env.OPENMONTAGE_URL || process.env.OPENMONTAGE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
}

function proxyRequest(req, res, next) {
  const target = resolveTarget();
  const path = req.url.replace(/^\/openmontage/, '') || '/';
  const targetUrl = new URL(path, target);

  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
    path: targetUrl.pathname + (targetUrl.search || ''),
    method: req.method,
    headers: {
      ...req.headers,
      host: targetUrl.host,
    },
  };

  // Forward Clerk user context
  const clerkUserId = req.headers['x-clerk-user-id'] || req.user?.id || '';
  if (clerkUserId) {
    options.headers['x-openmontage-user-id'] = clerkUserId;
  }
  const apiKey = req.headers['x-openai-api-key'];
  if (apiKey) {
    options.headers['x-openai-api-key'] = apiKey;
  }

  // Remove headers that shouldn't be forwarded
  delete options.headers['connection'];
  delete options.headers['keep-alive'];

  const lib = targetUrl.protocol === 'https:' ? https : http;

  const proxyReq = lib.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('[openmontage] proxy error:', err.message);
    if (!res.headersSent) {
      res.writeHead(502);
      res.json({ error: 'OpenMontage service unavailable', detail: err.message });
    }
  });

  req.pipe(proxyReq);
}

// Proxy all /openmontage/* requests to the OpenMontage FastAPI server.
router.use('/', proxyRequest);

export default router;
