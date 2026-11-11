/**
 * Shots that render a product's real pages: they read full-page captures and
 * card crops through `demosrc/_fixtures/liveTexture` (directly, or through the shared
 * dashboard / card fixtures), so a clip's `screens` /
 * `crops` props put the user's product on screen. Every other recipe draws its
 * own UI in code and only takes the shared title / tint overlay.
 *
 * Plain data so the server-side director can import it.
 */
export const PRODUCT_TEXTURE_SHOTS: readonly string[] = [
  'CrashImpactReal',
  'CrashZoomReal',
  'DeckDealFlyin',
  'DocumentTypewriterReveal',
  'FreezeAnnotateReal',
  'ListStackPress',
  'MultiplaneReal',
  'OutroGroupPhotoLaunch',
  'PageWaterfallWall',
  'RowEmbed',
  'SpotlightHeroCard',
  'TypeAndFilter',
  'WhipBrakeReal',
  // Recipes that draw their screen with the shared fake dashboard / card fixtures: those now show the
  // site's own page and card crops (demosrc/_fixtures/Fixtures.tsx) when a clip carries them.
  'AnimeImpact',
  'FlylineArc',
  'ReticleLockOn',
  'UiStripAwayOutro',
  'WireframeDrawOn',
  'BentoLightUp',
  'JumpCutPunchIn',
  'TrailerBumper',
  'InkBleedReveal',
  'BeforeAfterSliderScrub',
  'DroneDiveLanding',
  'PullBackIsolation',
  // Card recipes whose picture area takes the site's own crops.
  'CardStack',
  'Carousel3D',
  // The product shot / the page that lands in the frame is the site's own.
  'ProductCardProgressiveAssemble',
  'NeonFrameForerun',
  'NeonFrameForerunOrbit',
  // Sample-interface recipes whose cards, panels, windows, thumbnails and avatars show the scene's own
  // site pictures (demosrc/_fixtures/liveTexture realCard); with no capture they draw their sample UI.
  'AvatarBracketCarousel',
  'BezierSourceConvergeMerge',
  'ClonerDepthEcho',
  'DrawSvgTrace',
  'ContactShadowLift',
  'IntegrationHubMap',
  'ResearchCardStackScroll',
  'PanelToCanvasMaterialize',
  'CursorCastEnsemble',
  'PaletteThemeRipple',
  'ThemeSweepToggle',
];

export const isProductTextureShot = (componentName: string): boolean =>
  PRODUCT_TEXTURE_SHOTS.includes(componentName);

/**
 * Categories whose recipes draw their own sample interface (a made-up app screen, table
 * or chart). In a film for a company they show a foreign screen unless the site's page is
 * added beside them, so the director prefers PRODUCT-PAGE shots and brand scenes.
 */
const SAMPLE_UI_CATEGORIES: readonly string[] = ['ui-entrance', 'interaction', 'data'];

export const drawsSampleScreen = (t: { componentName: string; category: string }): boolean =>
  SAMPLE_UI_CATEGORIES.includes(t.category) && !isProductTextureShot(t.componentName);
