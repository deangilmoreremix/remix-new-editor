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
  inputChevron: false,
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
  colorScheme: '', // '' = the design's own colours; otherwise the id of the colour scheme last applied (COLOR_SCHEMES)
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
  'qualifying-quiz': { caption: "Let's find the right solution for you", subtitle: '', btnText: 'Next' },
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
// The board is drawn with big type: captions ~1.35x and box/button text 72% of the form size (the form also shrinks itself if its content would not fit) (all still sliders).
const d = (id, label, category, patch) => ({
  id, label, category,
  patch: { ...DESIGN_BASE, designPreset: id, fontSize: 72, ...patch, captionFontSize: Math.min(200, Math.round((patch.captionFontSize ?? 76) * 1.35)), ...(EXTRA[id] || {}) },
  copy: { caption: 'Get Your Personalized Video', btnText: 'Play Video', ...(COPY[id] || {}) },
});

export const OPTIN_DESIGNS = [
  // ---------------------------------------------------------------- layouts
  d('classic-overlay', 'Classic Overlay', 'layouts', {
    backgroundColor: '#1d1f26', backgroundColor2: '#09090c', bgAngle: 160, innerWidth: 80, fieldLayout: 'grid', fieldWidth: 80,
    inputIcons: true, inputBackground: '#ffffff', inputOpacity: 8, inputFontColor: '#f1f2f6', inputBorderColor: '#4a4d59', placeholderColor: '#b3b6c4',
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
    designLayout: 'side-card', fontFamily: 'Inter', backgroundColor: '', backdropColor: '#020a12', backdropOpacity: 62,
    innerWidth: 48, innerHeight: 95, innerColor: '#04131f', innerOpacity: 86, cardRadius: 4, cardBorderColor: '#22d3ee', cardBorderWidth: 1, cardGlow: '#06b6d4', cardBlur: 8,
    captionAlignment: 'left', captionFontSize: 62, fieldWidth: 100, ...darkInputs, inputBorderColor: '#0e7490', inputFontColor: '#e6fbff', placeholderColor: '#8fd8e8', inputBorderRadius: 3,
    buttonBackground: '#06b6d4', buttonBackground2: '#2563eb', buttonFontColor: '#02131c', buttonBorderRadius: 3, btnBottomBorder: 'none',
  }),
  d('cinematic-bottom-sheet', 'Cinematic Bottom Sheet', 'layouts', {
    designLayout: 'sheet', fontFamily: 'Inter', backgroundColor: '', backdropColor: '#050510', backdropOpacity: 45, fontColor: '#16162e',
    innerWidth: 96, innerHeight: 58, innerColor: '#ffffff', innerOpacity: 97, cardRadius: 18, cardBorderColor: '#e5e7ff', cardBorderWidth: 1, cardBlur: 10,
    captionFontSize: 64, fieldLayout: 'row', fieldWidth: 96, inputBackground: '#f3f4fb', inputFontColor: '#16162e', inputBorderColor: '#d9dcf2', inputBorderRadius: 8, placeholderColor: '#6a6f94', inputIcons: true,
    buttonBackground: '#7c3aed', buttonBackground2: '#4f46e5', buttonBorderRadius: 8, btnBottomBorder: 'none',
    subtitle: 'Fill out your details below and click play to experience the magic of AI personalization.',
  }),
  d('two-step-wizard', 'Two-Step Wizard', 'layouts', {
    fontFamily: 'Poppins', fontColor: '#2b2160', backgroundColor: '#8b7be8', backgroundColor2: '#5b3fc4', innerWidth: 74, innerHeight: 94,
    innerColor: '#ffffff', innerOpacity: 90, cardRadius: 18, cardBorderColor: '#e9d5ff', cardBorderWidth: 1, cardGlow: '#a78bfa',
    inputBackground: '#ffffff', inputBorderColor: '#e5e7eb', inputFontColor: '#1f2937', inputBorderRadius: 6, placeholderColor: '#6b7280', inputIcons: true,
    buttonBackground: '#6d4cff', buttonHoverColor: '#5b3fe0', buttonBorderRadius: 8, btnBottomBorder: 'none',
    multiStep: true, stepSize: 2, subtitle: 'Just 2 quick steps to get your custom video experience',
  }),
  d('conversational-setup', 'Conversational Setup', 'layouts', {
    designLayout: 'chat', fontFamily: 'Inter', fontSize: 66, fontColor: '#1f2340', backgroundColor: '', backdropColor: '#0b0b18', backdropOpacity: 25, innerWidth: 64, innerHeight: 88,
    innerColor: '#ffffff', innerOpacity: 98, cardRadius: 18, cardBorderColor: '#e2e5ff', cardBorderWidth: 1, cardGlow: '#6d4cff',
    captionAlignment: 'left', captionFontSize: 34, fieldWidth: 100,
    inputBackground: '#f4f5ff', inputFontColor: '#1f2340', inputBorderColor: '#d5d9ff', inputBorderRadius: 10, placeholderColor: '#7a80a8', inputIcons: true,
    buttonBackground: '#6d4cff', buttonBackground2: '#8b5cf6', buttonBorderRadius: 10, btnBottomBorder: 'none',
    fieldLayout: 'stacked',
  }),
  d('vip-access', 'VIP Access', 'premium', {
    fontFamily: 'Cinzel', fontColor: '#f5e7b8', captionColor: '#e8c872', captionFontSize: 78, backgroundColor: '#0b0905', backgroundColor2: '#1b1409', bgAngle: 160,
    innerWidth: 92, innerHeight: 95, cardRadius: 6, cardBorderColor: '#c9a24a', cardBorderWidth: 2, cardGlow: '#c9a24a',
    inputBackground: '#000000', inputOpacity: 55, inputFontColor: '#f5e7b8', inputBorderColor: '#8a6d2b', inputBorderRadius: 3, placeholderColor: '#b79a52', inputIcons: true,
    fieldLayout: 'grid', fieldWidth: 80,
    buttonBackground: '#f2c14e', buttonBackground2: '#b8860b', buttonFontColor: '#1a1205', buttonHoverColor: '#d9a638', buttonBorderRadius: 3, btnBottomBorder: 'none',
    eyebrow: 'EXCLUSIVE PRIVATE PREVIEW',
  }),
  d('qualifying-quiz', 'Qualifying Quiz', 'layouts', {
    designLayout: 'split', fontFamily: 'Inter', fontSize: 64, fieldLayout: 'grid', backgroundColor: '#150e33', backgroundColor2: '#2a1b66', innerWidth: 94, innerHeight: 94,
    innerColor: '#8b5cf6', innerOpacity: 12, cardRadius: 16, cardBorderColor: '#4c3f8f', cardBorderWidth: 1,
    captionAlignment: 'left', captionFontSize: 62, fieldWidth: 100,
    inputBackground: '#ffffff', inputBorderColor: '#ddd6fe', inputFontColor: '#1f2937', inputBorderRadius: 5, placeholderColor: '#6b7280',
    buttonBackground: '#6d4cff', buttonHoverColor: '#5b3fe0', buttonBorderRadius: 6, btnBottomBorder: 'none',
    eyebrow: 'QUALIFYING QUIZ',
  }),
  d('social-proof', 'Social Proof Opt-in', 'layouts', {
    designLayout: 'split', fontFamily: 'Inter', backgroundColor: '#1b1140', backgroundColor2: '#3b1f8f', innerWidth: 94, innerHeight: 94,
    innerColor: '#6d4cff', innerOpacity: 30, cardRadius: 14, captionAlignment: 'left', captionFontSize: 58, fieldWidth: 100,
    inputBackground: '#ffffff', inputBorderColor: '#e5e7eb', inputFontColor: '#1f2937', inputBorderRadius: 4, inputIcons: true,
    buttonBackground: '#6d4cff', buttonBackground2: '#7c3aed', buttonBorderRadius: 6, btnBottomBorder: 'none',
    eyebrow: 'SOCIAL PROOF OPT-IN', subtitle: 'Enter your details to get your personalized video.',
    sideQuote: 'SmartVideo AI made it incredibly easy to create high-converting videos for our business.',
    sideAuthor: 'Verified Customer', sideRating: '4.9/5 (2,847 reviews)', sideStats: '50,000+ Creators; 5M+ Videos Created; 98% Satisfaction',
  }),
  d('neon-floating-card', 'Neon Floating Card', 'glass', {
    fontFamily: 'Poppins', backgroundColor: '#05040f', backgroundColor2: '#1a0a3a', bgAngle: 160, innerWidth: 44, innerHeight: 94,
    innerColor: '#0b0720', innerOpacity: 60, cardRadius: 40, cardBorderColor: '#ff2bd6', cardBorderWidth: 3, cardGlow: '#ff2bd6',
    captionFontSize: 80, fieldLayout: 'stacked', fieldWidth: 86, ...darkInputs, inputBorderColor: '#c026d3',
    buttonBackground: '#ff2d95', buttonBackground2: '#ff3d6e', buttonBorderRadius: 30, btnBottomBorder: 'none',
  }),

  // ---------------------------------------------------------- glass & neon
  d('aurora-glass', 'Aurora Glass', 'glass', {
    designLayout: 'side-card', fontFamily: 'Poppins', backgroundColor: '#031a1f', backgroundColor2: '#06302f', innerWidth: 54, innerHeight: 95,
    innerColor: '#14b8a6', innerOpacity: 16, cardRadius: 28, cardBorderColor: '#5eead4', cardBorderWidth: 2, cardGlow: '#2dd4bf', cardBlur: 10,
    captionFontSize: 72, fieldWidth: 80, ...darkInputs, inputBackground: '#03201f', inputOpacity: 60, inputFontColor: '#e6fff9', inputBorderColor: '#5eead4', placeholderColor: '#9fe7d8', inputBorderRadius: 10,
    buttonBackground: '#10b981', buttonBackground2: '#06b6d4', buttonFontColor: '#02221c', buttonBorderRadius: 30, btnBottomBorder: 'none',
    subtitle: 'Enter your details below and click play',
  }),
  d('holographic-card', 'Holographic Card', 'glass', {
    designLayout: 'card-left', fontFamily: 'Poppins', backgroundColor: '#08122b', backgroundColor2: '#1a0b3f', innerWidth: 46, innerHeight: 88,
    innerColor: '#0b1230', innerOpacity: 88, cardRadius: 26, cardBorderColor: '#7ee7ff', cardBorderWidth: 2, cardGlow: '#22d3ee', cardBlur: 10,
    captionFontSize: 74, buttonWidth: 'auto', fieldWidth: 80, ...darkInputs, inputBorderColor: '#7ee7ff', placeholderColor: '#d6ecff', inputOpacity: 14,
    buttonBackground: '#22d3ee', buttonBackground2: '#a855f7', buttonBorderRadius: 22, btnBottomBorder: 'none',
  }),
  d('gradient-mesh', 'Gradient Mesh', 'glass', {
    designLayout: 'hero', fontFamily: 'Poppins', backgroundColor: '#4c1d95', backgroundColor2: '#7c3aed', bgAngle: 150, innerWidth: 92, innerHeight: 66,
    captionFontSize: 120, fieldLayout: 'row', fieldWidth: 100, inputBackground: '#ffffff', inputOpacity: 94, inputBorderColor: 'transparent', inputFontColor: '#3b0764', inputBorderRadius: 8, placeholderColor: '#6b4b9a', inputIcons: true,
    buttonBackground: '#ffffff', buttonFontColor: '#6d28d9', buttonHoverColor: '#f3e8ff', buttonBorderRadius: 24, btnBottomBorder: 'none',
  }),
  d('cosmic-portal', 'Cosmic Portal', 'glass', {
    fontFamily: 'Poppins', backgroundColor: '#12031a', backgroundColor2: '#4a0a3d', bgAngle: 180, innerWidth: 78, innerHeight: 92,
    innerColor: '#3b0a33', innerOpacity: 55, cardRadius: 200, cardBorderColor: '#f0abfc', cardBorderWidth: 3, cardGlow: '#d946ef',
    captionFontSize: 66, buttonWidth: 'auto', fieldWidth: 74, ...darkInputs, inputBorderColor: '#f0abfc', placeholderColor: '#f3c9fb',
    buttonBackground: '#a21caf', buttonBackground2: '#db2777', buttonBorderRadius: 30, btnBottomBorder: '#f0abfc',
  }),
  d('geometric-frames', 'Geometric Frames', 'glass', {
    fontFamily: 'Rajdhani', designAccent: '#fbbf24', backgroundColor: '#1a0f02', backgroundColor2: '#3a2006', innerWidth: 76, innerHeight: 94,
    captionFontSize: 70, fieldLayout: 'grid', fieldWidth: 82, inputBackground: '#3a2006', inputOpacity: 80, inputFontColor: '#ffe9b8', inputBorderColor: '#f59e0b', inputBorderRadius: 3, placeholderColor: '#d9ad63', inputIcons: true,
    buttonBackground: '#f59e0b', buttonFontColor: '#2a1500', buttonHoverColor: '#d98206', buttonBorderRadius: 22, btnBottomBorder: 'none',
  }),

  // ---------------------------------------------------------- light & soft
  d('editorial-minimalist', 'Editorial Minimalist', 'light', {
    designLayout: 'drawer-left', fontFamily: 'Playfair Display', fontColor: '#111111', backgroundColor: '', backdropColor: '#000000', backdropOpacity: 40,
    innerWidth: 44, innerHeight: 100, innerColor: '#ffffff', innerOpacity: 100,
    captionAlignment: 'left', captionFontSize: 84, fieldLayout: 'stacked', fieldWidth: 100, fieldAlign: 'left',
    inputBackground: '#ffffff', inputBorderColor: '#111111', inputFontColor: '#111111', inputBorderRadius: 2, placeholderColor: '#555555',
    buttonBackground: '#111111', buttonFontColor: '#ffffff', buttonHoverColor: '#333333', buttonBorderRadius: 2, btnBottomBorder: 'none',
    subtitle: 'Fill in your details to start watching',
  }),
  d('floating-pill-inputs', 'Floating Pill Inputs', 'light', {
    designLayout: 'corner', fontFamily: 'Poppins', backgroundColor: '', backdropColor: '#05030f', backdropOpacity: 25, innerWidth: 42, innerHeight: 72,
    innerColor: '#2a1b7a', innerOpacity: 94, cardRadius: 24, cardGlow: '#7c3aed',
    captionFontSize: 72, fieldLayout: 'stacked', fieldWidth: 78, inputBackground: '#ffffff', inputOpacity: 88, inputFontColor: '#2a2160', inputBorderColor: 'transparent', inputBorderRadius: 30, placeholderColor: '#6b5fb0', inputIcons: true,
    buttonBackground: '#a855f7', buttonBackground2: '#7c3aed', buttonBorderRadius: 30, btnBottomBorder: 'none',
  }),
  d('soft-pastel-frost', 'Soft Pastel Frost', 'light', {
    designLayout: 'card-left', fontFamily: 'Poppins', fontColor: '#3a1550', backgroundColor: '#fde68a', backgroundColor2: '#fb7185', bgAngle: 160, innerWidth: 46, innerHeight: 88,
    innerColor: '#ffffff', innerOpacity: 38, cardRadius: 30, cardBorderColor: '#ffffff', cardBorderWidth: 2, cardBlur: 16,
    captionFontSize: 72, buttonWidth: 'auto', fieldWidth: 86, inputBackground: '#ffffff', inputOpacity: 85, inputBorderColor: 'transparent', inputFontColor: '#3a1550', inputBorderRadius: 30, placeholderColor: '#9a5b86', inputIcons: true,
    buttonBackground: '#1f1147', buttonFontColor: '#ffffff', buttonHoverColor: '#32207a', buttonBorderRadius: 30, btnBottomBorder: 'none',
  }),
  d('progress-milestones', 'Progress Milestones', 'light', {
    designLayout: 'split', fontFamily: 'Inter', fontColor: '#2a1f5c', backgroundColor: '#c4b5fd', backgroundColor2: '#7c3aed', innerWidth: 90, innerHeight: 84,
    innerColor: '#ffffff', innerOpacity: 94, cardRadius: 18, cardBorderColor: '#ede9fe', cardBorderWidth: 1,
    captionAlignment: 'left', captionFontSize: 66, fieldWidth: 100, inputBackground: '#f5f3ff', inputBorderColor: '#ddd6fe', inputFontColor: '#1f2937', inputBorderRadius: 8, placeholderColor: '#6b7280', inputIcons: true,
    buttonBackground: '#6d4cff', buttonHoverColor: '#5b3fe0', buttonBorderRadius: 8, btnBottomBorder: 'none',
    multiStep: true, stepSize: 1,
  }),
  d('accordion-form', 'Accordion Form', 'light', {
    fontFamily: 'Inter', backgroundColor: '#0b1030', backgroundColor2: '#1b1460', bgAngle: 170, innerWidth: 60, innerHeight: 96, inputChevron: true,
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
    designLayout: 'banner', fontFamily: 'Share Tech Mono', fontColor: '#39ff14', backgroundColor: '#000000', innerWidth: 92, innerHeight: 74,
    cardRadius: 4, cardBorderColor: '#22c55e', cardBorderWidth: 2, cardGlow: '#22c55e', captionAlignment: 'left', captionFontSize: 76, fieldLayout: 'cols', fieldWidth: 100,
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
    fontFamily: 'Montserrat', backgroundColor: '#2a0508', backgroundColor2: '#0b0203', bgAngle: 180, innerWidth: 80, innerHeight: 95,
    captionFontSize: 72, fieldLayout: 'cols', fieldWidth: 94,
    inputBackground: '#ffffff', inputOpacity: 10, inputBorderColor: '#8a8a8a', inputFontColor: '#f5f5f5', inputBorderRadius: 6, placeholderColor: '#bbbbbb', inputIcons: true,
    buttonBackground: '#dc2626', buttonHoverColor: '#b91c1c', buttonBorderRadius: 6, btnBottomBorder: 'none',
    subtitle: 'Enter your details and click play',
  }),
  d('blueprint-grid', 'Blueprint Grid', 'bold', {
    designLayout: 'drawer-right', fontFamily: 'Share Tech Mono', backgroundColor: '', backdropColor: '#031a4a', backdropOpacity: 35, innerWidth: 44, innerHeight: 100,
    innerColor: '#0a2a6b', innerOpacity: 94, cardBorderWidth: 1, cardBorderColor: '#93c5fd',
    captionFontSize: 72, fieldLayout: 'stacked', fieldWidth: 84,
    inputBackground: '#0a2a6b', inputOpacity: 60, inputFontColor: '#e0f0ff', inputBorderColor: '#93c5fd', inputBorderRadius: 0, placeholderColor: '#9ec5f0', inputIcons: true,
    buttonBackground: '#1d6bff', buttonHoverColor: '#1557d6', buttonBorderRadius: 2, btnBottomBorder: '#93c5fd',
  }),
  d('high-contrast-monochrome', 'High Contrast Mono', 'bold', {
    designLayout: 'scrim-left', fontFamily: 'Montserrat', backgroundColor: '', backdropColor: '#000000', backdropOpacity: 15, innerWidth: 58, innerHeight: 100, captionAlignment: 'left', captionFontSize: 84,
    fieldLayout: 'stacked', fieldWidth: 88, fieldAlign: 'left', inputBackground: '#ffffff', inputBorderColor: '#ffffff', inputFontColor: '#000000', inputBorderRadius: 6, inputIcons: true,
    buttonBackground: '#facc15', buttonFontColor: '#000000', buttonHoverColor: '#eab308', buttonBorderRadius: 20, btnBottomBorder: 'none',
  }),
  d('horizontal-ribbon', 'Horizontal Ribbon', 'bold', {
    designLayout: 'sheet', fontFamily: 'Poppins', backgroundColor: '', backdropColor: '#12031f', backdropOpacity: 30, innerWidth: 100, innerHeight: 56,
    innerColor: '#a21caf', innerOpacity: 96, cardRadius: 0,
    captionFontSize: 74, fieldLayout: 'cols', fieldWidth: 100,
    inputBackground: '#ffffff', inputOpacity: 92, inputBorderColor: 'transparent', inputFontColor: '#2a2160', inputBorderRadius: 8, placeholderColor: '#6b5fb0', inputIcons: true,
    buttonBackground: '#ec4899', buttonHoverColor: '#db2777', buttonBorderRadius: 4, btnBottomBorder: 'none',
  }),
  d('ticket-invitation', 'Ticket Invitation', 'bold', {
    designLayout: 'split', fontFamily: 'Montserrat', backgroundColor: '#12081f', backgroundColor2: '#2a1240', innerWidth: 88, innerHeight: 74,
    innerColor: '#1a0f2e', innerOpacity: 80, cardRadius: 18, cardBorderColor: '#f5b83a', cardBorderWidth: 2,
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
    designLayout: 'drawer-right', fontFamily: 'Playfair Display', fontColor: '#1f2937', backgroundColor: '#e5e7eb', backgroundColor2: '#9ca3af', bgAngle: 135, innerWidth: 46, innerHeight: 100,
    innerColor: '#ffffff', innerOpacity: 78, cardRadius: 0, cardBorderColor: '#ffffff', cardBorderWidth: 2, cardBlur: 6,
    captionFontSize: 76, buttonWidth: 'auto', fieldWidth: 82, inputBackground: '#ffffff', inputBorderColor: '#d1d5db', inputFontColor: '#1f2937', inputBorderRadius: 4, placeholderColor: '#6b7280', inputIcons: true,
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
  ['card-left', 'Card on the left'],
  ['drawer-right', 'Panel down the right side'],
  ['drawer-left', 'Panel down the left side'],
  ['sheet', 'Bottom sheet'],
  ['corner', 'Small pop-up in the corner'],
  ['banner', 'Wide banner across the middle'],
  ['hero', 'Big title, all boxes in one row, no card'],
  ['scrim-left', 'Left-aligned over a dark fade'],
  ['chat', 'Chat (a question before each box)'],
];
export const DESIGN_LAYOUT_IDS = DESIGN_LAYOUTS.map(([id]) => id);

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
export function applyOptinDesign(current, design, schemeId = '') {
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
  // created / picked with a colour scheme: recolour the design's own colours (never compounding: it always starts from them)
  if (schemeId) { const scheme = COLOR_SCHEMES.find((x) => x.id === schemeId); if (scheme) Object.assign(out, recolorOptin({ ...current, ...out }, scheme)); }
  return out;
}


// ----------------------------------------------------------------------------- colour schemes

/** One-click colour schemes: each is a hue. Picking one recolours the whole design (background, card, inputs, button, decoration) to that hue. */
export const COLOR_SCHEMES = [
  { id: '', label: "The design's own", hue: null },
  { id: 'violet', label: 'Violet', hue: 262 },
  { id: 'blue', label: 'Blue', hue: 218 },
  { id: 'sky', label: 'Sky', hue: 199 },
  { id: 'cyan', label: 'Cyan', hue: 187 },
  { id: 'teal', label: 'Teal', hue: 168 },
  { id: 'green', label: 'Green', hue: 142 },
  { id: 'lime', label: 'Lime', hue: 84 },
  { id: 'amber', label: 'Amber', hue: 42 },
  { id: 'orange', label: 'Orange', hue: 24 },
  { id: 'red', label: 'Red', hue: 352 },
  { id: 'pink', label: 'Pink', hue: 330 },
  { id: 'magenta', label: 'Magenta', hue: 295 },
];

// Colours a scheme turns. Text, the white of inputs and other neutrals (greys, black, white) are left alone, so contrast is kept:
// only the hue of a coloured value changes, never its lightness or strength.
const RECOLOR_KEYS = [
  'backgroundColor', 'backgroundColor2', 'backdropColor', 'innerColor', 'cardBorderColor', 'cardGlow', 'designAccent',
  'inputBackground', 'inputBorderColor', 'inputFontColor', 'placeholderColor', 'fontColor', 'captionColor',
  'buttonBackground', 'buttonBackground2', 'buttonHoverColor', 'btnBottomBorder', 'buttonFontColor',
];

const parseHex = (v) => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(v ?? '').trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
function toHsl([r, g, b]) {
  const R = r / 255; const G = g / 255; const B = b / 255;
  const max = Math.max(R, G, B); const min = Math.min(R, G, B); const l = (max + min) / 2; const d = max - min;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? ((G - B) / d + (G < B ? 6 : 0)) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h * 60, s, l];
}
function hslHex(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return `#${[f(0), f(8), f(4)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}
const SAT = 0.12; // below this a colour counts as a neutral (grey / black / white)
const hueOf = (hex) => { const rgb = parseHex(hex); if (!rgb) return null; const [h, s] = toHsl(rgb); return s >= SAT ? h : null; };
const lumOf = (hex) => { const rgb = parseHex(hex); if (!rgb) return 0; const [r, g, b] = rgb.map((c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** Moves a coloured value to the scheme: its hue lands near the target (a design that mixes two hues keeps a little of that, 40%), lightness and strength unchanged. */
/** WCAG contrast ratio of two colours (1..21). */
export function contrastRatio(a, b) {
  const [hi, lo] = [lumOf(a), lumOf(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** Whichever of white or near-black reads better on `bg`. */
const bestText = (bg) => (contrastRatio('#ffffff', bg) >= contrastRatio('#111827', bg) ? '#ffffff' : '#111827');
/** `fg` moved lighter or darker (same hue) until it reads on `bg` with at least `min` contrast. */
function readableOn(fg, bg, min = 3) {
  const rgb = parseHex(fg);
  if (!rgb || contrastRatio(fg, bg) >= min) return fg;
  const [h, s, l] = toHsl(rgb);
  const darker = lumOf(bg) > 0.4;
  for (let step = 1; step <= 20; step += 1) {
    const next = hslHex(h, s, Math.max(0, Math.min(1, l + (darker ? -1 : 1) * step * 0.05)));
    if (contrastRatio(next, bg) >= min) return next;
  }
  return darker ? '#111827' : '#ffffff';
}
function rotateHex(hex, base, target) {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const [h, s, l] = toHsl(rgb);
  if (s < SAT) return hex;
  const offset = ((h - base + 540) % 360) - 180; // -180..180: how far this colour sits from the design's base hue
  return hslHex((target + offset * 0.4 + 360) % 360, s, l);
}
/** The hue a design is built around: its first coloured button / frame / background colour (null for a black-and-white design). */
function baseHueOf(source) {
  for (const k of ['buttonBackground', 'buttonBackground2', 'cardBorderColor', 'designAccent', 'backgroundColor', 'innerColor', 'backdropColor']) {
    const h = hueOf(source?.[k]);
    if (h !== null) return h;
  }
  return null;
}

/**
 * The colour keys to set so `current` wears `scheme`. It always starts from the design's own colours (not from the current ones), so
 * picking schemes one after another never drifts, and "The design's own" restores them exactly. With no design it turns the current colours.
 */
export function recolorOptin(current, scheme) {
  const design = getOptinDesign(current?.designPreset);
  const source = design ? design.patch : current;
  const out = { colorScheme: scheme?.id || '' };
  if (scheme?.hue == null) {
    if (design) RECOLOR_KEYS.forEach((k) => { if (k in source) out[k] = source[k]; });
    return out;
  }
  const base = baseHueOf(source);
  const keys = RECOLOR_KEYS.filter((k) => k in source && source[k] !== undefined && source[k] !== null);
  if (base === null) {
    // a black-and-white design: it keeps its look and gains the scheme as its accent (button, decoration)
    keys.forEach((k) => { out[k] = source[k]; });
    out.buttonBackground = hslHex(scheme.hue, 0.72, 0.46);
    out.buttonHoverColor = hslHex(scheme.hue, 0.72, 0.38);
    out.designAccent = hslHex(scheme.hue, 0.72, 0.52);
    out.buttonFontColor = bestText(out.buttonBackground);
    return out;
  }
  keys.forEach((k) => { out[k] = rotateHex(source[k], base, scheme.hue); });
  // decoration that is drawn in an accent (frames, stripes, badge) follows the scheme even when the design did not set one
  if (!hueOf(source.designAccent)) out.designAccent = hslHex(scheme.hue, 0.72, 0.52);
  // button text: a coloured text keeps its tint; a black / white one is re-picked so it reads on the new button colour
  if (hueOf(out.buttonBackground) !== null && hueOf(source.buttonFontColor) === null && 'buttonFontColor' in source) {
    out.buttonFontColor = bestText(out.buttonBackground);
  } else if ('buttonFontColor' in out && out.buttonBackground) {
    out.buttonFontColor = readableOn(out.buttonFontColor, out.buttonBackground); // a tinted text on a new colour still has to read
  }
  return out;
}

/** Swatch colour of a scheme tile. */
export const schemeSwatch = (scheme) => (scheme.hue == null ? 'conic-gradient(#f43f5e,#f59e0b,#22c55e,#06b6d4,#6366f1,#d946ef,#f43f5e)' : `hsl(${scheme.hue} 75% 52%)`);
