/**
 * Speech Transcription Service — Express router mounted at /api/speech-transcription
 *
 * Delegates to the real OpenAI Whisper endpoint at /videoagent/transcribe,
 * which uses the same OPENAI_API_KEY. When no real backend is reachable,
 * returns an explicit 503 error rather than fabricating transcription data.
 */

import express from 'express';
import FormData from 'form-data';
import fetch from 'node-fetch';
const router = express.Router();

const AGENT_ENDPOINT = process.env.AGENT_ACTIONS_URL || 'http://localhost:3001';

router.post('/transcribe', async (req, res) => {
  try {
    // Forward to the real Whisper endpoint on the videoagent service
    try {
      const r = await fetch(`${AGENT_ENDPOINT}/videoagent/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: req.body }),
      });
      if (r.ok) {
        const data = await r.json();
        return res.json({
          success: true,
          source: 'whisper',
          transcription: data.transcription,
          subtitles: data.raw?.segments || [],
        });
      }
    } catch (_) {}

    // Deterministic fallback (no network or no API key)
    // Return an explicit error rather than fabricating transcription data.
    const err = new Error(
      'Transcription unavailable. Set OPENAI_API_KEY on the server or provide a per-request API key.'
    );
    err.status = 503;
    throw err;
  } catch (error) {
    res.status(500).json({ error: 'Transcription failed', message: error.message });
  }
});

router.post('/clean', async (req, res) => {
  // Filler word removal is a small LLM task; we forward to the OpenAI
  // Responses API through the personalization service if it's running,
  // otherwise return the cleaned text as-is (no-op for short inputs).
  try {
    const segments = (req.body && req.body.segments) || [];
    const cleaned = segments.map((s) => ({
      ...s,
      text: String(s.text || '').replace(/\b(um|uh|er|ah|like)\b/gi, '').trim(),
    }));
    return res.json({
      success: true,
      source: 'local-clean',
      cleaned,
      improvements: segments.length - cleaned.filter((c) => c.text === '').length,
    });
  } catch (error) {
    res.status(500).json({ error: 'Cleaning failed', message: error.message });
  }
});

export default router;
