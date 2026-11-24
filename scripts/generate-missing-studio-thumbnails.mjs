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

const SUFFIX = ", professional photography, warm cinematic lighting, shallow depth of field, photorealistic, blank screens without readable text, no lettering, no logos, no watermark";

const ALL_STUDIOS = [
  {
    id: "cinema-template",
    prompt: "Filmmaker choosing a cinematic look from a wall of film-style template frames on a large monitor in a dim colour-grading suite" + SUFFIX,
    filename: "cinema-template.webp",
  },
  {
    id: "zackd",
    prompt: "Creative director storyboarding a stylised keyframe sequence on an ultrawide monitor, printed keyframes pinned on a board behind, moody studio" + SUFFIX,
    filename: "zackd.webp",
  },
  {
    id: "director",
    prompt: "Film editor directing an AI assisted rough cut on a large monitor with a footage bin and multi-clip timeline, director chair beside the desk" + SUFFIX,
    filename: "director.webp",
  },
  {
    id: "timeline",
    prompt: "Video editor at a multi-track timeline editing suite with waveforms and clips on two ultrawide monitors, mixing console on the desk" + SUFFIX,
    filename: "timeline.webp",
  },
  {
    id: "workbench",
    prompt: "Creator building a node based workflow connecting image and video generation blocks on a huge monitor, whiteboard of sketched pipelines behind" + SUFFIX,
    filename: "workbench.webp",
  },
  {
    id: "website-builder",
    prompt: "Web designer reviewing a responsive website layout on desktop, tablet and phone at once on an ultrawide monitor, bright modern studio" + SUFFIX,
    filename: "website-builder.webp",
  },
  {
    id: "video-pages",
    prompt: "Marketer previewing a video web page on a large monitor showing a big round play icon over a smiling presenter photo, an orange rounded bar below it, laptop showing the same page beside it" + SUFFIX,
    filename: "video-pages.webp",
  },
  {
    id: "motion-director",
    prompt: "Motion designer directing animated graphics made of flowing colourful ribbons and geometric shapes on an ultrawide monitor, graphics tablet on a clean empty desk, plain wall behind" + SUFFIX,
    filename: "motion-director.webp",
  },
  {
    id: "leadfinder",
    prompt: "Sales researcher browsing a map and list of local business prospects on a large monitor, notebook and coffee on the desk" + SUFFIX,
    filename: "leadfinder.webp",
  },
  {
    id: "outreach",
    prompt: "Sales rep recording a personal video message to camera with a ring light and mirrorless camera on a tripod, a video call preview of a smiling prospect on the monitor behind" + SUFFIX,
    filename: "outreach.webp",
  },
  {
    id: "recorder",
    prompt: "Creator recording a screen tutorial with webcam, ring light and condenser microphone on a boom arm, screen capture preview on the monitor" + SUFFIX,
    filename: "recorder.webp",
  },
  {
    id: "find-my-brand",
    prompt: "Brand strategist extracting colour palette and style from a website on a large monitor, swatches and mood board pinned on the wall" + SUFFIX,
    filename: "find-my-brand.webp",
  },
  {
    id: "animate",
    prompt: "Animator bringing a still illustration to life, frame by frame motion preview on a large monitor, drawing tablet and keyframe sketches" + SUFFIX,
    filename: "animate.webp",
  },
  {
    id: "brand",
    prompt: "Brand designer arranging colour swatches, packaging mockups and an abstract geometric mark across a large monitor and desk, warm desk lamp" + SUFFIX,
    filename: "brand.webp",
  },
  {
    id: "viral",
    prompt: "Social media creator producing short vertical videos, three phones showing trending clips on stands beside a monitor with an analytics graph" + SUFFIX,
    filename: "viral.webp",
  },
  {
    id: "personalizer",
    prompt: "Marketer personalising one video template into many versions with different names on a large monitor, spreadsheet of contacts beside it" + SUFFIX,
    filename: "personalizer.webp",
  },
  {
    id: "video-agent",
    prompt: "Producer directing an AI video assistant through a chat panel next to a video preview on an ultrawide monitor, modern editing studio" + SUFFIX,
    filename: "video-agent.webp",
  },
  {
    id: "ai-vfx",
    prompt: "VFX artist adding fire, energy and camera move effects to a single still image on an ultrawide monitor, dramatic coloured studio lighting" + SUFFIX,
    filename: "ai-vfx.webp",
  },
  {
    id: "influencer",
    prompt: "Fashion influencer in a bright studio with ring light and camera, consistent AI portrait variations shown on the monitor behind" + SUFFIX,
    filename: "influencer.webp",
  },
  {
    id: "commercial",
    prompt: "Product photographer shooting a perfume bottle on a lit white sweep with softboxes, polished product shots on the monitor" + SUFFIX,
    filename: "commercial.webp",
  },
  {
    id: "library",
    prompt: "Creator browsing a neat grid of thumbnails of landscapes and portraits on a large monitor, organised shelves of media drives behind" + SUFFIX,
    filename: "library.webp",
  },
  {
    id: "content-library",
    prompt: "Content manager organising saved assets and folders on a large monitor, filing shelves and labelled boxes in a bright office" + SUFFIX,
    filename: "content-library.webp",
  },
  {
    id: "templates",
    prompt: "Designer browsing a gallery of ready made video and image templates on an ultrawide monitor, swatches and print proofs on the desk" + SUFFIX,
    filename: "templates.webp",
  },
  {
    id: "academy",
    prompt: "Instructor teaching filmmaking to students in a modern classroom with a large screen showing a lesson, laptops on desks" + SUFFIX,
    filename: "academy.webp",
  },
];

// Optional batch filter: node scripts/generate-missing-studio-thumbnails.mjs id1 id2 ...
const ONLY = process.argv.slice(2);
const STUDIOS = ONLY.length ? ALL_STUDIOS.filter((x) => ONLY.includes(x.id)) : ALL_STUDIOS;

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
  let previous = [];
  try { previous = JSON.parse(fs.readFileSync(metadataPath, 'utf8')).results || []; } catch { /* first run */ }
  const merged = [...previous.filter((r) => !results.some((n) => n.id === r.id)), ...results.map((r) => ({ ...r, path: r.path && path.relative(REPO_ROOT, r.path) }))];
  fs.writeFileSync(metadataPath, JSON.stringify({ generated: new Date().toISOString(), results: merged }, null, 2));
  console.log(`\nMetadata saved to: ${metadataPath}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
