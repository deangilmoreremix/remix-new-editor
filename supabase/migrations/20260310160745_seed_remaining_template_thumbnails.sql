/*
  # Seed remaining 33 template thumbnails

  Adds metadata records for all newly generated template thumbnail images.
  These cover templates across Social Media, Style Transfer, Entertainment,
  Commercial, and VFX categories that were not included in the initial seed.

  1. Modified Tables
    - `thumbnails` - 33 new rows inserted for template thumbnail metadata

  2. Notes
    - Uses ON CONFLICT to safely skip any duplicates
    - All images stored at /thumbnails/templates/{template-id}.webp
    - Includes alt_text for accessibility and prompt_used for reproducibility
*/

INSERT INTO thumbnails (target_type, target_id, image_path, alt_text, prompt_used) VALUES
  -- Social Media
  ('template', 'tiktok-video', '/thumbnails/templates/tiktok-video.webp', 'Person dancing with TikTok-style visual effects', 'Person dancing energetically with colorful TikTok-style visual effects overlaid'),
  ('template', 'instagram-reel', '/thumbnails/templates/instagram-reel.webp', 'Aesthetic fashion scene with cinematic motion', 'Aesthetic fashion scene with cinematic motion blur, lifestyle content'),
  ('template', 'youtube-thumbnail', '/thumbnails/templates/youtube-thumbnail.webp', 'Shocked expression YouTube thumbnail style', 'Person with shocked expression against bold dramatic fiery background'),
  ('template', 'reaction-thumbnail', '/thumbnails/templates/reaction-thumbnail.webp', 'Exaggerated reaction face with comic pop effects', 'Person with exaggerated surprised reaction, comic-style pop art effects'),
  ('template', 'short-form-ad', '/thumbnails/templates/short-form-ad.webp', 'Product reveal in vertical promo frame', 'Premium sneaker mid-reveal in punchy vertical promotional frame'),
  ('template', 'story-highlight-cover', '/thumbnails/templates/story-highlight-cover.webp', 'Minimalist pastel icon story highlight cover', 'Clean minimalist pastel gradient circle icon for Instagram story highlight'),
  ('template', 'profile-picture', '/thumbnails/templates/profile-picture.webp', 'Professional headshot portrait with studio lighting', 'Professional headshot portrait with warm studio lighting'),
  ('template', 'banner-creator', '/thumbnails/templates/banner-creator.webp', 'Ultra-wide panoramic cityscape at golden hour', 'Ultra-wide panoramic cityscape at golden hour sunset, cinematic banner'),

  -- Style Transfer
  ('template', 'anime-converter', '/thumbnails/templates/anime-converter.webp', 'Person rendered in anime art style', 'Person rendered in anime art style with big expressive eyes, cel-shaded'),
  ('template', 'comic-book', '/thumbnails/templates/comic-book.webp', 'Person in American comic book ink style', 'Person drawn in bold American comic book ink style with halftone dots'),
  ('template', 'gta-loading-screen', '/thumbnails/templates/gta-loading-screen.webp', 'GTA V loading screen satirical illustration', 'Character leaning against sports car in GTA V loading screen style'),
  ('template', 'pixel-art', '/thumbnails/templates/pixel-art.webp', 'Person as 16-bit pixel art character', 'Person rendered as 16-bit pixel art character, retro game aesthetic'),
  ('template', 'ghibli-style', '/thumbnails/templates/ghibli-style.webp', 'Person in Studio Ghibli watercolor style', 'Person in Studio Ghibli watercolor art style with pastoral background'),
  ('template', 'cyberpunk-style', '/thumbnails/templates/cyberpunk-style.webp', 'Person with neon glow in cyberpunk city', 'Person with neon glow effects in rain-soaked cyberpunk city at night'),
  ('template', 'vhs-retro', '/thumbnails/templates/vhs-retro.webp', 'Retro VHS tape aesthetic with scan lines', 'Retro VHS videotape aesthetic with scan lines and analog distortion'),
  ('template', 'film-noir', '/thumbnails/templates/film-noir.webp', 'Film noir black and white detective scene', 'Person in classic film noir with dramatic venetian blind shadows'),
  ('template', 'glass-ball', '/thumbnails/templates/glass-ball.webp', 'Landscape refracted inside crystal glass sphere', 'Crystal glass ball reflecting inverted landscape with bokeh background'),

  -- Entertainment
  ('template', 'movie-poster', '/thumbnails/templates/movie-poster.webp', 'Dramatic cinematic movie poster composition', 'Hero standing in flames with epic city skyline, theatrical poster style'),
  ('template', 'magazine-cover', '/thumbnails/templates/magazine-cover.webp', 'High fashion magazine cover editorial', 'Elegant person in haute couture, high fashion magazine cover layout'),
  ('template', 'bullet-time', '/thumbnails/templates/bullet-time.webp', 'Matrix-style bullet time freeze frame', 'Person frozen mid-air with camera orbit trail, Matrix style'),
  ('template', 'action-figure', '/thumbnails/templates/action-figure.webp', 'Person as collectible action figure in packaging', 'Person rendered as plastic action figure inside toy blister pack'),
  ('template', 'disney-pixar', '/thumbnails/templates/disney-pixar.webp', 'Pixar-style 3D animated character', 'Person as Pixar-style 3D animated character with big expressive eyes'),
  ('template', 'superhero-transform', '/thumbnails/templates/superhero-transform.webp', 'Superhero transformation with energy burst', 'Person mid-transformation with glowing energy burst and cape forming'),
  ('template', 'lego-style', '/thumbnails/templates/lego-style.webp', 'Scene built from colorful toy bricks', 'Whimsical world made of colorful interlocking toy bricks'),
  ('template', 'squid-game', '/thumbnails/templates/squid-game.webp', 'Korean survival game show aesthetic', 'Person in green tracksuit with ominous masked figures, survival game'),
  ('template', '3d-figurine', '/thumbnails/templates/3d-figurine.webp', 'Detailed 3D collectible figurine on display stand', 'Person rendered as detailed 3D collectible figurine on round display stand'),

  -- Commercial
  ('template', 'product-hero', '/thumbnails/templates/product-hero.webp', 'Premium product on marble with studio lighting', 'Premium perfume bottle on polished marble with dramatic studio rim lighting'),
  ('template', 'product-photography', '/thumbnails/templates/product-photography.webp', 'Professional product shot on white backdrop', 'Clean product photography on white infinity curve studio backdrop'),
  ('template', 'billboard-ad', '/thumbnails/templates/billboard-ad.webp', 'Ultra-wide billboard with luxury product', 'Ultra-wide billboard advertisement with luxury wristwatch on dark velvet'),
  ('template', 'asmr-video', '/thumbnails/templates/asmr-video.webp', 'Satisfying close-up ASMR content', 'Extreme close-up of satisfying soap cutting, ASMR content style'),
  ('template', 'product-placement', '/thumbnails/templates/product-placement.webp', 'Product in cozy lifestyle coffee shop scene', 'Premium coffee cup on cozy coffee shop table with morning golden light'),
  ('template', 'unboxing-scene', '/thumbnails/templates/unboxing-scene.webp', 'Premium product unboxing reveal moment', 'Hands opening premium matte black gift box with dramatic top lighting'),

  -- VFX (building-explosion was missing)
  ('template', 'building-explosion', '/thumbnails/templates/building-explosion.webp', 'Hollywood-grade building explosion VFX', 'Building mid-explosion with massive fireball and debris flying outward')
ON CONFLICT (target_type, target_id) DO NOTHING;
