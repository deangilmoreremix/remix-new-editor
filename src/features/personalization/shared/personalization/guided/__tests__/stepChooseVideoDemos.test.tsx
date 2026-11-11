// @vitest-environment jsdom
/**
 * Behaviour tests for the Personalization modal's Demos tab
 * (`src/shared/personalization/guided/StepChooseVideo.tsx`).
 *
 * The Demos tab is the only surface that lists the whole demo library, so
 * these tests lock down the behaviour that matters to a customer:
 *
 *  1. The FULL eligible set is offered — the gallery reports the real
 *     registry size, not a 12-item slice.
 *  2. The category tabs exist and carry accurate counts.
 *  3. Search and the source / style / aspect filters narrow the set.
 *  4. A filter combination that matches nothing shows an empty state
 *     (never a crash) and can be reset.
 *  5. Pagination reveals every registry id, cumulatively — no video is
 *     permanently hidden.
 *  6. The selected demo card still mounts a real <video> element.
 *
 * The provider is mocked: the Demos tab only needs `previewVideo`,
 * `setPreviewVideo`, `previewSettings` and `updatePreviewComposition`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { DEMO_LIBRARY_REGISTRY } from '@ohb/data/demoLibraryRegistry'
import { countDemosByCategory, DEMO_CATEGORIES } from '../demoCategories'

const { ctx } = vi.hoisted(() => ({
  ctx: {
    source: {
      sourceMedia: '/media/source-video.webm',
      poster: null,
      title: 'Source video',
      durationLabel: '10s',
    },
    previewVideo: null as {
      url: string
      poster: string | null
      title: string
      kind: string
      demoId?: string
    } | null,
    setPreviewVideo: vi.fn(),
    previewSettings: { fps: 30 },
    updatePreviewComposition: vi.fn(),
    sharedMediaEntries: [] as unknown[],
  },
}))

// The provider lives one level above `guided/`; the path is resolved relative
// to THIS test file.
vi.mock('../../DemoPersonalizeProvider', () => ({
  useDemoPersonalize: () => ctx,
}))

import { StepChooseVideo } from '../StepChooseVideo'

const ELIGIBLE = DEMO_LIBRARY_REGISTRY.length
const LIBRARY_COUNTS = countDemosByCategory(
  DEMO_LIBRARY_REGISTRY.map((entry) => ({
    id: entry.legacyId,
    slug: entry.slug,
    title: entry.title,
    category: entry.category,
    rawCategory: entry.rawCategory,
    useCase: entry.useCase,
    duration: entry.durationSeconds,
    durationLabel: entry.durationLabel,
    aspectRatio: entry.aspectRatio,
    videoSrc: entry.videoSrc,
    posterSrc: entry.posterSrc,
    prompt: entry.prompt,
    studioTab: entry.studioTab,
    tags: entry.tags,
    sourceRepo: entry.sourceRepo,
  })),
)

/** Render the component and open the Demos tab. */
function renderDemos(): HTMLElement {
  const { container } = render(<StepChooseVideo />)
  fireEvent.click(screen.getByRole('tab', { name: /AI Demos/i }))
  return container
}

/** The "Showing X of Y" line. */
function galleryCount(): string {
  return screen.getByTestId('demo-gallery-count').textContent ?? ''
}

/** The number the gallery reports as the total of the current filter set. */
function galleryTotal(): number {
  const match = /of (\d+) demos?/.exec(galleryCount())
  return match ? Number(match[1]) : Number.NaN
}

/** The registry ids currently mounted as cards. */
function mountedDemoIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-demo-id]')).map(
    (node) => node.getAttribute('data-demo-id') ?? '',
  )
}

beforeEach(() => {
  ctx.previewVideo = null
  ctx.setPreviewVideo.mockClear()
  ctx.updatePreviewComposition.mockClear()
})

afterEach(() => {
  cleanup()
})

describe('Demos tab — the full eligible set', () => {
  it('reports the whole registry size, not a 12-item slice', () => {
    renderDemos()

    // The tab itself says how many demos are on offer.
    expect(screen.getByRole('tab', { name: /AI Demos/i }).textContent).toContain(String(ELIGIBLE))

    // And the gallery counts the whole matching set.
    expect(galleryTotal()).toBe(ELIGIBLE)
    expect(ELIGIBLE).toBeGreaterThan(12)
  })

  it('mounts only the first window of cards, not all of them', () => {
    const container = renderDemos()

    const mounted = mountedDemoIds(container)
    expect(mounted.length).toBeGreaterThan(0)
    expect(mounted.length).toBeLessThan(ELIGIBLE)
    expect(galleryCount()).toContain('Showing')
  })
})

describe('Demos tab — category tabs', () => {
  it('renders the niche categories that hold demos, with accurate counts', () => {
    renderDemos()

    const allTab = screen.getByTestId('demo-category-tab-all')
    expect(allTab.textContent).toContain(String(ELIGIBLE))

    // A niche with demos shows the count the taxonomy reports for it.
    const technology = screen.getByTestId('demo-category-tab-technology')
    expect(technology.textContent).toContain(String(LIBRARY_COUNTS.technology))
    expect(LIBRARY_COUNTS.technology).toBeGreaterThan(0)

    // "All Demos" comes first — inside the demo category tab list (the wizard
    // itself owns a second, separate tab list).
    const categoryTabs = within(
      screen.getByRole('tablist', { name: 'Demo categories' }),
    ).getAllByRole('tab')
    expect(categoryTabs[0].getAttribute('data-testid')).toBe('demo-category-tab-all')
  })

  it('omits a niche that holds no demo at all', () => {
    const emptyNiche = DEMO_CATEGORIES.find(
      (category) => category.id !== 'all' && (LIBRARY_COUNTS[category.id] ?? 0) === 0,
    )
    expect(emptyNiche).toBeDefined()

    renderDemos()

    expect(screen.queryByTestId(`demo-category-tab-${emptyNiche!.id}`)).toBeNull()
  })

  it('offers a sub-category control once a niche with sub-categories is active', () => {
    renderDemos()

    // "All Demos" spans every niche, so it has no sub-category dimension.
    expect(screen.queryByLabelText('Sub-category')).toBeNull()

    fireEvent.click(screen.getByTestId('demo-category-tab-beauty'))
    expect(screen.getByLabelText('Sub-category')).toBeTruthy()
  })
})

describe('Demos tab — search and filters', () => {
  it('narrows the set with the search box', () => {
    renderDemos()
    expect(galleryTotal()).toBe(ELIGIBLE)

    fireEvent.change(screen.getByLabelText('Search demos'), { target: { value: 'ramen' } })

    const narrowed = galleryTotal()
    expect(narrowed).toBeGreaterThan(0)
    expect(narrowed).toBeLessThan(ELIGIBLE)
  })

  it('narrows the set with the source filter', () => {
    renderDemos()

    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'seedance-1' } })

    const narrowed = galleryTotal()
    expect(narrowed).toBeGreaterThan(0)
    expect(narrowed).toBeLessThan(ELIGIBLE)
  })

  it('narrows the set with the style filter', () => {
    renderDemos()

    fireEvent.change(screen.getByLabelText('Style'), { target: { value: 'cinema' } })

    const narrowed = galleryTotal()
    expect(narrowed).toBeGreaterThan(0)
    expect(narrowed).toBeLessThan(ELIGIBLE)
  })

  it('narrows the set with the aspect-ratio filter', () => {
    renderDemos()

    fireEvent.change(screen.getByLabelText('Aspect ratio'), { target: { value: '9:16' } })

    const narrowed = galleryTotal()
    expect(narrowed).toBeGreaterThan(0)
    expect(narrowed).toBeLessThan(ELIGIBLE)
  })

  it('builds the filter options from the data, not from a hardcoded list', () => {
    renderDemos()

    const source = screen.getByLabelText('Source') as HTMLSelectElement
    const sourceValues = Array.from(source.options).map((option) => option.value)
    expect(sourceValues).toContain('all')
    for (const collection of ['minimax-h3', 'promptfeed', 'seedance-1', 'seedance-25']) {
      expect(sourceValues).toContain(collection)
    }

    const style = screen.getByLabelText('Style') as HTMLSelectElement
    const styleValues = Array.from(style.options).map((option) => option.value)
    expect(styleValues).toContain('all')
    expect(styleValues.length).toBeGreaterThan(1)

    const aspect = screen.getByLabelText('Aspect ratio') as HTMLSelectElement
    const aspectValues = Array.from(aspect.options).map((option) => option.value)
    expect(aspectValues).toContain('all')
    expect(aspectValues.length).toBeGreaterThan(1)
  })
})

describe('Demos tab — empty state', () => {
  it('shows the empty state instead of crashing when nothing matches', () => {
    const container = renderDemos()

    fireEvent.change(screen.getByLabelText('Search demos'), {
      target: { value: 'zzz-no-such-demo-anywhere-zzz' },
    })

    expect(screen.getByTestId('demo-empty-state')).toBeTruthy()
    expect(mountedDemoIds(container)).toHaveLength(0)
    expect(galleryTotal()).toBe(0)
  })

  it('restores the full set when the empty state is reset', () => {
    renderDemos()

    fireEvent.change(screen.getByLabelText('Search demos'), {
      target: { value: 'zzz-no-such-demo-anywhere-zzz' },
    })
    expect(screen.getByTestId('demo-empty-state')).toBeTruthy()

    fireEvent.click(screen.getByTestId('demo-empty-clear-filters'))

    expect(screen.queryByTestId('demo-empty-state')).toBeNull()
    expect(galleryTotal()).toBe(ELIGIBLE)
  })
})

describe('Demos tab — pagination', () => {
  it('reveals every registry id cumulatively, so no video is hidden', () => {
    const container = renderDemos()

    const perStep: string[][] = []
    for (let step = 0; step < 40; step += 1) {
      perStep.push(mountedDemoIds(container))

      const showMore = screen.queryByTestId('demo-show-more')
      if (!showMore) break
      fireEvent.click(showMore)
    }

    // Every step grew, and nothing that was already on screen disappeared.
    expect(perStep.length).toBeGreaterThan(1)
    for (let index = 1; index < perStep.length; index += 1) {
      expect(perStep[index].length).toBeGreaterThan(perStep[index - 1].length)
      for (const id of perStep[index - 1]) {
        expect(perStep[index]).toContain(id)
      }
    }

    // The last window holds every registered demo.
    const finalIds = new Set(perStep[perStep.length - 1])
    expect(finalIds.size).toBe(ELIGIBLE)
    for (const entry of DEMO_LIBRARY_REGISTRY) {
      expect(finalIds.has(entry.id)).toBe(true)
    }

    // The counter agrees: the whole library is on screen.
    expect(galleryCount()).toContain(`Showing ${ELIGIBLE} of ${ELIGIBLE}`)
  })
})

describe('Demos tab — card previews', () => {
  it('every unselected card autoplays its own silent clip over its poster', () => {
    const { container } = render(<StepChooseVideo />)
    fireEvent.click(screen.getByRole('tab', { name: /AI Demos/i }))

    const cards = [...container.querySelectorAll<HTMLElement>('[data-demo-id]')]
    expect(cards.length).toBeGreaterThan(0)
    for (const card of cards) {
      const entry = DEMO_LIBRARY_REGISTRY.find((e) => e.id === card.getAttribute('data-demo-id'))!
      if (card.getAttribute('aria-pressed') === 'true') continue
      const clip = card.querySelector('video[data-testid="card-preview-video"]') as HTMLVideoElement
      expect(clip, `card ${entry.id} must play a preview clip`).toBeTruthy()
      expect(clip.getAttribute('src')).toBe(entry.videoSrc)
      expect(clip.muted && clip.loop && clip.autoplay && clip.playsInline).toBe(true)
      expect(clip.controls).toBe(false)
      // The poster stays underneath as the loading / failure face.
      expect(card.querySelector('img')?.getAttribute('src')).toBe(entry.posterSrc)
    }
  })
})

describe('Demos tab — selection', () => {
  it('mounts a real <video> on the selected card and keeps it stable across filters', () => {
    const demo = DEMO_LIBRARY_REGISTRY[0]
    ctx.previewVideo = {
      url: demo.videoSrc,
      poster: demo.posterSrc,
      title: demo.title,
      kind: 'demo',
      demoId: demo.id,
    }

    const { container } = render(<StepChooseVideo />)
    fireEvent.click(screen.getByRole('tab', { name: /AI Demos/i }))

    const card = container.querySelector(`[data-demo-id="${demo.id}"]`) as HTMLElement
    expect(card).toBeTruthy()
    expect(card.querySelector('video[data-testid="demo-player"]')).toBeTruthy()
    expect(card.querySelector('img')).toBeNull()
    // Exactly one card in the whole grid carries a player.
    expect(container.querySelectorAll('video[data-testid="demo-player"]')).toHaveLength(1)

    // Changing a filter does not change the selection.
    fireEvent.change(screen.getByLabelText('Style'), { target: { value: 'commercial' } })
    const stillSelected = container.querySelector(`[data-demo-id="${demo.id}"]`) as HTMLElement | null
    if (stillSelected) {
      expect(stillSelected.getAttribute('aria-pressed')).toBe('true')
    }
  })

  it('records the picked demo by its stable source-qualified id', () => {
    const demo = DEMO_LIBRARY_REGISTRY[3]
    const { container } = render(<StepChooseVideo />)
    fireEvent.click(screen.getByRole('tab', { name: /AI Demos/i }))

    const card = container.querySelector(`[data-demo-id="${demo.id}"]`) as HTMLElement
    expect(card).toBeTruthy()
    fireEvent.click(card)

    expect(ctx.setPreviewVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        url: demo.videoSrc,
        poster: demo.posterSrc,
        title: demo.title,
        kind: 'demo',
        demoId: demo.id,
      }),
    )
    // The registry id is source-qualified, never the colliding numeric id.
    expect(demo.id).toContain(':')
  })
})
