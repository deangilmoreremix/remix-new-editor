/**
 * Director Proxy — forwards Director agent + chat requests to the local
 * VideoDB "Director" Python backend.
 *
 * The official Director framework runs as a separate Flask/socket.io service
 * on localhost:8000. This proxy does NOT re-implement any agent logic; it only
 * forwards requests and normalizes responses.
 *
 * Routes:
 *   POST /api/director/agent/:id   -> http://localhost:8000/agent/:id
 *   POST /api/director/chat        -> VideoDB chat-completions REST fallback
 *
 * NOTE on chat transport:
 *   The Director backend exposes chat exclusively over socket.io on the
 *   "/chat" namespace (see director/entrypoint/api/socket_io.py). There is no
 *   plain HTTP POST route for /chat, so a direct POST forward is not possible
 *   from server-side fetch. Per the task, we therefore proxy chat to the
 *   VideoDB chat-completions REST API (api.videodb.io) using the user's own
 *   VideoDB key as `x-access-token`, mirroring backend/services/videodbProxy.js.
 *
 * Security:
 *  - The user key (if any) is read from the request body only and never logged.
 *  - The upstream's own VIDEO_DB_API_KEY is configured on the Director service.
 */

import express from 'express';

const router = express.Router();

const DIRECTOR_BASE_URL = process.env.DIRECTOR_BASE_URL || 'http://localhost:8000';
const VIDEODB_BASE_URL = 'https://api.videodb.io';

// Pull a VideoDB key from a few possible request envelopes.
function extractVideoDbKey(body) {
    if (!body) return '';
    return (
        body.videoDbKey ||
        (body.settings && body.settings.videoDbKey) ||
        ''
    );
}

// Normalize an upstream Director agent response into a consistent shape.
function normalizeAgentResponse(data) {
    const streamUrl =
        (data && (data.streamUrl || (data.output && data.output.stream_url))) || null;
    const summary =
        (data && (data.summary || (data.output && data.output.summary))) || null;
    const script =
        (data && (data.script || (data.output && data.output.script))) || null;
    return { ok: true, streamUrl, summary, script, raw: data };
}

// If the upstream reports a VideoDB auth problem, return a clear 502.
function isAuthError(status, data) {
    if (status === 401 || status === 403) return true;
    const msg = (data && (data.message || data.error || data.detail || '')) || '';
    return /api[_ ]?key|unauthor|authentication|not (configured|authorized)/i.test(
        String(msg)
    );
}

router.post('/agent/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { input, videoId, videoUrl, collectionId, videoDbKey } = req.body || {};

        if (!id) {
            return res.status(400).json({ ok: false, error: 'Missing agent id.' });
        }
        if (input === undefined || input === null) {
            return res.status(400).json({ ok: false, error: 'Missing input.' });
        }

        const upstreamBody = {
            input,
            video_id: videoId,
            video_url: videoUrl,
            collection_id: collectionId || 'default',
        };
        if (videoDbKey) {
            upstreamBody.video_db_key = videoDbKey;
        }

        const upstreamUrl = `${DIRECTOR_BASE_URL}/agent/${encodeURIComponent(id)}`;

        const upstream = await fetch(upstreamUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(upstreamBody),
        });

        const text = await upstream.text();
        let payload;
        try {
            payload = JSON.parse(text);
        } catch {
            payload = text;
        }

        if (!upstream.ok) {
            if (isAuthError(upstream.status, payload)) {
                return res.status(502).json({
                    ok: false,
                    error:
                        'VideoDB key not configured on the Director backend. Set VIDEO_DB_API_KEY.',
                    status: upstream.status,
                });
            }
            return res.status(upstream.status).json({
                ok: false,
                error:
                    (payload &&
                        (payload.message || payload.error || payload.detail)) ||
                    'Director agent request failed.',
                status: upstream.status,
            });
        }

        return res.status(200).json(normalizeAgentResponse(payload));
    } catch (err) {
        console.error('[director-proxy] agent error:', err.message);
        res.status(502).json({
            ok: false,
            error: 'Failed to reach Director backend.',
            message: err.message,
        });
    }
});

router.post('/chat', async (req, res) => {
    try {
        const {
            message,
            videoId,
            videoUrl,
            collectionId,
            sessionId,
            videoDbKey,
        } = req.body || {};

        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ ok: false, error: 'Missing message.' });
        }

        const key = extractVideoDbKey(req.body);
        if (!key || typeof key !== 'string' || !key.trim()) {
            return res.status(400).json({
                ok: false,
                error:
                    'Missing VideoDB API key. Chat requires a user VideoDB key (the Director /chat endpoint is socket.io-only; we fall back to api.videodb.io chat).',
            });
        }

        // Build the chat context. The VideoDB chat-completions REST API takes a
        // list of messages; we send the user's message plus optional video
        // context so the assistant can ground its response.
        const contentParts = [];
        if (videoUrl) contentParts.push(`Video URL: ${videoUrl}`);
        if (videoId) contentParts.push(`Video ID: ${videoId}`);
        if (collectionId) contentParts.push(`Collection ID: ${collectionId}`);
        if (sessionId) contentParts.push(`Session ID: ${sessionId}`);
        contentParts.push(message);

        const messages = [
            {
                role: 'user',
                content: contentParts.join('\n'),
            },
        ];

        const chatUrl = `${VIDEODB_BASE_URL}/chat/completions`;
        const upstream = await fetch(chatUrl, {
            method: 'POST',
            headers: {
                'x-access-token': key.trim(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ messages }),
        });

        const text = await upstream.text();
        let payload;
        try {
            payload = JSON.parse(text);
        } catch {
            payload = text;
        }

        if (!upstream.ok) {
            if (isAuthError(upstream.status, payload)) {
                return res.status(502).json({
                    ok: false,
                    error:
                        'VideoDB key not configured or invalid for chat. Set a valid VIDEO_DB_API_KEY.',
                    status: upstream.status,
                });
            }
            return res.status(upstream.status).json({
                ok: false,
                error:
                    (payload &&
                        (payload.message || payload.error || payload.detail)) ||
                    'VideoDB chat request failed.',
                status: upstream.status,
            });
        }

        // Extract assistant text from a chat-completions-style response.
        const textOut =
            (payload &&
                payload.choices &&
                payload.choices[0] &&
                payload.choices[0].message &&
                payload.choices[0].message.content) ||
            (payload && payload.text) ||
            (payload && payload.output) ||
            null;

        return res.status(200).json({ ok: true, text: textOut, raw: payload });
    } catch (err) {
        console.error('[director-proxy] chat error:', err.message);
        res.status(502).json({
            ok: false,
            error: 'Failed to reach VideoDB chat backend.',
            message: err.message,
        });
    }
});

export default router;
