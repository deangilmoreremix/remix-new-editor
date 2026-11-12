// [remix] Categories for the AI & stock media browser: 11 groups, 100 categories. Each category has a list of topics:
// the first is its broad search, the rest are refinements (the count badge on the category pill).
//  - stock (Pexels / Pixabay): a topic is the search that runs
//  - AI: a topic becomes an editable prompt (aiPrompt)
export interface MediaCategory {
  id: string;
  label: string;
  glyph: string;
  group: string;
  topics: string[];
}
export interface MediaGroup {
  id: string;
  label: string;
  glyph: string;
  categories: MediaCategory[];
}

const slug = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Monochrome glyphs (the ︎ selector, added at render time, keeps them from turning into colour emoji).
const GLYPHS = ['▦', '▭', '◎', '▤', '◇', '▶', '✎', '✺', '⌖', '◈', '◐', '✦', '❖', '✿', '◉', '▲', '◆', '⬡', '⬢', '✚', '★', '♪', '♫', '⚑', '⚙', '☘', '⌂', '✂', '◍', '▣', '☰', '✱', '❂', '✧', '⬣', '◬', '⊕', '⊗', '⌘', '☉'];
let n = 0;

function group(label: string, glyph: string, rows: Array<[string, string]>): MediaGroup {
  const id = slug(label);
  return {
    id, label, glyph,
    categories: rows.map(([name, topics]) => ({ id: slug(name), label: name, glyph: GLYPHS[n++ % GLYPHS.length], group: id, topics: topics.split(',').map((t) => t.trim()) })),
  };
}

export const MEDIA_GROUPS: MediaGroup[] = [
  group('Nature & Outdoors', '✿', [
    ['Forests', 'forest, pine trees, rainforest, autumn forest, misty woods'],
    ['Mountains', 'mountains, alpine peaks, hiking trail, snowy summit, canyon cliffs'],
    ['Oceans & Beaches', 'ocean waves, tropical beach, coastline, sea foam, drone beach'],
    ['Sky & Clouds', 'clouds, blue sky, storm clouds, milky way, aurora'],
    ['Waterfalls & Rivers', 'waterfall, river, stream rapids, lake reflection, creek'],
    ['Sunrise & Sunset', 'sunset, sunrise, golden hour, twilight sky, silhouette sunset'],
    ['Flowers & Plants', 'flowers, blooming, green leaves, garden, cherry blossom'],
    ['Weather', 'rain, thunderstorm, fog, wind, rainbow'],
    ['Winter & Snow', 'snow, snowfall, ice, frozen lake, winter forest'],
    ['Desert & Dunes', 'desert, sand dunes, cactus, canyon, oasis'],
  ]),
  group('Animals & Wildlife', '❖', [
    ['Wildlife', 'wildlife, lion, elephant, deer, wolf'],
    ['Dogs', 'dog, puppy, dog running, dog park'],
    ['Cats', 'cat, kitten, cat playing, cat sleeping'],
    ['Birds', 'birds, eagle, flying birds, parrot, owl'],
    ['Ocean Life', 'underwater, coral reef, dolphin, jellyfish, fish school'],
    ['Insects', 'insects, butterfly, bee, ants, dragonfly'],
    ['Farm Animals', 'farm animals, horses, cows, sheep, chickens'],
  ]),
  group('People & Lifestyle', '◉', [
    ['Friends & Family', 'friends laughing, family dinner, family beach, group selfie'],
    ['Portraits', 'portrait, smiling woman, man portrait, close up face'],
    ['Crowds', 'crowd, people walking, festival crowd, commuters, street crowd'],
    ['Kids & Babies', 'children playing, baby, kids school, toddler'],
    ['Couples', 'couple, romantic dinner, wedding couple, holding hands'],
    ['Fitness', 'fitness, running, workout, yoga, stretching'],
    ['Wellness', 'meditation, spa, massage, healthy lifestyle, sleeping'],
    ['Fashion & Beauty', 'fashion model, makeup, hair salon, runway, jewelry'],
    ['Hands & Gestures', 'hands typing, handshake, pointing, hands writing, applause'],
    ['Seniors', 'senior couple, grandparents, elderly walking, retirement'],
  ]),
  group('Business & Work', '▣', [
    ['Office Teams', 'office team, coworkers, open office, brainstorm, team celebration'],
    ['Meetings', 'business meeting, conference room, presentation, video call, boardroom'],
    ['Entrepreneurs', 'entrepreneur, startup founder, small business owner, shop owner'],
    ['Remote Work', 'working from home, laptop cafe, home office, video conference'],
    ['Finance & Money', 'finance, stock market, coins, credit card, calculator'],
    ['Marketing', 'marketing, social media, advertising, analytics screen, content creator'],
    ['Customer Service', 'customer service, call center, support headset, shopping'],
    ['Real Estate', 'real estate, house tour, apartment, keys, construction site'],
    ['Deals & Handshakes', 'handshake, contract signing, business deal, negotiation'],
    ['Retail & E-commerce', 'online shopping, store, packages, checkout, warehouse'],
  ]),
  group('Technology & Science', '⌘', [
    ['Technology', 'technology, circuit board, digital, hologram, smart city'],
    ['AI & Robots', 'artificial intelligence, robot, machine learning, neural network, android'],
    ['Coding', 'coding, programmer, software, code on screen, developer'],
    ['Data & Networks', 'data, network, server room, data visualization, cloud computing'],
    ['Cybersecurity', 'cybersecurity, hacker, padlock, encryption, firewall'],
    ['Space & Galaxy', 'space, galaxy, planets, nebula, astronaut'],
    ['Science Lab', 'science lab, microscope, chemistry, experiment, dna'],
    ['Medicine', 'medicine, doctor, hospital, surgery, stethoscope'],
    ['Gadgets', 'smartphone, headphones, drone, vr headset, smartwatch'],
    ['Energy', 'solar panels, wind turbines, electricity, battery, power plant'],
  ]),
  group('Places & Travel', '⌖', [
    ['City Skylines', 'city skyline, skyscrapers, downtown, rooftop view, urban'],
    ['Streets & Traffic', 'street, traffic, crosswalk, busy road, taxi'],
    ['Night Cities', 'city night, neon street, night traffic, city lights, rain city'],
    ['Aerial & Drone', 'aerial view, drone footage, flying over, aerial city, aerial coast'],
    ['Landmarks', 'landmark, eiffel tower, colosseum, statue, ancient temple'],
    ['Resorts & Islands', 'resort, island, tropical, pool, overwater villa'],
    ['Road Trips', 'road trip, highway, car window, camper van, mountain road'],
    ['Airports & Planes', 'airplane, airport, takeoff, airplane window, runway'],
    ['Trains & Subways', 'train, subway, railway, station, bullet train'],
    ['Hotels & Travel', 'hotel, luggage, travel, passport, tourist'],
  ]),
  group('Food & Drink', '♨', [
    ['Gourmet Food', 'gourmet food, plated dish, fine dining, steak, sushi'],
    ['Cooking', 'cooking, chef, kitchen, frying pan, chopping'],
    ['Coffee & Tea', 'coffee, latte art, tea, coffee shop, barista'],
    ['Fruits & Vegetables', 'fruit, vegetables, farmers market, fresh salad, berries'],
    ['Bakery & Desserts', 'bakery, bread, cake, chocolate, ice cream'],
    ['Drinks & Cocktails', 'cocktail, wine, beer, juice, pouring drink'],
    ['Restaurants', 'restaurant, waiter, cafe, street food, food truck'],
    ['Healthy Eating', 'healthy food, smoothie, vegan, meal prep, breakfast'],
  ]),
  group('Sports & Action', '⚑', [
    ['Soccer', 'soccer, football match, goal, stadium, soccer training'],
    ['Basketball', 'basketball, dunk, court, streetball'],
    ['Running', 'running, marathon, sprint, trail running, jogging'],
    ['Extreme Sports', 'extreme sports, skateboarding, snowboarding, surfing, parkour'],
    ['Water Sports', 'swimming, surfing, kayak, sailing, diving'],
    ['Winter Sports', 'skiing, snowboard, ice hockey, ice skating, sledding'],
    ['Cycling', 'cycling, mountain bike, road bike, bmx'],
    ['Combat Sports', 'boxing, martial arts, karate, wrestling, judo'],
    ['Gym & Training', 'gym, weightlifting, crossfit, treadmill, personal trainer'],
  ]),
  group('Arts & Backgrounds', '✦', [
    ['Abstract', 'abstract, abstract motion, geometric shapes, fractal, kaleidoscope'],
    ['Gradients', 'gradient background, color gradient, pastel gradient, mesh gradient'],
    ['Light Leaks & Bokeh', 'bokeh, light leak, lens flare, glitter, sparkles'],
    ['Particles', 'particles, dust, floating particles, stars, confetti'],
    ['Textures', 'texture, grunge, concrete, wood, fabric'],
    ['Neon & Glow', 'neon, glowing lines, laser, led lights, synthwave'],
    ['Smoke & Fire', 'smoke, fire, flames, sparks, embers'],
    ['Liquid & Ink', 'liquid, ink in water, paint, watercolor, oil'],
    ['Paper & Craft', 'paper, origami, craft, collage, handmade'],
    ['Loops & Backgrounds', 'looping background, seamless loop, motion background, calm background'],
  ]),
  group('Home, Events & Learning', '⌂', [
    ['Home & Interior', 'home interior, living room, kitchen, bedroom, furniture'],
    ['Education', 'education, classroom, students, university, graduation'],
    ['Books & Libraries', 'books, library, reading, writing, notebook'],
    ['Celebrations', 'celebration, party, birthday, fireworks, new year'],
    ['Weddings', 'wedding, bride, wedding ceremony, wedding dance, bouquet'],
    ['Holidays', 'christmas, halloween, easter, thanksgiving, valentine'],
    ['Music & Concerts', 'concert, live music, guitar, dj, piano'],
    ['Gardening & DIY', 'gardening, diy, woodworking, painting wall, tools'],
    ['Art & Design', 'art, painter, sculpture, design studio, photography'],
  ]),
  group('Industry & Transport', '⚙', [
    ['Cars & Driving', 'car, driving, sports car, car interior, electric car'],
    ['Construction', 'construction, crane, bulldozer, builder, scaffolding'],
    ['Factories', 'factory, manufacturing, assembly line, welding, machinery'],
    ['Farming', 'farm, tractor, harvest, wheat field, greenhouse'],
    ['Shipping & Ports', 'shipping, container ship, port, cargo, logistics'],
    ['Aviation', 'aviation, helicopter, cockpit, jet, drone flight'],
    ['Motorcycles & Bikes', 'motorcycle, scooter, biker, bicycle city'],
  ]),
];

export const MEDIA_CATEGORIES: MediaCategory[] = MEDIA_GROUPS.flatMap((g) => g.categories);

export const topicLabel = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);

/** An editable AI prompt for a topic. */
export const aiPrompt = (topic: string, kind: 'videos' | 'images'): string =>
  `Cinematic ${topic}, ${kind === 'videos' ? 'smooth camera movement, ' : ''}natural lighting, rich detail, high quality`;
