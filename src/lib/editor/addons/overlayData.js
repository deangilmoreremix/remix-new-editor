/**
 * Data lists for the overlay addons, taken from upstream
 * strategic-limited/remix-new-editor:
 *   lib/constants/fonts.js       → OVERLAY_FONTS (Google Fonts families)
 *   lib/constants/animations.js  → OVERLAY_ANIMATIONS (Animate.css names)
 *   lib/constants/blendMode.js   → BLEND_MODES
 * and the built-in sticker library from public/assets/sticker/
 * (upstream's animated sticker catalog lived on its backend; animated
 * stickers are added here from a Lottie .json URL or upload).
 *
 * Generated from those files; regenerate rather than hand-edit the lists.
 */

export const DEFAULT_OVERLAY_FONT = 'Anton';

export const OVERLAY_FONTS = [
  "Lobster",
  "Pacifico",
  "Bebas Neue",
  "Abril Fatface",
  "Amatic SC",
  "Kaushan Script",
  "Satisfy",
  "Great Vibes",
  "Special Elite",
  "Ultra",
  "Vidaloka",
  "Luckiest Guy",
  "Staatliches",
  "Carter One",
  "Mr Dafoe",
  "Leckerli One",
  "Aguafina Script",
  "Finger Paint",
  "Italiana",
  "Sancreek",
  "Sedgwick Ave Display",
  "Kanit",
  "Russo One",
  "Beth Ellen",
  "Exo 2",
  "Italianno",
  "Fjalla One",
  "Gentium Book Basic",
  "Source Sans Pro",
  "Poppins",
  "Squada One",
  "Lato",
  "Questrial",
  "Sintony",
  "Lora",
  "Roboto",
  "Khula",
  "Yanone Kaffeesatz",
  "Syncopate",
  "Economica",
  "Vollkorn",
  "Nanum Brush Script",
  "Rajdhani",
  "Merriweather",
  "Ek Mukta",
  "Mukta",
  "Merriweather Sans",
  "Istok Web",
  "Metrophobic",
  "Montserrat",
  "Gravitas One",
  "PT Sans",
  "Macondo Swash Caps",
  "Open Sans",
  "Supermercado One",
  "Oswald",
  "Palanquin",
  "Dancing Script",
  "Bad Script",
  "Heebo",
  "DotGothic16",
  "Outfit",
  "Bangers",
  "Fredoka One",
  "Covered By Your Grace",
  "Coda",
  "Bowlby One SC",
  "Titan One",
  "Bevan",
  "Teko",
  "Tienne",
  "Alfa Slab One",
  "Martel Sans",
  "Raleway",
  "Fredericka the Great",
  "Cabin Sketch",
  "Anton",
  "Zeyada",
  "La Belle Aurore",
  "Homemade Apple",
  "Crete Round",
  "Palanquin Dark",
  "Dawning of a New Day",
  "Give You Glory",
  "Indie Flower",
  "Just Me Again Down Here",
  "Over the Rainbow",
  "Permanent Marker",
  "Reenie Beanie",
  "Rock Salt",
  "Waiting for the Sunrise",
  "Walter Turncoat",
  "Vast Shadow",
  "Lily Script One",
  "Cookie",
  "Londrina Sketch",
  "Nunito",
  "Krona One",
  "Syne",
  "Belleza",
  "Space Grotesk",
  "Federo",
  "DM Sans",
  "Caudex",
  "Cinzel Decorative",
  "Viaoda Libre",
  "Piazzolla",
  "Mulish",
  "Ceviche One",
  "Sora",
  "Hahmlet",
  "JetBrains Mono",
  "Andada Pro",
  "Epilogue",
  "Inter",
  "Encode Sans",
  "Manrope",
  "BioRhyme",
  "Playfair Display",
  "Archivo Narrow",
  "Rubik",
  "Inconsolata",
  "Cardo",
  "Neuton",
  "Archivo",
  "Chivo",
  "Slabo 27px",
  "Space Mono",
  "Work Sans",
  "Mochiy Pop P One",
  "Cormorant",
  "Eczar",
  "Spectral",
  "Proza Libre"
];

/** [value, label] pairs; first entry is "No blend". */
export const BLEND_MODES = [
  [
    "normal",
    "No blend"
  ],
  [
    "multiply",
    "Multiply"
  ],
  [
    "screen",
    "Screen"
  ],
  [
    "overlay",
    "Overlay"
  ],
  [
    "darken",
    "Darken"
  ],
  [
    "lighten",
    "Lighten"
  ],
  [
    "color-dodge",
    "Color Dodge"
  ],
  [
    "color-burn",
    "Color Burn"
  ],
  [
    "hard-light",
    "Hard Light"
  ],
  [
    "soft-light",
    "Soft Light"
  ],
  [
    "difference",
    "Difference"
  ],
  [
    "exclusion",
    "Exclusion"
  ],
  [
    "hue",
    "Hue"
  ],
  [
    "saturation",
    "Saturation"
  ],
  [
    "color",
    "Color"
  ],
  [
    "luminosity",
    "Luminosity"
  ]
];

/** { in, idle, out }: arrays of [value, label]. */
export const OVERLAY_ANIMATIONS = {
  "in": [
    [
      "bounceIn",
      "Bounce In"
    ],
    [
      "bounceInDown",
      "Bounce In Down"
    ],
    [
      "bounceInLeft",
      "Bounce In Left"
    ],
    [
      "bounceInRight",
      "Bounce In Right"
    ],
    [
      "bounceInUp",
      "Bounce In Up"
    ],
    [
      "fadeIn",
      "Fade In"
    ],
    [
      "fadeInDown",
      "Fade In Down"
    ],
    [
      "fadeInDownBig",
      "Fade In Down Big"
    ],
    [
      "fadeInLeft",
      "Fade In Left"
    ],
    [
      "fadeInLeftBig",
      "Fade In Left Big"
    ],
    [
      "fadeInRight",
      "Fade In Right"
    ],
    [
      "fadeInRightBig",
      "Fade In Right Big"
    ],
    [
      "fadeInUp",
      "Fade In Up"
    ],
    [
      "fadeInUpBig",
      "Fade In Up Big"
    ],
    [
      "flipInX",
      "Flip In X"
    ],
    [
      "flipInY",
      "Flip In Y"
    ],
    [
      "lightSpeedIn",
      "Light Speed In"
    ],
    [
      "rotateIn",
      "Rotate In"
    ],
    [
      "rotateInDownLeft",
      "Rotate In Down Left"
    ],
    [
      "rotateInDownRight",
      "Rotate In Down Right"
    ],
    [
      "rotateInUpLeft",
      "Rotate In Up Left"
    ],
    [
      "rotateInUpRight",
      "Rotate In Up Right"
    ],
    [
      "slideInUp",
      "Slide In Up"
    ],
    [
      "slideInDown",
      "Slide In Down"
    ],
    [
      "slideInLeft",
      "Slide In Left"
    ],
    [
      "slideInRight",
      "Slide In Right"
    ],
    [
      "zoomIn",
      "Zoom In"
    ],
    [
      "zoomInDown",
      "Zoom In Down"
    ],
    [
      "zoomInLeft",
      "Zoom In Left"
    ],
    [
      "zoomInRight",
      "Zoom In Right"
    ],
    [
      "zoomInUp",
      "Zoom In Up"
    ],
    [
      "jackInTheBox",
      "Jack In The Box"
    ],
    [
      "rollIn",
      "Roll In"
    ]
  ],
  "idle": [
    [
      "bounce",
      "Bounce"
    ],
    [
      "flash",
      "Flash"
    ],
    [
      "pulse",
      "Pulse"
    ],
    [
      "rubberBand",
      "Rubber Band"
    ],
    [
      "shake",
      "Shake"
    ],
    [
      "swing",
      "Swing"
    ],
    [
      "tada",
      "Tada"
    ],
    [
      "wobble",
      "Wobble"
    ],
    [
      "jello",
      "Jello"
    ],
    [
      "heartBeat",
      "Heart Beat"
    ],
    [
      "flip",
      "Flip"
    ]
  ],
  "out": [
    [
      "bounceOut",
      "Bounce Out"
    ],
    [
      "bounceOutDown",
      "Bounce Out Down"
    ],
    [
      "bounceOutLeft",
      "Bounce Out Left"
    ],
    [
      "bounceOutRight",
      "Bounce Out Right"
    ],
    [
      "bounceOutUp",
      "Bounce Out Up"
    ],
    [
      "fadeOut",
      "Fade Out"
    ],
    [
      "fadeOutDown",
      "Fade Out Down"
    ],
    [
      "fadeOutDownBig",
      "Fade Out Down Big"
    ],
    [
      "fadeOutLeft",
      "Fade Out Left"
    ],
    [
      "fadeOutLeftBig",
      "Fade Out Left Big"
    ],
    [
      "fadeOutRight",
      "Fade Out Right"
    ],
    [
      "fadeOutRightBig",
      "Fade Out Right Big"
    ],
    [
      "fadeOutUp",
      "Fade Out Up"
    ],
    [
      "fadeOutUpBig",
      "Fade Out Up Big"
    ],
    [
      "flipOutX",
      "Flip Out X"
    ],
    [
      "flipOutY",
      "Flip Out Y"
    ],
    [
      "lightSpeedOut",
      "Light Speed Out"
    ],
    [
      "rotateOut",
      "Rotate Out"
    ],
    [
      "rotateOutDownLeft",
      "Rotate Out Down Left"
    ],
    [
      "rotateOutDownRight",
      "Rotate Out Down Right"
    ],
    [
      "rotateOutUpLeft",
      "Rotate Out Up Left"
    ],
    [
      "rotateOutUpRight",
      "Rotate Out Up Right"
    ],
    [
      "slideOutUp",
      "Slide Out Up"
    ],
    [
      "slideOutDown",
      "Slide Out Down"
    ],
    [
      "slideOutLeft",
      "Slide Out Left"
    ],
    [
      "slideOutRight",
      "Slide Out Right"
    ],
    [
      "zoomOut",
      "Zoom Out"
    ],
    [
      "zoomOutDown",
      "Zoom Out Down"
    ],
    [
      "zoomOutLeft",
      "Zoom Out Left"
    ],
    [
      "zoomOutRight",
      "Zoom Out Right"
    ],
    [
      "zoomOutUp",
      "Zoom Out Up"
    ],
    [
      "hinge",
      "Hinge"
    ],
    [
      "rollOut",
      "Roll Out"
    ]
  ]
};

/** Built-in static stickers grouped like upstream's sticker tabs. */
export const STICKER_LIBRARY = {
  "emoticons": [
    {
      "name": "alien",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_alien.svg"
    },
    {
      "name": "angel",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_angel.svg"
    },
    {
      "name": "angry",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_angry.svg"
    },
    {
      "name": "anxious",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_anxious.svg"
    },
    {
      "name": "asleep",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_asleep.svg"
    },
    {
      "name": "attention",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_attention.svg"
    },
    {
      "name": "baby chicken",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_baby_chicken.svg"
    },
    {
      "name": "batman",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_batman.svg"
    },
    {
      "name": "beer",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_beer.svg"
    },
    {
      "name": "blush",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_blush.svg"
    },
    {
      "name": "boxer",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_boxer.svg"
    },
    {
      "name": "business",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_business.svg"
    },
    {
      "name": "chicken",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_chicken.svg"
    },
    {
      "name": "cool",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_cool.svg"
    },
    {
      "name": "cry",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_cry.svg"
    },
    {
      "name": "deceased",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_deceased.svg"
    },
    {
      "name": "devil",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_devil.svg"
    },
    {
      "name": "duckface",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_duckface.svg"
    },
    {
      "name": "furious",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_furious.svg"
    },
    {
      "name": "grin",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_grin.svg"
    },
    {
      "name": "guitar",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_guitar.svg"
    },
    {
      "name": "harry potter",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_harry_potter.svg"
    },
    {
      "name": "hippie",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_hippie.svg"
    },
    {
      "name": "hitman",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_hitman.svg"
    },
    {
      "name": "humourous",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_humourous.svg"
    },
    {
      "name": "idea",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_idea.svg"
    },
    {
      "name": "impatient",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_impatient.svg"
    },
    {
      "name": "kiss",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_kiss.svg"
    },
    {
      "name": "kisses",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_kisses.svg"
    },
    {
      "name": "laugh",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_laugh.svg"
    },
    {
      "name": "loud cry",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_loud_cry.svg"
    },
    {
      "name": "loving",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_loving.svg"
    },
    {
      "name": "masked",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_masked.svg"
    },
    {
      "name": "music",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_music.svg"
    },
    {
      "name": "nerd",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_nerd.svg"
    },
    {
      "name": "ninja",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_ninja.svg"
    },
    {
      "name": "not speaking to you",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_not_speaking_to_you.svg"
    },
    {
      "name": "pig",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_pig.svg"
    },
    {
      "name": "pumpkin",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_pumpkin.svg"
    },
    {
      "name": "question",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_question.svg"
    },
    {
      "name": "rabbit",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_rabbit.svg"
    },
    {
      "name": "sad",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_sad.svg"
    },
    {
      "name": "sick",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_sick.svg"
    },
    {
      "name": "skateboard",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_skateboard.svg"
    },
    {
      "name": "skull",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_skull.svg"
    },
    {
      "name": "sleepy",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_sleepy.svg"
    },
    {
      "name": "smile",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_smile.svg"
    },
    {
      "name": "smoking",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_smoking.svg"
    },
    {
      "name": "sobbing",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_sobbing.svg"
    },
    {
      "name": "star",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_star.svg"
    },
    {
      "name": "steaming furious",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_steaming_furious.svg"
    },
    {
      "name": "sunbathing",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_sunbathing.svg"
    },
    {
      "name": "tired",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_tired.svg"
    },
    {
      "name": "tongue out wink",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_tongue_out_wink.svg"
    },
    {
      "name": "wave",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_wave.svg"
    },
    {
      "name": "wide grin",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_wide_grin.svg"
    },
    {
      "name": "wink",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_wink.svg"
    },
    {
      "name": "wrestler",
      "src": "/assets/sticker/emoticons/imgly_sticker_emoticons_wrestler.svg"
    },
    {
      "name": "ape",
      "src": "/assets/sticker/emoji_ape.png"
    },
    {
      "name": "crying",
      "src": "/assets/sticker/emoji_crying.png"
    },
    {
      "name": "happyface",
      "src": "/assets/sticker/emoji_happyface.png"
    },
    {
      "name": "melon",
      "src": "/assets/sticker/emoji_melon.png"
    }
  ],
  "shapes": [
    {
      "name": "arrow 02",
      "src": "/assets/sticker/shapes/imgly_sticker_shapes_arrow_02.svg"
    },
    {
      "name": "arrow 03",
      "src": "/assets/sticker/shapes/imgly_sticker_shapes_arrow_03.svg"
    },
    {
      "name": "badge 01",
      "src": "/assets/sticker/shapes/imgly_sticker_shapes_badge_01.svg"
    },
    {
      "name": "badge 04",
      "src": "/assets/sticker/shapes/imgly_sticker_shapes_badge_04.svg"
    },
    {
      "name": "badge 06",
      "src": "/assets/sticker/shapes/imgly_sticker_shapes_badge_06.svg"
    },
    {
      "name": "badge 08",
      "src": "/assets/sticker/shapes/imgly_sticker_shapes_badge_08.svg"
    },
    {
      "name": "badge 11",
      "src": "/assets/sticker/shapes/imgly_sticker_shapes_badge_11.svg"
    },
    {
      "name": "badge 12",
      "src": "/assets/sticker/shapes/imgly_sticker_shapes_badge_12.svg"
    },
    {
      "name": "badge 13",
      "src": "/assets/sticker/shapes/imgly_sticker_shapes_badge_13.svg"
    },
    {
      "name": "badge 15",
      "src": "/assets/sticker/shapes/imgly_sticker_shapes_badge_15.svg"
    },
    {
      "name": "badge 18",
      "src": "/assets/sticker/shapes/imgly_sticker_shapes_badge_18.svg"
    },
    {
      "name": "badge 19",
      "src": "/assets/sticker/shapes/imgly_sticker_shapes_badge_19.svg"
    },
    {
      "name": "badge 20",
      "src": "/assets/sticker/shapes/imgly_sticker_shapes_badge_20.svg"
    },
    {
      "name": "badge 28",
      "src": "/assets/sticker/shapes/imgly_sticker_shapes_badge_28.svg"
    },
    {
      "name": "badge 32",
      "src": "/assets/sticker/shapes/imgly_sticker_shapes_badge_32.svg"
    },
    {
      "name": "badge 35",
      "src": "/assets/sticker/shapes/imgly_sticker_shapes_badge_35.svg"
    },
    {
      "name": "badge 36",
      "src": "/assets/sticker/shapes/imgly_sticker_shapes_badge_36.svg"
    },
    {
      "name": "spray 01",
      "src": "/assets/sticker/shapes/imgly_sticker_shapes_spray_01.svg"
    },
    {
      "name": "spray 04",
      "src": "/assets/sticker/shapes/imgly_sticker_shapes_spray_04.svg"
    }
  ]
};

/**
 * Animated emoji stickers (Lottie): Noto Emoji Animation by Google,
 * CC BY 4.0 — bundled in public/assets/sticker/animated-emoji/; the required
 * attribution lives in CREDITS.md there (not shown in the editor UI).
 */
export const ANIMATED_EMOJI = [
  {
    "name": "grinning",
    "emoji": "😀",
    "src": "/assets/sticker/animated-emoji/grinning.json"
  },
  {
    "name": "smiley",
    "emoji": "😃",
    "src": "/assets/sticker/animated-emoji/smiley.json"
  },
  {
    "name": "smile",
    "emoji": "😄",
    "src": "/assets/sticker/animated-emoji/smile.json"
  },
  {
    "name": "grin",
    "emoji": "😁",
    "src": "/assets/sticker/animated-emoji/grin.json"
  },
  {
    "name": "laughing",
    "emoji": "😆",
    "src": "/assets/sticker/animated-emoji/laughing.json"
  },
  {
    "name": "sweat smile",
    "emoji": "😅",
    "src": "/assets/sticker/animated-emoji/sweat-smile.json"
  },
  {
    "name": "rofl",
    "emoji": "🤣",
    "src": "/assets/sticker/animated-emoji/rofl.json"
  },
  {
    "name": "joy",
    "emoji": "😂",
    "src": "/assets/sticker/animated-emoji/joy.json"
  },
  {
    "name": "slight smile",
    "emoji": "🙂",
    "src": "/assets/sticker/animated-emoji/slight-smile.json"
  },
  {
    "name": "wink",
    "emoji": "😉",
    "src": "/assets/sticker/animated-emoji/wink.json"
  },
  {
    "name": "blush",
    "emoji": "😊",
    "src": "/assets/sticker/animated-emoji/blush.json"
  },
  {
    "name": "innocent",
    "emoji": "😇",
    "src": "/assets/sticker/animated-emoji/innocent.json"
  },
  {
    "name": "smiling hearts",
    "emoji": "🥰",
    "src": "/assets/sticker/animated-emoji/smiling-hearts.json"
  },
  {
    "name": "heart eyes",
    "emoji": "😍",
    "src": "/assets/sticker/animated-emoji/heart-eyes.json"
  },
  {
    "name": "star struck",
    "emoji": "🤩",
    "src": "/assets/sticker/animated-emoji/star-struck.json"
  },
  {
    "name": "kissing heart",
    "emoji": "😘",
    "src": "/assets/sticker/animated-emoji/kissing-heart.json"
  },
  {
    "name": "yum",
    "emoji": "😋",
    "src": "/assets/sticker/animated-emoji/yum.json"
  },
  {
    "name": "winking tongue",
    "emoji": "😜",
    "src": "/assets/sticker/animated-emoji/winking-tongue.json"
  },
  {
    "name": "zany",
    "emoji": "🤪",
    "src": "/assets/sticker/animated-emoji/zany.json"
  },
  {
    "name": "money mouth",
    "emoji": "🤑",
    "src": "/assets/sticker/animated-emoji/money-mouth.json"
  },
  {
    "name": "hugging",
    "emoji": "🤗",
    "src": "/assets/sticker/animated-emoji/hugging.json"
  },
  {
    "name": "hand over mouth",
    "emoji": "🤭",
    "src": "/assets/sticker/animated-emoji/hand-over-mouth.json"
  },
  {
    "name": "thinking",
    "emoji": "🤔",
    "src": "/assets/sticker/animated-emoji/thinking.json"
  },
  {
    "name": "raised eyebrow",
    "emoji": "🤨",
    "src": "/assets/sticker/animated-emoji/raised-eyebrow.json"
  },
  {
    "name": "neutral",
    "emoji": "😐",
    "src": "/assets/sticker/animated-emoji/neutral.json"
  },
  {
    "name": "smirk",
    "emoji": "😏",
    "src": "/assets/sticker/animated-emoji/smirk.json"
  },
  {
    "name": "eye roll",
    "emoji": "🙄",
    "src": "/assets/sticker/animated-emoji/eye-roll.json"
  },
  {
    "name": "grimacing",
    "emoji": "😬",
    "src": "/assets/sticker/animated-emoji/grimacing.json"
  },
  {
    "name": "relieved",
    "emoji": "😌",
    "src": "/assets/sticker/animated-emoji/relieved.json"
  },
  {
    "name": "sleeping",
    "emoji": "😴",
    "src": "/assets/sticker/animated-emoji/sleeping.json"
  },
  {
    "name": "mind blown",
    "emoji": "🤯",
    "src": "/assets/sticker/animated-emoji/mind-blown.json"
  },
  {
    "name": "partying",
    "emoji": "🥳",
    "src": "/assets/sticker/animated-emoji/partying.json"
  },
  {
    "name": "sunglasses",
    "emoji": "😎",
    "src": "/assets/sticker/animated-emoji/sunglasses.json"
  },
  {
    "name": "nerd",
    "emoji": "🤓",
    "src": "/assets/sticker/animated-emoji/nerd.json"
  },
  {
    "name": "monocle",
    "emoji": "🧐",
    "src": "/assets/sticker/animated-emoji/monocle.json"
  },
  {
    "name": "open mouth",
    "emoji": "😮",
    "src": "/assets/sticker/animated-emoji/open-mouth.json"
  },
  {
    "name": "astonished",
    "emoji": "😲",
    "src": "/assets/sticker/animated-emoji/astonished.json"
  },
  {
    "name": "flushed",
    "emoji": "😳",
    "src": "/assets/sticker/animated-emoji/flushed.json"
  },
  {
    "name": "pleading",
    "emoji": "🥺",
    "src": "/assets/sticker/animated-emoji/pleading.json"
  },
  {
    "name": "cry",
    "emoji": "😢",
    "src": "/assets/sticker/animated-emoji/cry.json"
  },
  {
    "name": "sob",
    "emoji": "😭",
    "src": "/assets/sticker/animated-emoji/sob.json"
  },
  {
    "name": "scream",
    "emoji": "😱",
    "src": "/assets/sticker/animated-emoji/scream.json"
  },
  {
    "name": "rage",
    "emoji": "😡",
    "src": "/assets/sticker/animated-emoji/rage.json"
  },
  {
    "name": "smiling imp",
    "emoji": "😈",
    "src": "/assets/sticker/animated-emoji/smiling-imp.json"
  },
  {
    "name": "skull",
    "emoji": "💀",
    "src": "/assets/sticker/animated-emoji/skull.json"
  },
  {
    "name": "clown",
    "emoji": "🤡",
    "src": "/assets/sticker/animated-emoji/clown.json"
  },
  {
    "name": "ghost",
    "emoji": "👻",
    "src": "/assets/sticker/animated-emoji/ghost.json"
  },
  {
    "name": "alien",
    "emoji": "👽",
    "src": "/assets/sticker/animated-emoji/alien.json"
  },
  {
    "name": "robot",
    "emoji": "🤖",
    "src": "/assets/sticker/animated-emoji/robot.json"
  },
  {
    "name": "red heart",
    "emoji": "❤️",
    "src": "/assets/sticker/animated-emoji/red-heart.json"
  },
  {
    "name": "fire",
    "emoji": "🔥",
    "src": "/assets/sticker/animated-emoji/fire.json"
  },
  {
    "name": "party popper",
    "emoji": "🎉",
    "src": "/assets/sticker/animated-emoji/party-popper.json"
  },
  {
    "name": "confetti ball",
    "emoji": "🎊",
    "src": "/assets/sticker/animated-emoji/confetti-ball.json"
  },
  {
    "name": "thumbs up",
    "emoji": "👍",
    "src": "/assets/sticker/animated-emoji/thumbs-up.json"
  },
  {
    "name": "clap",
    "emoji": "👏",
    "src": "/assets/sticker/animated-emoji/clap.json"
  },
  {
    "name": "raised hands",
    "emoji": "🙌",
    "src": "/assets/sticker/animated-emoji/raised-hands.json"
  },
  {
    "name": "folded hands",
    "emoji": "🙏",
    "src": "/assets/sticker/animated-emoji/folded-hands.json"
  },
  {
    "name": "wave",
    "emoji": "👋",
    "src": "/assets/sticker/animated-emoji/wave.json"
  },
  {
    "name": "hundred",
    "emoji": "💯",
    "src": "/assets/sticker/animated-emoji/hundred.json"
  },
  {
    "name": "sparkles",
    "emoji": "✨",
    "src": "/assets/sticker/animated-emoji/sparkles.json"
  },
  {
    "name": "rocket",
    "emoji": "🚀",
    "src": "/assets/sticker/animated-emoji/rocket.json"
  },
  {
    "name": "gift",
    "emoji": "🎁",
    "src": "/assets/sticker/animated-emoji/gift.json"
  },
  {
    "name": "birthday cake",
    "emoji": "🎂",
    "src": "/assets/sticker/animated-emoji/birthday-cake.json"
  },
  {
    "name": "balloon",
    "emoji": "🎈",
    "src": "/assets/sticker/animated-emoji/balloon.json"
  },
  {
    "name": "trophy",
    "emoji": "🏆",
    "src": "/assets/sticker/animated-emoji/trophy.json"
  },
  {
    "name": "eyes",
    "emoji": "👀",
    "src": "/assets/sticker/animated-emoji/eyes.json"
  },
  {
    "name": "collision",
    "emoji": "💥",
    "src": "/assets/sticker/animated-emoji/collision.json"
  },
  {
    "name": "light bulb",
    "emoji": "💡",
    "src": "/assets/sticker/animated-emoji/light-bulb.json"
  },
  {
    "name": "check mark",
    "emoji": "✅",
    "src": "/assets/sticker/animated-emoji/check-mark.json"
  },
  {
    "name": "cross mark",
    "emoji": "❌",
    "src": "/assets/sticker/animated-emoji/cross-mark.json"
  },
  {
    "name": "police light",
    "emoji": "🚨",
    "src": "/assets/sticker/animated-emoji/police-light.json"
  },
  {
    "name": "rainbow",
    "emoji": "🌈",
    "src": "/assets/sticker/animated-emoji/rainbow.json"
  }
];

/** gl-transitions (MIT / BSD) names for the Video Transitions picker; popular first. */
export const VIDEO_TRANSITIONS = [
  [
    "fade",
    "Fade"
  ],
  [
    "crosswarp",
    "Crosswarp"
  ],
  [
    "dissolve",
    "Dissolve"
  ],
  [
    "wipeLeft",
    "Wipe Left"
  ],
  [
    "wipeRight",
    "Wipe Right"
  ],
  [
    "wipeUp",
    "Wipe Up"
  ],
  [
    "wipeDown",
    "Wipe Down"
  ],
  [
    "CrossZoom",
    "Cross Zoom"
  ],
  [
    "directionalwarp",
    "Directionalwarp"
  ],
  [
    "Swirl",
    "Swirl"
  ],
  [
    "cube",
    "Cube"
  ],
  [
    "circleopen",
    "Circleopen"
  ],
  [
    "Radial",
    "Radial"
  ],
  [
    "pixelize",
    "Pixelize"
  ],
  [
    "InvertedPageCurl",
    "Inverted Page Curl"
  ],
  [
    "GlitchMemories",
    "Glitch Memories"
  ],
  [
    "burn",
    "Burn"
  ],
  [
    "Dreamy",
    "Dreamy"
  ],
  [
    "ripple",
    "Ripple"
  ],
  [
    "heart",
    "Heart"
  ],
  [
    "AdvancedMosaic",
    "Advanced Mosaic"
  ],
  [
    "angular",
    "Angular"
  ],
  [
    "BlockDissolve",
    "Block Dissolve"
  ],
  [
    "BookFlip",
    "Book Flip"
  ],
  [
    "Bounce",
    "Bounce"
  ],
  [
    "BowTieHorizontal",
    "Bow Tie Horizontal"
  ],
  [
    "BowTieVertical",
    "Bow Tie Vertical"
  ],
  [
    "BowTieWithParameter",
    "Bow Tie With Parameter"
  ],
  [
    "Box",
    "Box"
  ],
  [
    "burn0",
    "Burn0"
  ],
  [
    "ButterflyWaveScrawler",
    "Butterfly Wave Scrawler"
  ],
  [
    "cannabisleaf",
    "Cannabisleaf"
  ],
  [
    "chessboard",
    "Chessboard"
  ],
  [
    "circle",
    "Circle"
  ],
  [
    "CircleCrop",
    "Circle Crop"
  ],
  [
    "colorphase",
    "Colorphase"
  ],
  [
    "ColourDistance",
    "Colour Distance"
  ],
  [
    "coord-from-in",
    "Coord from in"
  ],
  [
    "CrazyParametricFun",
    "Crazy Parametric Fun"
  ],
  [
    "crosshatch",
    "Crosshatch"
  ],
  [
    "DefocusBlur",
    "Defocus Blur"
  ],
  [
    "Directional",
    "Directional"
  ],
  [
    "directional-easing",
    "Directional easing"
  ],
  [
    "DirectionalScaled",
    "Directional Scaled"
  ],
  [
    "directionalwipe",
    "Directionalwipe"
  ],
  [
    "displacement",
    "Displacement"
  ],
  [
    "DoomScreenTransition",
    "Doom Screen Transition"
  ],
  [
    "doorway",
    "Doorway"
  ],
  [
    "DreamyZoom",
    "Dreamy Zoom"
  ],
  [
    "Drop_Zone_Flicker",
    "Drop Zone Flicker"
  ],
  [
    "EdgeTransition",
    "Edge Transition"
  ],
  [
    "fadecolor",
    "Fadecolor"
  ],
  [
    "fadegrayscale",
    "Fadegrayscale"
  ],
  [
    "FilmBurn",
    "Film Burn"
  ],
  [
    "flyeye",
    "Flyeye"
  ],
  [
    "Fold",
    "Fold"
  ],
  [
    "fragment",
    "Fragment"
  ],
  [
    "GlitchDisplace",
    "Glitch Displace"
  ],
  [
    "GridFlip",
    "Grid Flip"
  ],
  [
    "hexagonalize",
    "Hexagonalize"
  ],
  [
    "HorizontalClose",
    "Horizontal Close"
  ],
  [
    "HorizontalOpen",
    "Horizontal Open"
  ],
  [
    "HSVfade",
    "HSVfade"
  ],
  [
    "kaleidoscope",
    "Kaleidoscope"
  ],
  [
    "LeftRight",
    "Left Right"
  ],
  [
    "LinearBlur",
    "Linear Blur"
  ],
  [
    "luma",
    "Luma"
  ],
  [
    "luminance_melt",
    "Luminance melt"
  ],
  [
    "morph",
    "Morph"
  ],
  [
    "Mosaic",
    "Mosaic"
  ],
  [
    "mosaic_transition",
    "Mosaic transition"
  ],
  [
    "multiply_blend",
    "Multiply blend"
  ],
  [
    "old_tv_lost_signal",
    "Old tv lost signal"
  ],
  [
    "Overexposure",
    "Overexposure"
  ],
  [
    "parametric_glitch",
    "Parametric glitch"
  ],
  [
    "perlin",
    "Perlin"
  ],
  [
    "pinwheel",
    "Pinwheel"
  ],
  [
    "polar_function",
    "Polar function"
  ],
  [
    "PolkaDotsCurtain",
    "Polka Dots Curtain"
  ],
  [
    "powerKaleido",
    "Power Kaleido"
  ],
  [
    "PuzzleRight",
    "Puzzle Right"
  ],
  [
    "randomNoisex",
    "Random Noisex"
  ],
  [
    "randomsquares",
    "Randomsquares"
  ],
  [
    "Rectangle",
    "Rectangle"
  ],
  [
    "RectangleCrop",
    "Rectangle Crop"
  ],
  [
    "Revolve_Left",
    "Revolve Left"
  ],
  [
    "Rolls",
    "Rolls"
  ],
  [
    "rotate_scale_fade",
    "Rotate scale fade"
  ],
  [
    "RotateScaleVanish",
    "Rotate Scale Vanish"
  ],
  [
    "rotateTransition",
    "Rotate Transition"
  ],
  [
    "scale-in",
    "Scale in"
  ],
  [
    "SimpleFlip",
    "Simple Flip"
  ],
  [
    "SimpleZoom",
    "Simple Zoom"
  ],
  [
    "SimpleZoomOut",
    "Simple Zoom Out"
  ],
  [
    "Slides",
    "Slides"
  ],
  [
    "splitSlideInHorizontal",
    "Split Slide In Horizontal"
  ],
  [
    "splitSlideInOutHorizontal",
    "Split Slide In Out Horizontal"
  ],
  [
    "splitSlideInOutVertical",
    "Split Slide In Out Vertical"
  ],
  [
    "splitSlideInVertical",
    "Split Slide In Vertical"
  ],
  [
    "splitSlideOutHorizontal",
    "Split Slide Out Horizontal"
  ],
  [
    "splitSlideOutVertical",
    "Split Slide Out Vertical"
  ],
  [
    "squareswire",
    "Squareswire"
  ],
  [
    "squeeze",
    "Squeeze"
  ],
  [
    "StarWipe",
    "Star Wipe"
  ],
  [
    "StaticFade",
    "Static Fade"
  ],
  [
    "static_wipe",
    "Static wipe"
  ],
  [
    "StereoViewer",
    "Stereo Viewer"
  ],
  [
    "StripDatamoshGlitch",
    "Strip Datamosh Glitch"
  ],
  [
    "swap",
    "Swap"
  ],
  [
    "tangentMotionBlur",
    "Tangent Motion Blur"
  ],
  [
    "TilesWave",
    "Tiles Wave"
  ],
  [
    "TopBottom",
    "Top Bottom"
  ],
  [
    "TVStatic",
    "TVStatic"
  ],
  [
    "undulatingBurnOut",
    "Undulating Burn Out"
  ],
  [
    "VerticalClose",
    "Vertical Close"
  ],
  [
    "VerticalOpen",
    "Vertical Open"
  ],
  [
    "WaterDrop",
    "Water Drop"
  ],
  [
    "wind",
    "Wind"
  ],
  [
    "windowblinds",
    "Windowblinds"
  ],
  [
    "windowslice",
    "Windowslice"
  ],
  [
    "x_axis_translation",
    "X axis translation"
  ],
  [
    "ZoomInCircles",
    "Zoom In Circles"
  ],
  [
    "zoomInOut",
    "Zoom In Out"
  ],
  [
    "ZoomLeftWipe",
    "Zoom Left Wipe"
  ],
  [
    "ZoomRigthWipe",
    "Zoom Right Wipe"
  ]
];
