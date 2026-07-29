#!/usr/bin/env node

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const thumbnails = [
    { id: 'balloon-flyaway', name: 'Balloon Flyaway', prompt: 'Person floating upward into dark sky clutching colorful balloons, dramatic upward motion, dark atmospheric background with purple undertones, professional photography, cinematic lighting' },
    { id: 'blow-kiss', name: 'Blow Kiss', prompt: 'Person mid-kiss gesture with fingers touching lips then extending toward camera, dramatic studio lighting with rim light, dark moody background with blue undertones, professional portrait' },
    { id: 'body-shake', name: 'Body Shake', prompt: 'Person shaking body with motion blur effect, energetic movement frozen mid-action, dark background with particle effects, dramatic sports photography style' },
    { id: 'break-glass', name: 'Break Glass', prompt: 'Person mid-action breaking through shattered glass pane, shards flying outward, dramatic action shot, dark background with sharp lighting, VFX movie still' },
    { id: 'carry-me', name: 'Carry Me', prompt: 'Romantic scene of person being lifted in arms, cinematic lighting, dark moody background with soft purple glow, wedding photography style' },
    { id: 'cartoon-doll', name: 'Cartoon Doll', prompt: 'Person rendered as cute 3D cartoon doll character with large expressive eyes, vibrant colors, dark gradient background with pink and purple, toy commercial style' },
    { id: 'cheek-kiss', name: 'Cheek Kiss', prompt: 'Close-up of cheek kiss moment, soft romantic lighting, dark background with subtle warm glow, intimate portrait photography' },
    { id: 'child-memory', name: 'Child Memory', prompt: 'Person transformed into younger version as child, nostalgic dreamy aesthetic with soft focus, dark vignette with warm sepia tones, cinematic flashback' },
    { id: 'couple-arrival', name: 'Couple Arrival', prompt: 'Couple walking toward camera in dramatic slow motion, cinematic lighting, dark atmospheric background with blue undertones, movie poster style' },
    { id: 'fairy-me', name: 'Fairy Me', prompt: 'Person with glowing fairy wings and magical particles floating around, ethereal lighting with purple and pink glow, dark mystical forest background, fantasy photography' },
    { id: 'fashion-stride', name: 'Fashion Stride', prompt: 'Person striding confidently on fashion runway, dramatic catwalk lighting from above, dark stage background with spotlight, high fashion editorial' },
    { id: 'fisherman', name: 'Fisherman', prompt: 'Person dressed as fisherman casting fishing line at golden hour, dramatic warm lighting, dark moody water background with reflections, outdoor adventure photography' },
    { id: 'flower-receive', name: 'Flower Receive', prompt: 'Person receiving flowers with surprised delighted expression, romantic soft lighting with warm glow, dark background, engagement photo style' },
    { id: 'flying', name: 'Flying', prompt: 'Person flying through air with cape flowing behind in superman pose, dramatic sky with dark clouds, cinematic superhero movie still' },
    { id: 'french-kiss', name: 'French Kiss', prompt: 'Couple mid-french kiss in romantic embrace, soft dramatic lighting with warm tones, dark background with subtle glow, movie romance scene' },
    { id: 'gender-swap', name: 'Gender Swap', prompt: 'Split-screen transformation showing person with dramatically different gender presentation, dramatic reveal lighting, dark moody background, transformation photography' },
    { id: 'golden-epoch', name: 'Golden Epoch', prompt: 'Person in 1920s vintage golden era style, sepia tones with art deco aesthetic, dramatic vintage lighting, classic Hollywood portrait style' },
    { id: 'hair-swap', name: 'Hair Swap', prompt: 'Person with dramatically different hairstyle showing transformation, before-after aesthetic, dramatic studio lighting with purple rim light, fashion editorial' },
    { id: 'hugging', name: 'Hugging', prompt: 'Warm hugging embrace between two people, soft romantic lighting with warm golden glow, dark background, emotional portrait photography' },
    { id: 'jiggle-up', name: 'Jiggle Up', prompt: 'Person jumping with jiggle physics effect frozen mid-air, energetic motion, dark background with motion blur edges, dynamic sports photography' },
    { id: 'kissing-pro', name: 'Kissing Pro', prompt: 'Couple in passionate kiss pose like movie poster, dramatic cinematic lighting with rim light, dark background, theatrical romance photography' },
    { id: 'live-memory', name: 'Live Memory', prompt: 'Person appearing as living memory with ethereal glow and soft focus, dreamy nostalgic aesthetic, dark vignette with warm light, cinematic flashback' },
    { id: 'love-drop', name: 'Love Drop', prompt: 'Person with heart-shaped tears or droplets falling, emotional romantic scene with pink glow, dark background with soft lighting, dramatic portrait' },
    { id: 'melt', name: 'Melt', prompt: 'Person melting like wax with dripping effect, surreal artistic style, dark background with warm amber lighting, conceptual art photography' },
    { id: 'minecraft', name: 'Minecraft', prompt: 'Person in Minecraft blocky 3D world with voxel aesthetic, pixelated terrain and blocks, dark game-like background with pixel art style, gaming screenshot' },
    { id: 'muscling', name: 'Muscling', prompt: 'Person flexing muscles showing strength, dramatic bodybuilding pose with spotlight, dark background with dramatic lighting, fitness photography' },
    { id: 'nap-me', name: 'Nap Me', prompt: 'Person sleeping peacefully in bed with soft morning light from window, cozy peaceful atmosphere, dark bedroom with warm tones, lifestyle photography' },
    { id: 'paperman', name: 'Paperman', prompt: 'Person transformed into paper cutout with 2D flat aesthetic, colorful geometric shapes, dark layered paper background, artistic illustration style' },
    { id: 'pilot', name: 'Pilot', prompt: 'Person in pilot uniform with headset in cockpit, dramatic aviation lighting with blue instrument glow, dark interior with window showing sky' },
    { id: 'pinch', name: 'Pinch', prompt: 'Person pinching small glowing orb between fingers, close-up macro shot with dramatic lighting, dark background with light particles, detail photography' },
    { id: 'pixel-me', name: 'Pixel Me', prompt: 'Person rendered as pixel art character in 8-bit aesthetic, retro gaming style, dark digital background with scanlines, pixel art portrait' },
    { id: 'romantic-lift', name: 'Romantic Lift', prompt: 'Person lifting partner in romantic embrace, slow motion capture, cinematic lighting with warm glow, dark background, romantic movie scene' },
    { id: 'sexy-me', name: 'Sexy Me', prompt: 'Person in glamorous sexy pose with dramatic fashion lighting, dark studio background with purple rim light, high fashion editorial style' },
    { id: 'slice-therapy', name: 'Slice Therapy', prompt: 'Person with body sliced revealing interior cross-section view, medical scan aesthetic with blue glow, dark background, sci-fi conceptual art' },
    { id: 'soul-depart', name: 'Soul Depart', prompt: 'Person with ghostly soul or spirit separating from body in ethereal transparent form, mystical dark background with purple energy, paranormal photography' },
    { id: 'split-stance', name: 'Split Stance', prompt: 'Person in powerful martial arts split stance pose, dramatic action lighting, dark background with spotlight, martial arts movie still' },
    { id: 'squid-game', name: 'Squid Game', prompt: 'Person in iconic Squid Game green tracksuit with triangle mask, ominous dark background with red emergency light, dystopian thriller aesthetic' },
    { id: 'toy-me', name: 'Toy Me', prompt: 'Person transformed into realistic toy action figure in plastic packaging on display stand, toy product photography, dark background with studio lighting' },
    { id: 'walk-forward', name: 'Walk Forward', prompt: 'Person walking directly toward camera in slow motion, dramatic approach shot with shallow depth of field, dark background with blur' },
    { id: 'zoom-in-fast', name: 'Zoom In Fast', prompt: 'Extreme fast zoom into person face with motion blur edges and radial blur effect, dramatic zoom impact, dark background with light streaks' },
    { id: 'zoom-out-fast', name: 'Zoom Out Fast', prompt: 'Fast zoom out from person face revealing surroundings with expanding motion blur, dramatic reveal, dark background with environmental context' }
];

const OUTPUT_DIR = path.join(__dirname, 'public', 'thumbnails', 'templates');

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                downloadImage(response.headers.location, filepath).then(resolve).catch(reject);
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => {});
            reject(err);
        });
    });
}

async function generateWithPuter(prompt, outputPath) {
    const { for: promptForAI } = await import('puter.js');
    
    console.log(`Generating: ${path.basename(outputPath)}`);
    
    try {
        const img = await puter.ai.txt2img(prompt, {
            model: 'flux-schnell'
        });
        
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 640, 360);
        
        const buffer = canvas.toBuffer('image/webp');
        fs.writeFileSync(outputPath, buffer);
        
        console.log(`Saved: ${outputPath}`);
    } catch (error) {
        console.error(`Error generating ${outputPath}:`, error.message);
    }
}

async function main() {
    ensureDir(OUTPUT_DIR);
    
    console.log(`Generating ${thumbnails.length} thumbnails...`);
    console.log(`Output directory: ${OUTPUT_DIR}`);
    
    for (let i = 0; i < thumbnails.length; i++) {
        const thumb = thumbnails[i];
        const outputPath = path.join(OUTPUT_DIR, `${thumb.id}.webp`);
        
        console.log(`[${i + 1}/${thumbnails.length}] ${thumb.name}`);
        
        await generateWithPuter(thumb.prompt, outputPath);
        
        await new Promise(r => setTimeout(r, 2000));
    }
    
    console.log('Done!');
}

main().catch(console.error);
