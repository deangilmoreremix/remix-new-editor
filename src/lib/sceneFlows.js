/**
 * SCENE FLOWS
 *
 * Canonical story flows as ordered arrays of scene class IDs.
 * Each flow represents a proven narrative structure for a specific
 * content type or genre.
 */

import { SCENE_CLASSES, STORY_PURPOSES } from './sceneTaxonomy.js';

// ============================================
// FLOW DEFINITIONS
// ============================================

export const FLOWS = {
  // Flow A — Classic Hero Story
  classic_hero: {
    id: 'classic_hero',
    name: 'Classic Hero Story',
    description: 'The universal hero journey with inciting incident, trials, climax, and resolution',
    bestFor: ['cinematic_short_film', 'narrative', 'dramatic'],
    scenes: [
      'cold_open',
      'establishing',
      'character_introduction',
      'normal_world',
      'inciting_event',
      'character_reaction',
      'conflict',
      'journey',
      'discovery',
      'training_scene',
      'escalation',
      'climax',
      'resolution',
      'emotional_ending',
      'end_card'
    ]
  },

  // Flow B — Commercial / Ad
  commercial: {
    id: 'commercial',
    name: 'Commercial',
    description: 'Pattern interrupt → problem → solution → transformation → CTA',
    bestFor: ['commercial', 'ad', 'product', 'brand'],
    scenes: [
      'hook',
      'business_problem',
      'customer_discovery',
      'product_reveal',
      'demonstration',
      'transformation',
      'social_proof',
      'hero_product_reveal',
      'cta',
      'end_card'
    ]
  },

  // Flow C — Cinematic Product Launch
  cinematic_product_launch: {
    id: 'cinematic_product_launch',
    name: 'Cinematic Product Launch',
    description: 'Mystery-driven product reveal with cinematic atmosphere',
    bestFor: ['product_launch', 'luxury', 'tech', 'cinematic_commercial'],
    scenes: [
      'mystery',
      'atmospheric_opening',
      'establishing',
      'product_reveal',
      'environment',
      'demonstration',
      'product_in_use',
      'transformation',
      'hero_product_reveal',
      'cta',
      'end_card'
    ]
  },

  // Flow D — Documentary
  documentary: {
    id: 'documentary',
    name: 'Documentary',
    description: 'Real-world storytelling with interviews, B-roll, and discovery',
    bestFor: ['documentary', 'real_story', 'interview'],
    scenes: [
      'cold_open',
      'establishing',
      'character_introduction',
      'interview',
      'historical',
      'observational',
      'investigation',
      'discovery',
      'emotional',
      'resolution',
      'end_card'
    ]
  },

  // Flow E — Case Study
  case_study: {
    id: 'case_study',
    name: 'Case Study',
    description: 'Customer journey from problem to solution to results',
    bestFor: ['case_study', 'testimonial', 'business', 'b2b'],
    scenes: [
      'hook',
      'customer_discovery',
      'business_problem',
      'before_after',
      'discovery',
      'product_demo',
      'implementation',
      'transformation',
      'testimonial',
      'cta',
      'end_card'
    ]
  },

  // Flow F — AI Business Story
  ai_business: {
    id: 'ai_business',
    name: 'AI Business Story',
    description: 'Business owner transforms their operations with AI',
    bestFor: ['ai', 'saas', 'tech', 'business', 'smartvideo'],
    scenes: [
      'character_introduction',
      'business_problem',
      'normal_world',
      'inciting_event',
      'character_reaction',
      'discovery',
      'demonstration',
      'transformation',
      'growth',
      'testimonial',
      'victory',
      'cta',
      'end_card'
    ]
  },

  // Flow G — Horror
  horror: {
    id: 'horror',
    name: 'Horror',
    description: 'Atmospheric horror with tension building to a threat reveal',
    bestFor: ['horror', 'thriller', 'suspense'],
    scenes: [
      'atmospheric_opening',
      'establishing',
      'character_introduction',
      'normal_world',
      'strange_event',
      'investigation',
      'first_clue',
      'suspense',
      'threat_reveal',
      'chase_scene',
      'confrontation',
      'escape_scene',
      'twist_ending',
      'end_card'
    ]
  },

  // Flow H — Romance
  romance: {
    id: 'romance',
    name: 'Romance',
    description: 'Two characters meet, connect, face conflict, and reunite',
    bestFor: ['romance', 'love', 'relationship', 'emotional'],
    scenes: [
      'character_introduction',
      'character_introduction',
      'first_meeting',
      'conversation',
      'romance',
      'montage',
      'conflict',
      'separation',
      'realization',
      'reunion',
      'emotional_ending',
      'end_card'
    ]
  },

  // Flow I — Transformation / Personal Journey
  transformation: {
    id: 'transformation',
    name: 'Transformation',
    description: 'Personal or business transformation from struggle to success',
    bestFor: ['transformation', 'before_after', 'fitness', 'wellness', 'personal'],
    scenes: [
      'before_state',
      'business_problem',
      'character_reaction',
      'decision',
      'training_scene',
      'failure',
      'discovery',
      'progress',
      'breakthrough',
      'transformation',
      'after_state',
      'emotional_ending',
      'end_card'
    ]
  },

  // Flow J — High-Energy Social Video
  high_energy_social: {
    id: 'high_energy_social',
    name: 'High-Energy Social',
    description: 'Fast-paced social video with pattern interrupt and bold CTA',
    bestFor: ['social_media', 'tiktok', 'reels', 'shorts', 'viral'],
    scenes: [
      'social_hook',
      'bold_claim',
      'visual_proof',
      'problem',
      'demonstration',
      'transformation',
      'social_proof',
      'result',
      'cta',
      'end_card'
    ]
  },

  // Flow K — Business Explainer
  business_explainer: {
    id: 'business_explainer',
    name: 'Business Explainer',
    description: 'Clear problem-solution-explainer structure for B2B',
    bestFor: ['b2b', 'saas', 'tech', 'explainer', 'business'],
    scenes: [
      'hook',
      'business_problem',
      'explanation',
      'demonstration',
      'benefit',
      'case_study_scene',
      'cta',
      'end_card'
    ]
  },

  // Flow L — Brand Film
  brand_film: {
    id: 'brand_film',
    name: 'Brand Film',
    description: 'Emotional brand story with values and lifestyle',
    bestFor: ['brand', 'luxury', 'lifestyle', 'emotional_brand_story'],
    scenes: [
      'atmospheric_opening',
      'establishing',
      'character_introduction',
      'normal_world',
      'product_in_use',
      'emotional',
      'lifestyle',
      'transformation',
      'hero_product_reveal',
      'emotional_ending',
      'end_card'
    ]
  },

  // Flow M — Social Media Short
  social_short: {
    id: 'social_short',
    name: 'Social Media Short',
    description: 'Condensed social-first narrative with quick hooks',
    bestFor: ['social_media', 'short_form', 'vertical'],
    scenes: [
      'social_hook',
      'problem',
      'demonstration',
      'transformation',
      'result',
      'cta'
    ]
  },

  // Flow N — Product Demo
  product_demo: {
    id: 'product_demo',
    name: 'Product Demo',
    description: 'Focused product demonstration with clear benefits',
    bestFor: ['product', 'demo', 'saas', 'tech'],
    scenes: [
      'hook',
      'problem',
      'product_reveal',
      'demonstration',
      'benefit',
      'transformation',
      'cta',
      'end_card'
    ]
  },

  // Flow O — Testimonial / Customer Story
  testimonial_story: {
    id: 'testimonial_story',
    name: 'Testimonial Story',
    description: 'Customer journey from problem to success with authentic feel',
    bestFor: ['testimonial', 'customer_story', 'case_study'],
    scenes: [
      'customer_introduction',
      'business_problem',
      'struggle',
      'discovery',
      'solution',
      'implementation',
      'transformation',
      'results',
      'testimonial',
      'cta',
      'end_card'
    ]
  },

  // Flow P — Training / Educational
  training_educational: {
    id: 'training_educational',
    name: 'Training / Educational',
    description: 'Step-by-step educational content with clear takeaways',
    bestFor: ['education', 'training', 'tutorial', 'how_to'],
    scenes: [
      'hook',
      'problem',
      'concept',
      'demonstration',
      'practice',
      'result',
      'cta',
      'end_card'
    ]
  },

  // Flow Q — Event Recap
  event_recap: {
    id: 'event_recap',
    name: 'Event Recap',
    description: 'Event highlights with atmosphere, moments, and energy',
    bestFor: ['event', 'recap', 'conference', 'wedding'],
    scenes: [
      'establishing',
      'arrival',
      'atmosphere',
      'highlights',
      'emotional_moment',
      'celebration',
      'victory',
      'end_card'
    ]
  },

  // Flow R — Restaurant / Food
  restaurant_food: {
    id: 'restaurant_food',
    name: 'Restaurant / Food',
    description: 'Appetizing food showcase with atmosphere and experience',
    bestFor: ['restaurant', 'food', 'cafe', 'culinary'],
    scenes: [
      'establishing',
      'atmosphere',
      'food_hero',
      'preparation',
      'tasting',
      'emotional',
      'cta',
      'end_card'
    ]
  },

  // Flow S — Fitness / Wellness
  fitness_wellness: {
    id: 'fitness_wellness',
    name: 'Fitness / Wellness',
    description: 'Transformation and energy focus for fitness content',
    bestFor: ['fitness', 'wellness', 'gym', 'health'],
    scenes: [
      'character_introduction',
      'normal_world',
      'decision',
      'training_scene',
      'struggle',
      'progress',
      'transformation',
      'victory',
      'emotional_ending',
      'cta',
      'end_card'
    ]
  },

  // Flow T — Real Estate
  real_estate: {
    id: 'real_estate',
    name: 'Real Estate',
    description: 'Property showcase from exterior to lifestyle',
    bestFor: ['real_estate', 'property', 'home', 'luxury'],
    scenes: [
      'establishing',
      'exterior',
      'interior',
      'lifestyle',
      'neighborhood',
      'emotional',
      'cta',
      'end_card'
    ]
  },

  // Flow U — Fashion
  fashion_flow: {
    id: 'fashion_flow',
    name: 'Fashion',
    description: 'Model and product showcase with style and movement',
    bestFor: ['fashion', 'style', 'clothing', 'runway'],
    scenes: [
      'atmospheric_opening',
      'fashion',
      'product_macro',
      'movement',
      'lifestyle',
      'hero_product_reveal',
      'cta',
      'end_card'
    ]
  },

  // Flow V — Automotive
  automotive: {
    id: 'automotive',
    name: 'Automotive',
    description: 'Vehicle showcase with performance and lifestyle',
    bestFor: ['automotive', 'car', 'vehicle', 'luxury'],
    scenes: [
      'establishing',
      'vehicle_reveal',
      'performance',
      'lifestyle',
      'interior',
      'hero_shot',
      'cta',
      'end_card'
    ]
  },

  // Flow W — Legal / Professional
  legal_professional: {
    id: 'legal_professional',
    name: 'Legal / Professional',
    description: 'Trust-building professional narrative',
    bestFor: ['legal', 'professional', 'business', 'b2b'],
    scenes: [
      'establishing',
      'character_introduction',
      'problem',
      'expertise',
      'case_study_scene',
      'results',
      'testimonial',
      'cta',
      'end_card'
    ]
  },

  // Flow X — Nonprofit / Mission
  nonprofit: {
    id: 'nonprofit',
    name: 'Nonprofit / Mission',
    description: 'Emotional mission-driven storytelling',
    bestFor: ['nonprofit', 'charity', 'mission', 'cause'],
    scenes: [
      'emotional_opening',
      'problem',
      'human_story',
      'solution',
      'impact',
      'transformation',
      'hope',
      'cta',
      'end_card'
    ]
  },

  // Flow Y — SaaS / Tech Product
  saas_tech: {
    id: 'saas_tech',
    name: 'SaaS / Tech Product',
    description: 'Clear product value and business outcome focus',
    bestFor: ['saas', 'tech', 'software', 'b2b'],
    scenes: [
      'hook',
      'business_problem',
      'technology',
      'demonstration',
      'benefit',
      'case_study_scene',
      'results',
      'cta',
      'end_card'
    ]
  },

  // Flow Z — Event / Conference
  event_conference: {
    id: 'event_conference',
    name: 'Event / Conference',
    description: 'High-energy event recap with crowd and speaker moments',
    bestFor: ['event', 'conference', 'summit', 'workshop'],
    scenes: [
      'establishing',
      'arrival',
      'speaker',
      'audience',
      'networking',
      'highlight',
      'emotional_moment',
      'closing',
      'end_card'
    ]
  }
};

// ============================================
// HELPERS
// ============================================

export const FLOW_IDS = Object.keys(FLOWS);

export function getFlowById(id) {
  return FLOWS[id] || null;
}

export function getFlowsForTemplate(template) {
  if (!template) return Object.values(FLOWS);
  
  const templateCategory = (template.category || '').toLowerCase();
  const templateId = (template.id || '').toLowerCase();
  const outputStyle = (template.outputStyle?.id || '').toLowerCase();

  const matches = Object.values(FLOWS).filter(flow => {
    const bestFor = flow.bestFor || [];
    return bestFor.some(keyword => {
      const kw = keyword.toLowerCase();
      return templateCategory.includes(kw) ||
             templateId.includes(kw) ||
             outputStyle.includes(kw) ||
             (template.name && template.name.toLowerCase().includes(kw));
    });
  });

  return matches.length > 0 ? matches : Object.values(FLOWS);
}

export function getSceneById(id) {
  return SCENE_CLASSES[id] || null;
}

export function getScenesByIds(ids) {
  return ids.map(id => getSceneById(id)).filter(Boolean);
}
