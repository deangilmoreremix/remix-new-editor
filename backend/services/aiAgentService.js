/**
 * AI Agent Service — Express router mounted at /api/ai-agent
 *
 * Delegates to the real agent actions bridge at /api/agents.
 * When the bridge is unreachable, returns an explicit error
 * rather than fabricating plausible-looking mock data.
 */

import express from 'express';
const router = express.Router();

const AGENT_ENDPOINT = process.env.AGENT_ACTIONS_URL || 'http://localhost:3001';

const AGENT_COMMAND_MAP = {
  add_title: { action: 'add-text', label: 'Add Title' },
  add_subtitle: { action: 'add-text', label: 'Add Subtitle' },
  trim_video: { action: 'trim-video', label: 'Trim Video' },
  generate_clip: { action: 'create-clip', label: 'Generate Clip' },
  detect_scenes: { action: 'detect-scenes', label: 'Detect Scenes' },
};

async function callBridge(action, payload) {
  try {
    const r = await fetch(`${AGENT_ENDPOINT}/api/agents/agent/${encodeURIComponent(action)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (r.ok) return await r.json();
    return null;
  } catch (_) {
    return null;
  }
}

router.post('/process', async (req, res) => {
  try {
    const { command } = req.body || {};
    if (!command || typeof command !== 'string') {
      return res.status(400).json({
        error: 'Invalid command',
        message: 'Command must be a non-empty string',
      });
    }

    const lowerCommand = command.toLowerCase();

    // Try to match against the known command vocabulary and forward to the
    // real agent bridge.
    let matched = null;
    for (const [key, mapping] of Object.entries(AGENT_COMMAND_MAP)) {
      const pattern = key === 'add_title'
        ? /add.*title/i
        : key === 'add_subtitle'
          ? /add.*subtitle/i
          : key === 'trim_video'
            ? /trim.*video|cut.*video/i
            : key === 'generate_clip'
              ? /generate.*clip|create.*clip/i
              : /detect.*scene/i;
      if (pattern.test(lowerCommand)) {
        matched = { key, mapping };
        break;
      }
    }

    if (matched) {
      const bridge = await callBridge(matched.mapping.action, { command, ...req.body });
      if (bridge) {
        return res.json({
          success: true,
          source: 'agent-bridge',
          result: {
            action: matched.mapping.action,
            label: matched.mapping.label,
            command,
            ...bridge,
          },
          timestamp: new Date().toISOString(),
        });
      }
      // Bridge unreachable — return an explicit error, not fabricated data.
      return res.status(503).json({
        error: 'Agent bridge unavailable',
        message: 'The agent actions bridge is not reachable. Set AGENT_ACTIONS_URL or ensure the backend is running.',
      });
    }

    // No known command matched — return an explicit error instead of fabricating data.
    return res.status(400).json({
      error: 'Unrecognized command',
      message: 'Command not in known vocabulary. Try: add title, add subtitle, trim video, generate clip, detect scenes.',
      suggestions: ['add title', 'trim video', 'detect scenes'],
    });
  } catch (error) {
    console.error('AI Agent processing error:', error);
    res.status(500).json({ error: 'Processing failed', message: error.message });
  }
});

router.get('/commands', (req, res) => {
  res.json({
    commands: Object.keys(AGENT_COMMAND_MAP),
    examples: [
      'add a title "My Video Title"',
      'trim the video by 2 seconds',
      'generate a sunset clip',
      'detect scenes in the video',
    ],
  });
});

router.post('/workflow', async (req, res) => {
  try {
    const { command } = req.body || {};
    // Forward to the real workflow endpoint on the videoagent service
    try {
      const r = await fetch(`${AGENT_ENDPOINT}/videoagent/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steps: [{ action: 'detect-scenes' }, { action: 'extract-highlights' }, { action: 'generate-subtitles' }],
          command,
        }),
      });
      if (r.ok) {
        const result = await r.json();
        return res.json({ success: true, source: 'agent-bridge', workflow: { jobId: result.jobId, status: result.status }, result: { command } });
      }
    } catch (_) {}

    // Bridge unreachable — return an explicit error, not a fabricated workflow.
    return res.status(503).json({
      error: 'Agent bridge unavailable',
      message: 'The agent actions bridge is not reachable. Set AGENT_ACTIONS_URL or ensure the backend is running.',
    });
  } catch (error) {
    res.status(500).json({ error: 'Workflow failed', message: error.message });
  }
});

export default router;
