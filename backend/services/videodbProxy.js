/**
 * VideoDB Proxy — Render backend endpoint
 *
 * The browser stores each user's VideoDB key locally (via apiKeyManager).
 * To run VideoDB on the backend (Render.com) instead of calling api.videodb.io
 * directly from the client, the frontend POSTs the user's key + the target
 * VideoDB path to this proxy. The backend then calls VideoDB server-side with
 * the user's key as `x-access-token`.
 *
 * This mirrors the existing pattern in videoAgentService.js, where the user's
 * own OpenAI key is sent in the request body and the backend uses it to call
 * the external service. No global/server VideoDB key is required — every user
 * brings their own, exactly as designed in the setup popup.
 *
 * Security:
 *  - The user key is read from the request body only, never logged.
 *  - Endpoints are validated (no path traversal / SSRF) before forwarding.
 *  - The key is stripped from any echoed payload.
 */

import express from 'express';
import multer from 'multer';

const router = express.Router();

// In-memory upload handling for multipart file uploads (VideoDB ingest).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

const VIDEODB_BASE_URL = 'https://api.videodb.io';

// Allowed VideoDB path shapes (prevent SSRF / path traversal).
function isValidVideoDBPath(p) {
    if (!p || typeof p !== 'string') return false;
    const trimmed = p.trim();
    if (!trimmed || trimmed.startsWith('/') || trimmed.includes('..') || trimmed.includes('//')) return false;
    // Only simple api paths: letters, digits, underscores, hyphens, slashes, braces-free.
    return /^[a-z0-9_./-]+$/.test(trimmed);
}

router.post('/proxy', upload.any('file'), async (req, res) => {
    try {
        // Multipart uploads (file ingest) carry the key + endpoint as text fields.
        const isMultipart = Array.isArray(req.files) && req.files.length > 0;
        const body = isMultipart ? (req.body || {}) : (req.body || {});
        const { endpoint, method = 'POST' } = body;

        // The user's own VideoDB key travels in the request body / fields.
        const videoDbKey =
            (req.body && req.body.videoDbKey) ||
            (req.body && req.body.settings && req.body.settings.videoDbKey) ||
            '';

        if (!videoDbKey || typeof videoDbKey !== 'string' || !videoDbKey.trim()) {
            return res.status(400).json({ error: 'Missing VideoDB API key. Add your VideoDB key in Settings.' });
        }

        if (!isValidVideoDBPath(endpoint)) {
            return res.status(400).json({ error: 'Invalid VideoDB endpoint.' });
        }

        const upstreamUrl = `${VIDEODB_BASE_URL}/${endpoint}`;
        const upstreamMethod = String(method).toUpperCase() === 'GET' ? 'GET' : 'POST';

        const headers = {
            'x-access-token': videoDbKey.trim(),
        };

        let fetchOptions;
        if (isMultipart) {
            // Forward the uploaded file as multipart/form-data to VideoDB.
            const form = new FormData();
            for (const f of req.files) {
                form.append(f.fieldname, new Blob([f.buffer], { type: f.mimetype }), f.originalname);
            }
            for (const [k, v] of Object.entries(req.body)) {
                if (k !== 'videoDbKey' && k !== 'settings' && v != null) form.append(k, String(v));
            }
            fetchOptions = { method: upstreamMethod, headers, body: form };
        } else {
            headers['Content-Type'] = 'application/json';
            fetchOptions = { method: upstreamMethod, headers };
            if (upstreamMethod === 'POST' && body.body !== undefined) {
                fetchOptions.body = JSON.stringify(body.body);
            }
        }

        const upstream = await fetch(upstreamUrl, fetchOptions);
        const text = await upstream.text();

        // Forward VideoDB's status + JSON (or raw text) back to the client.
        let payload;
        try {
            payload = JSON.parse(text);
        } catch {
            payload = text;
        }

        res.status(upstream.status).json(payload);
    } catch (err) {
        console.error('[videodb-proxy] error:', err.message);
        res.status(500).json({ error: 'VideoDB proxy failed', message: err.message });
    }
});

export default router;
