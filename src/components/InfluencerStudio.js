import { muapi } from '../lib/muapi.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { AuthModal } from './AuthModal.js';
import { createUploadPicker } from './UploadPicker.js';
import { createHeroSection, getCustomThumbnailFromCache, saveCustomThumbnailToCache, clearCustomThumbnailCache } from '../lib/thumbnails.js';
import { mountPersonalizeTrigger, replaceTokensInPrompt } from './personalize/personalizePopover.js';
import { TemplateThumbnailModal, mountThumbnailModal } from './modals/TemplateThumbnailModal.jsx';
import { requireEntitlement } from '../lib/clerkEntitlements.js';
import { mountModelSelector } from '../lib/modelSelectorUI.js';
import { i2iModels } from '../lib/models.js';
import { createSafeImage } from '../lib/security.js';
import { getAssetsForStudio } from '../data/exampleGalleryAssets.js';
import ExampleGallery from './studios/ExampleGallery.js';
import { openSocialPublish } from '../lib/socialPublishHelpers.js';

const STYLE_PRESETS = [
  'Realistic', 'DigitalCam', 'Quiet luxury', 'FashionShow', '90s Grain', 'Sunset beach',
  'Amalfi Summer', 'Bimbocore', 'Vintage PhotoBooth', 'Gorpcore', 'Indie sleaze',
  'Fairycore', 'Avant-garde', 'Y2K Posters', 'Grunge', 'Coquette core', 'Tokyo Streetstyle',
  '2049', 'Night rider', 'Glazed doll skin makeup',
];

const FORMAT_PRESETS = [
  { name: 'Instagram Post', ar: '1:1' },
  { name: 'Story / Reel', ar: '9:16' },
  { name: 'YouTube Thumb', ar: '16:9' },
  { name: 'Pinterest Pin', ar: '2:3' },
];

const CDN = 'https://cdn.muapi.ai/influencer';

const TABS_CONFIG = {
  face: {
    label: 'Face',
    subcategories: [
      {
        id: 'character_type',
        label: 'Character Type',
        options: [
          { id: 'human',             label: 'Human',    img: `${CDN}/character_type_human.webp`,             promptVal: 'human features' },
          { id: 'elf',               label: 'Elf',      img: `${CDN}/character_type_elf.webp`,               promptVal: 'elf with pointed ears' },
          { id: 'alien',             label: 'Alien',    img: `${CDN}/character_type_alien.webp`,             promptVal: 'alien creature' },
          { id: 'amphibian',         label: 'Amphibian',img: `${CDN}/character_type_amphibian.webp`,         promptVal: 'amphibian humanoid' },
          { id: 'reptile',           label: 'Reptile',  img: `${CDN}/character_type_reptile.webp`,           promptVal: 'reptilian creature' },
          { id: 'mantis',            label: 'Mantis',   img: `${CDN}/character_type_mantis.webp`,            promptVal: 'mantis hybrid character' },
          { id: 'bee',               label: 'Bee',      img: `${CDN}/character_type_bee.webp`,               promptVal: 'bee insect hybrid character' },
          { id: 'octopus',           label: 'Octopus',  img: `${CDN}/character_type_octopus.webp`,           promptVal: 'aquatic octopus hybrid' },
          { id: 'crocodile',         label: 'Crocodile',img: `${CDN}/character_type_crocodile.webp`,         promptVal: 'crocodile humanoid' },
          { id: 'iguana',            label: 'Iguana',   img: `${CDN}/character_type_iguana.webp`,            promptVal: 'iguana humanoid' },
          { id: 'lizard',            label: 'Lizard',   img: `${CDN}/character_type_lizard.webp`,            promptVal: 'lizard humanoid' },
          { id: 'rhinoceros_beetle', label: 'Beetle',   img: `${CDN}/character_type_rhinoceros_beetle.webp`, promptVal: 'rhinoceros beetle humanoid' },
          { id: 'ant',               label: 'Ant',      img: `${CDN}/character_type_ant.webp`,               promptVal: 'ant hybrid character' },
        ],
      },
      {
        id: 'gender',
        label: 'Gender',
        options: [
          { id: 'female',      label: 'Female',      img: `${CDN}/gender_female.webp`,      promptVal: 'female' },
          { id: 'male',        label: 'Male',        img: `${CDN}/gender_male.webp`,        promptVal: 'male' },
          { id: 'non_binary',  label: 'Non-binary',  img: `${CDN}/gender_non_binary.webp`,  promptVal: 'non-binary character' },
          { id: 'trans_man',   label: 'Trans Man',   img: `${CDN}/gender_trans_man.webp`,   promptVal: 'transgender man' },
          { id: 'trans_woman', label: 'Trans Woman', img: `${CDN}/gender_trans_woman.webp`, promptVal: 'transgender woman' },
        ],
      },
      {
        id: 'ethnicity_origin_base',
        label: 'Ethnicity / Origin',
        options: [
          { id: 'african',        label: 'African',       img: `${CDN}/ethnicity_origin_base_african.webp`,                                  promptVal: 'african heritage' },
          { id: 'asian',          label: 'Asian',         img: `${CDN}/ethnicity_origin_base_recreate_in_east_asian_supermodel__korea.webp`, promptVal: 'East Asian supermodel, Korean K-Pop Idol phenotype' },
          { id: 'european',       label: 'European',      img: `${CDN}/ethnicity_origin_base_scandinavian_supermodel.webp`,                  promptVal: 'Scandinavian Supermodel' },
          { id: 'indian',         label: 'Indian',        img: `${CDN}/ethnicity_origin_base_indian.webp`,                                   promptVal: 'south asian indian heritage' },
          { id: 'middle_eastern', label: 'Middle Eastern',img: `${CDN}/ethnicity_origin_base_middle_eastern.webp`,                           promptVal: 'middle eastern heritage' },
          { id: 'mixed',          label: 'Mixed',         img: `${CDN}/ethnicity_origin_base_mixed.webp`,                                    promptVal: 'multiracial mixed heritage' },
        ],
      },
      {
        id: 'eye_color',
        label: 'Eye Color',
        options: [
          { id: 'eye_blue',       label: 'Blue',         img: `${CDN}/eye_color_eye_blue.webp`,       promptVal: 'striking blue eyes' },
          { id: 'eye_brown',      label: 'Brown',        img: `${CDN}/eye_color_eye_brown.webp`,      promptVal: 'warm brown eyes' },
          { id: 'eye_green',      label: 'Green',        img: `${CDN}/eye_color_eye_green.webp`,      promptVal: 'emerald green eyes' },
          { id: 'eye_amber',      label: 'Amber',        img: `${CDN}/eye_color_eye_amber.webp`,      promptVal: 'amber eyes' },
          { id: 'eye_grey',       label: 'Grey',         img: `${CDN}/eye_color_eye_grey.webp`,       promptVal: 'grey eyes' },
          { id: 'eye_red',        label: 'Red',          img: `${CDN}/eye_color_eye_red.webp`,        promptVal: 'red eyes' },
          { id: 'eye_purple',     label: 'Purple',       img: `${CDN}/eye_color_eye_purple.webp`,     promptVal: 'violet purple eyes' },
          { id: 'eye_black',      label: 'Black',        img: `${CDN}/eye_color_eye_black.webp`,      promptVal: 'black eyes' },
          { id: 'eye_deep_brown', label: 'Deep Brown',   img: `${CDN}/eye_color_eye_deep_brown.webp`, promptVal: 'deep dark brown eyes' },
          { id: 'eye_white',      label: 'White',        img: `${CDN}/eye_color_eye_white.webp`,      promptVal: 'white eyes' },
          { id: 'eye_black_void', label: 'Solid Black',  img: `${CDN}/eye_color_eye_black_void.webp`, promptVal: 'solid black void eyes' },
          { id: 'eye_white_void', label: 'Blind / Empty',img: `${CDN}/eye_color_eye_white_void.webp`, promptVal: 'blind empty white eyes' },
        ],
      },
      {
        id: 'eyes_type',
        label: 'Eye Type',
        options: [
          { id: 'eyes_human',      label: 'Human',     img: `${CDN}/eyes_type_eyes_human.webp`,      promptVal: 'normal human eyes' },
          { id: 'eyes_reptile',    label: 'Reptile',   img: `${CDN}/eyes_type_eyes_reptile.webp`,    promptVal: 'reptile slit-pupil eyes' },
          { id: 'eyes_mechanical', label: 'Mechanical',img: `${CDN}/eyes_type_eyes_mechanical.webp`, promptVal: 'mechanical cyborg eyes' },
        ],
      },
      {
        id: 'eyes_details',
        label: 'Eye Features',
        options: [
          { id: 'eyes_different_colors', label: 'Heterochromia', img: `${CDN}/eyes_details_eyes_different_colors.webp`, promptVal: 'heterochromia different eye colors' },
          { id: 'eyes_blind',            label: 'Blind Eye',     img: `${CDN}/eyes_details_eyes_blind.webp`,            promptVal: 'one cloudy blind eye' },
          { id: 'eyes_scarred',          label: 'Scarred Eye',   img: `${CDN}/eyes_details_eyes_scarred.webp`,          promptVal: 'scar running across one eye' },
          { id: 'eyes_glowing',          label: 'Glowing Eye',   img: `${CDN}/eyes_details_eyes_glowing.webp`,          promptVal: 'glowing magical eyes' },
        ],
      },
      {
        id: 'mouth',
        label: 'Mouth & Teeth',
        options: [
          { id: 'mouth_small',           label: 'Small Mouth',   img: `${CDN}/mouth_mouth_small.webp`,           promptVal: 'small delicate mouth' },
          { id: 'mouth_large',           label: 'Large Mouth',   img: `${CDN}/mouth_mouth_large.webp`,           promptVal: 'wide expressive mouth' },
          { id: 'mouth_no_teeth',        label: 'No Teeth',      img: `${CDN}/mouth_mouth_no_teeth.webp`,        promptVal: 'no visible teeth' },
          { id: 'mouth_different_teeth', label: 'Unique Teeth',  img: `${CDN}/mouth_mouth_different_teeth.webp`, promptVal: 'unusual tooth structure' },
          { id: 'mouth_sharp_teeth',     label: 'Sharp Teeth',   img: `${CDN}/mouth_mouth_sharp_teeth.webp`,     promptVal: 'sharp predatory fangs' },
          { id: 'mouth_forked_tongue',   label: 'Forked Tongue', img: `${CDN}/mouth_mouth_forked_tongue.webp`,   promptVal: 'reptilian forked tongue' },
          { id: 'mouth_two_tongues',     label: 'Two Tongues',   img: `${CDN}/mouth_mouth_two_tongues.webp`,     promptVal: 'two separate tongues' },
        ],
      },
      {
        id: 'ears',
        label: 'Ears',
        options: [
          { id: 'ears_human', label: 'Human',     img: `${CDN}/ears_ears_human.webp`, promptVal: 'normal human ears' },
          { id: 'ears_elf',   label: 'Elf Ears',  img: `${CDN}/ears_ears_elf.webp`,   promptVal: 'pointed elf ears' },
          { id: 'ears_no',    label: 'No Ears',   img: `${CDN}/ears_ears_no.webp`,    promptVal: 'no visible ears' },
          { id: 'ears_wings', label: 'Wing Ears', img: `${CDN}/ears_ears_wings.webp`, promptVal: 'wing ears' },
        ],
      },
      {
        id: 'horns',
        label: 'Horns',
        options: [
          { id: 'small_horns', label: 'Small Horns', img: `${CDN}/horns_small_horns.webp`, promptVal: 'small horns on forehead' },
          { id: 'big_horns',   label: 'Big Horns',   img: `${CDN}/horns_big_horns.webp`,   promptVal: 'large curved horns' },
          { id: 'antlers',     label: 'Antlers',      img: `${CDN}/horns_antlers.webp`,      promptVal: 'deer antlers on head' },
        ],
      },
      {
        id: 'skin_conditions',
        label: 'Skin Conditions',
        options: [
          { id: 'condition_vitiligo',     label: 'Vitiligo',     img: `${CDN}/skin_conditions_condition_vitiligo.webp`,     promptVal: 'vitiligo skin condition' },
          { id: 'condition_pigmentation', label: 'Pigmentation', img: `${CDN}/skin_conditions_condition_pigmentation.webp`, promptVal: 'hyperpigmentation' },
          { id: 'condition_freckles',     label: 'Freckles',     img: `${CDN}/skin_conditions_condition_freckles.webp`,     promptVal: 'freckled skin' },
          { id: 'condition_birthmarks',   label: 'Birthmarks',   img: `${CDN}/skin_conditions_condition_birthmarks.webp`,   promptVal: 'visible birthmarks' },
          { id: 'condition_scars',        label: 'Scars',        img: `${CDN}/skin_conditions_condition_scars.webp`,        promptVal: 'scarred skin' },
          { id: 'condition_burns',        label: 'Burns',        img: `${CDN}/skin_conditions_condition_burns.webp`,        promptVal: 'burn marks on skin' },
          { id: 'condition_albinism',     label: 'Albinism',     img: `${CDN}/skin_conditions_condition_albinism.webp`,     promptVal: 'albinism pale white skin' },
          { id: 'condition_cracked',      label: 'Cracked Skin', img: `${CDN}/skin_conditions_condition_cracked.webp`,      promptVal: 'cracked dry skin texture' },
          { id: 'condition_wrinkled',     label: 'Wrinkled',     img: `${CDN}/skin_conditions_condition_wrinkled.webp`,     promptVal: 'wrinkled aged skin' },
        ],
      },
    ],
  },
  body: {
    label: 'Body',
    subcategories: [
      {
        id: 'face_skin_material',
        label: 'Face Skin Material',
        options: [
          { id: 'face_skin_human',     label: 'Human Skin',  img: `${CDN}/face_skin_material_face_skin_human.webp`,     promptVal: 'smooth human skin' },
          { id: 'face_skin_scales',    label: 'Scales',      img: `${CDN}/face_skin_material_face_skin_scales.webp`,    promptVal: 'shimmering scales' },
          { id: 'face_skin_fur',       label: 'Fur',         img: `${CDN}/face_skin_material_face_skin_fur.webp`,       promptVal: 'soft fur covered face' },
          { id: 'face_skin_amphibian', label: 'Amphibian',   img: `${CDN}/face_skin_material_face_skin_amphibian.webp`, promptVal: 'smooth moist amphibian skin' },
          { id: 'face_skin_fish',      label: 'Fish Skin',   img: `${CDN}/face_skin_material_face_skin_fish.webp`,      promptVal: 'iridescent fish scale skin' },
          { id: 'face_skin_metallic',  label: 'Metallic',    img: `${CDN}/face_skin_material_face_skin_metallic.webp`,  promptVal: 'polished metallic skin' },
        ],
      },
      {
        id: 'face_surface_pattern',
        label: 'Skin Pattern',
        options: [
          { id: 'face_pattern_solid',    label: 'Solid',          img: `${CDN}/face_surface_pattern_face_pattern_solid.webp`,    promptVal: 'solid color skin' },
          { id: 'face_pattern_stripes',  label: 'Stripes',        img: `${CDN}/face_surface_pattern_face_pattern_stripes.webp`,  promptVal: 'exotic striped skin pattern' },
          { id: 'face_pattern_spots',    label: 'Spots',          img: `${CDN}/face_surface_pattern_face_pattern_spots.webp`,    promptVal: 'dappled spotted skin' },
          { id: 'face_pattern_chess',    label: 'Chess',          img: `${CDN}/face_surface_pattern_face_pattern_chess.webp`,    promptVal: 'checkerboard skin pattern' },
          { id: 'face_pattern_veins',    label: 'Veins',          img: `${CDN}/face_surface_pattern_face_pattern_veins.webp`,    promptVal: 'translucent skin with neon veins' },
          { id: 'face_pattern_gradient', label: 'Gradient',       img: `${CDN}/face_surface_pattern_face_pattern_gradient.webp`, promptVal: 'gradient skin coloring' },
          { id: 'face_pattern_giraffe',  label: 'Giraffe',        img: `${CDN}/face_surface_pattern_face_pattern_giraffe.webp`,  promptVal: 'giraffe print skin markings' },
        ],
      },
      {
        id: 'body_type',
        label: 'Body Type',
        options: [
          { id: 'body_slim',     label: 'Slim',     img: `${CDN}/body_type_body_slim.webp`,     promptVal: 'slim slender physique' },
          { id: 'body_lean',     label: 'Lean',     img: `${CDN}/body_type_body_lean.webp`,     promptVal: 'lean toned physique' },
          { id: 'body_athletic', label: 'Athletic', img: `${CDN}/body_type_body_athletic.webp`, promptVal: 'fit athletic body' },
          { id: 'body_muscular', label: 'Muscular', img: `${CDN}/body_type_body_muscular.webp`, promptVal: 'strong muscular build' },
          { id: 'body_curvy',    label: 'Curvy',    img: `${CDN}/body_type_body_curvy.webp`,    promptVal: 'curvy body type' },
          { id: 'body_heavy',    label: 'Heavy',    img: `${CDN}/body_type_body_heavy.webp`,    promptVal: 'heavy set build' },
          { id: 'body_skinny',   label: 'Skinny',   img: `${CDN}/body_type_body_skinny.webp`,   promptVal: 'very skinny thin build' },
        ],
      },
      {
        id: 'left_arm',
        label: 'Left Arm',
        options: [
          { id: 'left_arm_normal',     label: 'Normal',         img: `${CDN}/left_arm_left_arm_normal.webp`,                          promptVal: 'normal left arm' },
          { id: 'left_arm_cute',       label: 'Cute Prosthetic',img: `${CDN}/left_arm_make_left_arm_stylish_pink_prosthetic_wi.webp`, promptVal: 'stylish pink prosthetic left arm with cute stickers' },
          { id: 'left_arm_robotic',    label: 'Robotic',        img: `${CDN}/left_arm_left_arm_robotic.webp`,                         promptVal: 'robotic left arm' },
          { id: 'left_arm_prosthetic', label: 'Prosthetic',     img: `${CDN}/left_arm_left_arm_prosthetic.webp`,                      promptVal: 'prosthetic left arm' },
          { id: 'left_arm_mechanical', label: 'Mechanical',     img: `${CDN}/left_arm_left_arm_mechanical.webp`,                      promptVal: 'mechanical left arm' },
          { id: 'left_arm_none',       label: 'None',           img: `${CDN}/left_arm_left_arm_none.webp`,                            promptVal: 'no left arm' },
        ],
      },
      {
        id: 'right_arm',
        label: 'Right Arm',
        options: [
          { id: 'right_arm_normal',     label: 'Normal',         img: `${CDN}/right_arm_right_arm_normal.webp`,                          promptVal: 'normal right arm' },
          { id: 'right_arm_cute',       label: 'Cute Prosthetic',img: `${CDN}/right_arm_make_right_arm_stylish_pink_prosthetic_w.webp`, promptVal: 'stylish pink prosthetic right arm with cute stickers' },
          { id: 'right_arm_robotic',    label: 'Robotic',        img: `${CDN}/right_arm_right_arm_robotic.webp`,                         promptVal: 'robotic right arm' },
          { id: 'right_arm_prosthetic', label: 'Prosthetic',     img: `${CDN}/right_arm_right_arm_prosthetic.webp`,                      promptVal: 'prosthetic right arm' },
          { id: 'right_arm_mechanical', label: 'Mechanical',     img: `${CDN}/right_arm_right_arm_mechanical.webp`,                      promptVal: 'mechanical right arm' },
          { id: 'right_arm_none',       label: 'None',           img: `${CDN}/right_arm_right_arm_none.webp`,                            promptVal: 'no right arm' },
        ],
      },
      {
        id: 'left_leg',
        label: 'Left Leg',
        options: [
          { id: 'left_leg_normal',     label: 'Normal',         img: `${CDN}/left_leg_left_leg_normal.webp`,                          promptVal: 'normal left leg' },
          { id: 'left_leg_cute',       label: 'Cute Prosthetic',img: `${CDN}/left_leg_make_left_leg_stylish_pink_prosthetic_wi.webp`, promptVal: 'stylish pink prosthetic left leg with cute stickers' },
          { id: 'left_leg_robotic',    label: 'Robotic',        img: `${CDN}/left_leg_left_leg_robotic.webp`,                         promptVal: 'robotic left leg' },
          { id: 'left_leg_prosthetic', label: 'Prosthetic',     img: `${CDN}/left_leg_left_leg_prosthetic.webp`,                      promptVal: 'prosthetic left leg' },
          { id: 'left_leg_mechanical', label: 'Mechanical',     img: `${CDN}/left_leg_left_leg_mechanical.webp`,                      promptVal: 'mechanical left leg' },
          { id: 'left_leg_none',       label: 'None',           img: `${CDN}/left_leg_left_leg_none.webp`,                            promptVal: 'no left leg' },
        ],
      },
      {
        id: 'right_leg',
        label: 'Right Leg',
        options: [
          { id: 'right_leg_normal',     label: 'Normal',         img: `${CDN}/right_leg_right_leg_normal.webp`,                          promptVal: 'normal right leg' },
          { id: 'right_leg_cute',       label: 'Cute Prosthetic',img: `${CDN}/right_leg_make_right_leg_stylish_pink_prosthetic_w.webp`, promptVal: 'stylish pink prosthetic right leg with cute stickers' },
          { id: 'right_leg_robotic',    label: 'Robotic',        img: `${CDN}/right_leg_right_leg_robotic.webp`,                        promptVal: 'robotic right leg' },
          { id: 'right_leg_prosthetic', label: 'Prosthetic',     img: `${CDN}/right_leg_right_leg_prosthetic.webp`,                     promptVal: 'prosthetic right leg' },
          { id: 'right_leg_mechanical', label: 'Mechanical',     img: `${CDN}/right_leg_right_leg_mechanical.webp`,                     promptVal: 'mechanical right leg' },
          { id: 'right_leg_none',       label: 'None',           img: `${CDN}/right_leg_right_leg_none.webp`,                           promptVal: 'no right leg' },
        ],
      },
    ],
  },
  style: {
    label: 'Style',
    subcategories: [
      {
        id: 'hair',
        label: 'Hair / Head Growth',
        options: [
          { id: 'hair_bald',      label: 'Bald',       img: `${CDN}/hair_hair_bald.webp`,      promptVal: 'bald head' },
          { id: 'hair_short',     label: 'Short Hair', img: `${CDN}/hair_hair_short.webp`,     promptVal: 'short hair' },
          { id: 'hair_long',      label: 'Long Hair',  img: `${CDN}/hair_hair_long.webp`,      promptVal: 'long flowing hair' },
          { id: 'hair_afro',      label: 'Afro',       img: `${CDN}/hair_hair_afro.webp`,      promptVal: 'afro hairstyle' },
          { id: 'hair_punk',      label: 'Punk',       img: `${CDN}/hair_hair_punk.webp`,      promptVal: 'punk mohawk hairstyle' },
          { id: 'hair_fur',       label: 'Fur / Mane', img: `${CDN}/hair_hair_fur.webp`,       promptVal: 'fur mane on head' },
          { id: 'hair_tentacles', label: 'Tentacles',  img: `${CDN}/hair_hair_tentacles.webp`, promptVal: 'tentacles as hair' },
          { id: 'hair_spines',    label: 'Spines',     img: `${CDN}/hair_hair_spines.webp`,    promptVal: 'spines as hair' },
        ],
      },
      {
        id: 'accessories',
        label: 'Accessories & Markings',
        options: [
          { id: 'accessory_tattoos',       label: 'Tattoos',            img: `${CDN}/accessories_accessory_tattoos.webp`,       promptVal: 'covered in tattoos' },
          { id: 'accessory_piercing',      label: 'Piercings',          img: `${CDN}/accessories_accessory_piercing.webp`,      promptVal: 'multiple piercings' },
          { id: 'accessory_scarification', label: 'Scarification',      img: `${CDN}/accessories_accessory_scarification.webp`, promptVal: 'ritual scarification marks' },
          { id: 'accessory_symbols',       label: 'Symbols / Markings', img: `${CDN}/accessories_accessory_symbols.webp`,       promptVal: 'symbolic tribal markings' },
          { id: 'accessory_cyber',         label: 'Cyber Markings',     img: `${CDN}/accessories_accessory_cyber.webp`,         promptVal: 'cyberpunk circuit markings' },
        ],
      },
      {
        id: 'rendering_style',
        label: 'Rendering Style',
        options: [
          { id: 'style_hyper_realistic', label: 'Hyper-Realistic', img: `${CDN}/character_type_human.webp`,  promptVal: 'hyper-realistic 8k photograph' },
          { id: 'style_anime',           label: 'Anime',           img: `${CDN}/character_type_elf.webp`,    promptVal: 'anime art style' },
          { id: 'style_cartoon',         label: 'Cartoon',         img: `${CDN}/character_type_mantis.webp`, promptVal: 'cartoon illustration style' },
          { id: 'style_2d',              label: '2D Illustration', img: `${CDN}/character_type_alien.webp`,  promptVal: '2D flat illustration style' },
        ],
      },
    ],
  },
};

const SVG_SHUF = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>';
const SVG_BOLT = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>';
const SVG_CHECK = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
const SVG_DOWNLOAD = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
const SVG_SPIN = '<svg class="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-opacity="0.3"/><path d="M21 12a9 9 0 00-9-9"/></svg>';
const SVG_SEED = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L12 6M12 18L12 22M4.93 4.93L7.76 7.76M16.24 16.24M2 12L6 12M18 12L22 12M4.93 19.07L7.76 16.24M16.24 7.76L19.07 4.93"/></svg>';
const SVG_HIST_DOWNLOAD = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>';
const SVG_HIST_DELETE = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>';

export function InfluencerStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col items-center bg-app-bg overflow-y-auto p-6 md:p-10 relative';
  mountStudioChrome(container, { currentRoute: 'influencer' });

  let uploadedUrl = null;
  let selectedStyle = STYLE_PRESETS[0];
  let selectedFormat = FORMAT_PRESETS[0];
  let selectedModel = { id: 'higgsfield-soul-image-to-image', name: 'Influencer Image' };
  let customThumbnailUrl = getCustomThumbnailFromCache('influencer-studio');
  let styleIntensity = 70;
  let seedLocked = false;
  const currentSeed = Math.floor(Math.random() * 999999999);
  const generationHistory = [];

  const selectedOptions = {};
  Object.values(TABS_CONFIG).forEach((tab) =>
    tab.subcategories.forEach((sub) => {
      if (sub.options && sub.options.length > 0) selectedOptions[sub.id] = sub.options[0].id;
    })
  );

  let activeTab = 'face';
  const isGenerating = false;
  let currentResult = null;
  const selectedHistoryIdx = null;
  let showAllTags = false;

  const TAGS_VISIBLE = 7;

  const header = document.createElement('div');
  header.className = 'mb-8 animate-fade-in-up text-center w-full max-w-xl';
  const influBanner = createHeroSection('influencer', 'h-32 md:h-44 mb-4');
  if (influBanner) {
    const bannerText = document.createElement('div');
    bannerText.className = 'absolute bottom-0 left-0 right-0 p-5 z-10';
    bannerText.innerHTML = '<h1 class="text-2xl md:text-4xl font-black text-white tracking-tight mb-2">AI Influencer Studio</h1><p class="text-white/60 text-sm max-w-md">Generate social content with 20+ fashion presets and format templates</p>';
    influBanner.appendChild(bannerText);
    header.appendChild(influBanner);
  }
  container.appendChild(header);

  const modelSelectorContainer = document.createElement('div');
  modelSelectorContainer.className = 'w-full max-w-xl mb-6';
  container.appendChild(modelSelectorContainer);

  mountModelSelector(modelSelectorContainer, {
    models: i2iModels,
    selectedModelId: selectedModel.id,
    onSelectModel: (modelId) => {
      selectedModel = i2iModels.find(m => m.id === modelId) || selectedModel;
    },
  });

  const formCard = document.createElement('div');
  formCard.className = 'w-full max-w-xl bg-[#111]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col gap-5 animate-fade-in-up';
  formCard.style.animationDelay = '0.15s';

  const uploadRow = document.createElement('div');
  const uploadLabel = document.createElement('label');
  uploadLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider block mb-2';
  uploadLabel.textContent = 'Your Photo';
  uploadRow.appendChild(uploadLabel);
  const uploadInner = document.createElement('div');
  uploadInner.className = 'flex items-center gap-4';
  const picker = createUploadPicker({
    anchorContainer: container,
    onSelect: ({ url }) => { uploadedUrl = url; },
    onClear: () => { uploadedUrl = null; },
  });
  uploadInner.appendChild(picker.trigger);
  const uploadHint = document.createElement('span');
  uploadHint.className = 'text-sm text-muted';
  uploadHint.textContent = 'Upload reference photo or video';
  uploadInner.appendChild(uploadHint);
  uploadRow.appendChild(uploadInner);
  formCard.appendChild(uploadRow);
  container.appendChild(picker.panel);

  const buildPrompt = () => {
    const parts = [];
    Object.values(TABS_CONFIG).forEach((tab) =>
      tab.subcategories.forEach((sub) => {
        const opt = sub.options.find((o) => o.id === selectedOptions[sub.id]);
        if (opt && opt.promptVal) parts.push(opt.promptVal);
      })
    );
    let prompt = 'Ultra-realistic professional portrait photograph of an AI influencer character, 8k resolution, cinematic lighting, sharp detail';
    if (parts.length > 0) prompt += ', ' + parts.join(', ');
    if (selectedStyle) prompt += `, Style preset: ${selectedStyle}`;
    return prompt;
  };

  const attrLabel = document.createElement('label');
  attrLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
  attrLabel.textContent = 'Visual Attributes';
  formCard.appendChild(attrLabel);

  const tabRow = document.createElement('div');
  tabRow.className = 'flex gap-1';
  Object.keys(TABS_CONFIG).forEach((key) => {
    const tabBtn = document.createElement('button');
    tabBtn.type = 'button';
    tabBtn.textContent = TABS_CONFIG[key].label;
    tabBtn.dataset.tabKey = key;
    const isActive = key === activeTab;
    tabBtn.className = isActive
      ? 'flex-1 py-1.5 rounded-lg text-xs font-semibold bg-white text-black shadow transition-all'
      : 'flex-1 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-white hover:bg-white/10 transition-all';
    tabBtn.onclick = () => {
      activeTab = key;
      tabRow.querySelectorAll('button').forEach((b) => {
        const k = b.dataset.tabKey;
        b.className = k === activeTab
          ? 'flex-1 py-1.5 rounded-lg text-xs font-semibold bg-white text-black shadow transition-all'
          : 'flex-1 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-white hover:bg-white/10 transition-all';
      });
      attrScroll.querySelectorAll('[data-subcat]').forEach((sc) => {
        sc.classList.toggle('hidden', sc.dataset.subcat !== activeTab);
      });
    };
    tabRow.appendChild(tabBtn);
  });
  formCard.appendChild(tabRow);

  const shuffleBtn = document.createElement('button');
  shuffleBtn.type = 'button';
  shuffleBtn.innerHTML = `${SVG_SHUF} Shuffle`;
  shuffleBtn.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/10 transition-all w-full mt-1';
  shuffleBtn.onclick = () => {
    Object.values(TABS_CONFIG).forEach((tab) =>
      tab.subcategories.forEach((sub) => {
        if (sub.options && sub.options.length > 0) {
          selectedOptions[sub.id] = sub.options[Math.floor(Math.random() * sub.options.length)].id;
        }
      })
    );
    refreshAttrGrid();
    refreshTagsBar();
  };
  formCard.appendChild(shuffleBtn);

  const attrScroll = document.createElement('div');
  attrScroll.className = 'space-y-4 mt-3 max-h-64 overflow-y-auto pr-1';
  Object.values(TABS_CONFIG).forEach((tab) => {
    tab.subcategories.forEach((sub) => {
      const subcatBlock = document.createElement('div');
      subcatBlock.dataset.subcat = tab.label === TABS_CONFIG[activeTab]?.label ? activeTab : '';
      subcatBlock.classList.toggle('hidden', tab.label !== TABS_CONFIG[activeTab]?.label);

      const subcatTitle = document.createElement('p');
      subcatTitle.className = 'text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5';
      subcatTitle.textContent = sub.label;
      subcatBlock.appendChild(subcatTitle);

      const grid = document.createElement('div');
      grid.className = 'grid grid-cols-3 gap-1.5';
      grid.dataset.subcatGrid = sub.id;

      sub.options.forEach((opt) => {
        const isSelected = selectedOptions[sub.id] === opt.id;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.optId = opt.id;
        btn.className = isSelected
          ? 'group relative aspect-square rounded-xl overflow-hidden border-2 border-white/80 ring-1 ring-white/30 shadow-lg transition-all'
          : 'group relative aspect-square rounded-xl overflow-hidden border border-white/[0.08] hover:border-white/25 transition-all';
        btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        btn.setAttribute('aria-label', opt.label);

        const img = document.createElement('img');
        img.src = opt.img;
        img.alt = opt.label;
        img.loading = 'lazy';
        img.className = 'w-full h-full object-cover';
        img.onerror = function () { this.onerror = null; this.src = `${CDN}/character_type_human.webp`; };
        btn.appendChild(img);

        const overlay = document.createElement('div');
        overlay.className = 'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-4 pb-1 px-1';
        const labelSpan = document.createElement('span');
        labelSpan.className = 'text-[9px] font-semibold text-white leading-none';
        labelSpan.textContent = opt.label;
        overlay.appendChild(labelSpan);
        btn.appendChild(overlay);

        if (isSelected) {
          const badge = document.createElement('div');
          badge.className = 'absolute top-1 right-1 w-4 h-4 rounded-full bg-white text-black flex items-center justify-center';
          badge.innerHTML = SVG_CHECK;
          btn.appendChild(badge);
        }

        btn.onclick = () => {
          selectedOptions[sub.id] = opt.id;
          refreshAttrGrid();
          refreshTagsBar();
        };

        grid.appendChild(btn);
      });

      subcatBlock.appendChild(grid);
      attrScroll.appendChild(subcatBlock);
    });
  });

  function refreshAttrGrid() {
    attrScroll.querySelectorAll('[data-subcat-grid]').forEach((grid) => {
      const subId = grid.dataset.subcatGrid;
      grid.querySelectorAll('button[data-opt-id]').forEach((btn) => {
        const optId = btn.dataset.optId;
        const isSel = selectedOptions[subId] === optId;
        btn.className = isSel
          ? 'group relative aspect-square rounded-xl overflow-hidden border-2 border-white/80 ring-1 ring-white/30 shadow-lg transition-all'
          : 'group relative aspect-square rounded-xl overflow-hidden border border-white/[0.08] hover:border-white/25 transition-all';
        btn.setAttribute('aria-pressed', isSel ? 'true' : 'false');
        const existingBadge = btn.querySelector('.attr-check-badge');
        if (existingBadge) existingBadge.remove();
        if (isSel) {
          const badge = document.createElement('div');
          badge.className = 'absolute top-1 right-1 w-4 h-4 rounded-full bg-white text-black flex items-center justify-center attr-check-badge';
          badge.innerHTML = SVG_CHECK;
          btn.appendChild(badge);
        }
      });
    });
  }

  formCard.appendChild(attrScroll);

  const formatLabel = document.createElement('label');
  formatLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
  formatLabel.textContent = 'Output Format';
  formCard.appendChild(formatLabel);

  const formatRow = document.createElement('div');
  formatRow.className = 'flex gap-2 flex-wrap';
  FORMAT_PRESETS.forEach((f) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = f.name === selectedFormat.name
      ? 'px-4 py-2 rounded-xl text-xs font-bold btn-secondary-modern transition-all'
      : 'px-4 py-2 rounded-xl text-xs font-bold bg-white/5 text-secondary hover:bg-white/10 transition-all border border-white/10';
    btn.textContent = `${f.name} (${f.ar})`;
    btn.onclick = () => {
      selectedFormat = f;
      formatRow.querySelectorAll('button').forEach((b) => {
        const isActive = b.textContent.includes(f.name);
        b.className = isActive
          ? 'px-4 py-2 rounded-xl text-xs font-bold btn-secondary-modern transition-all'
          : 'px-4 py-2 rounded-xl text-xs font-bold bg-white/5 text-secondary hover:bg-white/10 transition-all border border-white/10';
      });
    };
    formatRow.appendChild(btn);
  });
  formCard.appendChild(formatRow);

  const intensityRow = document.createElement('div');
  intensityRow.className = 'flex flex-col gap-2';
  intensityRow.innerHTML = `
    <div class="flex items-center justify-between">
      <label class="text-xs font-bold text-secondary uppercase tracking-wider">Style Intensity</label>
      <span id="intensity-val" class="text-xs font-bold text-primary">${styleIntensity}%</span>
    </div>
    <input type="range" id="style-intensity-slider" min="0" max="100" step="5" value="${styleIntensity}"
      class="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary">
  `;
  formCard.appendChild(intensityRow);

  const intensitySlider = intensityRow.querySelector('#style-intensity-slider');
  const intensityVal = intensityRow.querySelector('#intensity-val');
  if (intensitySlider) {
    intensitySlider.oninput = (e) => {
      styleIntensity = parseInt(e.target.value, 10);
      intensityVal.textContent = styleIntensity + '%';
    };
  }

  const stylePresetRow = document.createElement('div');
  stylePresetRow.className = 'flex flex-col gap-2';
  const stylePresetLabel = document.createElement('label');
  stylePresetLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
  stylePresetLabel.textContent = 'Style Preset';
  stylePresetRow.appendChild(stylePresetLabel);

  const stylePresetGrid = document.createElement('div');
  stylePresetGrid.className = 'flex gap-1.5 flex-wrap';

  const STYLE_GRADIENTS = {
    'Realistic': 'linear-gradient(135deg, #e8d5b7, #c4a882)',
    'DigitalCam': 'linear-gradient(135deg, #667eea, #764ba2)',
    'Quiet luxury': 'linear-gradient(135deg, #d5cfc7, #a89f91)',
    'FashionShow': 'linear-gradient(135deg, #1a1a2e, #e94560)',
    '90s Grain': 'linear-gradient(135deg, #f6d365, #fda085)',
    'Sunset beach': 'linear-gradient(135deg, #ff9a9e, #fecfef)',
    'Amalfi Summer': 'linear-gradient(135deg, #a1c4fd, #c2e9fb)',
    'Bimbocore': 'linear-gradient(135deg, #ff6b9d, #c44569)',
    'Vintage PhotoBooth': 'linear-gradient(135deg, #d4a574, #8b5e3c)',
    'Gorpcore': 'linear-gradient(135deg, #4a6741, #8b9a7b)',
    'Indie sleaze': 'linear-gradient(135deg, #c9a87c, #8b7355)',
    'Fairycore': 'linear-gradient(135deg, #e0c3fc, #8ec5fc)',
    'Avant-garde': 'linear-gradient(135deg, #0f0f0f, #434343)',
    'Y2K Posters': 'linear-gradient(135deg, #00d2ff, #3a7bd5)',
    'Grunge': 'linear-gradient(135deg, #5c4a3d, #3d2b1f)',
    'Coquette core': 'linear-gradient(135deg, #ffc3a0, #ffafbd)',
    'Tokyo Streetstyle': 'linear-gradient(135deg, #ff0080, #ff8c00)',
    '2049': 'linear-gradient(135deg, #ff6b35, #f7c948)',
    'Night rider': 'linear-gradient(135deg, #0c0c0c, #1a1a2e)',
    'Glazed doll skin makeup': 'linear-gradient(135deg, #ffecd2, #fcb69f)',
  };

  STYLE_PRESETS.forEach(style => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all border';
    const gradient = STYLE_GRADIENTS[style] || 'linear-gradient(135deg, #333, #666)';
    const isActive = style === selectedStyle;
    if (isActive) {
      btn.className += ' border-primary/40 bg-white/10 text-white';
    } else {
      btn.className += ' border-white/10 bg-white/5 text-secondary hover:bg-white/10';
    }
    btn.innerHTML = `<span class="w-3 h-3 rounded-full shrink-0 border border-white/20" style="background:${gradient}"></span>${style}`;
    btn.onclick = () => {
      selectedStyle = style;
      stylePresetGrid.querySelectorAll('button').forEach(b => {
        b.classList.remove('border-primary/40', 'bg-white/10', 'text-white');
        b.classList.add('border-white/10', 'bg-white/5', 'text-secondary');
      });
      btn.classList.remove('border-white/10', 'bg-white/5', 'text-secondary');
      btn.classList.add('border-primary/40', 'bg-white/10', 'text-white');
    };
    stylePresetGrid.appendChild(btn);
  });

  stylePresetRow.appendChild(stylePresetGrid);
  formCard.appendChild(stylePresetRow);

  const seedRow = document.createElement('div');
  seedRow.className = 'flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3';
  seedRow.innerHTML = `
    <div class="flex items-center gap-3">
      ${SVG_SEED}
      <div>
        <div class="text-xs font-bold text-white">Character Consistency (Seed Lock)</div>
        <div class="text-[10px] text-muted">Keep face consistent across generations</div>
      </div>
    </div>
    <div class="flex items-center gap-3">
      <span id="seed-display" class="text-xs font-mono text-muted">#${currentSeed}</span>
      <button id="seed-toggle" class="relative w-11 h-6 bg-white/10 rounded-full transition-colors" aria-label="Toggle seed lock">
        <span class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform"></span>
      </button>
    </div>
  `;
  formCard.appendChild(seedRow);

  const seedToggle = seedRow.querySelector('#seed-toggle');
  const seedDisplay = seedRow.querySelector('#seed-display');
  if (seedToggle) {
    seedToggle.onclick = () => {
      seedLocked = !seedLocked;
      if (seedLocked) {
        seedToggle.classList.remove('bg-white/10');
        seedToggle.classList.add('bg-primary');
        seedToggle.querySelector('span').classList.add('translate-x-5');
      } else {
        seedToggle.classList.add('bg-white/10');
        seedToggle.classList.remove('bg-primary');
        seedToggle.querySelector('span').classList.remove('translate-x-5');
      }
    };
  }

  const promptInput = document.createElement('textarea');
    // Prompt Gallery button
    const promptGalleryBtn = document.createElement('button');
    promptGalleryBtn.type = 'button';
    promptGalleryBtn.textContent = '📚 Prompts';
    promptGalleryBtn.title = 'Browse prompt gallery';
    promptGalleryBtn.setAttribute('aria-label', 'Open prompt gallery');
    promptGalleryBtn.className = 'btn-ghost-modern';
    promptGalleryBtn.addEventListener('click', () => {
        openPromptGallery({
          appTheme: 'influencer-studio',
          onSelect: (prompt) => {
            promptInput.value = prompt;
            promptInput.dispatchEvent(new Event('input', { bubbles: true }));
            promptInput.focus();
          }
        }).catch((err) => console.error('[PromptGallery] open failed:', err));
    });

    // Recipe Engine button
    const recipeBtn = document.createElement('button');
    recipeBtn.type = 'button';
    recipeBtn.textContent = '📋 Recipes';
    recipeBtn.title = 'Browse AI recipes';
    recipeBtn.setAttribute('aria-label', 'Open recipe engine');
    recipeBtn.className = 'btn-ghost-modern';
    recipeBtn.addEventListener('click', () => {
      openRecipeModal({
        onRunRecipe: (url) => {
        }
      }).catch((err) => console.error('[Recipe] open failed:', err));
    });


    // Monetization Hub button
    const monetizationBtn = document.createElement('button');
    monetizationBtn.type = 'button';
    monetizationBtn.textContent = '💼 Monetize';
    monetizationBtn.title = "Open Smart Video AI Monetization Hub";
    monetizationBtn.setAttribute('aria-label', 'Open Smart Video AI Monetization Hub');
    monetizationBtn.className = 'btn-ghost-modern';
    monetizationBtn.addEventListener('click', () => {
      openMonetizationHub().catch((err) => console.error('[Monetization] open failed:', err));
    });
    // Model Picker button
    const modelPickerBtn = document.createElement('button');
    modelPickerBtn.type = 'button';
    modelPickerBtn.textContent = 'AI Pick';
    modelPickerBtn.title = 'Open intelligent model picker';
    modelPickerBtn.setAttribute('aria-label', 'Open model picker');
    modelPickerBtn.className = 'text-[11px] font-bold text-cyan-400 border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1.5 rounded-lg hover:bg-cyan-400/20 transition-colors ml-2 whitespace-nowrap';
    modelPickerBtn.addEventListener('click', () => {
      openModelPicker({
        currentModelId: selectedModel.id,
        onSelectModel: (modelId) => {
          selectedModel = i2iModels.find(m => m.id === modelId) || selectedModel;
        }
      }).catch((err) => console.error('[ModelPicker] open failed:', err));
    });
    formCard.appendChild(modelPickerBtn);
  promptInput.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors resize-none';
  promptInput.rows = 2;
  promptInput.placeholder = 'Additional instructions (optional)';
  promptInput.setAttribute('aria-label', 'Influencer prompt');
  formCard.appendChild(promptInput);

  const gtmBtn = document.createElement('button');
  gtmBtn.type = 'button';
  gtmBtn.textContent = '🎯 GTM Boost';
  gtmBtn.title = 'Enhance your prompt with GTM conversion frameworks';
  gtmBtn.setAttribute('aria-label', 'GTM Boost prompt enhancer');
  gtmBtn.className = 'gtm-boost-btn';
  gtmBtn.addEventListener('click', () => {
    import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
      openGTMPromptModal('influencer-studio', (prompt) => {
        promptInput.value = prompt;
        promptInput.dispatchEvent(new Event('input', { bubbles: true }));
        promptInput.focus();
      });
    }).catch((err) => console.error('[InfluencerStudio] GTM Boost failed:', err));
  });
  const toolbar = document.createElement('div');
  toolbar.className = 'flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]';
  toolbar.appendChild(gtmBtn);
  toolbar.appendChild(recipeBtn);
  toolbar.appendChild(monetizationBtn);
  toolbar.appendChild(promptGalleryBtn);
  formCard.appendChild(toolbar);

  const personalizeControls = document.createElement('div');
  personalizeControls.className = 'flex items-center gap-2';
  mountPersonalizeTrigger({
      controlsContainer: personalizeControls,
      getTextarea: () => promptInput,
      appId: 'influencer-studio',
  });
  formCard.appendChild(personalizeControls);

  const thumbBtn = document.createElement('button');
  thumbBtn.type = 'button';
  thumbBtn.textContent = '🖼 Thumbnail';
  thumbBtn.title = 'Generate a custom thumbnail';
  thumbBtn.className = 'btn-ghost-modern w-full';
  thumbBtn.addEventListener('click', () => {
    const modal = new TemplateThumbnailModal({
      appTheme: 'influencer-studio',
      layout: 'panel',
      studioId: 'influencer-studio',
      studioName: 'AI Influencer Studio',
      aspectRatio: selectedFormat.ar || '1:1',
      outputType: 'image',
      onApply: ({ imageUrl }) => {
        customThumbnailUrl = imageUrl;
        saveCustomThumbnailToCache('influencer-studio', imageUrl);
      },
      onClear: () => {
        customThumbnailUrl = null;
        clearCustomThumbnailCache('influencer-studio');
      },
    });
    mountThumbnailModal(modal);
    modal.open();
  });
  formCard.appendChild(thumbBtn);

  const genBtn = document.createElement('button');
genBtn.type = 'button';
  genBtn.className = 'btn-primary-modern w-full px-[14px] py-2 min-h-[40px] text-[13px] font-bold rounded-2xl inline-flex items-center justify-center gap-1.5 transition-all mt-2';
  genBtn.textContent = 'Generate Content';
  genBtn.setAttribute('aria-label', 'Generate content');
  formCard.appendChild(genBtn);
  container.appendChild(formCard);

  const previewCard = document.createElement('div');
  previewCard.className = 'w-full max-w-xl bg-[#111]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col gap-4 animate-fade-in-up';
  previewCard.style.animationDelay = '0.2s';

  const previewHeader = document.createElement('div');
  previewHeader.className = 'flex items-center justify-between';

  const arGroup = document.createElement('div');
  arGroup.className = 'flex gap-0.5 bg-white/5 border border-white/10 rounded-xl p-1';
  ['3:4', '1:1', '9:16', '16:9'].forEach((r) => {
    const arBtn = document.createElement('button');
    arBtn.type = 'button';
    arBtn.textContent = r;
    const isActive = r === selectedFormat.ar;
    arBtn.className = isActive
      ? 'px-3 py-1.5 rounded-lg text-xs font-bold btn-secondary-modern transition-all'
      : 'px-3 py-1.5 rounded-lg text-xs font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-all';
    arBtn.onclick = () => {
      selectedFormat = { name: selectedFormat.name, ar: r };
      arGroup.querySelectorAll('button').forEach((b) => {
        const active = b.textContent === r;
        b.className = active
          ? 'px-3 py-1.5 rounded-lg text-xs font-bold btn-secondary-modern transition-all'
          : 'px-3 py-1.5 rounded-lg text-xs font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-all';
      });
    };
    arGroup.appendChild(arBtn);
  });
  previewHeader.appendChild(arGroup);

  const actionGroup = document.createElement('div');
  actionGroup.className = 'flex items-center gap-2';

  const shuffleActionBtn = document.createElement('button');
  shuffleActionBtn.type = 'button';
  shuffleActionBtn.innerHTML = `${SVG_SHUF} Shuffle`;
  shuffleActionBtn.className = 'flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/10 transition-all';
  shuffleActionBtn.onclick = () => {
    Object.values(TABS_CONFIG).forEach((tab) =>
      tab.subcategories.forEach((sub) => {
        if (sub.options && sub.options.length > 0) {
          selectedOptions[sub.id] = sub.options[Math.floor(Math.random() * sub.options.length)].id;
        }
      })
    );
    refreshAttrGrid();
    refreshTagsBar();
  };
  actionGroup.appendChild(shuffleActionBtn);

  const previewGenBtn = document.createElement('button');
  previewGenBtn.type = 'button';
  previewGenBtn.innerHTML = `${SVG_BOLT} Generate`;
  previewGenBtn.className = 'btn-secondary-modern flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all';
  previewGenBtn.onclick = () => genBtn.click();
  actionGroup.appendChild(previewGenBtn);

  previewHeader.appendChild(actionGroup);
  previewCard.appendChild(previewHeader);

  const previewArea = document.createElement('div');
  previewArea.className = 'relative rounded-2xl overflow-hidden bg-[#141414] border border-white/10 flex items-center justify-center';
  previewArea.style.aspectRatio = '3/4';
  previewArea.style.maxHeight = '420px';
  previewArea.style.maxWidth = '100%';

  const placeholderContent = document.createElement('div');
  placeholderContent.className = 'flex flex-col items-center gap-3 text-center px-8 py-12';
  placeholderContent.innerHTML = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.8" class="text-gray-700"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><p class="text-sm text-gray-600 font-medium">Your AI influencer lives here.</p><p class="text-xs text-gray-700">Design and build your AI influencer from scratch</p>';
  previewArea.appendChild(placeholderContent);

  const previewImg = document.createElement('img');
  previewImg.className = 'w-full h-full object-cover hidden';
  previewImg.alt = 'Generated AI Character';

  const downloadOverlay = document.createElement('button');
  downloadOverlay.type = 'button';
  downloadOverlay.className = 'absolute bottom-3 right-3 hidden items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 text-white text-[11px] font-semibold hover:bg-black/80 transition-all z-10';
  downloadOverlay.innerHTML = `${SVG_DOWNLOAD} Save`;
  downloadOverlay.onclick = () => {
    if (previewImg.src && !previewImg.classList.contains('hidden')) {
      const a = document.createElement('a');
      a.href = previewImg.src;
      a.download = `ai-influencer-${Date.now()}.webp`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  previewArea.appendChild(previewImg);
  previewArea.appendChild(downloadOverlay);
  previewCard.appendChild(previewArea);

  const tagsBar = document.createElement('div');
  tagsBar.className = 'flex flex-wrap gap-1.5 items-center min-h-[26px]';

  function refreshTagsBar() {
    tagsBar.innerHTML = '';
    const selectedTags = [];
    Object.keys(TABS_CONFIG).forEach((tabKey) => {
      TABS_CONFIG[tabKey].subcategories.forEach((sub) => {
        const selId = selectedOptions[sub.id];
        const opt = sub.options.find((o) => o.id === selId);
        if (opt) selectedTags.push({ subcatId: sub.id, label: opt.label, img: opt.img });
      });
    });

    if (selectedTags.length === 0) return;

    const visibleTags = showAllTags ? selectedTags : selectedTags.slice(0, TAGS_VISIBLE);

    visibleTags.forEach((tag) => {
      const pillWrap = document.createElement('div');
      pillWrap.className = 'relative shrink-0';

      const tooltip = document.createElement('div');
      tooltip.className = 'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none hidden';
      tooltip.style.filter = 'drop-shadow(0 4px 16px rgba(0,0,0,0.6))';
      tooltip.innerHTML = `<div class="w-[72px] h-[72px] rounded-xl overflow-hidden border border-white/20 bg-[#1a1a1a]" style="transform:rotate(-3deg)"><img src="${tag.img}" alt="${tag.label}" class="w-full h-full object-cover" /></div>`;

      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'h-[22px] px-2 rounded-md bg-white/[0.07] hover:bg-white/[0.13] border border-white/[0.10] text-[11px] font-medium text-gray-200 whitespace-nowrap transition-all cursor-pointer';
      pill.textContent = tag.label;

      pillWrap.appendChild(tooltip);
      pillWrap.appendChild(pill);
      tagsBar.appendChild(pillWrap);

      pill.addEventListener('mouseenter', () => { tooltip.classList.remove('hidden'); });
      pill.addEventListener('mouseleave', () => { tooltip.classList.add('hidden'); });
    });

    if (selectedTags.length > TAGS_VISIBLE) {
      const moreBtn = document.createElement('button');
      moreBtn.type = 'button';
      moreBtn.textContent = showAllTags ? 'hide' : 'show more';
      moreBtn.className = 'h-[22px] px-2 rounded-md bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-[11px] text-gray-500 hover:text-gray-300 whitespace-nowrap transition-all cursor-pointer';
      moreBtn.onclick = () => {
        showAllTags = !showAllTags;
        refreshTagsBar();
      };
      tagsBar.appendChild(moreBtn);
    }
  }

  refreshTagsBar();
  previewCard.appendChild(tagsBar);
  container.appendChild(previewCard);

  const genArea = document.createElement('div');
  genArea.className = 'w-full max-w-xl mt-4';
  const genWrapper = document.createElement('div');
  genWrapper.className = 'flex gap-3 items-center';

  const promptHint = document.createElement('span');
  promptHint.className = 'text-[11px] text-muted truncate flex-1';
  promptHint.textContent = 'Add details in the prompt field above, then generate.';
  genWrapper.appendChild(promptHint);
  genArea.appendChild(genWrapper);
  container.appendChild(genArea);

  const resultArea = document.createElement('div');
  resultArea.className = 'w-full max-w-xl mt-6 hidden';
  resultArea.setAttribute('role', 'status');
  resultArea.setAttribute('aria-live', 'polite');
  container.appendChild(resultArea);

  const historySidebar = document.createElement('div');
  historySidebar.className = 'fixed right-0 top-0 h-full w-20 md:w-24 bg-black/60 backdrop-blur-xl border-l border-white/5 z-50 flex flex-col items-center py-4 gap-3 overflow-y-auto transition-all duration-500 translate-x-full opacity-0';
  historySidebar.id = 'influencer-history-sidebar';

  const historyLabel = document.createElement('div');
  historyLabel.className = 'text-[9px] font-bold text-muted uppercase tracking-widest mb-2';
  historyLabel.textContent = 'History';
  historySidebar.appendChild(historyLabel);

  const historyList = document.createElement('div');
  historyList.className = 'flex flex-col gap-2 w-full px-2';
  historySidebar.appendChild(historyList);

  container.appendChild(historySidebar);

  const renderHistory = () => {
    historyList.innerHTML = '';
    generationHistory.slice(0, 50).forEach((entry, idx) => {
      const thumb = document.createElement('div');
      thumb.className = `relative group/thumb cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-300 ${idx === 0 ? 'border-primary shadow-glow' : 'border-white/10 hover:border-white/30'}`;

      const img = createSafeImage(entry.url, (entry.prompt || 'Generated').substring(0, 30), 'w-full aspect-square object-cover');
      thumb.appendChild(img);

      const overlay = document.createElement('div');
      overlay.className = 'absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center gap-1';

      const downloadBtn = document.createElement('button');
      downloadBtn.type = 'button';
      downloadBtn.className = 'hist-download p-1.5 bg-primary rounded-lg text-black hover:scale-110 transition-transform';
      downloadBtn.title = 'Download';
      downloadBtn.innerHTML = SVG_HIST_DOWNLOAD;
      overlay.appendChild(downloadBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'hist-delete p-1.5 bg-red-500/80 rounded-lg text-white hover:scale-110 transition-transform';
      deleteBtn.title = 'Delete';
      deleteBtn.innerHTML = SVG_HIST_DELETE;
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        generationHistory.splice(idx, 1);
        try { localStorage.setItem('influencer_history', JSON.stringify(generationHistory.slice(0, 50))); } catch {}
        renderHistory();
      };
      overlay.appendChild(deleteBtn);
      thumb.appendChild(overlay);

      thumb.onclick = (e) => {
        if (e.target.closest('.hist-download')) {
          const a = document.createElement('a');
          a.href = entry.url;
          a.download = `influencer-${entry.id || idx}.jpg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          return;
        }
        resultArea.classList.remove('hidden');
        resultArea.innerHTML = `
          <div class="bg-[#111]/80 border border-white/10 rounded-2xl p-4 animate-fade-in-up">
            <img src="${entry.url}" class="w-full rounded-xl mb-3">
            <div class="flex gap-3">
              <a href="${entry.url}" download class="flex-1 btn-secondary-modern py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all">Download</a>
              <button class="flex-1 bg-white/10 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-white/20 transition-all regen-btn">Generate Again</button>
            </div>
          </div>
        `;
        resultArea.querySelector('.regen-btn').onclick = () => genBtn.click();
      };

      historyList.appendChild(thumb);
    });
  };

  const addToHistory = (entry) => {
    generationHistory.unshift(entry);
    try {
      localStorage.setItem('influencer_history', JSON.stringify(generationHistory.slice(0, 50)));
    } catch { /* ignore */ }
    historySidebar.classList.remove('translate-x-full', 'opacity-0');
    historySidebar.classList.add('translate-x-0', 'opacity-100');
    renderHistory();
  };

  try {
    const saved = JSON.parse(localStorage.getItem('influencer_history') || '[]');
    saved.forEach((e) => generationHistory.push(e));
    if (saved.length > 0) {
      historySidebar.classList.remove('translate-x-full', 'opacity-0');
      historySidebar.classList.add('translate-x-0', 'opacity-100');
      renderHistory();
    }
  } catch { /* ignore */ }

  genBtn.onclick = async () => {
    if (!(await requireEntitlement())) return;
    if (!uploadedUrl) { alert('Upload a photo first'); return; }
    const apiKey = apiKeyManager.getMuapiKey();
    if (!apiKey) { AuthModal(() => genBtn.click()); return; }

    genBtn.disabled = true;
    genBtn.innerHTML = `<span class="animate-spin inline-block mr-2">&#9711;</span> Generating...`;

    try {
      const activeProfile = (() => { try { return JSON.parse(localStorage.getItem('remix_contact_profiles') || '[]').find((p) => p.id === localStorage.getItem('remix_selected_contact_id')) || null; } catch { return null; } })();
      const prompt = `${buildPrompt()}. ${replaceTokensInPrompt(promptInput.value.trim(), activeProfile) || 'Fashion editorial photo, professional quality'}`;
      const params = {
        model: selectedModel.id,
        image_url: uploadedUrl,
        prompt,
        style: selectedStyle,
        style_intensity: styleIntensity / 100,
        aspect_ratio: selectedFormat.ar,
        customThumbnailUrl: customThumbnailUrl || undefined,
      };
      if (seedLocked) params.seed = currentSeed;
      const result = await muapi.generateI2I(params);
      if (seedLocked && result?.url) {
        seedDisplay.textContent = `#${currentSeed}`;
      }
      if (result?.url) {
        currentResult = result.url;
        previewImg.src = result.url;
        previewImg.classList.remove('hidden');
        downloadOverlay.classList.remove('hidden');
        downloadOverlay.classList.add('flex');
        placeholderContent.classList.add('hidden');
        resultArea.classList.add('hidden');
        addToHistory({ id: Date.now(), url: result.url, prompt, style: selectedStyle, timestamp: Date.now() });
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = 'Generate Content';
    }
  };

    const galleryAssets = getAssetsForStudio('influencer');
    if (galleryAssets.length > 0) {
      const gallery = ExampleGallery({ studioId: 'influencer', assets: galleryAssets, maxCards: 28 });
      container.appendChild(gallery);
    }

    return container;
}
