/**
 * 30 ready-made designs for the opt-in form (List Builder, Personalizer and
 * Lead Generator all share one renderer, so every design works in all three).
 *
 * A design is NOT a separate renderer: it is a one-click preset that patches
 * ordinary options (colours, font, card, inputs, button, layout, steps) plus a
 * `designPreset` id that switches on some decoration in styles/timeline-addons.css
 * (aurora glow, blueprint grid, ticket stub, …). After picking one, every value
 * stays editable in the settings panel — exactly like the default design.
 *
 * Presets never touch the viewer-facing copy (caption, button text, fields):
 * those stay as the creator wrote them. They may set the small design-specific
 * extras (eyebrow, subtitle, side-panel quote/stats).
 *
 * Visual references: the "SmartVideo AI – Lead Generator 30 Designs" board.
 * Designs 4/5 and 9/10 of that board have their file names swapped relative to
 * what they show; the ids here follow what the pictures show.
 */

/** Every option a design may change, at its default — picking a design resets these first, so designs never mix. */
export const DESIGN_BASE = {
  designPreset: '',
  designLayout: 'center', // center | split | side-card | sheet | chat
  fontFamily: 'Raleway',
  fontColor: '#ffffff',
  captionAlignment: 'center',
  captionBold: true,
  captionColor: '',
  captionFontSize: 76,
  fontSize: 60,
  backgroundColor: '#000000',
  backgroundColor2: '',
  bgAngle: 135,
  backdropColor: '#3e3e51',
  backdropOpacity: 100,
  innerWidth: 65,
  innerHeight: 100,
  innerColor: '#ffffff',
  innerOpacity: 0,
  cardRadius: 0,
  cardBorderColor: '',
  cardBorderWidth: 0,
  cardGlow: '',
  cardBlur: 0,
  inputBackground: '#ffffff',
  inputOpacity: 100,
  inputFontColor: '#000000',
  inputBorderColor: '#c1c1c1',
  inputBorderRadius: 5,
  placeholderColor: '#6b7280',
  inputIcons: false,
  buttonBackground: '#eb5054',
  buttonBackground2: '',
  buttonFontColor: '#ffffff',
  buttonHoverColor: '#d23f43',
  buttonBorderRadius: 5,
  btnBottomBorder: '#eb5054',
  fieldLayout: 'auto',
  fieldWidth: 70,
  fieldGap: 6,
  fieldAlign: 'center',
  buttonWidth: 'full',
  eyebrow: '',
  subtitle: '',
  sideQuote: '',
  sideAuthor: '',
  sideStats: '',
  sideRating: '',
  multiStep: false,
  stepSize: 1,
  brandName: '',
  brandIcon: true,
  badgeIcon: 'none',
  btnIcon: 'none',
  stepLabels: '',
  stepQuestions: '',
  choiceStyle: 'dropdown',
  panelTitle: '',
  panelHint: '',
  designAccent: '',
  decorEnabled: true,
};

export const BADGE_ICONS = [['none', 'None'], ['crown', 'Crown'], ['ticket', 'Ticket'], ['star', 'Star'], ['play', 'Play circle'], ['lock', 'Lock'], ['sparkle', 'Sparkle']];
export const BUTTON_ICONS = [['none', 'None'], ['play', 'Play triangle'], ['arrow', 'Arrow →']];

export const OPTIN_DESIGN_CATEGORIES = [
  ['layouts', 'Layouts'],
  ['glass', 'Glass & neon'],
  ['light', 'Light & soft'],
  ['bold', 'Bold & retro'],
  ['premium', 'Premium'],
];

/** Dark glass input on a dark card (reused). */
const darkInputs = { inputBackground: '#ffffff', inputOpacity: 9, inputFontColor: '#eceaff', inputBorderColor: '#5b54c9', inputBorderRadius: 8, placeholderColor: '#b7b3ea', inputIcons: true };

const BRAND = 'SmartVideo AI';
const PLAY = { btnIcon: 'play' };
const ARROW = { btnIcon: 'arrow' };
const THREE = 'Email, First Name, Last Name';

// Look extras from the reference board (brand mark, badges, steppers, button icons, panel headings).
const EXTRA = {
  'classic-overlay': { brandName: BRAND, btnIcon: 'play' },
  'glass-split': { brandName: BRAND, ...ARROW },
  'neon-spotlight': { brandName: BRAND, ...PLAY },
  'cinematic-bottom-sheet': { brandName: BRAND, ...PLAY },
  'two-step-wizard': { brandName: BRAND, ...ARROW, stepLabels: 'Details, Get Your Video' },
  'conversational-setup': { brandName: BRAND, ...ARROW, fieldLayout: 'stacked', stepQuestions: "What's your email?\nGreat! What's your first name?\nAnd what's your last name?" },
  'vip-access': { badgeIcon: 'crown', ...PLAY },
  'qualifying-quiz': { brandName: BRAND, ...ARROW, choiceStyle: 'list', panelTitle: 'Your Details', panelHint: 'So we can personalize your video experience.' },
  'social-proof': { brandName: BRAND, ...ARROW },
  'neon-floating-card': { brandName: BRAND, ...PLAY },
  'aurora-glass': PLAY, 'editorial-minimalist': PLAY, 'holographic-card': PLAY, 'retro-terminal': PLAY, 'modular-bento': PLAY,
  'spotlight-theater': PLAY, 'floating-pill-inputs': PLAY, 'blueprint-grid': PLAY, 'high-contrast-monochrome': PLAY, 'gradient-mesh': PLAY,
  'ticket-invitation': { badgeIcon: 'ticket', ...PLAY }, 'progress-milestones': { ...ARROW, stepLabels: 'Details, Confirm, Watch' },
  'accordion-form': PLAY, 'left-rail': { badgeIcon: 'play', ...PLAY }, 'horizontal-ribbon': PLAY, 'geometric-frames': PLAY,
  'soft-pastel-frost': PLAY, 'dark-brutalist': PLAY, 'cosmic-portal': PLAY, 'luxe-platinum': PLAY,
};

/**
 * The wording each design shows on the board. Applied by applyOptinDesign ONLY while the creator's own text is
 * still a default (or another design's), so a customised caption / button / box list is never overwritten.
 */
const COPY = {
  'classic-overlay': { caption: 'WANT TO PERSONALIZE YOUR VIDEO EXPERIENCE', btnText: 'Play' },
  'glass-split': { caption: 'Glass Split Demo', btnText: 'Create My Personalized Video', privacyDisclaimer: 'Your information is secure and will only be used to create your personalized video.' },
  'neon-spotlight': { caption: 'Create Your Own Personalized Video', subtitle: 'Fill out your details and watch your custom video in seconds.', btnText: 'Watch Now' },
  'cinematic-bottom-sheet': { caption: 'Create Your Very Own Personalized Video', subtitle: 'Fill out your details below and click Play My Video to experience the magic of AI personalization.', btnText: 'Play My Video' },
  'two-step-wizard': { caption: 'Create Your Personalized Video', subtitle: 'Just 2 quick steps to get your custom video experience', btnText: 'Play Video' },
  'conversational-setup': { caption: "Hi there! Let's create your personalized video experience.", subtitle: '', btnText: 'Start My Video' },
  'vip-access': { caption: 'VIP ACCESS', subtitle: 'Get instant access to your personalized video', btnText: 'WATCH NOW' },
  'qualifying-quiz': { caption: "Let's find the right solution for you", subtitle: 'Answer a quick question and share your details to get a personalized video experience.', btnText: 'Next' },
  'social-proof': { caption: 'Watch How It Works For You', subtitle: 'Enter your details to get your personalized video.', btnText: 'Watch My Video' },
  'neon-floating-card': { caption: 'Create Your Personalized Video', btnText: 'Play My Video' },
  'aurora-glass': { caption: 'Get Your Personalized Video', subtitle: 'Enter your details below and click play' },
  'editorial-minimalist': { caption: 'Get Your Personalized Video', subtitle: 'Fill in your details to start watching' },
  'holographic-card': { caption: 'Create Your Personalized Video', btnText: 'Play Now' },
  'spotlight-theater': { caption: 'Get Your Personalized Video', subtitle: 'Enter your details and click play' },
  'floating-pill-inputs': { caption: 'Create Your Personalized Video' },
  'gradient-mesh': { caption: 'Create Your Personalized Video' },
  'progress-milestones': { caption: 'Get Your Personalized Video', btnText: 'Next' },
  'left-rail': { caption: 'Create Your Personalized Video' },
  'horizontal-ribbon': { caption: 'Get Your Personalized Video' },
  'geometric-frames': { caption: 'Create Your Personalized Video' },
  'ticket-invitation': { caption: 'Your Personalized Video Awaits' },
  'dark-brutalist': { caption: 'GET YOUR PERSONALIZED VIDEO', btnText: 'PLAY VIDEO' },
  'cosmic-portal': { caption: 'Create Your Personalized Video' },
};

// id, label, category, patch
// The board is drawn with big type: captions ~1.6x and box/button text 88% of the form size (all still sliders).
const d = (id, label, category, patch) => ({
  id, label, category,
  patch: { ...DESIGN_BASE, designPreset: id, fontSize: 88, ...patch, captionFontSize: Math.min(200, Math.round((patch.captionFontSize ?? 76) * 1.6)), ...(EXTRA[id] || {}) },
  copy: { caption: 'Get Your Personalized Video', btnText: 'Play Video', ...(COPY[id] || {}) },
});

export const OPTIN_DESIGNS = [
  // ---------------------------------------------------------------- layouts
  d('classic-overlay', 'Classic Overlay', 'layouts', {
    backgroundColor: '#1a1033', backgroundColor2: '#0b0618', bgAngle: 160, innerWidth: 80, fieldLayout: 'grid', fieldWidth: 80,
    inputIcons: true, inputBackground: '#ffffff', inputOpacity: 10, inputFontColor: '#eceaff', inputBorderColor: '#4b4a73', placeholderColor: '#b7b3ea',
    buttonBackground: '#e11d48', buttonHoverColor: '#be123c', btnBottomBorder: 'none',
  }),
  d('glass-split', 'Glass Split', 'layouts', {
    designLayout: 'split', fontFamily: 'Inter', backgroundColor: '#0a0820', backgroundColor2: '#1b1650', innerWidth: 88, innerHeight: 80,
    innerColor: '#8b8bff', innerOpacity: 10, cardRadius: 24, cardBorderColor: '#7c7cff', cardBorderWidth: 2, cardGlow: '#6366f1', cardBlur: 12,
    captionAlignment: 'left', captionFontSize: 84, fieldWidth: 100, ...darkInputs,
    buttonBackground: '#7c3aed', buttonBackground2: '#3b82f6', buttonBorderRadius: 8, btnBottomBorder: 'none',
    subtitle: 'See how SmartVideo AI turns a single video into a personalized experience for every viewer.',
  }),
  d('neon-spotlight', 'Neon Spotlight', 'layouts', {
    designLayout: 'side-card', fontFamily: 'Inter', backgroundColor: '', backdropColor: '#05030f', backdropOpacity: 62,
    innerWidth: 38, innerHeight: 92, innerColor: '#0e0a24', innerOpacity: 82, cardRadius: 16, cardBorderColor: '#8b5cf6', cardBorderWidth: 1, cardGlow: '#7c3aed', cardBlur: 8,
    captionAlignment: 'left', captionFontSize: 62, fieldWidth: 100, ...darkInputs,
    buttonBackground: '#6d4cff', buttonBackground2: '#4f46e5', buttonBorderRadius: 6, btnBottomBorder: 'none',
  }),
  d('cinematic-bottom-sheet', 'Cinematic Bottom Sheet', 'layouts', {
    designLayout: 'sheet', fontFamily: 'Inter', backgroundColor: '', backdropColor: '#050510', backdropOpacity: 45,
    innerWidth: 96, innerHeight: 58, innerColor: '#0f1022', innerOpacity: 90, cardRadius: 18, cardBorderColor: '#33365e', cardBorderWidth: 1, cardBlur: 10,
    captionFontSize: 64, fieldLayout: 'row', fieldWidth: 96, ...darkInputs,
    buttonBackground: '#a855f7', buttonBackground2: '#7c3aed', buttonBorderRadius: 8, btnBottomBorder: 'none',
    subtitle: 'Fill out your details below and click play to experience the magic of AI personalization.',
  }),
  d('two-step-wizard', 'Two-Step Wizard', 'layouts', {
    fontFamily: 'Poppins', fontColor: '#2b2160', backgroundColor: '#8b7be8', backgroundColor2: '#5b3fc4', innerWidth: 62, innerHeight: 84,
    innerColor: '#ffffff', innerOpacity: 90, cardRadius: 18, cardBorderColor: '#e9d5ff', cardBorderWidth: 1, cardGlow: '#a78bfa',
    inputBackground: '#ffffff', inputBorderColor: '#e5e7eb', inputFontColor: '#1f2937', inputBorderRadius: 6, placeholderColor: '#6b7280', inputIcons: true,
    buttonBackground: '#6d4cff', buttonHoverColor: '#5b3fe0', buttonBorderRadius: 8, btnBottomBorder: 'none',
    multiStep: true, stepSize: 2, subtitle: 'Just 2 quick steps to get your custom video experience',
  }),
  d('conversational-setup', 'Conversational Setup', 'layouts', {
    designLayout: 'chat', fontFamily: 'Inter', fontSize: 64, backgroundColor: '#0d0a1f', backgroundColor2: '#241659', innerWidth: 46, innerHeight: 96,
    captionAlignment: 'left', captionFontSize: 38, fieldWidth: 100, ...darkInputs, inputBorderColor: '#6d65e6',
    buttonBackground: '#6d4cff', buttonBackground2: '#8b5cf6', buttonBorderRadius: 8, btnBottomBorder: 'none',
    fieldLayout: 'stacked', fieldWidth: 100,
  }),
  d('vip-access', 'VIP Access', 'premium', {
    fontFamily: 'Cinzel', fontColor: '#f5e7b8', captionColor: '#e8c872', captionFontSize: 125, backgroundColor: '#0b0905', backgroundColor2: '#1b1409', bgAngle: 160,
    innerWidth: 84, innerHeight: 88, cardRadius: 6, cardBorderColor: '#c9a24a', cardBorderWidth: 2, cardGlow: '#c9a24a',
    inputBackground: '#000000', inputOpacity: 55, inputFontColor: '#f5e7b8', inputBorderColor: '#8a6d2b', inputBorderRadius: 3, placeholderColor: '#b79a52', inputIcons: true,
    fieldLayout: 'grid', fieldWidth: 80,
    buttonBackground: '#f2c14e', buttonBackground2: '#b8860b', buttonFontColor: '#1a1205', buttonHoverColor: '#d9a638', buttonBorderRadius: 3, btnBottomBorder: 'none',
    eyebrow: 'EXCLUSIVE PRIVATE PREVIEW',
  }),
  d('qualifying-quiz', 'Qualifying Quiz', 'layouts', {
    designLayout: 'split', fontFamily: 'Inter', fontSize: 68, backgroundColor: '#150e33', backgroundColor2: '#2a1b66', innerWidth: 90, innerHeight: 88,
    innerColor: '#8b5cf6', innerOpacity: 12, cardRadius: 16, cardBorderColor: '#4c3f8f', cardBorderWidth: 1,
    captionAlignment: 'left', captionFontSize: 74, fieldWidth: 100,
    inputBackground: '#ffffff', inputBorderColor: '#ddd6fe', inputFontColor: '#1f2937', inputBorderRadius: 5, placeholderColor: '#6b7280',
    buttonBackground: '#6d4cff', buttonHoverColor: '#5b3fe0', buttonBorderRadius: 6, btnBottomBorder: 'none',
    eyebrow: 'QUALIFYING QUIZ', subtitle: 'Answer a quick question and share your details to get a personalized video experience.',
  }),
  d('social-proof', 'Social Proof Opt-in', 'layouts', {
    designLayout: 'split', fontFamily: 'Inter', backgroundColor: '#1b1140', backgroundColor2: '#3b1f8f', innerWidth: 88, innerHeight: 80,
    innerColor: '#6d4cff', innerOpacity: 30, cardRadius: 14, captionAlignment: 'left', captionFontSize: 70, fieldWidth: 100,
    inputBackground: '#ffffff', inputBorderColor: '#e5e7eb', inputFontColor: '#1f2937', inputBorderRadius: 4, inputIcons: true,
    buttonBackground: '#6d4cff', buttonBackground2: '#7c3aed', buttonBorderRadius: 6, btnBottomBorder: 'none',
    eyebrow: 'SOCIAL PROOF OPT-IN', subtitle: 'Enter your details to get your personalized video.',
    sideQuote: 'SmartVideo AI made it incredibly easy to create high-converting videos for our business.',
    sideAuthor: 'Verified Customer', sideRating: '4.9/5 (2,847 reviews)', sideStats: '50,000+ Creators; 5M+ Videos Created; 98% Satisfaction',
  }),
  d('neon-floating-card', 'Neon Floating Card', 'glass', {
    fontFamily: 'Poppins', backgroundColor: '#05040f', backgroundColor2: '#1a0a3a', bgAngle: 160, innerWidth: 54, innerHeight: 80,
    innerColor: '#0b0720', innerOpacity: 60, cardRadius: 34, cardBorderColor: '#ff2bd6', cardBorderWidth: 3, cardGlow: '#ff2bd6',
    captionFontSize: 80, fieldLayout: 'grid', fieldWidth: 86, ...darkInputs, inputBorderColor: '#c026d3',
    buttonBackground: '#ff2d95', buttonBackground2: '#ff3d6e', buttonBorderRadius: 30, btnBottomBorder: 'none',
  }),

  // ---------------------------------------------------------- glass & neon
  d('aurora-glass', 'Aurora Glass', 'glass', {
    fontFamily: 'Poppins', backgroundColor: '#140a3a', backgroundColor2: '#07102e', innerWidth: 62, innerHeight: 90,
    innerColor: '#5b5bd6', innerOpacity: 24, cardRadius: 28, cardBorderColor: '#a78bfa', cardBorderWidth: 2, cardGlow: '#8b5cf6', cardBlur: 10,
    captionFontSize: 72, fieldWidth: 80, ...darkInputs, inputBackground: '#0b1030', inputOpacity: 55, inputBorderColor: '#4cc9f0', inputBorderRadius: 10,
    buttonBackground: '#4f8cff', buttonBackground2: '#a855f7', buttonBorderRadius: 30, btnBottomBorder: 'none',
    subtitle: 'Enter your details below and click play',
  }),
  d('holographic-card', 'Holographic Card', 'glass', {
    fontFamily: 'Poppins', backgroundColor: '#08122b', backgroundColor2: '#1a0b3f', innerWidth: 64, innerHeight: 86,
    innerColor: '#0b1230', innerOpacity: 88, cardRadius: 26, cardBorderColor: '#7ee7ff', cardBorderWidth: 2, cardGlow: '#22d3ee', cardBlur: 10,
    captionFontSize: 74, fieldWidth: 80, ...darkInputs, inputBorderColor: '#7ee7ff',
    buttonBackground: '#22d3ee', buttonBackground2: '#a855f7', buttonBorderRadius: 22, btnBottomBorder: 'none',
  }),
  d('gradient-mesh', 'Gradient Mesh', 'glass', {
    fontFamily: 'Poppins', backgroundColor: '#4c1d95', backgroundColor2: '#7c3aed', bgAngle: 150, innerWidth: 70, innerHeight: 90,
    captionFontSize: 78, fieldWidth: 86, inputBackground: '#ffffff', inputOpacity: 94, inputBorderColor: 'transparent', inputFontColor: '#3b0764', inputBorderRadius: 8, placeholderColor: '#6b4b9a', inputIcons: true,
    buttonBackground: '#ffffff', buttonFontColor: '#6d28d9', buttonHoverColor: '#f3e8ff', buttonBorderRadius: 24, btnBottomBorder: 'none',
  }),
  d('cosmic-portal', 'Cosmic Portal', 'glass', {
    fontFamily: 'Poppins', backgroundColor: '#06031a', backgroundColor2: '#2a0f5e', bgAngle: 180, innerWidth: 64, innerHeight: 84,
    innerColor: '#1a0b4a', innerOpacity: 55, cardRadius: 200, cardBorderColor: '#c084fc', cardBorderWidth: 3, cardGlow: '#a855f7',
    captionFontSize: 66, fieldWidth: 74, ...darkInputs, inputBorderColor: '#a78bfa',
    buttonBackground: '#4c1d95', buttonBackground2: '#6d28d9', buttonBorderRadius: 30, btnBottomBorder: '#c084fc',
  }),
  d('geometric-frames', 'Geometric Frames', 'glass', {
    fontFamily: 'Rajdhani', backgroundColor: '#041f2b', backgroundColor2: '#06384a', innerWidth: 76, innerHeight: 94,
    captionFontSize: 70, fieldWidth: 60, inputBackground: '#06384a', inputOpacity: 80, inputFontColor: '#d9faff', inputBorderColor: '#22d3ee', inputBorderRadius: 3, placeholderColor: '#7cc8d6', inputIcons: true,
    buttonBackground: '#22e5c4', buttonFontColor: '#03242b', buttonHoverColor: '#14c9aa', buttonBorderRadius: 22, btnBottomBorder: 'none',
  }),

  // ---------------------------------------------------------- light & soft
  d('editorial-minimalist', 'Editorial Minimalist', 'light', {
    fontFamily: 'Playfair Display', fontColor: '#111111', backgroundColor: '#ffffff', backgroundColor2: '#f3f4f6', bgAngle: 180, innerWidth: 60, innerHeight: 90,
    captionAlignment: 'left', captionFontSize: 84, fieldLayout: 'stacked', fieldWidth: 100, fieldAlign: 'left',
    inputBackground: '#ffffff', inputBorderColor: '#111111', inputFontColor: '#111111', inputBorderRadius: 2, placeholderColor: '#555555',
    buttonBackground: '#111111', buttonFontColor: '#ffffff', buttonHoverColor: '#333333', buttonBorderRadius: 2, btnBottomBorder: 'none',
    subtitle: 'Fill in your details to start watching',
  }),
  d('floating-pill-inputs', 'Floating Pill Inputs', 'light', {
    fontFamily: 'Poppins', backgroundColor: '#1b1155', backgroundColor2: '#3b1f8f', innerWidth: 64, innerHeight: 90,
    captionFontSize: 72, fieldLayout: 'stacked', fieldWidth: 78, inputBackground: '#ffffff', inputOpacity: 88, inputFontColor: '#2a2160', inputBorderColor: 'transparent', inputBorderRadius: 30, placeholderColor: '#6b5fb0', inputIcons: true,
    buttonBackground: '#a855f7', buttonBackground2: '#7c3aed', buttonBorderRadius: 30, btnBottomBorder: 'none',
  }),
  d('soft-pastel-frost', 'Soft Pastel Frost', 'light', {
    fontFamily: 'Poppins', fontColor: '#3b2a73', backgroundColor: '#c9d6ff', backgroundColor2: '#f8c8e8', innerWidth: 64, innerHeight: 90,
    innerColor: '#ffffff', innerOpacity: 55, cardRadius: 22, cardBorderColor: '#ffffff', cardBorderWidth: 2, cardBlur: 14,
    captionFontSize: 72, fieldWidth: 82, inputBackground: '#ffffff', inputOpacity: 80, inputBorderColor: '#e0d7ff', inputFontColor: '#3b2a73', inputBorderRadius: 10, placeholderColor: '#8b7bb8', inputIcons: true,
    buttonBackground: '#ec4899', buttonBackground2: '#a855f7', buttonBorderRadius: 24, btnBottomBorder: 'none',
  }),
  d('progress-milestones', 'Progress Milestones', 'light', {
    fontFamily: 'Inter', fontColor: '#2a1f5c', backgroundColor: '#c4b5fd', backgroundColor2: '#7c3aed', innerWidth: 64, innerHeight: 86,
    innerColor: '#ffffff', innerOpacity: 92, cardRadius: 18, cardBorderColor: '#ede9fe', cardBorderWidth: 1,
    captionFontSize: 74, fieldWidth: 86, inputBackground: '#f5f3ff', inputBorderColor: '#ddd6fe', inputFontColor: '#1f2937', inputBorderRadius: 8, placeholderColor: '#6b7280', inputIcons: true,
    buttonBackground: '#6d4cff', buttonHoverColor: '#5b3fe0', buttonBorderRadius: 8, btnBottomBorder: 'none',
    multiStep: true, stepSize: 1,
  }),
  d('accordion-form', 'Accordion Form', 'light', {
    fontFamily: 'Inter', backgroundColor: '#0b1030', backgroundColor2: '#1b1460', bgAngle: 170, innerWidth: 80, innerHeight: 94,
    captionFontSize: 72, fieldLayout: 'stacked', fieldWidth: 92, fieldGap: 8,
    inputBackground: '#ffffff', inputBorderColor: '#c7d2fe', inputFontColor: '#1e1b4b', inputBorderRadius: 8, placeholderColor: '#4b5563', inputIcons: true,
    buttonBackground: '#a855f7', buttonBackground2: '#6d28d9', buttonBorderRadius: 24, btnBottomBorder: 'none',
  }),
  d('left-rail', 'Left Rail', 'layouts', {
    designLayout: 'split', fontFamily: 'Inter', backgroundColor: '#0a0a1e', backgroundColor2: '#2a1a6e', innerWidth: 90, innerHeight: 86,
    captionAlignment: 'left', captionFontSize: 80, fieldWidth: 100, fieldLayout: 'stacked',
    inputBackground: '#f4f4fb', inputBorderColor: '#e5e7eb', inputFontColor: '#1f2937', inputBorderRadius: 6, placeholderColor: '#6b7280', inputIcons: true,
    buttonBackground: '#7c4dff', buttonBackground2: '#6d4cff', buttonBorderRadius: 8, btnBottomBorder: 'none',
  }),

  // ---------------------------------------------------------- bold & retro
  d('retro-terminal', 'Retro Terminal', 'bold', {
    fontFamily: 'Share Tech Mono', fontColor: '#39ff14', backgroundColor: '#000000', innerWidth: 80, innerHeight: 90,
    cardRadius: 4, cardBorderColor: '#22c55e', cardBorderWidth: 2, cardGlow: '#22c55e', captionAlignment: 'left', captionFontSize: 76, fieldLayout: 'stacked', fieldWidth: 100,
    inputBackground: '#000000', inputBorderColor: '#22c55e', inputFontColor: '#39ff14', inputBorderRadius: 2, placeholderColor: '#2f9e44', inputIcons: true,
    buttonBackground: '#22ff44', buttonFontColor: '#001a06', buttonHoverColor: '#16d338', buttonBorderRadius: 2, btnBottomBorder: 'none',
  }),
  d('modular-bento', 'Modular Bento', 'bold', {
    fontFamily: 'Inter', backgroundColor: '#1b1140', backgroundColor2: '#4c1d95', innerWidth: 84, innerHeight: 84,
    innerColor: '#ffffff', innerOpacity: 12, cardRadius: 18, cardBorderColor: '#8b5cf6', cardBorderWidth: 1,
    captionAlignment: 'left', captionFontSize: 76, fieldLayout: 'stacked', fieldWidth: 100,
    inputBackground: '#ffffff', inputOpacity: 90, inputBorderColor: 'transparent', inputFontColor: '#2a2160', inputBorderRadius: 6, placeholderColor: '#6b5fb0', inputIcons: true,
    buttonBackground: '#8b5cf6', buttonBackground2: '#a855f7', buttonBorderRadius: 8, btnBottomBorder: 'none',
  }),
  d('spotlight-theater', 'Spotlight Theater', 'bold', {
    fontFamily: 'Montserrat', backgroundColor: '#2a0508', backgroundColor2: '#0b0203', bgAngle: 180, innerWidth: 56, innerHeight: 92,
    captionFontSize: 72, fieldLayout: 'stacked', fieldWidth: 90,
    inputBackground: '#ffffff', inputOpacity: 10, inputBorderColor: '#8a8a8a', inputFontColor: '#f5f5f5', inputBorderRadius: 6, placeholderColor: '#bbbbbb', inputIcons: true,
    buttonBackground: '#dc2626', buttonHoverColor: '#b91c1c', buttonBorderRadius: 6, btnBottomBorder: 'none',
    subtitle: 'Enter your details and click play',
  }),
  d('blueprint-grid', 'Blueprint Grid', 'bold', {
    fontFamily: 'Share Tech Mono', backgroundColor: '#0a2a6b', backgroundColor2: '#06174a', bgAngle: 160, innerWidth: 72, innerHeight: 92,
    captionFontSize: 72, fieldLayout: 'stacked', fieldWidth: 84,
    inputBackground: '#0a2a6b', inputOpacity: 60, inputFontColor: '#e0f0ff', inputBorderColor: '#93c5fd', inputBorderRadius: 0, placeholderColor: '#9ec5f0', inputIcons: true,
    buttonBackground: '#1d6bff', buttonHoverColor: '#1557d6', buttonBorderRadius: 2, btnBottomBorder: '#93c5fd',
  }),
  d('high-contrast-monochrome', 'High Contrast Mono', 'bold', {
    fontFamily: 'Montserrat', backgroundColor: '#0a0a0a', innerWidth: 64, innerHeight: 90, captionAlignment: 'left', captionFontSize: 80,
    fieldLayout: 'stacked', fieldWidth: 100, inputBackground: '#ffffff', inputBorderColor: '#ffffff', inputFontColor: '#000000', inputBorderRadius: 6, inputIcons: true,
    buttonBackground: '#facc15', buttonFontColor: '#000000', buttonHoverColor: '#eab308', buttonBorderRadius: 20, btnBottomBorder: 'none',
  }),
  d('horizontal-ribbon', 'Horizontal Ribbon', 'bold', {
    fontFamily: 'Poppins', backgroundColor: '#2a0b5e', backgroundColor2: '#7c2d8a', bgAngle: 150, innerWidth: 86, innerHeight: 80,
    captionFontSize: 74, fieldLayout: 'cols', fieldWidth: 100,
    inputBackground: '#ffffff', inputOpacity: 92, inputBorderColor: 'transparent', inputFontColor: '#2a2160', inputBorderRadius: 8, placeholderColor: '#6b5fb0', inputIcons: true,
    buttonBackground: '#ec4899', buttonHoverColor: '#db2777', buttonBorderRadius: 4, btnBottomBorder: 'none',
  }),
  d('ticket-invitation', 'Ticket Invitation', 'bold', {
    designLayout: 'split', fontFamily: 'Montserrat', backgroundColor: '#12081f', backgroundColor2: '#2a1240', innerWidth: 88, innerHeight: 74,
    innerColor: '#1a0f2e', innerOpacity: 80, cardRadius: 18, cardBorderColor: '#f5b83a', cardBorderWidth: 2, cardGlow: '#f59e0b',
    captionFontSize: 80, fieldWidth: 100, fieldLayout: 'stacked',
    inputBackground: '#ffffff', inputBorderColor: '#ffffff', inputFontColor: '#1f2937', inputBorderRadius: 4, placeholderColor: '#6b7280', inputIcons: true,
    buttonBackground: '#facc15', buttonFontColor: '#1a1205', buttonHoverColor: '#eab308', buttonBorderRadius: 4, btnBottomBorder: 'none',
  }),
  d('dark-brutalist', 'Dark Brutalist', 'bold', {
    designLayout: 'split', fontFamily: 'Anton', backgroundColor: '#1c1c1c', innerWidth: 92, innerHeight: 80,
    captionAlignment: 'left', captionFontSize: 120, fieldWidth: 100, fieldLayout: 'stacked',
    inputBackground: '#e5e5e5', inputBorderColor: '#111111', inputFontColor: '#111111', inputBorderRadius: 0, placeholderColor: '#555555', inputIcons: true,
    buttonBackground: '#dc2626', buttonHoverColor: '#b91c1c', buttonBorderRadius: 0, btnBottomBorder: 'none',
  }),

  // ---------------------------------------------------------------- premium
  d('luxe-platinum', 'Luxe Platinum', 'premium', {
    fontFamily: 'Playfair Display', fontColor: '#1f2937', backgroundColor: '#e5e7eb', backgroundColor2: '#9ca3af', bgAngle: 135, innerWidth: 62, innerHeight: 90,
    innerColor: '#ffffff', innerOpacity: 70, cardRadius: 24, cardBorderColor: '#ffffff', cardBorderWidth: 2, cardBlur: 6,
    captionFontSize: 76, fieldWidth: 82, inputBackground: '#ffffff', inputBorderColor: '#d1d5db', inputFontColor: '#1f2937', inputBorderRadius: 4, placeholderColor: '#6b7280', inputIcons: true,
    buttonBackground: '#c9a24a', buttonBackground2: '#e7d08a', buttonFontColor: '#3b2a05', buttonHoverColor: '#b58f3b', buttonBorderRadius: 4, btnBottomBorder: 'none',
  }),
];

const BY_ID = new Map(OPTIN_DESIGNS.map((x) => [x.id, x]));

export const getOptinDesign = (id) => BY_ID.get(id) || null;

/** A design id that is safe to put in a data attribute / CSS selector. */
export const safeDesignId = (id) => (BY_ID.has(id) ? id : '');

export const DESIGN_LAYOUTS = [
  ['center', 'Centered'],
  ['split', 'Split (title left, form right)'],
  ['side-card', 'Card on the right'],
  ['sheet', 'Bottom sheet'],
  ['chat', 'Chat (one question at a time)'],
];

/** Mini preview for the design picker: background, card and button drawn from the preset's own colours. */
export function designThumb(design) {
  const p = design.patch;
  const bg = p.backgroundColor ? (p.backgroundColor2 ? `linear-gradient(${p.bgAngle}deg,${p.backgroundColor},${p.backgroundColor2})` : p.backgroundColor) : (p.backdropColor || '#111');
  const card = p.innerOpacity > 0 || p.cardBorderWidth ? `background:${p.innerOpacity > 0 ? p.innerColor : 'transparent'};border:1px solid ${p.cardBorderColor || 'transparent'};` : '';
  const btn = p.buttonBackground2 ? `linear-gradient(90deg,${p.buttonBackground},${p.buttonBackground2})` : p.buttonBackground;
  const split = p.designLayout === 'split';
  const caption = `<i style="display:block;height:4px;width:${split ? 34 : 60}%;background:${p.captionColor || p.fontColor};opacity:.9;border-radius:2px;margin:0 ${split ? 'auto 0 0' : 'auto'}"></i>`;
  const field = `<i style="display:block;height:5px;background:${p.inputBackground};opacity:${Math.max(0.25, p.inputOpacity / 100)};border-radius:${Math.min(4, p.inputBorderRadius)}px;margin:2px 0"></i>`;
  const form = `<div style="flex:1">${field}${field}<i style="display:block;height:6px;background:${btn};border-radius:${Math.min(4, p.buttonBorderRadius)}px;margin-top:3px"></i></div>`;
  return `<span class="optin-thumb" aria-hidden="true" style="display:block;width:100%;aspect-ratio:16/10;border-radius:5px;overflow:hidden;background:${bg};padding:10% 12%;box-sizing:border-box"><span style="display:flex;gap:6%;align-items:center;height:100%;${card}border-radius:${Math.min(6, (p.cardRadius || 2))}px;padding:6%;box-sizing:border-box">${split ? `<span style="flex:.8">${caption}</span>${form}` : `<span style="flex:1">${caption}<span style="display:block;margin-top:5px">${field}${field}<i style="display:block;height:6px;background:${btn};border-radius:${Math.min(4, p.buttonBorderRadius)}px;margin-top:3px"></i></span></span>`}</span></span>`;
}


// ------------------------------------------------------------- picking a design

const DEFAULT_CAPTIONS = ['please enter your details to find out more', 'want to personalize your video experience'];
const DEFAULT_BUTTONS = ['play', 'next', 'submit', 'send'];
const STARTER_LABELS = new Set(['email', 'first name', 'last name', 'firstname', 'lastname']);
const norm = (v) => String(v ?? '').trim().toLowerCase();
const ALL = (key) => new Set(OPTIN_DESIGNS.map((x) => norm(x.copy[key])).filter(Boolean));

/** The three boxes every design on the board shows (a fresh form has only Email). */
export function starterFields(required) {
  return [
    { id: 0, label: 'Email', token: 'EMAIL', type: 'email', required },
    { id: 2, label: 'First Name', token: 'FIRST NAME', type: 'singleline', required },
    { id: 3, label: 'Last Name', token: 'LAST NAME', type: 'singleline', required },
  ];
}

const QUIZ_FIELD = {
  id: 1, label: 'What best describes your primary goal?', token: 'WHAT BEST DESCRIBES YOUR PRIMARY GOAL?', type: 'select', required: true,
  options: 'Generate more leads, Increase customer engagement, Drive product demos or trials, Educate and onboard customers',
};

/**
 * Everything picking `design` changes on `current`: its look (always) plus its wording and starter boxes (only while
 * the creator's own are still untouched defaults). Returns the keys to set.
 */
export function applyOptinDesign(current, design) {
  const out = { ...design.patch };
  const copy = design.copy || {};
  if (copy.caption !== undefined) {
    const c = norm(current?.caption);
    if (!c || DEFAULT_CAPTIONS.includes(c) || ALL('caption').has(c)) out.caption = copy.caption;
  }
  if (copy.btnText !== undefined) {
    const b = norm(current?.btnText);
    if (!b || DEFAULT_BUTTONS.includes(b) || ALL('btnText').has(b)) out.btnText = copy.btnText;
  }
  if (copy.privacyDisclaimer && (!current?.privacyDisclaimer || /^by opting in/i.test(current.privacyDisclaimer) || ALL('privacyDisclaimer').has(norm(current.privacyDisclaimer)))) {
    out.privacyDisclaimer = copy.privacyDisclaimer;
  }
  // copy that this design leaves empty (e.g. no sub-title) lives in the patch already (DESIGN_BASE resets it); design sub-titles come from the copy
  if (copy.subtitle !== undefined) out.subtitle = copy.subtitle;
  const els = Array.isArray(current?.elements) ? current.elements : [];
  const pristine = els.length <= 4 && els.every((e) => STARTER_LABELS.has(norm(e.label)) || norm(e.label) === norm(QUIZ_FIELD.label));
  if (pristine) {
    const required = els.length ? !!els[0].required : true;
    const base = starterFields(required);
    out.elements = design.id === 'qualifying-quiz' ? [{ ...QUIZ_FIELD, required }, ...base] : base;
  }
  return out;
}
