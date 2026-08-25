/**
 * Scene Detection Service — Express router mounted at /api/scene-detection
 *
 * Delegates to the real agent bridge at /api/agents (which itself uses
 * FFmpeg / Director / PySceneDetect). If no real backend is reachable, it
 * returns an explicit unavailable error — it NEVER fabricates scene data.
 */

import express from 'express';
const router = express.Router();

const AGENT_ENDPOINT = process.env.AGENT_ACTIONS_URL || 'http://localhost:3001';

async function callBridge(videoUrl, options = {}) {
  try {
    const r = await fetch(`${AGENT_ENDPOINT}/api/agents/agent/detect-scenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl, ...options }),
    });
    if (r.ok) return await r.json();
    return null;
  } catch (_) {
    return null;
  }
}

router.post('/detect', async (req, res) => {
  try {
    const { videoUrl, ...options } = req.body || {};
    const bridge = await callBridge(videoUrl, options);
    if (bridge && Array.isArray(bridge.scenes)) {
      return res.json({
        success: true,
        source: 'agent-bridge',
        jobId: bridge.jobId || `bridge_${Date.now()}`,
        scenes: bridge.scenes,
        totalScenes: bridge.scenes.length,
      });
    }

    // No real scene-detection backend was reachable. Report an explicit
    // unavailable state instead of inventing scene boundaries.
    return res.status(503).json({
      success: false,
      unavailable: true,
      error:
        'Scene detection backend unavailable. Start the agent actions service (AGENT_ACTIONS_URL) with FFmpeg or the Director API.',
    });
  } catch (error) {
    res.status(500).json({ error: 'Scene detection failed', message: error.message });
  }
});

export default router;

