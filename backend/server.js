import './loadEnv.js'; // load .env.local into process.env BEFORE service modules read it
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import http from 'http';

// Import services
import aiAgentService from './services/aiAgentService.js';
import sceneDetectionService from './services/sceneDetectionService.js';
import semanticSearchService from './services/semanticSearchService.js';
import speechTranscriptionService from './services/speechTranscriptionService.js';
import videoAgentService from './services/videoAgentService.js';
import agentActionsService from './services/agentActionsService.js';
import modelCatalogService from './services/modelCatalogService.js';
import videoDbProxyService from './services/videoDbProxyService.js';
import gtmBoostService from './services/gtmBoostService.js';
import { auth } from './middleware/auth.js';

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const videoAgentLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const agentActionsLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const videodbProxyLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

// Authenticated API routes — every route below requires a valid Supabase
// JWT in the `Authorization: Bearer <token>` header. The middleware attaches
// `req.user = { id, email }` and `req.requestId` (UUID) for downstream use
// (e.g. logging, per-user DB operations). See backend/middleware/auth.js.
//
// Note: services do not currently read req.user.id, but it is now available
// to any handler that needs it (e.g. agentActionsService could scope DB
// writes to the calling user with `const userId = req.user.id;`).
//
// Retry behavior:
//   - videoDbProxyService and videoAgentService wrap outbound calls with
//     withRetry (maxAttempts=2) and log each retry using req.requestId.
//   - DirectorPage (frontend) wraps fetch calls with withRetry (maxAttempts=3)
//     and shows user-facing toast notifications on each retry.
//   - No additional express retry middleware is needed; services own retry.
app.use('/api/ai-agent', auth, aiAgentService);
app.use('/api/scene-detection', auth, sceneDetectionService);
app.use('/api/semantic-search', auth, semanticSearchService);
app.use('/api/speech-transcription', auth, speechTranscriptionService);
app.use('/api/agents', agentActionsLimiter, auth, agentActionsService);
app.use('/api/model-catalog', auth, modelCatalogService);
app.use('/api/videodb', videodbProxyLimiter, auth, videoDbProxyService);
app.use('/api/gtm-boost', auth, gtmBoostService);
app.use('/videoagent', videoAgentLimiter, auth, videoAgentService);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Analytics ingestion — receives a batch of events from the in-browser
// analytics client (src/lib/analytics.js). No auth for now since this is
// non-sensitive operational telemetry; a real sink (DB, warehouse, etc.)
// can be wired in later without changing the wire format.
app.post('/api/analytics', (req, res) => {
  const events = Array.isArray(req.body?.events) ? req.body.events : [];
  if (events.length === 0) {
    return res.status(400).json({ ok: false, error: 'events array is required' });
  }
  console.log('[analytics]', JSON.stringify({ count: events.length, events }));
  res.json({ ok: true, received: events.length });
});

// MCP WebSocket Server
const wss = new WebSocketServer({ server, path: '/mcp' });

wss.on('connection', (ws, req) => {
  console.log('MCP client connected');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'execute_command':
          const result = await handleMCPCommand(data.data);
          ws.send(JSON.stringify({
            type: 'command_result',
            id: data.id,
            success: true,
            result
          }));
          break;

        case 'get_timeline_state':
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Timeline state is managed client-side. This endpoint is not implemented on the server.',
          }));
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        default:
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Unknown command type'
          }));
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  });

  ws.on('close', () => {
    console.log('MCP client disconnected');
  });

  ws.on('error', (error) => {
    console.error('MCP WebSocket error:', error);
  });
});

async function handleMCPCommand(data) {
  switch (data.action) {
    case 'add_clip':
      return { clipId: 'mcp_' + Date.now(), success: true };

    case 'remove_clip':
      return { success: true };

    case 'move_clip':
      return { success: true };

    case 'set_playhead':
      return { position: data.time };

    default:
      throw new Error('Unknown MCP command: ' + data.action);
  }
}

const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`🚀 Backend server running on port ${PORT}`);
    console.log(`🔗 MCP WebSocket available at ws://localhost:${PORT}/mcp`);
    console.log(`📊 Health check at http://localhost:${PORT}/health`);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

export default app;