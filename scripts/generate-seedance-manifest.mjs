#!/usr/bin/env node
/**
 * Regenerates the Seedance 2.5 demo manifest from a curated prompt catalog.
 *
 *   node scripts/generate-seedance-manifest.mjs
 *
 * This script is a manual curation tool — the awesome-seedance-2.5-api-prompts
 * repo does not ship a machine-readable gallery.json, so prompts are curated
 * directly into this script's DEMOS array.
 *
 * Writes:
 *   src/data/seedanceDemos.ts    normalized metadata (small, imported by every section)
 *   src/data/seedancePrompts.ts  full prompt text (large, lazy-imported by the prompt modal only)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const outDir = join(REPO_ROOT, 'src', 'data');

const DEMOS = [
  {
    slug: 'steampunk-clockwork-odyssey',
    title: 'Steampunk Clockwork Odyssey',
    category: 'Cinematic',
    useCase: 'Epic fantasy adventures and premium brand storytelling',
    duration: 30,
    aspectRatio: '16:9',
    tags: ['steampunk', 'cinematic', 'fantasy', '3d-motion-graphics'],
    workflow: 't2v',
    prompt: `A premium, highly cinematic 30-second 3D motion-graphics sequence in an exquisite steampunk and vintage miniature-landscape style, paired with continuous, fluid orbiting and penetrating camera movement.
[0-10s]: Macro close-up of an antique brass clock face. It miraculously unfolds layer by layer into interlocking rotating gear rings and volumetric mist. The camera dives downward through the gears as a mechanical ornithopter spirals upward from a miniature canyon made of stacked aged books.
[10-20s]: The camera glides forward along the ornithopter's path and seamlessly passes into a rapidly spinning ornate brass zoetrope, where galloping mechanical horses appear as projected light and shadow. The projection leaps out of the box, instantly transforming into a brass levitating cable car traveling along glowing copper rails through a forest of mechanical gears, bathed in cinematic golden-hour light.
[20-30s]: The camera elegantly pans downward. Below the cable car, a delicate wind-up wooden mechanical sailing ship cuts through deep-blue glass waves. At the end of the waves, the scene seamlessly evolves into a glowing giant moon. Silhouettes of explorers holding swaying lanterns struggle along a crystal-vein mountain ridge beneath the stars. The camera spirals smoothly outward through ethereal clouds and returns to the grand ticking brass clock face.
Technical specifications: hyper-real mechanical textures, rich brass and gold tones, cinematic shallow depth of field. Smooth, continuous seamless travel shots, with a strong epic feeling and fantasy-adventure atmosphere.`,
  },
  {
    slug: 'crystal-ball-match-cut-brand-film',
    title: 'Crystal Ball Match-Cut Brand Film',
    category: 'Commercial',
    useCase: 'High-energy brand films and music-synced product reveals',
    duration: 30,
    aspectRatio: '16:9',
    tags: ['brand-film', 'commercial', 'match-cut', 'music-sync'],
    workflow: 't2v',
    prompt: `A fast-paced, cinematic match-cut short film synchronized to dynamic electronic beats. A flawless crystal ball remains fixed at the center of the frame throughout, with a glowing logo engraved inside. The crystal ball stays in extremely sharp focus while the background switches at high speed in perfect sync with powerful music hits.
Scene 1: Macro close-up. Cinematic water splashes fly around the crystal ball, refracting complex light and shadow.
Scene 2: Morning vintage cafe. The crystal ball sits on a raw wooden tabletop; the background shows rising coffee steam and blurred commuters outside the window.
Scene 3: Golden-hour evening. A skateboarder casually tosses and catches the crystal ball with one hand; the background is a rapidly receding street scene with beautiful sunset backlight.
Scene 4: A feverish music festival. Hands raise the crystal ball high, refracting dazzling stage lasers in the background.
Scene 5: A lively family-party dining table. The crystal ball rests in the center, surrounded by blurred figures clinking glasses and reaching for food.
Scene 6: A dim cinema. Two hands hold the crystal ball while faint light from a giant screen flows across its surface.
Scene 7: The crystal ball sits on a violently vibrating speaker diaphragm, then cuts seamlessly with the music climax to the center of spinning DJ turntables.
Scene 8: Outdoor camping at night. The background becomes warm campfire light and swaying string-light bokeh.
Final toss: On the final bass hit, the crystal ball is thrown high out of the top of the frame. Cut instantly to a pure black background, with minimalist white text appearing in the center.
Edit tightly to the energetic BGM rhythm with beat-matched transitions. Use top-tier cinematic color grading, realistic glass refraction and transmission, complex ray tracing, and global illumination. Keep the subject ultra-sharp while the background carries strong dynamic blur and high visual impact.`,
  },
  {
    slug: 'window-to-eye-concept-film',
    title: 'Window-to-Eye Concept Film',
    category: 'Cinematic',
    useCase: 'Cinematic brand concepts with multi-reference image sequences',
    duration: 30,
    aspectRatio: '16:9',
    tags: ['concept-film', 'cinematic', 'multi-reference', 'brand'],
    workflow: 'i2v',
    prompt: `A cinematic brand-concept short film. @image1 is the first frame. The image shakes slightly as the camera slowly pushes in toward tree shadows rapidly receding outside the window. The retreating shadows accelerate, then suddenly cut to @image2 where the speed slows dramatically and the camera glides gently forward along a stream with birdsong and flowers.
The camera tilts downward into the water, with bubble sound effects underwater. A group of orange jellyfish swims gracefully past the lens @image3. The camera slowly pulls back; a school of small fish crosses the frame and moves from the water into the window interior @image4. A girl looks left and right, watching the fish.
The camera slowly pulls back and the image falls out of focus. It refocuses as the picture becomes clear again, then switches to the rhythm of the music: Chinese garden flower window @image5 with rotating light, church stained-glass window, airplane cabin window, dome skylight, bay window, venetian blinds, European dormer window, door peephole, camera viewfinder frame, bird eye, and finally a human-eye close-up.
The image holds on the human eye close-up. The eye closes and the screen goes black, then suddenly opens again with a brand reveal at the center of the eye on a bass hit.`,
  },
  {
    slug: 'multilingual-creative-typography-loop',
    title: 'Multilingual Creative Typography Loop',
    category: 'VFX',
    useCase: 'Seamless looping typography animations and kinetic text content',
    duration: 15,
    aspectRatio: '16:9',
    tags: ['typography', 'loop', 'kinetic', 'vfx', 'multi-language'],
    workflow: 't2v',
    prompt: `A 15-second seamless looping creative typography animation video, 4K, 30 fps. Each language lasts about 1.2 seconds. Transitions are created through text dissolving, morphing, or drifting into particles, with no hard cuts. The background music has a clear rhythm and strong beat hits.
0-1.2s Chinese "创造" (Create): Op-art pure black background. Black-and-white concentric circles expand outward from the center to form a visual tunnel. The white 3D Chinese characters slowly protrude from the center toward the camera in bold sans-serif form, with subtle edge shadows. The circles ripple and distort like water as the text advances.
1.2-2.4s English "Create": The Chinese characters dissolve into ink-like particles and reassemble into "Create". Neon cyan and magenta gradients flow across the letters. The background becomes a dark grid with scanning light beams. The word stretches slightly with elastic motion on the beat.
2.4-3.6s Japanese: The English letters shatter into paper-like fragments and fold into Japanese kanji. The background becomes warm washi paper texture with soft gold dust. The characters appear as brush ink, then gain a glossy lacquer edge.
3.6-4.8s Korean: Ink strokes curve into Hangul. The background shifts to a clean white design space with floating geometric blocks. The text is pearl white with a fine blue rim light.
4.8-6.0s French: Letters bloom like perfume vapor over a deep burgundy background. The accent mark appears as a small sparkling stroke, landing precisely on the beat.
6.0-7.2s Spanish: Warm orange and deep blue mosaic tiles rotate into place. The text becomes sunlit, thick, and sculptural, with long shadows sliding across it.
7.2-8.4s Arabic: Particles sweep from right to left and become elegant Arabic calligraphy. The background turns midnight blue with gold star-like specks. The strokes glow softly and flow like liquid metal.
8.4-9.6s Hindi: The letters emerge from colorful powder and festival-like particles. The background carries saffron, teal, and pink gradients, with soft cloth texture.
9.6-10.8s Thai: The typography forms from water ripples and glass reflections. The background is a luminous tropical green with highlights like sunlight through leaves.
10.8-12.0s Russian: The text appears as frosted crystal on a cold blue background. Fine ice particles fly outward as the letters lock into place.
12.0-13.2s Portuguese: The letters swing in with a playful tiled-wave motion, using bright green and yellow accents. The background feels clean, sunny, and energetic.
13.2-15.0s Finale: All words from different languages orbit inward as particles and assemble around the central text. The background becomes a deep black stage with a radiant circular light ring. The final frame holds briefly, then the light ring collapses back into the first concentric-circle tunnel, creating a perfect loop.`,
  },
  {
    slug: 'haute-couture-dream-bokeh-film',
    title: 'Haute Couture Dream Bokeh Film',
    category: 'Fashion',
    useCase: 'Runway-grade fashion films and luxury brand motion',
    duration: 30,
    aspectRatio: '3:4',
    tags: ['fashion', 'couture', 'bokeh', 'luxury', 'runway'],
    workflow: 't2v',
    prompt: `Overall style: a 30-second couture brand-level visual blockbuster with strong cinematic polish and premium texture. Emphasize dreamy bokeh, silky motion-blur transitions, volumetric lighting, and ultra-real material detail.
[0-5s] Dreamlike prologue and macro close-up: an ultra-high-definition macro shot of a slender hand reaching into the air. The fingertips touch colorful star-like bokeh. As the fingers pass through the light, the points of light turn into flowing silk threads and wrap around the wrist.
[5-12s] High-fashion entrance: a model in an elegant couture silhouette walks through a dark reflective space. The dress surface alternates between translucent gauze, liquid metal, and glittering crystals. The camera circles slowly, catching rim light and delicate fabric motion.
[12-20s] Surreal transformation: the bokeh expands into floating flower petals and glass fragments. The model turns gently; light flows across the face and shoulders, and the scene transitions through smooth motion blur into a brighter dreamlike stage.
[20-30s] Finale: the model pauses under a halo of warm light. Silk, petals, and crystal particles spiral upward and dissolve into a clean brand-style ending frame. Keep the tone refined, dreamlike, luxurious, and cinematic.`,
  },
  {
    slug: 'retro-suede-boots-brand-concept-film',
    title: 'Retro Suede Boots Brand Concept Film',
    category: 'Fashion',
    useCase: 'Premium product films and high-fashion brand concepts',
    duration: 30,
    aspectRatio: '16:9',
    tags: ['fashion', 'product', 'brand', 'commercial'],
    workflow: 't2v',
    prompt: `A 30-second premium brand-concept short film with strong visual tension. The opening uses a surreal upside-down perspective. The camera flips with gravity to show a model wearing vintage suede boots stepping lightly across rolling red dunes. Macro close-ups reveal the matte nap of the boot surface and coarse red sand grains clinging to it.
Then cut into a montage full of weightlessness and dreamlike color: young male and female models fall backward lightly through amber wind-sand currents and cold edge rim light. The camera rapidly cuts to razor-sharp facial close-ups, where sand passes over eyelashes dusted with tiny gold particles. Fabrics, hair, and sand move in slow motion.
The middle section shows boots landing on mirror-like wet sand, footsteps turning into rippling liquid gold. The camera glides along the boot edge, then passes through a swirl of red dust into an abstract desert runway. Final shot: the model stands alone on a dune ridge at sunset. Red sand rises behind the body like a curtain, forming a clean, high-fashion brand silhouette. Use cinematic grading, premium commercial texture, realistic suede and sand detail, elegant rhythm, and no clutter.`,
  },
  {
    slug: 'deep-sea-coral-reef-jellyfish-scene',
    title: 'Deep-Sea Coral Reef Jellyfish Scene',
    category: 'Nature',
    useCase: 'Nature documentaries and immersive underwater content',
    duration: 15,
    aspectRatio: '1:1',
    tags: ['nature', 'underwater', 'documentary', 'jellyfish'],
    workflow: 't2v',
    prompt: `A deep-sea coral reef scene in a tropical underwater world with a blue overall tone. Large areas of healthy, thriving colorful living coral, including branching coral, brain coral, plate coral, and soft sea-fan coral. Schools of tropical fish swim naturally through the reef. The foreground is clear and vivid; the background gradually shifts blue-gray with reduced contrast. Natural light from above is filtered through seawater, forming soft volumetric beams. Tiny suspended particles and slight water movement are visible. Soft coral sways gently and fish movement is smooth and coordinated. Add a group of translucent pale-purple glowing jellyfish, 8 to 12 in total, slowly appearing in different sizes. Their umbrella bodies pulse gently with flowing tentacles, moving elegantly through the coral reef while the whole scene stays calm, realistic, and dreamlike.`,
  },
  {
    slug: 'floating-desert-museum-cinematic-film',
    title: 'Floating Desert Museum Cinematic Film',
    category: 'Cinematic',
    useCase: 'Architectural showcases and surreal brand films',
    duration: 30,
    aspectRatio: '1:1',
    tags: ['architecture', 'desert', 'cinematic', 'museum'],
    workflow: 't2v',
    prompt: `Cinematic and premium. A golden desert at dawn. A minimalist white art-museum building floats above the dunes, with delicate stone texture and soft reflections on its surface. Sunlight passes through windblown sand to form volumetric rays, and distant dunes have clear layers. The shot begins with an ultra-wide desert panorama and slowly pushes forward through drifting sand into the floating building. Inside are suspended sculptures, translucent silk installations, and a character wearing a white robe, with the fabric moving naturally in the wind. The camera performs a smooth orbit around the character. At the end, the building walls slowly open, revealing a huge sunrise and a silent desert horizon.`,
  },
  {
    slug: 'peking-opera-heritage-short-film',
    title: 'Peking Opera Heritage Short Film',
    category: 'Cultural',
    useCase: 'Cultural heritage stories and Eastern aesthetic narratives',
    duration: 30,
    aspectRatio: '3:4',
    tags: ['cultural', 'heritage', 'peking-opera', 'eastern-aesthetics'],
    workflow: 't2v',
    prompt: `A short film about the intangible cultural heritage of Peking Opera, cinematic, warm, restrained, and rooted in Eastern aesthetics. In a traditional troupe backstage area and handcraft workshop, an old master quietly makes opera headdresses, arranges costumes, and paints facial makeup. The hand details are delicate; silk threads, beads, pigments, and embroidered patterns have rich texture. A young apprentice watches seriously nearby, then carefully receives a tool and completes a small step under the master's guidance. The master straightens the apprentice's headwear and collar, as if gently passing on both a craft and an emotion. In the final shot, the young performer is fully dressed and stands beside the stage just before entering. A soft light illuminates the costume and side profile, creating a quiet, moving inheritance moment.`,
  },
  {
    slug: 'silk-road-pomegranate-folk-animation',
    title: 'Silk Road Pomegranate Folk Animation',
    category: 'Animation',
    useCase: 'Brand animations and culturally-inspired motion graphics',
    duration: 30,
    aspectRatio: '3:4',
    tags: ['animation', 'folk', 'silk-road', 'flat-design', 'cultural'],
    workflow: 't2v',
    prompt: `Overall style: mineral-pigment flat animation with Eastern and Silk Road decorative aesthetics. Use cinnabar red, ochre, malachite green, ultramarine, and gold accents, with paper and mural textures. Keep the image layered and flat; do not use live-action photography or 3D realism. The rhythm moves from stillness to motion and back to stillness, emphasizing the abundant journey "from land to cup" with lively Western-Regions-style music.
Shot 1, first fruit on the branch, abundant opening (0-4s): Ochre and cinnabar color blocks bloom across a Silk Road painting surface. A pomegranate branch stretches in from the right. Leaves and fruit are outlined with decorative linework. A ripe pomegranate slowly appears, and gold dust glints around it.
Shot 2, fruit splitting and seeds flowing (4-9s): The pomegranate gently opens. Red seeds pour out like jewels, forming rhythmic patterns across the paper. The movement is decorative rather than realistic, with mineral-pigment particles and mural texture.
Shot 3, Silk Road journey (9-16s): The seeds become a flowing red path. Camels, merchants, patterned fabrics, and distant city silhouettes appear as flat decorative motifs. The camera pans horizontally like a handscroll, with layered mountains, clouds, and gold outlines.
Shot 4, harvest and sharing (16-23s): The red path returns to an orchard and a table. Hands place pomegranates, cups, and fruit plates in a symmetrical composition. The palette becomes richer and warmer, creating a festive sense of abundance.
Shot 5, final stillness (23-30s): Pomegranate juice fills a cup. The surface of the liquid reflects gold ornament patterns. The whole image slowly settles into a mural-like poster composition, with fruit, leaves, cups, and Silk Road motifs arranged around the center.`,
  },
  {
    slug: 'oceanic-civilization-epic-sci-fi-film',
    title: 'Oceanic Civilization Epic Sci-Fi Film',
    category: 'Sci-Fi',
    useCase: 'Sci-fi epics and concept films with cinematic scale',
    duration: 30,
    aspectRatio: '16:9',
    tags: ['sci-fi', 'epic', 'ocean', 'concept-film', 'cinematic'],
    workflow: 't2v',
    prompt: `Theme: "The Fallen Theater: Oceanic Civilization". Epic sci-fi, Dune x Interstellar atmosphere, no real human characters, sculptural lifeforms.
[0-5s | Cosmic opening: the ocean as planetary memory] A deep-blue ocean fills the panoramic frame. The deep water shows layered structures like a liquid universe inside a planet. The camera slowly descends vertically from high altitude, passing through clouds and sea mist into the ocean surface. The surface ripples like metallic film and refracts irregular cracks of sunlight.
[5-10s | Entering the ruins] The camera breaks through the water and continues downward. Giant stone columns and alien temple structures appear beneath the sea. They look like the remains of a lost civilization, covered in coral-like mineral growth. Volumetric light pierces the water, revealing suspended stardust-like particles.
[10-18s | Sculptural lifeforms] Massive sculptural organisms awaken among the ruins. Their bodies resemble stone, shell, and polished metal, moving slowly and solemnly. They do not behave like animals but like living monuments. The camera spirals around them, emphasizing scale, ritual, and sacred silence.
[18-25s | Collapse and reconstruction] The alien temple begins to collapse without chaos. Blocks, columns, and fragments float apart, then reorganize into a new monumental structure. Water currents, dust, and light wrap around the architecture as if an ancient ceremony is being performed.
[25-30s | Abyssal finale] The camera pulls back to reveal the entire oceanic civilization as a colossal temple hidden under the sea. A grand spiral of stardust and water forms above it. The image should feel sacred, lonely, immense, and cinematic, with high dynamic range and realistic sci-fi texture.`,
  },
  {
    slug: 'mechanical-flower-bloom-brand-film',
    title: 'Mechanical Flower Bloom Brand Film',
    category: 'Commercial',
    useCase: 'Tech brand reveals and product demonstration films',
    duration: 30,
    aspectRatio: '1:1',
    tags: ['tech', 'brand', 'product', 'mechanical', 'macro'],
    workflow: 't2v',
    prompt: `Theme: "Mechanical Flower Bloom". Highlight the video-generation model's strengths in lighting, art detail, realism, camera movement, and cinematic character. The overall style is a high-end technology brand advertisement with strong visual impact. Use a one-shot macro push-in: begin with a metal flower bud in darkness, gradually enter the precision mechanical structure inside the petals, and end with the mechanical flower fully blooming as light spreads outward in a climactic frame. Require realistic physical lighting, refined metal and glass materials, delicate mechanical motion, stable composition, cinematic color grading, and no text.`,
  },
  {
    slug: 'one-shot-rooms-with-shifting-worlds',
    title: 'One-Shot Rooms With Shifting Worlds',
    category: 'Cinematic',
    useCase: 'Multi-reference narrative sequences and character-driven stories',
    duration: 30,
    aspectRatio: '16:9',
    tags: ['multi-reference', 'narrative', 'one-shot', 'character'],
    workflow: 'i2v',
    prompt: `One continuous shot. The camera smoothly follows a person in a black coat (refer to @image1) walking from left to right through six connected rooms with different tones and atmospheres. Every room has the same structure: white walls, light herringbone wood floors, French double floor-to-ceiling windows, and white sheer curtains, based on @image2. Only the scenery outside the window and the indoor mood change. The protagonist walks at a constant speed and passes through every open doorway in the walls.
0-5s: First room, American-comic fight theme. The protagonist enters and fights a character (@image3), who is defeated.
5-10s: Second room, warm felt style. Outside the window is a sunflower field (@image4). The room has warm orange soft light, and a painter is painting sunflowers (@image5). After entering, the protagonist also becomes felt-style.
10-15s: Third room, sadness theme. The entire image becomes black-and-white comic freeze-frame animation. Rain falls outside, and the interior is cold, gray, and low-key. A person sits alone in an empty room.
15-20s: Fourth room, cyberpunk neon city. The windows reveal rain-soaked skyscrapers and colorful lights. Reflections slide across the floor and the protagonist's coat.
20-25s: Fifth room, festival night. Fireworks fill the sky outside, colorful indoor light flickers, and the protagonist is pulled into a cheering atmosphere.
25-30s: Final room, blank white space. The protagonist stands in the center and snaps their fingers. With the snap sound, the screen turns black and a brand word appears in the center. Overall: cinematic, high-fashion advertising style, with lighting determined entirely by the outside scene, strong emotional contrast, and no extra text.`,
  },
  {
    slug: 'fruit-cookie-commercial',
    title: 'Fruit Cookie Commercial',
    category: 'Product',
    useCase: 'CPG product ads and multi-flavor food commercials',
    duration: 30,
    aspectRatio: '16:9',
    tags: ['product', 'food', 'commercial', 'multi-reference'],
    workflow: 'i2v',
    prompt: `Bright, colorful advertising-film style. Fruit-flavored cookies are the main subject, including strawberry, apple, grape, and orange flavors. The strawberry flavor refers to @image1. Cookies and their matching fruits are arranged in strong, orderly geometric arrays. The overall image is clean, premium, and rhythmic. The opening uses fruit to quickly establish visual focus, referencing the composition of @video1 as the music beat enters. Then different flavored cookies are lined up neatly, with close-up cuts inspired by the motion and camera movement of @video2. In the climax, one cookie breaks open, fruit juice and crumbs burst outward in a controlled, beautiful way, and the four flavors rotate into a final symmetrical product layout. Use bright lighting, crisp textures, lively rhythm, and no messy background.`,
  },
  {
    slug: 'desert-horned-lizard-grapefruit-ad',
    title: 'Desert Horned Lizard Grapefruit Ad',
    category: 'Product',
    useCase: 'Playful product ads and character-driven food commercials',
    duration: 20,
    aspectRatio: '16:9',
    tags: ['product', 'food', 'character', 'commercial', '3d-animation'],
    workflow: 'i2v',
    prompt: `3D animated advertisement style, bright and transparent colors, with strong freshness and impact in the fruit flesh and juice. The overall feeling should be like a high-quality commercial animated short with a little exaggerated humor. The desert horned lizard character is cute, lively, and expressive, based on @image1. The visual texture should reference the soft natural light, delicate fuzz/skin texture, dreamy macro depth of field, and realistic yet playful feeling in the reference image.
0-3s: A sun-scorched desert. The air is distorted by heat, the sand is hot, and the distance looks smoky. A tiny desert horned lizard crawls slowly, looking exhausted and thirsty.
3-8s: The lizard discovers a giant grapefruit half-buried in the sand. The orange fruit flesh glows with juicy freshness. The lizard's eyes widen dramatically.
8-14s: It bites into the grapefruit. Juice bursts out like a small fountain. The desert sand around it instantly becomes cool and wet, with fruit pulp and droplets flying in slow motion.
14-20s: The fruit juice expands into a sparkling orange sea. The lizard is splashed into the water and pops up with a confused expression. The sea surface glitters like juice lit by sunlight. Use exaggerated splashing and wave sounds with comic timing.`,
  },
];

function parseDuration(value) {
  if (typeof value !== 'string') return undefined;
  const match = value.match(/([\d.]+)/);
  return match ? Number(match[1]) : undefined;
}

function ts(value) {
  return JSON.stringify(value);
}

const demos = DEMOS.map((entry, index) => ({
  id: index + 1,
  slug: entry.slug,
  title: entry.title,
  category: entry.category,
  useCase: entry.useCase,
  duration: entry.duration,
  aspectRatio: entry.aspectRatio,
  videoSrc: `/media/seedance-2.5/videos/${entry.slug}.webm`,
  posterSrc: `/media/seedance-2.5/previews/${entry.slug}.webp`,
  tags: entry.tags,
  workflow: entry.workflow,
  sourceAuthor: 'Anil-matcha',
  sourceUrl: 'https://github.com/Anil-matcha/awesome-seedance-2.5-api-prompts',
}));

const header = `// AUTO-GENERATED FILE — do not edit by hand.
//
// Regenerate with:
//   node scripts/generate-seedance-manifest.mjs
//
// Canonical prompt source:
//   https://github.com/Anil-matcha/awesome-seedance-2.5-api-prompts
//
// Prompt text upstream is CC-BY-4.0 ("Anil-matcha Seedance 2.5 Prompt Lab").
// Gallery media is third-party and is NOT relicensed by the upstream repo.
//
// This module is the single source of truth for every Seedance 2.5 landing section.
// Do not duplicate demo metadata inside components.
`;

const manifest = `${header}
export type SeedanceCategory =
${[...new Set(demos.map((d) => d.category))]
  .sort()
  .map((c) => `  | ${ts(c)}`)
  .join('\n')};

export type SeedanceDemo = {
  id: number;
  slug: string;
  title: string;
  category: SeedanceCategory;
  useCase: string;
  duration?: number;
  aspectRatio?: string;
  videoSrc: string;
  posterSrc: string;
  tags?: string[];
  workflow?: string;
  sourceAuthor?: string;
  sourceUrl?: string;
};

export const SEEDANCE_MODEL = 'Seedance 2.5 (ByteDance)';

export const seedanceDemos: SeedanceDemo[] = [
${demos
  .map((d) => {
    const lines = [
      `    id: ${d.id}`,
      `    slug: ${ts(d.slug)}`,
      `    title: ${ts(d.title)}`,
      `    category: ${ts(d.category)}`,
      `    useCase: ${ts(d.useCase)}`,
      d.duration !== undefined ? `    duration: ${d.duration}` : null,
      d.aspectRatio ? `    aspectRatio: ${ts(d.aspectRatio)}` : null,
      `    videoSrc: ${ts(d.videoSrc)}`,
      `    posterSrc: ${ts(d.posterSrc)}`,
      d.tags?.length ? `    tags: [${d.tags.map(ts).join(', ')}]` : null,
      d.workflow ? `    workflow: ${ts(d.workflow)}` : null,
      d.sourceAuthor ? `    sourceAuthor: ${ts(d.sourceAuthor)}` : null,
      d.sourceUrl ? `    sourceUrl: ${ts(d.sourceUrl)}` : null,
    ].filter(Boolean);
    return `  {\n${lines.join(',\n')},\n  }`;
  })
  .join(',\n')},
];

/* --------------------------------------------------------------- lookup utils */

const bySlug = new Map(seedanceDemos.map((demo) => [demo.slug, demo]));

export function getDemoBySlug(slug: string): SeedanceDemo | undefined {
  return bySlug.get(slug);
}

export function requireDemo(slug: string): SeedanceDemo {
  const demo = bySlug.get(slug);
  if (!demo) throw new Error(\`[seedanceDemos] unknown demo slug: \${slug}\`);
  return demo;
}

export function getDemosBySlugs(slugs: string[]): SeedanceDemo[] {
  return slugs.map((slug) => requireDemo(slug));
}

export function getFeaturedDemos(): SeedanceDemo[] {
  return seedanceDemos.filter((demo) => demo.id <= 6);
}

export function getDemosByCategory(category: string): SeedanceDemo[] {
  if (!category || category === 'All') return seedanceDemos;
  return seedanceDemos.filter((demo) => demo.category === category);
}

export const SEEDANCE_CATEGORIES: string[] = [
  'All',
  ${[...new Set(demos.map((d) => d.category))]
    .sort()
    .map((c) => `  ${ts(c)},`)
    .join('\n')}
];

export function getCategoryCounts(): Record<string, number> {
  return seedanceDemos.reduce<Record<string, number>>((acc, demo) => {
    acc[demo.category] = (acc[demo.category] || 0) + 1;
    return acc;
  }, {});
}

export function ratioToNumber(aspectRatio?: string, fallback = 16 / 9): number {
  if (!aspectRatio) return fallback;
  const [w, h] = aspectRatio.split(':').map(Number);
  if (!w || !h) return fallback;
  return w / h;
}

export function formatDuration(demo: SeedanceDemo): string {
  return demo.duration ? \`\${demo.duration}s\` : '—';
}

/* --------------------------------------------------------- prompt (lazy load) */

export async function loadDemoPrompt(slug: string): Promise<string | undefined> {
  const { seedancePrompts } = await import('./seedancePrompts');
  return seedancePrompts[slug];
}

/* ------------------------------------------------- CTA routing */

export const CATEGORY_ROUTES: Record<string, string> = {
  Cinematic: 'cinema',
  Commercial: 'commercial',
  Fashion: 'influencer',
  Nature: 'cinema',
  Cultural: 'cinema',
  Animation: 'cinema',
  'Sci-Fi': 'cinema',
  VFX: 'ai-vfx',
  Product: 'commercial',
};

export const DEFAULT_CREATE_ROUTE = 'cinema';
export const TEMPLATE_PREFIX = 'seedance-2.5-';

export function getCreateTarget(demo: SeedanceDemo) {
  const route = CATEGORY_ROUTES[demo.category] || DEFAULT_CREATE_ROUTE;
  const params = {
    template: \`\${TEMPLATE_PREFIX}\${demo.slug}\`,
    ref: 'seedance-2.5',
  };
  const query = new URLSearchParams(params).toString();
  return { route, params, href: \`/?\${query}#/\${route}\` };
}

export function getCreateUrl(demo: SeedanceDemo): string {
  return getCreateTarget(demo).href;
}
`;

const promptsJson = Object.fromEntries(
  DEMOS.map((d) => [d.slug, d.prompt]),
);

const jsManifest = `${header}
export const SEEDANCE_MODEL = 'Seedance 2.5 (ByteDance)';

export const seedanceDemos = [
${demos
  .map((d) => {
    const lines = [
      `  {`,
      `    id: ${d.id},`,
      `    slug: ${ts(d.slug)},`,
      `    title: ${ts(d.title)},`,
      `    category: ${ts(d.category)},`,
      `    useCase: ${ts(d.useCase)},`,
      d.duration !== undefined ? `    duration: ${d.duration},` : null,
      d.aspectRatio ? `    aspectRatio: ${ts(d.aspectRatio)},` : null,
      `    tags: [${(d.tags || []).map(ts).join(', ')}],`,
      d.workflow ? `    workflow: ${ts(d.workflow)},` : null,
      `    sourceAuthor: 'Anil-matcha',`,
      `    sourceUrl: 'https://github.com/Anil-matcha/awesome-seedance-2.5-api-prompts',`,
      `  },`,
    ].filter(Boolean);
    return lines.join('\n');
  })
  .join('\n')}
];

/* ------------------------------------------------------------------ lookup utils */

const bySlug = new Map(seedanceDemos.map((demo) => [demo.slug, demo]));

export function getDemoBySlug(slug) {
  return bySlug.get(slug);
}

export function requireDemo(slug) {
  const demo = bySlug.get(slug);
  if (!demo) throw new Error(\`[seedanceDemos] unknown demo slug: \${slug}\`);
  return demo;
}

export function getDemosBySlugs(slugs) {
  return slugs.map((slug) => requireDemo(slug));
}

export function getFeaturedDemos() {
  return seedanceDemos.filter((demo) => demo.id <= 6);
}

export function getDemosByCategory(category) {
  if (!category || category === 'All') return seedanceDemos;
  return seedanceDemos.filter((demo) => demo.category === category);
}

export const SEEDANCE_CATEGORIES = [
  'All',
  ${[...new Set(demos.map((d) => d.category))]
    .sort()
    .map((c) => `  ${ts(c)},`)
    .join('\n')}
];

export function getCategoryCounts() {
  return seedanceDemos.reduce<Record<string, number>>((acc, demo) => {
    acc[demo.category] = (acc[demo.category] || 0) + 1;
    return acc;
  }, {});
}

export function ratioToNumber(aspectRatio, fallback = 16 / 9) {
  if (!aspectRatio) return fallback;
  const [w, h] = aspectRatio.split(':').map(Number);
  if (!w || !h) return fallback;
  return w / h;
}

export function formatDuration(demo) {
  return demo.duration ? \`\${demo.duration}s\` : '—';
}

/* --------------------------------------------------------- prompt (lazy load) */

export async function loadDemoPrompt(slug) {
  const { seedancePrompts } = await import('./seedancePrompts');
  return seedancePrompts[slug];
}

/* ------------------------------------------------- CTA routing */

export const CATEGORY_ROUTES = {
  Cinematic: 'cinema',
  Commercial: 'commercial',
  Fashion: 'influencer',
  Nature: 'cinema',
  Cultural: 'cinema',
  Animation: 'cinema',
  'Sci-Fi': 'cinema',
  VFX: 'ai-vfx',
  Product: 'commercial',
};

export const DEFAULT_CREATE_ROUTE = 'cinema';
export const TEMPLATE_PREFIX = 'seedance-2.5-';

export function getCreateTarget(demo) {
  const route = CATEGORY_ROUTES[demo.category] || DEFAULT_CREATE_ROUTE;
  const params = {
    template: \`\${TEMPLATE_PREFIX}\${demo.slug}\`,
    ref: 'seedance-2.5',
  };
  const query = new URLSearchParams(params).toString();
  return { route, params, href: \`/?\${query}#/\${route}\` };
}

export function getCreateUrl(demo) {
  return getCreateTarget(demo).href;
}
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'seedanceDemos.ts'), manifest);
writeFileSync(join(outDir, 'seedanceDemos.js'), jsManifest);
writeFileSync(join(outDir, 'seedancePrompts.ts'), `import prompts from './seedancePrompts.json';\n\nexport const seedancePrompts: Record<string, string> = prompts;\n`);
writeFileSync(join(outDir, 'seedancePrompts.json'), JSON.stringify(promptsJson, null, 2) + '\n');

console.log(`Wrote src/data/seedanceDemos.ts        (${demos.length} demos)`);
console.log(`Wrote src/data/seedanceDemos.js       (${demos.length} demos)`);
console.log(`Wrote src/data/seedancePrompts.json    (${(JSON.stringify(promptsJson).length / 1024).toFixed(1)}KB)`);
console.log(`Wrote src/data/seedancePrompts.ts      (prompt module)`);

const counts = demos.reduce((acc, d) => {
  acc[d.category] = (acc[d.category] || 0) + 1;
  return acc;
}, {});
console.log('Categories:', counts);
