// Zack D studio templates: the demo project and example scripts from the upstream open-source project
// https://github.com/Anil-matcha/zack-d-films-ai-video-generator (MIT, see NOTICE). The finished demo's media is
// served from this app's own /zackd/templates (same origin, so the in-browser final cut can read it).
// Loading a template never calls a paid API.
import { normalizeBeats } from '../../../netlify/functions/_shared/zackdPrompts.js';

export const TEMPLATE_ATTRIBUTION = 'Sample from the upstream open-source Zack D project (MIT).';

export const TEMPLATES = [
  {
    "id": "swallow-gum-demo",
    "kind": "finished",
    "title": "Swallow gum: finished demo",
    "topic": "What Happens When You Swallow Gum?",
    "description": "A complete 3-beat short from the upstream project. Reuses its 5 keyframes and 5 Veo clips so you can edit the script, add your own narration and render a cut without generating anything.",
    "poster": "/zackd/templates/swallow-gum/poster.jpg",
    "demo": "/zackd/templates/swallow-gum/demo.mp4",
    "beats": [
      {
        "narration": "What Happens When You Swallow Gum? Here is what actually happens inside your body.",
        "title_en": "Curiosity Hook",
        "shots": [
          {
            "type": "wide",
            "duration_sec": 3.0,
            "scene_description": "Stylized 3D main character experiencing What Happens When You Swallow Gum?, wide shot in bright studio lighting.",
            "camera_move": "push_in",
            "character_refs": [
              "main_character_turnaround"
            ],
            "zoom_impact": false
          },
          {
            "type": "macro_cross_section",
            "duration_sec": 3.0,
            "scene_description": "Detailed anatomical 3D cutaway cross-section illustrating What Happens When You Swallow Gum? mechanism.",
            "camera_move": "tilt_down",
            "character_refs": [
              "anatomical_organ_cross_section"
            ],
            "zoom_impact": true
          }
        ]
      },
      {
        "narration": "Your bodily defenses immediately kick in, attempting to neutralize the situation.",
        "title_en": "Biological Reaction",
        "shots": [
          {
            "type": "macro",
            "duration_sec": 3.0,
            "scene_description": "Microscopic view of fluids and enzymes interacting with the object in 3D clay style.",
            "camera_move": "pan_right",
            "character_refs": [
              "anatomical_organ_cross_section"
            ],
            "zoom_impact": false
          },
          {
            "type": "detail",
            "duration_sec": 3.0,
            "scene_description": "Close up of muscular contractions pushing the subject through the digestive tract.",
            "camera_move": "static",
            "character_refs": [
              "anatomical_organ_cross_section"
            ],
            "zoom_impact": true
          }
        ]
      },
      {
        "narration": "In the end, your body safely processes it and flushes it out within just a couple of days!",
        "title_en": "The Resolution",
        "shots": [
          {
            "type": "wide",
            "duration_sec": 3.0,
            "scene_description": "Stylized 3D main character smiling in relief, bright vibrant lighting, success emote.",
            "camera_move": "pull_out",
            "character_refs": [
              "main_character_turnaround"
            ],
            "zoom_impact": false
          }
        ]
      }
    ],
    "sheets": {
      "main_character_turnaround": "Friendly stylized 3D character with short hair, rendered as a smooth plasticine figure",
      "anatomical_organ_cross_section": "Semi-translucent glossy 3D cutaway of the digestive tract with visible tissue layers"
    },
    "assets": {
      "beat_1_a": {
        "keyframe": "/zackd/templates/swallow-gum/keyframes/beat_1_a.png",
        "clip": "/zackd/templates/swallow-gum/clips/beat_1_a.mp4"
      },
      "beat_1_b": {
        "keyframe": "/zackd/templates/swallow-gum/keyframes/beat_1_b.png",
        "clip": "/zackd/templates/swallow-gum/clips/beat_1_b.mp4"
      },
      "beat_2_a": {
        "keyframe": "/zackd/templates/swallow-gum/keyframes/beat_2_a.png",
        "clip": "/zackd/templates/swallow-gum/clips/beat_2_a.mp4"
      },
      "beat_2_b": {
        "keyframe": "/zackd/templates/swallow-gum/keyframes/beat_2_b.png",
        "clip": "/zackd/templates/swallow-gum/clips/beat_2_b.mp4"
      },
      "beat_3_a": {
        "keyframe": "/zackd/templates/swallow-gum/keyframes/beat_3_a.png",
        "clip": "/zackd/templates/swallow-gum/clips/beat_3_a.mp4"
      }
    }
  },
  {
    "id": "swallow-gum-script",
    "kind": "script",
    "title": "Swallow gum: script only",
    "topic": "What Happens When You Swallow Gum?",
    "description": "The myth-buster script from the upstream examples. No media: generate your own keyframes and clips.",
    "beats": [
      {
        "narration": "You've probably been told that swallowing gum stays in your stomach for 7 years... but is that actually true?",
        "title_en": "Swallowing Gum Myth",
        "shots": [
          {
            "type": "wide",
            "duration_sec": 3.0,
            "scene_description": "Stylized 3D boy swallowing a large pink bubble gum, wide shot in bright studio lighting.",
            "camera_move": "push_in",
            "character_refs": [
              "boy_turnaround"
            ],
            "zoom_impact": false
          },
          {
            "type": "macro_cross_section",
            "duration_sec": 3.0,
            "scene_description": "Detailed anatomical 3D cutaway cross-section of pink gum sliding down the throat.",
            "camera_move": "tilt_down",
            "character_refs": [
              "gut_cross_section_turnaround"
            ],
            "zoom_impact": true
          }
        ]
      },
      {
        "narration": "Saliva enzymes try to break it down, but the gum base completely resists. So your stomach acid steps in.",
        "title_en": "Stomach Acid Battle",
        "shots": [
          {
            "type": "macro",
            "duration_sec": 3.0,
            "scene_description": "Microscopic 3D view of stomach acid churning around the pink gum mass.",
            "camera_move": "pan_right",
            "character_refs": [
              "gut_cross_section_turnaround"
            ],
            "zoom_impact": false
          },
          {
            "type": "detail",
            "duration_sec": 3.0,
            "scene_description": "Close up of intestinal muscles squeezing the gum intact.",
            "camera_move": "static",
            "character_refs": [
              "gut_cross_section_turnaround"
            ],
            "zoom_impact": true
          }
        ]
      },
      {
        "narration": "Your digestive system treats it like insoluble fiber, passing it safely out of your body in just a few days!",
        "title_en": "Safe Passage",
        "shots": [
          {
            "type": "wide",
            "duration_sec": 3.0,
            "scene_description": "Stylized 3D boy smiling happily in relief, bright studio lighting.",
            "camera_move": "pull_out",
            "character_refs": [
              "boy_turnaround"
            ],
            "zoom_impact": false
          }
        ]
      }
    ],
    "sheets": {
      "boy_turnaround": "Stylized 3D boy with short brown hair and a blue t-shirt, plasticine shader",
      "gut_cross_section_turnaround": "Pink glossy 3D gut cross-section with stomach, esophagus and intestine, semi-translucent tissue"
    }
  },
  {
    "id": "mosquito-bite-script",
    "kind": "script",
    "title": "Mosquito bite: script only",
    "topic": "How Mosquitoes Drink Your Blood",
    "description": "A bodily-horror curiosity loop from the upstream examples. No media: generate your own keyframes and clips.",
    "beats": [
      {
        "narration": "When a mosquito lands on you, it doesn't just bite — it unfolds six needle-like tools to pierce your skin.",
        "title_en": "Mosquito Insertion",
        "shots": [
          {
            "type": "wide",
            "duration_sec": 3.0,
            "scene_description": "Macro 3D rendered mosquito landing on human arm skin, dramatic rim lighting.",
            "camera_move": "push_in",
            "character_refs": [
              "mosquito_turnaround"
            ],
            "zoom_impact": false
          },
          {
            "type": "macro_cross_section",
            "duration_sec": 3.0,
            "scene_description": "Cross-section of skin showing six micro-needles probing into a blood vessel.",
            "camera_move": "tilt_down",
            "character_refs": [
              "skin_cross_section_turnaround"
            ],
            "zoom_impact": true
          }
        ]
      },
      {
        "narration": "One needle pumps in saliva containing anesthetics so you feel nothing, while another sucks up your blood.",
        "title_en": "Anesthetic & Blood Draw",
        "shots": [
          {
            "type": "macro",
            "duration_sec": 3.0,
            "scene_description": "Glowing fluid being injected into blood vessel in 3D clay style.",
            "camera_move": "pan_left",
            "character_refs": [
              "skin_cross_section_turnaround"
            ],
            "zoom_impact": false
          },
          {
            "type": "detail",
            "duration_sec": 3.0,
            "scene_description": "Mosquito abdomen swelling with red liquid in extreme close-up.",
            "camera_move": "static",
            "character_refs": [
              "mosquito_turnaround"
            ],
            "zoom_impact": true
          }
        ]
      },
      {
        "narration": "Your immune system reacts to the leftover saliva by releasing histamine, creating that itchy red bump!",
        "title_en": "Histamine Reaction",
        "shots": [
          {
            "type": "wide",
            "duration_sec": 3.0,
            "scene_description": "Macro 3D view of red welt swelling on skin tissue with glowing immune cells.",
            "camera_move": "pull_out",
            "character_refs": [
              "skin_cross_section_turnaround"
            ],
            "zoom_impact": false
          }
        ]
      }
    ],
    "sheets": {
      "mosquito_turnaround": "Macro stylized 3D mosquito with six needle-like mouthparts, glossy clay shader",
      "skin_cross_section_turnaround": "3D skin cross-section showing epidermis, dermis and a blood vessel, semi-translucent"
    }
  }
];

export const getTemplate = (id) => TEMPLATES.find((t) => t.id === id) || null;

/**
 * Project state for a template. `origin` makes media paths absolute: the in-browser render and any
 * later paid regeneration (which needs a public https image URL) both want full URLs.
 */
export function templateToProject(template, origin = '') {
  const abs = (p) => (p ? `${origin}${p}` : p);
  const map = normalizeBeats({
    title: template.title,
    beats: template.beats,
    character_sheets_required: Object.keys(template.sheets),
    character_sheets: template.sheets,
  }, { topic: template.topic });
  const shots = {};
  for (const [id, a] of Object.entries(template.assets || {})) shots[id] = { keyframe: abs(a.keyframe), clip: abs(a.clip) };
  return { topic: template.topic, map, sheets: {}, shots, narration: null, music: null, stage: 'script' };
}
