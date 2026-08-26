/**
 * OpenMontage Proxy — Render backend endpoint
 *
 * Proxies requests from the frontend to the OpenMontage FastAPI server.
 * Forwards user-provided API keys (MuAPI, OpenAI) so tools can use them.
 *
 * Security:
 * - API keys are read from request body/headers, never logged
 * - User ID is injected from the authenticated session
 * - Keys are forwarded to OpenMontage API for tool execution
 */

import express from 'express';
import http from 'http';
import https from 'https';

const router = express.Router();

// OpenMontage FastAPI server URL (from env or default to localhost)
const OPENMONTAGE_URL = process.env.OPENMONTAGE_URL || 'http://localhost:8000';

// Agent for connection pooling
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

function getAgent(url) {
    return url.startsWith('https') ? httpsAgent : httpAgent;
}

/**
 * Proxy all requests to OpenMontage API
 */
router.all('*', async (req, res) => {
    try {
        const targetPath = req.path === '/' ? '' : req.path;
        const targetUrl = `${OPENMONTAGE_URL}/api${targetPath}`;

        // Build headers
        const headers = {
            'Content-Type': 'Content-Type' in req.headers ? req.headers['content-type'] : 'application/json',
        };

        // Forward auth token if present
        if (req.headers.authorization) {
            headers['Authorization'] = req.headers.authorization;
        }

        // Inject user ID from session (for development mode)
        // In production, this comes from Clerk auth middleware
        const userId = req.user?.id || req.headers['x-user-id'] || req.body?.user_id;
        if (userId) {
            headers['x-openmontage-user-id'] = userId;
        }

        // Forward user API keys from headers (sent by frontend apiKeyManager)
        const apiKeys = {};
        if (req.headers['x-muapi-api-key']) {
            apiKeys.MUAPI_API_KEY = req.headers['x-muapi-api-key'];
        }
        if (req.headers['x-openai-api-key']) {
            apiKeys.OPENAI_API_KEY = req.headers['x-openai-api-key'];
        }
        if (req.headers['x-google-api-key']) {
            apiKeys.GOOGLE_API_KEY = req.headers['x-google-api-key'];
        }
        if (req.headers['x-elevenlabs-api-key']) {
            apiKeys.ELEVENLABS_API_KEY = req.headers['x-elevenlabs-api-key'];
        }
        if (req.headers['x-minimax-api-key']) {
            apiKeys.MINIMAX_API_KEY = req.headers['x-minimax-api-key'];
        }

        // Merge api_keys into request body
        let body = req.body || {};
        if (Object.keys(apiKeys).length > 0) {
            body.api_keys = { ...(body.api_keys || {}), ...apiKeys };
        }

        // Build request options
        const isGetMethod = req.method === 'GET';
        const options = {
            method: req.method,
            headers,
            agent: getAgent(targetUrl),
            timeout: 120000, // 2 minute timeout for long-running operations
        };

        // Make request to OpenMontage API
        const response = await fetch(targetUrl, {
            ...options,
            body: isGetMethod ? undefined : JSON.stringify(body),
        });

        // Forward response headers
        response.headers.forEach((value, key) => {
            res.setHeader(key, value);
        });

        // Forward status and body
        res.status(response.status);
        const text = await response.text();
        res.send(text);

    } catch (error) {
        console.error('[OpenMontageProxy] Error:', error.message);
        res.status(502).json({
            error: 'OpenMontage service unavailable',
            detail: error.message,
        });
    }
});

/**
 * SSE proxy for real-time job events
 */
router.get('/productions/:jobId/events', async (req, res) => {
    try {
        const { jobId } = req.params;
        const targetUrl = `${OPENMONTAGE_URL}/api/productions/${jobId}/events`;

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const headers = {};
        const userId = req.user?.id || req.headers['x-user-id'];
        if (userId) {
            headers['x-openmontage-user-id'] = userId;
        }

        const response = await fetch(targetUrl, { headers });

        if (!response.ok) {
            res.status(response.status).send(await response.text());
            return;
        }

        // Stream response
        response.body.on('data', (chunk) => {
            res.write(chunk);
        });

        response.body.on('end', () => {
            res.end();
        });

        req.on('close', () => {
            response.body.destroy();
        });

    } catch (error) {
        console.error('[OpenMontageProxy] SSE Error:', error.message);
        res.status(502).json({ error: 'SSE connection failed' });
    }
});

export default router;
