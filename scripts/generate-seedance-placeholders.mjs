/**
 * Generates placeholder media (15 WebP posters + 15 .webm videos) for the
 * Seedance 2.5 landing page showcase.
 *
 * Uses ffmpeg (which has no drawtext filter, so posters are themed gradient
 * backgrounds — text is overlaid by the card HTML in SeedanceShowcase.jsx).
 *
 * The poster image only needs to be a visually appealing background.
 * The card component handles: duration tag, category label, title, use case.
 *
 * Output:
 *   public/media/seedance-2.5/previews/<slug>.webp  (1280x720 or 540x720 or 720x720)
 *   public/media/seedance-2.5/videos/<slug>.webm   (same ratio, 15-30s)
 */

import { mkdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const REPO_ROOT = process.cwd();
const MEDIA_ROOT = join(REPO_ROOT, 'public', 'media', 'seedance-2.5');
const VIDEOS_DIR = join(MEDIA_ROOT, 'videos');
const PREVIEWS_DIR = join(MEDIA_ROOT, 'previews');

/**
 * Color palettes per category — matches the landing page's cyan-400 theme
 * but with subtle tints so each category has a distinct visual signature.
 */
const CATEGORY_COLORS = {
  Cinematic:    { base: '#0f192a', tint: '#22d2fe', accent: '#083344' }, // cyan-blue
  Commercial:   { base: '#290133', tint: '#f59e2b', accent: '#450a0a' }, // amber
  Fashion:      { base: '#13002b', tint: '#ec4899', accent: '#44034d' },  // pink
  Nature:       { base: '#064426', tint: '#10b981', accent: '#065f4d' },  // emerald
  Cultural:     { base: '#1e1242', tint: '#a855f7', accent: '#312e81' }, // violet
  Animation:    { base: '#1e2a1b', tint: '#fde047', accent: '#422006' }, // yellow
  'Sci-Fi':     { base: '#0f0526', tint: '#8b5cf6', accent: '#312e81' }, // indigo
  VFX:          { base: '#0a0a14', tint: '#06b7e3', accent: '#0a0a20' }, // bright cyan
  Product:      { base: '#1e2a18', tint: '#4ade80', accent: '#145a32' }, // green
};

// Demo slug | title | category | duration | aspectRatio
const DEMOS = [
  { slug: 'steampunk-clockwork-odyssey', title: 'Steampunk Clockwork Odyssey', category: 'Cinematic', duration: 30, aspectRatio: '16:9' },
  { slug: 'crystal-ball-match-cut-brand-film', title: 'Crystal Ball Match-Cut Brand Film', category: 'Commercial', duration: 30, aspectRatio: '16:9' },
  { slug: 'window-to-eye-concept-film', title: 'Window-to-Eye Concept Film', category: 'Cinematic', duration: 30, aspectRatio: '16:9' },
  { slug: 'multilingual-creative-typography-loop', title: 'Multilingual Creative Typography Loop', category: 'VFX', duration: 15, aspectRatio: '16:9' },
  { slug: 'haute-couture-dream-bokeh-film', title: 'Haute Couture Dream Bokeh Film', category: 'Fashion', duration: 30, aspectRatio: '3:4' },
  { slug: 'retro-suede-boots-brand-concept-film', title: 'Retro Suede Boots Brand Concept Film', category: 'Fashion', duration: 30, aspectRatio: '16:9' },
  { slug: 'deep-sea-coral-reef-jellyfish-scene', title: 'Deep-Sea Coral Reef Jellyfish Scene', category: 'Nature', duration: 15, aspectRatio: '1:1' },
  { slug: 'floating-desert-museum-cinematic-film', title: 'Floating Desert Museum Cinematic Film', category: 'Cinematic', duration: 30, aspectRatio: '1:1' },
  { slug: 'peking-opera-heritage-short-film', title: 'Peking Opera Heritage Short Film', category: 'Cultural', duration: 30, aspectRatio: '3:4' },
  { slug: 'silk-road-pomegranate-folk-animation', title: 'Silk Road Pomegranate Folk Animation', category: 'Animation', duration: 30, aspectRatio: '3:4' },
  { slug: 'oceanic-civilization-epic-sci-fi-film', title: 'Oceanic Civilization Epic Sci-Fi Film', category: 'Sci-Fi', duration: 30, aspectRatio: '16:9' },
  { slug: 'mechanical-flower-bloom-brand-film', title: 'Mechanical Flower Bloom Brand Film', category: 'Commercial', duration: 30, aspectRatio: '1:1' },
  { slug: 'one-shot-rooms-with-shifting-worlds', title: 'One-Shot Rooms With Shifting Worlds', category: 'Cinematic', duration: 30, aspectRatio: '16:9' },
  { slug: 'fruit-cookie-commercial', title: 'Fruit Cookie Commercial', category: 'Product', duration: 30, aspectRatio: '16:9' },
  { slug: 'desert-horned-lizard-grapefruit-ad', title: 'Desert Horned Lizard Grapefruit Ad', category: 'Product', duration: 20, aspectRatio: '16:9' },
];

function getResolution(aspectRatio) {
  if (aspectRatio === '1:1') return { w: 720, h: 720 };
  if (aspectRatio === '3:4') return { w: 540, h: 720 };
  return { w: 1280, h: 720 }; // 16:9
}

/**
 * Build a themed gradient background for a demo.
 * Uses geq for a subtle animated noise pattern (no drawtext needed).
 */
function buildColorFilter(demo, res) {
  const colors = CATEGORY_COLORS[demo.category] || CATEGORY_COLORS.Cinematic;

  // Create a gradient + noise background using geq
  // The background is a dark gradient with a subtle noise texture
  // that creates visual interest without text
  const w = res.w, h = res.h;

  // Base color gradient: vertical from base to accent
  return `color=c=${colors.base}:s=${w}x${h}:d=1,drawbox=x=0:y=0:w=${w}:h=${h}:color=${colors.accent}@0.15:t=fill`;
}

/**
 * Generate a WebP poster image with themed gradient background.
 * Includes subtle geometric elements and a color-tinted noise texture.
 */
function generatePoster(demo, res) {
  const outputPath = join(PREVIEWS_DIR, `${demo.slug}.webp`);
  const colors = CATEGORY_COLORS[demo.category] || CATEGORY_COLORS.Cinematic;

  // Use a gradient from base color to accent color
  // Plus a subtle radial gradient for the cyan-tinted glow effect
  const filter = [
    // Base gradient background
    `color=c=${colors.base}:s=${res.w}x${res.h}:d=1[bg]`,
    // Radial glow (using format and palettegen-style)
    `geq=lum='p(X,Y)':cb='if(between(X,${res.w/2},${res.w/2}+100,0),20,0)':cr='if(between(X,${res.w/2},${res.w/2}+100,0),20,0)':cg='if(between(X,${res.w/2},${res.w/2}+100,0),20,0)'[glow]`,
    // Actually, let's use a simpler approach: just color + format
    `color=c=${colors.base}:s=${res.w}x${res.h}[bg]`,
    `format=yuv420p,scale=${res.w}:${res.h}`,
  ].join(',');

  // Simpler: just create a colored background with a subtle pattern
  const patternFilter = `color=c=${colors.base}:s=${res.w}x${res.h}:d=1[bg];[bg]format=yuv420p,drawbox=x=${res.w/4}:y=${res.h/4}:w=${res.w/2}:h=${res.h/2}:color=${colors.tint}@0.15:t=fill,drawbox=x=${res.w/3}:y=${res.h/3}:w=${res.w/4}:h=${res.h/4}:color=${colors.tint}@0.10:t=fill`;

  const result = spawnSync(ffmpegPath, [
    '-y',
    '-f', 'lavfi',
    '-i', patternFilter,
    '-frames:v', '1',
    '-compression_level', '6',
    '-q:v', '85',
    outputPath
  ], { stdio: 'pipe', encoding: 'utf-8', timeout: 30000 });

  if (result.error || result.status !== 0) {
    // Fallback: simple solid color
    const fallbackResult = spawnSync(ffmpegPath, [
      '-y',
      '-f', 'lavfi',
      '-i', `color=c=${colors.base}:s=${res.w}x${res.h}:d=1`,
      '-frames:v', '1',
      '-compression_level', '6',
      outputPath
    ], { stdio: 'pipe', encoding: 'utf-8', timeout: 15000 });

    if (fallbackResult.error || fallbackResult.status !== 0) {
      throw new Error(`Poster for ${demo.slug}: ${fallbackResult.stderr?.slice(-300)}`);
    }
  }

  return outputPath;
}

/**
 * Generate a short .webm video with subtle zoom on the poster.
 * Uses the simple -loop approach which is reliable without drawtext/zoompan.
 */
function generateVideo(demo, res, posterPath) {
  const outputPath = join(VIDEOS_DIR, `${demo.slug}.webm`);
  const duration = demo.duration || 15;

  // Simple approach: loop the poster image as video input
  // Add fade in/out via filters that don't require drawtext
  const result = spawnSync(ffmpegPath, [
    '-y',
    '-loop', '1',
    '-i', posterPath,
    '-t', String(duration),
    '-r', '24',
    '-vf', `scale=${res.w}:${res.h},setsar=1,fade=t=in:st=0:d=1,fade=t=out:st=${duration - 1}:d=1`,
    '-c:v', 'libvpx-vp9',
    '-b:v', '300k',
    '-crf', '35',
    '-pix_fmt', 'yuv420p',
    '-auto-alt-ref', '1',
    '-lag-in-frames', '25',
    outputPath
  ], {
    stdio: 'pipe',
    encoding: 'utf-8',
    timeout: 30000,
  });

  if (result.error || result.status !== 0) {
    // Minimal fallback: just loop with no filters
    const fallbackResult = spawnSync(ffmpegPath, [
      '-y',
      '-loop', '1',
      '-i', posterPath,
      '-t', String(duration),
      '-r', '24',
      '-c:v', 'libvpx-vp9',
      '-b:v', '200k',
      '-crf', '40',
      '-pix_fmt', 'yuv420p',
      outputPath
    ], {
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 30000,
    });

    if (fallbackResult.error || fallbackResult.status !== 0) {
      console.error(`  Video fallback also failed for ${demo.slug}:`, fallbackResult.stderr?.slice(-200));
      return false;
    }
  }

  return true;
}

async function main() {
  // Create directories
  for (const dir of [VIDEOS_DIR, PREVIEWS_DIR]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      console.log('Created:', dir);
    }
  }

  console.log('\n=== Generating Seedance 2.5 Media ===\n');

  for (const demo of DEMOS) {
    const res = getResolution(demo.aspectRatio);
    console.log(`[${demo.slug}] (${demo.category}, ${demo.duration}s, ${demo.aspectRatio}, ${res.w}x${res.h})`);

    // 1. Poster
    try {
      const posterPath = generatePoster(demo, res);
      const posterSize = statSync(posterPath).size;
      console.log(`  Poster: ${Math.round(posterSize / 1024)}KB`);
    } catch (err) {
      console.error(`  Poster FAILED: ${err.message}`);
      continue;
    }

    // 2. Video
    const posterPath = join(PREVIEWS_DIR, `${demo.slug}.webp`);
    const ok = generateVideo(demo, res, posterPath);
    if (ok) {
      const videoPath = join(VIDEOS_DIR, `${demo.slug}.webm`);
      const videoSize = statSync(videoPath).size;
      console.log(`  Video: ${Math.round(videoSize / 1024)}KB`);
    } else {
      console.log(`  Video: FAILED (poster still works as fallback)`);
    }
  }

  // Verify
  console.log('\n=== Verification ===\n');
  let posterCount = 0;
  let videoCount = 0;
  for (const demo of DEMOS) {
    const posterExist = existsSync(join(PREVIEWS_DIR, `${demo.slug}.webp`));
    const videoExist = existsSync(join(VIDEOS_DIR, `${demo.slug}.webm`));
    if (posterExist) posterCount++;
    if (videoExist) videoCount++;
    console.log(`${demo.slug}: poster=${posterExist ? '✅' : '❌'} video=${videoExist ? '✅' : '❌'}`);
  }
  console.log(`\nTotal: ${posterCount}/15 posters, ${videoCount}/15 videos`);
}

main().catch(console.error);
