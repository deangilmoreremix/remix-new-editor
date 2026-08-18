// Prompt catalogs imported from MiniMax, Seedance, and FLUX prompt/awesome repos.
// Each entry is display-safe and can be injected into any studio prompt field.

export const PROMPT_CATALOGS = {
  minimax: [
    { id: 'minimax-1', prompt: 'A cinematic drone shot flying over a futuristic city at golden hour, with lens flares and volumetric light.', category: 'cinematic', tags: ['drone','city','golden-hour'] },
    { id: 'minimax-2', prompt: 'Close-up portrait with soft studio lighting, shallow depth of field, 85mm lens, skin detail preserved.', category: 'portrait', tags: ['portrait','studio','shallow-dof'] },
    { id: 'minimax-3', prompt: 'Anime-style street scene in Tokyo at night, neon reflections on wet pavement, motion blur.', category: 'anime', tags: ['anime','neon','night'] },
    { id: 'minimax-4', prompt: 'Product hero shot on a marble surface with soft shadow, clean background, luxury brand aesthetic.', category: 'commercial', tags: ['product','luxury','marble'] },
    { id: 'minimax-5', prompt: 'Hyper-realistic food commercial, steam rising, macro lens, shallow depth of field.', category: 'commercial', tags: ['food','macro','commercial'] },
    { id: 'minimax-6', prompt: 'Slow-motion ocean waves crashing on rocks at blue hour, long exposure, silky water.', category: 'cinematic', tags: ['ocean','slow-motion','blue-hour'] },
    { id: 'minimax-7', prompt: 'Underwater scene with rays of light piercing through the surface, caustic patterns.', category: 'cinematic', tags: ['underwater','light','caustics'] },
    { id: 'minimax-8', prompt: 'Cyberpunk alley with rain, neon signs, cinematic composition, anamorphic lens flare.', category: 'cinematic', tags: ['cyberpunk','rain','neon'] },
    { id: 'minimax-9', prompt: 'Fashion editorial shot, full body, urban rooftop, natural wind movement, golden hour.', category: 'fashion', tags: ['fashion','rooftop','golden-hour'] },
    { id: 'minimax-10', prompt: 'Macro insect photography with extreme detail, natural light, blurred green background.', category: 'nature', tags: ['macro','insect','nature'] },
    { id: 'minimax-11', prompt: 'Cinematic car chase through a desert highway at sunset, dust particles in air, dynamic angle.', category: 'cinematic', tags: ['car','desert','action'] },
    { id: 'minimax-12', prompt: 'Cozy cabin interior with fireplace, warm practical lighting, Christmas decor, photorealistic.', category: 'interior', tags: ['cabin','fireplace','cozy'] },
    { id: 'minimax-13', prompt: 'Astrophotography with Milky Way over a mountain lake, long exposure, star reflections.', category: 'nature', tags: ['milky-way','stars','landscape'] },
    { id: 'minimax-14', prompt: 'Street photography style, candid moment in a busy market, natural light, documentary feel.', category: 'documentary', tags: ['street','market','documentary'] },
    { id: 'minimax-15', prompt: 'Abstract fluid art with iridescent colors, macro, high speed photography.', category: 'abstract', tags: ['fluid','abstract','color'] },
    { id: 'minimax-16', prompt: 'Vintage film still, 1970s aesthetic, warm tones, grain, soft focus, cinematic composition.', category: 'vintage', tags: ['vintage','1970s','film'] },
    { id: 'minimax-17', prompt: 'Architectural interior with dramatic shadows, concrete and glass, minimalist composition.', category: 'architecture', tags: ['architecture','minimal','shadows'] },
    { id: 'minimax-18', prompt: 'Wildlife photography, lion in golden savanna grass, telephoto lens, eye contact.', category: 'nature', tags: ['wildlife','lion','savanna'] },
    { id: 'minimax-19', prompt: 'High fashion studio shot with dramatic rim lighting, black background, editorial composition.', category: 'fashion', tags: ['fashion','studio','rim-light'] },
    { id: 'minimax-20', prompt: 'Space scene with nebula colors, distant galaxy, cinematic wide shot, sci-fi aesthetic.', category: 'sci-fi', tags: ['space','nebula','sci-fi'] },
    { id: 'minimax-21', prompt: 'Steampunk mechanical device, brass gears, intricate detail, dramatic side lighting.', category: 'fantasy', tags: ['steampunk','mechanical','brass'] }
  ],
  seedance: [
    { id: 'seedance-1', prompt: 'A lone astronaut walks across a rust-colored Martian landscape, dust swirling, vast sky.', category: 'sci-fi', tags: ['mars','astronaut','landscape'] },
    { id: 'seedance-2', prompt: 'Time-lapse of a flower blooming in a sunlit garden, dewdrops on petals.', category: 'nature', tags: ['flower','time-lapse','garden'] },
    { id: 'seedance-3', prompt: 'Sword fight in a rain-soaked ancient temple, sparks flying from steel, dramatic lighting.', category: 'action', tags: ['sword','rain','temple'] },
    { id: 'seedance-4', prompt: 'Child releases a paper lantern into a twilight sky filled with hundreds of others.', category: 'emotional', tags: ['lanterns','twilight','emotional'] },
    { id: 'seedance-5', prompt: 'Underwater ballet dancer performing in slow motion, fabric flowing, light rays.', category: 'artistic', tags: ['dancer','underwater','slow-motion'] },
    { id: 'seedance-6', prompt: 'Cat chases a laser pointer across a living room in super slow motion, playful energy.', category: 'fun', tags: ['cat','slow-motion','playful'] },
    { id: 'seedance-7', prompt: 'Dragon soars over a medieval castle at sunset, wings casting shadows on stone walls.', category: 'fantasy', tags: ['dragon','castle','sunset'] },
    { id: 'seedance-8', prompt: 'Chef prepares a gourmet dish in a professional kitchen, flame-kissed ingredients, fast cuts.', category: 'commercial', tags: ['chef','cooking','commercial'] },
    { id: 'seedance-9', prompt: 'POV roller coaster descent through a neon-lit theme park at night, motion blur.', category: 'action', tags: ['roller-coaster','neon','pov'] },
    { id: 'seedance-10', prompt: 'Samurai stands in a bamboo forest, wind blowing, cherry blossoms falling, meditative mood.', category: 'cinematic', tags: ['samurai','bamboo','cherry-blossoms'] },
    { id: 'seedance-11', prompt: 'Coffee beans falling into a grinder in extreme slow motion, aromatic steam rising.', category: 'commercial', tags: ['coffee','slow-motion','commercial'] },
    { id: 'seedance-12', prompt: 'Ballerina practices in an abandoned theater, dust motes in stage light, emotional.', category: 'artistic', tags: ['ballerina','theater','emotional'] },
    { id: 'seedance-13', prompt: 'F1 car speeds through a rain-soaked Monaco circuit at night, spray, neon reflections.', category: 'action', tags: ['f1','racing','rain'] },
    { id: 'seedance-14', prompt: 'Whale breaches in crystal clear ocean, water cascading off body, golden hour backlight.', category: 'nature', tags: ['whale','ocean','golden-hour'] },
    { id: 'seedance-15', prompt: 'Hip hop dancer performs in a graffiti-covered subway car, dynamic movement, urban energy.', category: 'music', tags: ['dance','hip-hop','urban'] },
    { id: 'seedance-16', prompt: 'Wizard casts a spell in an ancient library, books floating, magical particles, dramatic light.', category: 'fantasy', tags: ['wizard','magic','library'] },
    { id: 'seedance-17', prompt: 'Bonsai master trims a tree in a zen garden, rain falling, meditative precision.', category: 'documentary', tags: ['bonsai','zen','precision'] },
    { id: 'seedance-18', prompt: 'Skateboarder performs a kickflip over stairs in a sun-drenched urban plaza, golden hour.', category: 'action', tags: ['skateboard','sunset','urban'] },
    { id: 'seedance-19', prompt: 'Northern lights dance over an ice cave, reflected in frozen water, ethereal mood.', category: 'nature', tags: ['aurora','ice-cave','ethereal'] },
    { id: 'seedance-20', prompt: 'Pianist performs in an empty concert hall, single spotlight, emotional close-up on hands.', category: 'emotional', tags: ['piano','concert','emotional'] },
    { id: 'seedance-21', prompt: 'Robot learns to paint in a sunlit studio, paintbrush touching canvas, first spark of creativity.', category: 'sci-fi', tags: ['robot','art','sunlight'] },
    { id: 'seedance-22', prompt: 'Aerial shot of a winding river through autumn forest, fall colors reflecting in water.', category: 'nature', tags: ['aerial','river','autumn'] },
    { id: 'seedance-23', prompt: 'Gangster film style, protagonist walks away from an explosion in slow motion, black suit.', category: 'cinematic', tags: ['gangster','explosion','slow-motion'] },
    { id: 'seedance-24', prompt: 'Child chases butterflies through a sunlit meadow, slow motion, joyful energy, lens flare.', category: 'emotional', tags: ['child','butterflies','meadow'] },
    { id: 'seedance-25', prompt: 'Deep-sea submersible explores a bioluminescent trench, mysterious creatures, blue-green light.', category: 'sci-fi', tags: ['underwater','bioluminescent','deep-sea'] },
    { id: 'seedance-26', prompt: 'Fire dancer performs at night, sparks flying in slow motion, silhouettes, dramatic backlight.', category: 'artistic', tags: ['fire','dance','night'] },
    { id: 'seedance-27', prompt: 'Vintage motorcycle rides through a misty mountain pass at dawn, headlight cutting through fog.', category: 'cinematic', tags: ['motorcycle','mist','dawn'] },
    { id: 'seedance-28', prompt: 'Queen gives a speech in a grand hall, camera pushes in slowly, emotional crowd reaction.', category: 'cinematic', tags: ['queen','speech','crowd'] },
    { id: 'seedance-29', prompt: 'Octopus changes color and texture while moving across a coral reef, macro underwater.', category: 'nature', tags: ['octopus','coral','macro'] },
    { id: 'seedance-30', prompt: 'DJ performs for a massive crowd at an outdoor festival, lasers, confetti, euphoric energy.', category: 'music', tags: ['dj','festival','lasers'] }
  ],
  flux: [
    { id: 'flux-1', prompt: 'A photorealistic astronaut standing in a field of glowing bioluminescent flowers, cinematic lighting.', category: 'sci-fi', tags: ['astronaut','bioluminescent','cinematic'] },
    { id: 'flux-2', prompt: 'An elegant woman in a flowing red dress walking through a rainy neon-lit Tokyo street at night.', category: 'cinematic', tags: ['fashion','rain','neon'] },
    { id: 'flux-3', prompt: 'A majestic lion with a crown of thorns, regal portrait, dramatic chiaroscuro lighting.', category: 'portrait', tags: ['lion','regal','dramatic'] },
    { id: 'flux-4', prompt: 'Futuristic cityscape with flying cars, holographic billboards, cyberpunk aesthetic, ultra detailed.', category: 'sci-fi', tags: ['cyberpunk','cityscape','futuristic'] },
    { id: 'flux-5', prompt: 'A cozy bookstore cafe with rain on windows, warm reading lights, steam from coffee cups.', category: 'interior', tags: ['bookstore','cozy','rain'] },
    { id: 'flux-6', prompt: 'Abstract geometric composition with vibrant gradients, glass-like reflections, 3D render.', category: 'abstract', tags: ['geometric','abstract','3d'] },
    { id: 'flux-7', prompt: 'A witch stirring a glowing potion in a dark forest cottage, magical atmosphere, detailed props.', category: 'fantasy', tags: ['witch','magic','forest'] },
    { id: 'flux-8', prompt: 'Professional product photography of a luxury watch on black marble, studio lighting, reflections.', category: 'commercial', tags: ['watch','luxury','product'] },
    { id: 'flux-9', prompt: 'A serene koi pond in a Japanese garden, cherry blossoms falling, soft morning light.', category: 'nature', tags: ['japanese','koi','garden'] },
    { id: 'flux-10', prompt: 'A cybernetic samurai in a bamboo forest, rain falling, neon katana, dramatic composition.', category: 'sci-fi', tags: ['samurai','cybernetic','neon'] },
    { id: 'flux-11', prompt: 'A child reading under a blanket fort with fairy lights, magical atmosphere, warm tones.', category: 'emotional', tags: ['child','cozy','magical'] },
    { id: 'flux-12', prompt: 'A vintage Polaroid-style photo of a road trip, desert landscape, golden hour, film grain.', category: 'vintage', tags: ['polaroid','road-trip','film'] },
    { id: 'flux-13', prompt: 'An underwater photographer swimming through a coral reef, sun rays piercing surface.', category: 'nature', tags: ['underwater','coral','photographer'] },
    { id: 'flux-14', prompt: 'A grand library with infinite shelves, warm ambient lighting, floating books, magical realism.', category: 'fantasy', tags: ['library','infinite','magical'] }
  ]
};

export const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'nature', label: 'Nature' },
  { value: 'sci-fi', label: 'Sci-Fi' },
  { value: 'fantasy', label: 'Fantasy' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'abstract', label: 'Abstract' },
  { value: 'interior', label: 'Interior' },
  { value: 'architecture', label: 'Architecture' },
  { value: 'vintage', label: 'Vintage' },
  { value: 'emotional', label: 'Emotional' },
  { value: 'artistic', label: 'Artistic' },
  { value: 'action', label: 'Action' },
  { value: 'documentary', label: 'Documentary' },
  { value: 'music', tags: 'Music' },
  { value: 'fun', label: 'Fun' }
];

export const SOURCES = [
  { value: 'all', label: 'All Sources' },
  { value: 'minimax', label: 'MiniMax' },
  { value: 'seedance', label: 'Seedance' },
  { value: 'flux', label: 'FLUX' }
];

export function searchPrompts({ query, category, source } = {}) {
  const q = (query || '').toLowerCase().trim();
  return Object.entries(PROMPT_CATALOGS).flatMap(([src, items]) => {
    if (source && source !== 'all' && src !== source) return [];
    return items
      .filter(item => {
        if (category && category !== 'all' && item.category !== category) return false;
        if (!q) return true;
        return item.prompt.toLowerCase().includes(q) ||
               item.tags.some(t => t.includes(q)) ||
               item.category.includes(q);
      })
      .map(item => ({ ...item, source: src }));
  });
}

export function getPromptById(id) {
  for (const [, items] of Object.entries(PROMPT_CATALOGS)) {
    const found = items.find(item => item.id === id);
    if (found) return found;
  }
  return null;
}
