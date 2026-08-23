#!/usr/bin/env node
/**
 * Generate missing studio thumbnails via direct muapi API.
 *
 * Usage:
 *   MUAPI_KEY=your-key node scripts/generate-missing-studio-thumbnails.mjs
 *
 * Uses direct https to api.muapi.ai to avoid the Supabase proxy's
 * demo/placeholder response behavior.
 */

import https from 'https';
import fs from 'fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const MUAPI_KEY = process.env.MUAPI_KEY;
if (!MUAPI_KEY) {
  console.error('MUAPI_KEY environment variable is required');
  process.exit(1);
}

const OUTPUT_DIR = path.join(REPO_ROOT, 'public', 'thumbnails', 'studios');

const STUDIOS = [
  {
    id: 'audio',
    prompt: 'Sound engineer mixing music on a large audio console with glowing VU meters and studio monitors, professional recording studio',
    filename: 'audio.webp',
  },
  {
    id: 'avatar',
    prompt: 'AI avatar presenter speaking to camera in a modern virtual studio with green screen backdrop, professional broadcast quality',
    filename: 'avatar.webp',
  },
  {
    id: 'training',
    prompt: 'AI training dashboard showing loss curves converging over epochs with GPU server rack in background, data center aesthetic',
    filename: 'training.webp',
  },
  {
    id: 'videotools',
    prompt: 'Video editor enhancing footage with AI tools showing before/after split on ultrawide monitor, professional video editing suite',
    filename: 'videotools.webp',
  },
  {
    id: 'chat',
    prompt: 'Developer coding with AI assistant in split-screen conversation on ultrawide monitor, modern development environment',
    filename: 'chat.webp',
  },
  {
    id: 'lipsync',
    prompt: 'Portrait animation showing side-by-side comparison of static photo and animated lip-synced video, AI animation studio',
    filename: 'lipsync.webp',
  },
  {
    id: 'render',
    prompt: 'Video render farm with multiple monitors showing different export formats and progress bars, professional post-production studio',
    filename: 'render.webp',
  },
];

function httpsRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, body: buffer });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function createGeneration(prompt) {
  const payload = JSON.stringify({
    prompt,
    width: 1408,
    height: 768,
    num_images: 1,
  });

  const response = await httpsRequest({
    hostname: 'api.muapi.ai',
    path: '/api/v1/flux-schnell-image',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': MUAPI_KEY,
    },
  }, payload);

  if (!response.status || response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP ${response.status}: ${response.body.toString().slice(0, 200)}`);
  }

  let data;
  try {
    data = JSON.parse(response.body.toString());
  } catch (e) {
    throw new Error(`Invalid JSON response: ${response.body.toString().slice(0, 200)}`);
  }

  if (data.detail) {
    throw new Error(`API error: ${JSON.stringify(data.detail).slice(0, 300)}`);
  }

  const requestId = data.request_id || data.id;
  if (!requestId) {
    const imageUrl = data.outputs?.[0] || data.url || data.output?.url;
    if (imageUrl) return imageUrl;
    throw new Error(`No request_id or image URL in response: ${JSON.stringify(data).slice(0, 300)}`);
  }

  console.log(`  Request ID: ${requestId}, status: ${data.status || 'unknown'} - polling for result...`);
  return pollForResult(requestId);
}

async function pollForResult(requestId, maxAttempts = 40, baseInterval = 3000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, baseInterval));

    try {
      const response = await httpsRequest({
        hostname: 'api.muapi.ai',
        path: `/api/v1/predictions/${encodeURIComponent(requestId)}/result`,
        method: 'GET',
        headers: {
          'x-api-key': MUAPI_KEY,
        },
      });

      if (!response.status || response.status < 200 || response.status >= 300) {
        if (response.status >= 500 || response.status === 404) continue;
        const errText = response.body.toString().slice(0, 100);
        throw new Error(`Poll Failed: ${response.status} - ${errText}`);
      }

      let data;
      try {
        data = JSON.parse(response.body.toString());
      } catch (e) {
        throw new Error(`Invalid JSON in poll response: ${response.body.toString().slice(0, 200)}`);
      }

      const status = (data.status || '').toLowerCase();

      if (status === 'completed' || status === 'succeeded' || status === 'success') {
        const imageUrl = data.outputs?.[0] || data.url || data.output?.url;
        if (imageUrl) return imageUrl;
        throw new Error(`No image URL in completed response: ${JSON.stringify(data).slice(0, 300)}`);
      }

      if (status === 'failed' || status === 'error') {
        throw new Error(`Generation failed: ${data.error || data.detail || JSON.stringify(data).slice(0, 300)}`);
      }

      if (attempt % 5 === 0) {
        console.log(`  Polling... attempt ${attempt}/${maxAttempts}, status: ${status || 'unknown'}`);
      }
    } catch (error) {
      if (attempt === maxAttempts) throw error;
    }
  }

  throw new Error('Generation timed out after polling.');
}

async function downloadImage(url, filepath) {
  const tmpPath = `${filepath}.tmp`;

  try {
    const execSync = (await import('node:child_process')).execSync;
    const safeUrl = url.replace(/'/g, '%27').replace(/"/g, '%22');
    execSync(`curl -L -A "Mozilla/5.0" -o "${tmpPath}" "${safeUrl}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60000,
    });

    if (fs.existsSync(tmpPath) && fs.statSync(tmpPath).size > 0) {
      fs.renameSync(tmpPath, filepath);
      return;
    }
  } catch (e) {
    if (fs.existsSync(tmpPath)) {
      try { fs.unlinkSync(tmpPath); } catch {}
    }
    throw new Error(`Download failed: ${e.message}`);
  }
}

async function main() {
  console.log('Generating missing studio thumbnails via direct muapi...\n');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const results = [];

  for (let i = 0; i < STUDIOS.length; i++) {
    const studio = STUDIOS[i];
    const outputPath = path.join(OUTPUT_DIR, studio.filename);

    console.log(`[${i + 1}/${STUDIOS.length}] ${studio.id}`);

    try {
      const imageUrl = await createGeneration(studio.prompt);
      console.log(`  Generated: ${imageUrl.slice(0, 80)}...`);

      await downloadImage(imageUrl, outputPath);
      const stats = fs.statSync(outputPath);
      console.log(`  Saved: ${outputPath} (${(stats.size / 1024).toFixed(1)} KB)\n`);

      results.push({ id: studio.id, success: true, path: outputPath, size: stats.size, imageUrl });
    } catch (error) {
      console.error(`  Error: ${error.message}\n`);
      results.push({ id: studio.id, success: false, error: error.message });
    }

    if (i < STUDIOS.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log('================================================');
  console.log('Generation complete!');
  console.log(`Success: ${results.filter((r) => r.success).length}/${STUDIOS.length}`);
  console.log(`Failed: ${results.filter((r) => !r.success).length}/${STUDIOS.length}`);

  if (results.some((r) => !r.success)) {
    console.log('\nFailed studios:');
    results.filter((r) => !r.success).forEach((r) => console.log(`  - ${r.id}: ${r.error}`));
  }

  const metadataPath = path.join(OUTPUT_DIR, 'generation-metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify({ generated: new Date().toISOString(), results }, null, 2));
  console.log(`\nMetadata saved to: ${metadataPath}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
