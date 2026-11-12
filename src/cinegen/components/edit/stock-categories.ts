// [remix] Categories for the Stock & AI media browser. One list drives both sides:
//  - stock (Pixabay / Pexels): `query` is the search the category runs
//  - AI: `ai` is a ready-made prompt starter the user can edit before generating
export interface MediaCategory {
  id: string;
  label: string;
  icon: string;
  query: string;
  ai: string;
}

export const MEDIA_CATEGORIES: MediaCategory[] = [
  { id: 'nature', label: 'Nature', icon: '🌿', query: 'nature landscape', ai: 'Cinematic nature landscape at golden hour, mist over mountains, soft light' },
  { id: 'business', label: 'Business', icon: '💼', query: 'business office', ai: 'Modern office team meeting, bright natural light, professional corporate style' },
  { id: 'technology', label: 'Technology', icon: '💻', query: 'technology', ai: 'Futuristic technology, glowing circuits and data streams, sleek dark background' },
  { id: 'people', label: 'People', icon: '🧑‍🤝‍🧑', query: 'people', ai: 'Diverse group of friends laughing together outdoors, candid lifestyle photography' },
  { id: 'city', label: 'City & Travel', icon: '🏙️', query: 'city travel', ai: 'City skyline at dusk with light trails, wide cinematic shot' },
  { id: 'food', label: 'Food & Drink', icon: '🍽️', query: 'food', ai: 'Fresh gourmet dish on a rustic table, shallow depth of field, warm light' },
  { id: 'sports', label: 'Sports', icon: '⚽', query: 'sports', ai: 'Athlete in motion, dynamic action shot, dramatic stadium lighting' },
  { id: 'animals', label: 'Animals', icon: '🐾', query: 'animals', ai: 'Wild animal in its natural habitat, sharp detail, soft background blur' },
  { id: 'backgrounds', label: 'Backgrounds', icon: '🎨', query: 'abstract background', ai: 'Smooth abstract gradient background with flowing shapes, seamless and calm' },
  { id: 'lifestyle', label: 'Lifestyle', icon: '🏡', query: 'lifestyle', ai: 'Cozy home lifestyle scene, morning coffee by a sunny window' },
  { id: 'education', label: 'Education', icon: '🎓', query: 'education', ai: 'Students learning together in a bright modern classroom' },
  { id: 'health', label: 'Health & Wellness', icon: '🧘', query: 'wellness health', ai: 'Person doing yoga at sunrise, peaceful and calm, soft natural light' },
  { id: 'architecture', label: 'Architecture', icon: '🏛️', query: 'architecture', ai: 'Striking modern architecture, clean lines, blue sky, wide angle' },
  { id: 'transport', label: 'Transportation', icon: '🚗', query: 'transportation', ai: 'Car driving along a coastal road at sunset, cinematic tracking shot' },
  { id: 'party', label: 'Party & Music', icon: '🎉', query: 'party music', ai: 'Festival crowd with colourful stage lights and confetti, energetic' },
  { id: 'science', label: 'Space & Science', icon: '🔭', query: 'space science', ai: 'Galaxy and nebula in deep space, vivid colours, ultra detailed' },
];
