/**
 * Frozen-upstream integrity + the starfield thick-core adapter (Phase 3 final
 * review, finding 2).
 *
 * Phase 3 fixed finding F2 (starfield stars too thin to survive H.264) by
 * editing the frozen upstream `_upstream/starfield-warp/Starfield.tsx`. The
 * correction now lives in the adapter (`designs/StarfieldWarpDesign.tsx`) and
 * the upstream file is restored. These tests keep it that way:
 *
 *  1. Every file under `_upstream/` matches a pinned SHA-256, so no frozen
 *     upstream can drift silently. Files the header declares verbatim are also
 *     checked body-for-body against the hash of the upstream file itself,
 *     fetched from the pinned upstream commit when this manifest was written
 *     (`raw.githubusercontent.com/<repo>/<sha>/<path>`). Files with a
 *     pre-existing, header-documented Phase 1/2 deviation are pinned as-is.
 *  2. The adapter's local renderer, given the upstream's OWN core-size range,
 *     renders markup identical to the frozen upstream across the loop — so the
 *     only difference between the two is the core size the adapter chooses.
 *  3. The adapter really does draw the thicker 3–7 px cores, and the template
 *     the catalog registers uses that adapter.
 */

import { describe, it, expect, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const clock = vi.hoisted(() => ({ frame: 0 }))

vi.mock('remotion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('remotion')>()
  return {
    ...actual,
    useCurrentFrame: () => clock.frame,
    useVideoConfig: () => ({ width: 1920, height: 1080, fps: 30, durationInFrames: 150 }),
  }
})

const { Starfield } = await import('../_upstream/starfield-warp/Starfield')
const {
  ThickCoreStarfield,
  StarfieldWarpDesign,
  UPSTREAM_STAR_CORE_SIZE,
  EXPORT_STAR_CORE_SIZE,
} = await import('../designs/StarfieldWarpDesign')
const { starfieldWarpTemplate } = await import('../catalog')

const UPSTREAM_DIR = join(__dirname, '..', '_upstream')

/**
 * `file`: SHA-256 of the whole frozen file (header included).
 * `upstream`: for verbatim files, SHA-256 of the upstream source at the commit
 * named in the header; the frozen file's body (everything after the closing
 * `// ----` line of the provenance header) must hash to it.
 */
const FROZEN_UPSTREAM: Record<string, { file: string; upstream?: string }> = {
  'brito-bar-chart-race/BarChartRace.tsx': { file: '645d50e8dee99dd8a5e27c928870cf00eb7b9a16f89d7161352c9ea014dadd33' },
  'brito-bar-chart-race/sample-data.ts': { file: 'e6cfa131613dce385b84aec965aea39ae050f25f673e58521bf1cf94645f86aa' },
  'brito-captioned-short/CaptionedShort.tsx': { file: 'ded022d07f38d83dd2b6561b4cf3d4f87ee5ae52ce213363353fdb7812edb060' },
  'brito-kinetic-text/KineticText.tsx': { file: '2ca944c52acffa6378be3ea8e2afdc2d911aa5076f03e9e79435251f20b081d0' },
  'brito-lib/colors.ts': { file: '9eef1ee7b776fbefcd5cf38b262076788490a5e870912856f3bc3ea94f5d5c6f' },
  'brito-lib/fonts.ts': { file: '0c2e9b3f7ec9cfff50dda9374d9b62f21cc1510fd9826fc381d92aa5d17b7f1e' },
  'brito-lib/layout.tsx': { file: 'f03cdf4561a0a95a592608a380889afcbd885d1d1081f3315e4b4fd062847e64' },
  'brito-lib/springs.ts': { file: '33fbf504a118743a711ab4785c751b87cb41e95e7ca28d5f2deb555a90a5b602' },
  'brito-line-chart/LineChart.tsx': { file: '0cd111a6e17706af0e76476db37fab2c72369ed4d4d8668555d7c4df1b204e41' },
  'brito-logo-intro/LogoIntro.tsx': { file: '025daab751b8b60ad117020754c39da8371159a4ee0f4f2c3c544c834d1776c5' },
  'brito-lower-thirds/LowerThirds.tsx': { file: '7d9d9cd087a5ba47d9fc0741aad81c54232506c6e3057f978f2a20722c67cef0' },
  'brito-lower-thirds/styles.tsx': { file: '4bcd10e468204b2b86b7043869a710d71ebb36f4fe88298327305e769d09e2b1' },
  'brito-promo/PromoTemplate.tsx': { file: 'e486025f7d09b8c55f45c61a9586c887b1e1856678aae58ecb48a5122dcd1a16' },
  'camera-shake/CameraShake.tsx': { file: 'beb06ad4db923d5268f24eb2103e0732dc1eee9ac28e52dabedb69cffe451492', upstream: 'bbd4cb141d8d612ff797d2ad098e4f9ec88155434e7b9ab37331d6567892137a' },
  'card-flip-transition/CardFlipTransition.tsx': { file: 'd8fe6346dc41946b4a9513b4f9d6990e94c6ea5a42be4be977d35ccb86e58cd0', upstream: '2e7b4c8f10c2d67f9bfef8ccf2146468c1e0f440cb617645ab3dc3245ae4ee67' },
  'character-jumping/CharacterJumping.tsx': { file: '357cb82a1af04b2f6266f1e029675a1b0261ad3290d21e3519ad190aa2e1ab74', upstream: '42ad3e3ef93908c8aca8c947b95031c1e4560fb8e9ace62e693fd081befc2582' },
  'community-chat/CommunityChat.tsx': { file: 'd7acfa36549c12038d891f471bb510b6a662f0a33348ef7b95d8dc67d6a1297a', upstream: 'dfbf044202f1919d9a633a6195145e4af0584066d97991678b47579434446824' },
  'eye-reveal/EyeReveal.tsx': { file: '68d5b0e93130e2859e7c9eb5d4e7b81fff1b09de4b71e5f13d477039a5c643ed', upstream: 'edcf1abc6cf761f2cdf15a64622c4ac32717a59ecd3f85c9fb98a312f1bbb936' },
  'fireworks-burst/FireworksBurst.tsx': { file: '78fbf11f1e8a212406b8b37aa3608a814d107242e8763d17dbedf226761985e6', upstream: 'b08ffc709dd50715d847a6a7a2d297eb37049cfe73bc106f9af827dddc5ed63d' },
  'flip-page-transition/FlipPageTransition.tsx': { file: 'd2996bbf9c3269ade87f7f4bc287ead68333f3e1646e4bcd5e826b123ff81e66', upstream: '522b2230ddc49b30ca4b06d1478c6ce0474637c53b4385e23976193e83a6a704' },
  'four-tone-mono-titler/FourToneMonoTitler.tsx': { file: 'c6519f64814da173b5574dea504ff905280d0ba0f4f1b0fdba3de9d4491f0a37' },
  'gradient-text-sweep/GradientTextSweep.tsx': { file: 'bc1ecdc75c3329b0e053cfcba30a1e1b238dc293547894f449061ca295a0e17e', upstream: 'b092c0776b24a8ff79247bfac538c4f818e4595e1b76dc6214b73fd3fe4b41c8' },
  'ink-spread-transition/InkSpreadTransition.tsx': { file: '61901de925a2ed47ebff9588e6fd40306c7a4962de98bfcc7d25e8370562c505', upstream: '2eb862e756fc6dae3456abf07a13471e19be08735aaaa3585b68a3e72fc26f82' },
  'kinetic-word-stack/KineticWordStack.tsx': { file: 'd4adb3d9221521f83c83c9bed19415805cf5458aa58ca1d3ad3f2c4d9b4d5363', upstream: 'ca427232be7c2955006af56218ba7cfaf536ce745aa40c2f19687ccf73f2e755' },
  'kpi-counter/KpiCounter.tsx': { file: '546b7b5e3932e09827912569ca30d1a438edd556a88a05e9fe79fbea15dafe7f', upstream: '0ddc52f49062e1570487f531f3e4589701d7616b5e73ec70071abc25d35b1a9c' },
  'line-chart-anim/LineChartAnim.tsx': { file: '2c0616c362d776f67bcab0d87d83d31e1d9e9e2179e7c0df4ed6c66f17c616eb', upstream: '727cb6c5bc0882b7e2158b2a5c6a90d07270753b091c8ce470a4a940f7b3afde' },
  'loop-grid-wave/LoopGridWave.tsx': { file: 'f16ee00f8389ec52167258c433b2c52c903ceae30b1a3f0564f417ee88105d68', upstream: '011ac878a4108b0031adb87848eeb77032d253aa60ad29d45d178daf62c5ad3d' },
  'neon-sign/NeonSign.tsx': { file: 'db63b534ae2cd447f28dd55b979ca3cc349cb051e05519de117cbff1382e5ffd', upstream: 'e67abad94f47fd49ffb33b06adaaac586be9639c731c505635df90e1845a074d' },
  'parallax-pan/ParallaxPan.tsx': { file: '82fa0c3ac362959b352a7059ebb1be00cf187d7f80a06b107ca2ead07f5feb66', upstream: 'a6cb3ecbc902ec73fae7d4b6d52edf96f2549c520ee8c0a2ad4aee641355d2ab' },
  'particle-snow/ParticleSnow.tsx': { file: '92f34dda27fdb5b90743c1484242a789f17f4a57079fc0e910d1ec513921bfda', upstream: 'aa7cf2c7f39072dd36cd23abf07d69f7297056f51bf7b33fd5e5e66a5ac4460d' },
  'pencil-draw/PencilDraw.tsx': { file: 'd97269684ca8814faf9c39180f5d661d4b7d97ee772987347e52631280836da9', upstream: '104041b273eafc30c9eb87e6c8a9988f3d6ae82c91de665d5d77b30b8c5f67f1' },
  'pixel-candlestick-ohlc/PixelCandlestickOhlc.tsx': { file: '667c499358acfa4fd22912eafe273af6002b0b0b71d0fa20cd53213c399f4151' },
  'pixel-kit/font.ts': { file: '7aa2518554c800bc7cb56efbc9ae24559b0dcc99dc0d6becceb934aa2136d8af', upstream: 'c54fc788780eac2650eec6da1b6dd7911f814ba24b5a4a81db4dddb75a5c9fcf' },
  'pixel-kit/fx.tsx': { file: 'a9a7c7a124104abc787495e1dd90a0aa9a0874ecb1f263417e1c8b78d45736b5', upstream: 'bd00f12092e5963ba6310164a1de73681bba34f30a3059fca7c7715694147f4e' },
  'pixel-kit/index.ts': { file: '438a79684daa1421698858b2a00af762a37254200cf4be9acd2cc766dcad8799', upstream: '9e4c13ad9df3155dd953f15dea5d1ec958a7f6680cedcdd70a0e3a3cd7a1f8f2' },
  'pixel-kit/palette.ts': { file: 'eb13a317b90c5e12b54092d0649095292b625eece4d9b73872a2714cf7a57c68', upstream: '1a6e9524c4692650507f56da2b37cbeb1427a00ec3d29033c826a31dc6bb790e' },
  'pixel-kit/particles.ts': { file: '50ff710bf4a092217e21ef808dc86fc34328af348415dde5e4d58d4bf97ae966' },
  'pixel-kit/render.tsx': { file: 'ec39bcb81abe7e28f130a1c911813fec1eb76c021a2c5fbafee8152c6d5ec77f', upstream: '951a2fc54cb0e68f7a66ea6b5cdc1f13e584d7f1bc13b8e071b7921dea63e0eb' },
  'pixel-mosaic-transition/PixelMosaicTransition.tsx': { file: '2be3763a2b80dbb71b925690183e518d3732e05972e9d3b4830bdd930e886af0' },
  'pixel-typewriter-quote/PixelTypewriterQuote.tsx': { file: '2947966c03e3ed9fd475cd4f57c89be9378998fbbcccf3f350bcc195906170cd' },
  'pixel-waterfall-cycle/PixelWaterfallCycle.tsx': { file: 'fe368dca828ddf92bcc129f3a9fbec73a7dd2c1f3c8261d2509cf2abded128d5' },
  'pourover-drip-fill-gauge/PouroverDripFillGauge.tsx': { file: 'cbae86ce41ea31d2d010c79848011e43ac78cedbfda4324826ff5a9986c7e3cf' },
  'racing-chart/RacingChart.tsx': { file: '414cabb2e77a62fc41cb59337dd844b4733dfd85499a0b6eb5ee3755d602b040', upstream: '793489402139a23eac1eed6319abd51206c447021956e31df07cd21791455a9f' },
  'rve-animated-list/AnimatedList.tsx': { file: 'd09b1d15e9f32f97f5895660dab38c26e7cd9222e32cd1947f975dd32a37e67e' },
  'rve-area-chart/AreaChart.tsx': { file: '6be307e2e7b19ab550ef787a747a2f572e105760f4fde279779aeb3b507b819a' },
  'rve-blinds-transition/BlindsTransition.tsx': { file: '8d7a507450f0d1cc65f76c9764373653d9af1a24ef683d95561158360c3eb123' },
  'rve-bounce-text/BounceText.tsx': { file: 'd1791176ce88b6021bd54406c3836be8ffb250b414a6ea496a7c59bea3dfda74' },
  'rve-bubble-pop-text/BubblePopText.tsx': { file: 'e04022a23759c67d4ff8c1f5af86296d72d98f38869e07fb3f395fff0f1dbc36' },
  'rve-card-flip/CardFlip.tsx': { file: '96f1a02700e24e08ccdc905ae025b0a214979f89ae633043b54eaaaf662f585b' },
  'rve-chart-animation/ChartAnimation.tsx': { file: 'd9ac63179ec0a30dcbe037f81bd9ef0909ce308eff0a145fd1fbaffc88ae452d' },
  'rve-cinematic-title-intro/CinematicTitleIntro.tsx': { file: 'd3d662064a94049b77b0b0c047bb3e05a8eb51bf09190559b6ca660f180e93e5' },
  'rve-clock-wipe/ClockWipe.tsx': { file: '4887bfcec90197984f91bb6b1a245b29b2764f6f49ae3f3aa872ec3cce267fcf' },
  'rve-comparison-chart/ComparisonChart.tsx': { file: '0519ad0c58ba27c81747da20255ca9f97d1bbf816797b677af2f1c4479c84262' },
  'rve-countdown-intro/CountdownIntro.tsx': { file: 'c3bd78e65b152eccd5ba02dc393faf6d3a908bd804f2af9583f389ecaca7abd9' },
  'rve-countdown-timer/CountdownTimer.tsx': { file: 'ac801128cb0de5d005d15a3d6189ce255a18610fb354e0a0d0253b9d2dcf4f66' },
  'rve-credits-roll/CreditsRoll.tsx': { file: 'b8ce1e876017a19b221651b25b05db5d3b3a167e0a3c32469101723d6200ab55' },
  'rve-cross-dissolve/CrossDissolve.tsx': { file: '335edd756e63e24be54f39e0f269be4e233999c5023653d1f7ad4ff5c9f5de54' },
  'rve-donut-chart/DonutChart.tsx': { file: '6cd8d5634f4069009c638852578fc906e614a5724b5cda446da3e6ea98483eb4' },
  'rve-fade-through-black/FadeThroughBlack.tsx': { file: 'afa056a234f65bff1a33c441bda8f200ea7af7ac9264eccfef1b8dcd0c6501d1' },
  'rve-film-burn/FilmBurn.tsx': { file: 'bdda41856f9c1170e3aec0cf0633ab10166010ecdd300ebed74d045569c577be' },
  'rve-floating-bubble-text/FloatingBubbleText.tsx': { file: '7e47718d71632d72ff85904b6bd1be328af52c2deca2a585c2a77f8e7d0ef160' },
  'rve-gallery-grid/GalleryGrid.tsx': { file: '9ee29488f804bbf9f598795955944508a51e6faec93cebfad7acad0e1e2e8b7d' },
  'rve-geometric-patterns/GeometricPatterns.tsx': { file: '802a513e9dc64d8588ada345b65f62d5628e0e0eb1b5950004c58a67cf2581a6' },
  'rve-gradient-shift/GradientShift.tsx': { file: '7adb692287c41fd4ef12c3e3f142ef01e92e160f844cb4bde8eae319703788a1' },
  'rve-grid-pulse/GridPulse.tsx': { file: '2006ed81a100752bb7134c1808b69afb8bd7b0d271b682d1b1b2bf697cf1e9eb' },
  'rve-image-carousel/ImageCarousel.tsx': { file: 'e61c15c7eb987e9d9173f26ede1f63da438c2f46080bdfc5f43f519639f76059' },
  'rve-image-comparison-slider/ImageComparisonSlider.tsx': { file: '4043de5793a5e9ed1b7cb2f1e15c377296cdb35ed78010c0856102f653c9049a' },
  'rve-image-zoom-reveal/ImageZoomReveal.tsx': { file: '8c525ee675d4a60b450e08687219021f55e8cc56a924b6c90493697b8e03b5e0' },
  'rve-iris-transition/IrisTransition.tsx': { file: '23c96dec1c9d7b665293095444fc67cd1c182b921fdf726a0cd2a53a85d7417b' },
  'rve-ken-burns/KenBurns.tsx': { file: '94b20a33bcb03100dfe8811cebbb657623abd20f1f35c062d0e9a8d600750209' },
  'rve-letterbox-reveal/LetterboxReveal.tsx': { file: 'b9f467f21b946a9650eb1028c25c00722f9e780f9f6b3335aa3cf4fd46ee6cbd' },
  'rve-line-chart/LineChart.tsx': { file: 'e32ae36b40c0630ab2090f5ab230557997c7dfa6250ce6e8b9db2f0af777cf0e' },
  'rve-liquid-wave/LiquidWave.tsx': { file: '4336c7901c0ea8113b2c6532d98a4f91d38fbfe5c85dd2489adaf453fdefc7cd' },
  'rve-logo-fade-reveal/LogoFadeReveal.tsx': { file: 'ec36179f56a6574ff0498ec11af0151445671d3f8a961080b9d38f8aa335d167' },
  'rve-logo-glitch-reveal/LogoGlitchReveal.tsx': { file: 'a0592357c340c0ba5c467e912c5c565792e027df197ab589bacd01e2b61a7f9a' },
  'rve-logo-scale-rotate/LogoScaleRotate.tsx': { file: 'ede0f63578e129c613e08a913aa19207425d98cbc6cc6bc00d8a2938d2d1566d' },
  'rve-logo-spin-reveal/LogoSpinReveal.tsx': { file: '664d1df053c0435210d9637838159165f05929afec8634cfe3224469f930d7bd' },
  'rve-logo-typewriter/LogoTypewriter.tsx': { file: 'abecdfac9b86469d0000f1dd8ff89e735f34f9ec8b6335871c0ab692851fda9b' },
  'rve-lower-third/LowerThird.tsx': { file: 'd40e3b13202faae6a59efc25b77c61822fa7ff641b000ff09db043418e14c309' },
  'rve-masonry-gallery/MasonryGallery.tsx': { file: 'd5901f995df8ceb25d39d706cf4baf6bff43b197609c13a75f7d47ac8523dd2b' },
  'rve-matrix-rain/MatrixRain.tsx': { file: '38e6be6410f43828c15b437e87488d226787be207a117d7dbd6720d0fcbd8ae6' },
  'rve-morph-transition/MorphTransition.tsx': { file: '3724c666342932b281ab148a27eb9808a63405679ecc5cf58c1f1a6fce8181a0' },
  'rve-noise-grain/NoiseGrain.tsx': { file: 'f41e7b5e7187397b2c85c24c2687d754c54f454f8b6f69159fcbcf4b6f659fe7' },
  'rve-notification-pop/NotificationPop.tsx': { file: '6b9855204e3dace7b35abdd95353e99629e85c7359bec33ee4322fda4da2e42e' },
  'rve-particle-explosion/ParticleExplosion.tsx': { file: '24a0f15d999003fd8d8f5dfb0ae465605b448911b0218f6b129ad5fc0f1b3df9' },
  'rve-photo-stack/PhotoStack.tsx': { file: '8f85d8fcd4869ac0aa20954f90beda9e08e8c33e1453b978eeb3d876170119e8' },
  'rve-picture-in-picture/PictureInPicture.tsx': { file: '1904ea67f18ea7a9f6514c669cf22da038443f1c2d4c8b22aeaaff763df66ddb' },
  'rve-pie-chart/PieChart.tsx': { file: '8c08f6f0d9b8b620384b33f50c23a95b4824e9b22f30054f0f24edda6e21dc27' },
  'rve-pixel-transition/PixelTransition.tsx': { file: 'ac0fc1ceeaf8a3ae020b991b62f6208e202962e752b21fa4f92af5b7e95ee57b' },
  'rve-polaroid-frame/PolaroidFrame.tsx': { file: '050aa02704ae4ddeb655721366c7589627eeb151631ded3f27650affd5bae7ff' },
  'rve-progress-bars/ProgressBars.tsx': { file: '7a3096f294cd9eaf7d6437f65f02acb54b60168f0632c911218c6c37c1a2efbe' },
  'rve-progress-steps/ProgressSteps.tsx': { file: '9d2ab67c5e5035e267f981ab7fa48cafee0007d0fc707b3da5a2857e9ef80883' },
  'rve-pulsing-text/PulsingText.tsx': { file: 'c890cf024ab0312560ac18513a8d57976befff4020c18bc153ac92372d475b68' },
  'rve-push-transition/PushTransition.tsx': { file: 'eb6346267bffe2d9f45b0240e3a307507904b194d10f25d8db806295056e9baa' },
  'rve-quote-card/QuoteCard.tsx': { file: '2a49b5c5b3fae6be548a767954985cb0a18130b86cdb2164c41baa4f4939a838' },
  'rve-rotating-carousel/RotatingCarousel.tsx': { file: '2a995a5ed1dc76f9f4431c2e33a504f600bc93bd1943f6f445212a7ee9c69efe' },
  'rve-sound-wave/SoundWave.tsx': { file: '0de6acaff5c848e241a01382a098fcadd08fafd273e52a6d62bf7f2f62d98dbf' },
  'rve-spotlight-reveal/SpotlightReveal.tsx': { file: 'c7e450888faf2ac7117ea6475c0623d08d6e2684c6f854533cff615ef18e5555' },
  'rve-stat-counter/StatCounter.tsx': { file: '46efc7606dbd9b09adf87c7d2416c61b81e4a08d22510656dc646c229eb106c8' },
  'rve-subscribe-reminder/SubscribeReminder.tsx': { file: '37df6e8a97277e7ae80dda75fa46f82c9c8cb801accc6742a35371a768bf79bd' },
  'rve-text-highlight/TextHighlight.tsx': { file: '32b75efb0ff255c3f40af8c12b1bd8286ddf399ce1edd7c3c6c4cb98ef2d0978' },
  'rve-title-split/TitleSplit.tsx': { file: '4f137e833eeb26c4133e1cea666fd81b8a11d4796cd38116824ac11ebb6417a2' },
  'rve-typewriter-subtitle/TypewriterSubtitle.tsx': { file: '661f95a4551105cca0e8deb449f72cb695418fbc3546a36fe280073bd28c9207' },
  'rve-vignette-pulse/VignettePulse.tsx': { file: '4170c406e3fe254d642119485b7bbe1a4678f592a32207589e2535d93caa7e2c' },
  'rve-zoom-pulse/ZoomPulse.tsx': { file: '51bb502c95f63eebc7e50cd6b9ab10c2724a33321cb9e7ff3b1b7baf4a35a54c' },
  'rve-zoom-through/ZoomThrough.tsx': { file: 'ee5ca635ced5ef328b22b4b81284d4c941a3579c1d2289fa61c352d9add1f717' },
  'scramble-text/ScrambleText.tsx': { file: '2736aeed88bf7f33c391091e37dff423a2ae99895de94539fe640315d538ecc2', upstream: '8ae774eb0434ee67f98f4b30b2ac1695190a08e97595476db05b61d41ded486e' },
  'shatter-reveal/ShatterReveal.tsx': { file: '5963355e0f2907df4892721c036e256e6723ad87e0f0a77709649e0b9f1b4307', upstream: '1c0f2fc578a52d0b2bb46aaef010d24ee47301d1bf290a960fbb823344f60b45' },
  'slide-wipe/SlideWipe.tsx': { file: 'c91a55fb0420f94bad791e9a9d25d1ea61997224c3cbec7a5bb38f69e68158a1', upstream: 'f4ed1500396e4860245c88565dbc086053b171448503f37d4dae78e304b9a308' },
  'social-reel/SocialReel.tsx': { file: '76947ea92796c82609761535c906b326113d59b9f741b43a3394fdb9bcc60019', upstream: '612f89400ebd7364da916b907e24b763908563866631df94e4bc45cd8f5951b0' },
  'split-screen/SplitScreen.tsx': { file: 'fd292b7b862de0b2b23923020122029b02bf8f8981d44c7d60e3046b36f8825a', upstream: '744a291d361ed11d6ceefdad3339018d5663eb3a7ce21c374853af1bdbaf2b3a' },
  'thinking-bubble/ThinkingBubble.tsx': { file: 'a081690f1e393dbec203bec05fcccabc10e344f488c7001ee406d0c1684ddda7', upstream: 'd0a866eb5e79a6ff5f7dc2bcf88dcb1c997c7f6d99043bdde27ac5c41ad285df' },
  'transition-circle-wipe/TransitionCircleWipe.tsx': { file: 'b236444e57fdbc7834be4a0b0f1c103b2efa028ec4dfa32b731795b9563b1e17', upstream: '1a291611dec6d5891900d06686ee439a7f1c85a2e71223b9c612daf0d560934e' },
  'typewriter/Typewriter.tsx': { file: '5fc31654e8121309aace6e93235a1b9da3075f96ccb58bbc64755e2b70a7c094', upstream: '6b56266a1c7ca6053f37f5626262ed6d5b74d0a6f92990df1ec71c0fe20c2842' },
  'wave-hello/WaveHello.tsx': { file: 'b1fd9940064e4d2855dee1ff73944dec6b9d4e427567132410ac9ded3a5c584d', upstream: 'b8e7837b5eac24ef55868fa445a86bdef0e861a46178f152cd3ddc9a6b8a9957' },
  'wave-text/WaveText.tsx': { file: '3fa80e12aaa2c40df75647e5c64f86e61171ee307d486e40531ecb0601a8d58d', upstream: 'de1201b5b5db9315cdbf1bab09734d7a0f038f7e36b2ffa3f43a71271d4b9302' },
  'whip-pan/WhipPan.tsx': { file: '670ed538b516ef712551fbce7dc1635fd7b72702f2cf0a5a90bc411df319ae4e', upstream: '9707adf4db0db95b300f7bb2524aa35ca146cd151057f68aa1c778500a6556a8' },
  'bar-chart-anim/BarChartAnim.tsx': { file: '4a3da5633a08c30832235b0457660bafec0b0f710fdbcc7db8f674c5d0218085', upstream: '7616e6752a242cfee13d46b16f78236382c0d8c6e854b89c7f1b3a525e705dee' },
  'bokeh-circles/BokehCircles.tsx': { file: '0d13633b3456f54037a878ef6625fcfb682d8739ef7e3fa8ee865565d6a0e117' },
  'bounce-in-headline/BounceInHeadline.tsx': { file: 'eb594f98d92a7066f2b97c2f90274c9b678954f501739a908385aea0868bbbc2' },
  'brush-stroke-reveal/BrushStrokeReveal.tsx': { file: '7ebbdcce368fee573326ad266ab64fe971e67748cb3c88f76ef084329fe02ba8', upstream: '5b32bd6217c549b55fdf799d1db285cdf3e9e475d6d463ed5825612930d950d6' },
  'chapter-title/ChapterTitle.tsx': { file: '928d1a42327e39d2bcc4296cc674100ccd2435e1fa450df72acfbcc14490220c', upstream: '8caae393cf07cd043b7521305974504f4d9dab4e8178fffee7c52d780b049ed8' },
  'end-card/EndCard.tsx': { file: 'f1ee8c3132dc754df7ac163a1020bfaa836b3b6d3993106ca77f838720a4c51c' },
  'glitch-text/GlitchText.tsx': { file: 'd6b7033f07ca23dd9001d382141bc43fead1caefd0361fd2f9e0a3ae71cf3549', upstream: 'd52cb5c614312987fbf162b9be7bb3a1b251dd689d144e3897ffac2bc8e406a3' },
  'logo-blur-reveal/LogoBlurReveal.tsx': { file: 'f44a186a7aa4d183734ce73f1cc9c91d7a074043c01ebfa73c6f9470836cce99', upstream: '545ff1ef7230046f158e1aecf7d67c8f3498fd50cabbc98f80b829dbd67e3db5' },
  'logo-bounce-drop/LogoBounceDrop.tsx': { file: 'b793f83e06228a2d577c2670fe2d5f0601ddf0a79fa34da9ccbbb6b305878f0d', upstream: '5455c381e1ecb3f1f0c74be3f99f3a9304a84f8cfc469c39565554f08d061dc3' },
  'logo-mask-wipe/LogoMaskWipe.tsx': { file: 'ed0651e923e615510bcd8a9dc56a035c0e4b69acdcb67bd1f1632c23fe3b4283', upstream: '15f426c99e16f15d5a1de0609e134cb7fe636a13cde74a0c34a34be4ef1be4b7' },
  'logo-split-reveal/LogoSplitReveal.tsx': { file: '684e32b1450bb893afe2583a456783f44e8d78218cec94dd5bd1c6d7bc6abef3', upstream: 'da730961d04e5fe8aa3bf798aeef83944d9de6a68f7788a75ea1777bc2b5fb24' },
  'logo-stroke-draw/LogoStrokeDraw.tsx': { file: '70d9bc23ecba1297d4c56628b0b70ff92659b50c8395989d2534caa5f84430bd' },
  'lower-third-glass-card/LowerThirdGlassCard.tsx': { file: 'a3e449c4fb9000c7003ea01d4b0b08e13f897481d0e68bbccb86f42160e23c3e' },
  'rve-animated-text/AnimatedText.tsx': { file: 'c9c66f0dd1062cbe1cffe0ad47c3d0fa541c54239350fd5ac2d75f1ca8c5e622' },
  'rve-circular-progress/CircularProgress.tsx': { file: 'f80ba2d7cffc0308151fcd18bf915e9073660553980326afd323d89a3f4ccb34' },
  'rve-popping-text/PoppingText.tsx': { file: '05dcb87ed45e803276143bc1154c25c1e301259d7c6bfcceef5a8f8c5e472e4a' },
  'rve-slide-text/SlideText.tsx': { file: '16a857cb4cc7ddce25e4277accbff51ca0a9e896362e648845d5f7d94679e668' },
  'starfield-warp/Starfield.tsx': { file: '44ad5c24e690d2e3cb4b6aba9a447e4424d096add6c7c94695c3416e3da8aa80', upstream: 'a77d1319855413f1c4fec4794d7ab9d714aba3de726ff8c418998da4ff049bf7' },
  'text-mask-reveal/TextMaskReveal.tsx': { file: '4c8544ea743fe59382b8b23099670ef9d96cad1eb298f69ee92244e743b437e6', upstream: 'bb8fbe64c4a39c339ffe92a7a269c8d3ee5c0bfec9c0139a409bf2c40ebd361a' },
}

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return listSourceFiles(path)
    return /\.(tsx?|jsx?)$/.test(name) ? [relative(UPSTREAM_DIR, path)] : []
  })
}

/** Everything after the closing `// ----` line of the provenance header. */
function upstreamBody(text: string): string {
  const lines = text.split('\n')
  const dashes = lines.flatMap((line, i) => (line.startsWith('// ----') ? [i] : []))
  return lines.slice(dashes[1] + 1).join('\n')
}

describe('frozen upstream sources', () => {
  it('pins every file under _upstream/ (no unlisted file, no listed file missing)', () => {
    expect(listSourceFiles(UPSTREAM_DIR).sort()).toEqual(Object.keys(FROZEN_UPSTREAM).sort())
  })

  for (const [path, pin] of Object.entries(FROZEN_UPSTREAM)) {
    it(`${path} is unmodified`, () => {
      const text = readFileSync(join(UPSTREAM_DIR, path), 'utf8')
      expect(sha256(text)).toBe(pin.file)
      if (pin.upstream) {
        expect(text).toContain('Upstream code is reproduced verbatim apart from this header comment.')
        expect(sha256(upstreamBody(text))).toBe(pin.upstream)
      }
    })
  }

  it('the frozen starfield carries the upstream 1–3.5 px core and no local deviation', () => {
    const text = readFileSync(join(UPSTREAM_DIR, 'starfield-warp/Starfield.tsx'), 'utf8')
    expect(text).toContain('sizeBase: 1 + seededRandom(i * 7 + 3) * 2.5,')
    expect(text).not.toMatch(/F2|deviation/i)
  })
})

describe('starfield-warp adapter (local thick-core customization)', () => {
  const props = { count: 60, starColor: '#d9ff00', baseColor: 'transparent', warpSpeed: 4 }

  it('with the upstream core range, the local renderer matches the frozen upstream frame for frame', () => {
    for (const frame of [0, 1, 37, 60, 99, 149]) {
      clock.frame = frame
      const upstream = renderToStaticMarkup(<Starfield {...props} label={undefined} />)
      const local = renderToStaticMarkup(
        <ThickCoreStarfield {...props} coreSize={UPSTREAM_STAR_CORE_SIZE} />,
      )
      expect(local).toBe(upstream)
    }
  })

  it('the adapter draws 3–7 px base cores — thicker than the upstream 1–3.5 px', () => {
    expect(EXPORT_STAR_CORE_SIZE).toEqual({ min: 3, range: 4 })
    expect(UPSTREAM_STAR_CORE_SIZE).toEqual({ min: 1, range: 2.5 })

    clock.frame = 60
    const heights = (html: string) =>
      [...html.matchAll(/height:([\d.]+)px/g)].map((m) => Number(m[1]))
    const upstream = heights(renderToStaticMarkup(<Starfield {...props} label={undefined} />))
    const local = heights(
      renderToStaticMarkup(<ThickCoreStarfield {...props} coreSize={EXPORT_STAR_CORE_SIZE} />),
    )
    expect(local).toHaveLength(60)
    expect(upstream).toHaveLength(60)
    // Same star, same position in the loop: every adapter core is strictly
    // thicker, and the field as a whole is well over twice as thick.
    local.forEach((h, i) => expect(h).toBeGreaterThan(upstream[i]))
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
    expect(sum(local) / sum(upstream)).toBeGreaterThan(2)
    // Size = sizeBase * (0.5 + 1.5 * dist/maxR), so a core is never under
    // 0.5 * 3 = 1.5 px and never over 2 * 7 = 14 px.
    for (const h of local) {
      expect(h).toBeGreaterThanOrEqual(1.5)
      expect(h).toBeLessThanOrEqual(14)
    }
  })

  it('the registered template renders the thick-core adapter with no demo label', () => {
    const template = starfieldWarpTemplate
    expect(template.id).toBe('starfield-warp')
    expect(template.component).toBe(StarfieldWarpDesign)
    clock.frame = 60
    const html = renderToStaticMarkup(
      React.createElement(StarfieldWarpDesign, {
        text: '',
        textSlots: {},
        colors: { primary: '#d9ff00', accent: '#28c98b', text: '#d9ff00', backgroundDim: 0.18 },
        media: { logo: null, product: null, service: null },
        box: { leftPx: 0, topPx: 0, widthPx: 1920, heightPx: 1080 },
        width: 1920,
        height: 1080,
        frame: 60,
        fps: 30,
        opacity: 1,
        color: '#fff',
      } as unknown as React.ComponentProps<typeof StarfieldWarpDesign>),
    )
    expect(html).not.toContain('BACKGROUND')
    expect(html.match(/linear-gradient\(90deg, transparent, #d9ff00\)/g)).toHaveLength(60)
    expect(template.capabilities.notes).toMatch(/Local adapter customization/)
  })
})
