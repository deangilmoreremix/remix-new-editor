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
  const props = { count: 60, starColor: '#29d3f2', baseColor: 'transparent', warpSpeed: 4 }

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
        colors: { primary: '#29d3f2', accent: '#28c98b', text: '#29d3f2', backgroundDim: 0.18 },
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
    expect(html.match(/linear-gradient\(90deg, transparent, #29d3f2\)/g)).toHaveLength(60)
    expect(template.capabilities.notes).toMatch(/Local adapter customization/)
  })
})
