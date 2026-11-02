// @vitest-environment jsdom
/**
 * Unit tests for the Motion Studio template browser surfaced in Step 2 of
 * the Easy Personalization Wizard.
 *
 * The browser is driven by a context-typed `useDemoPersonalize()` hook. We
 * mock the hook (not the provider) so the tests stay focused on the
 * browser's rendering, search, category filtering and selection behaviour
 * without spinning up the full personalization provider.
 *
 * Performance note: rendering 124 recipe cards is slow under jsdom (~4-5s
 * per render). The interaction tests therefore work with the *first* visible
 * card rather than asserting on the full grid, and the catalog totals are
 * verified against the module directly.
 */

import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  MOTION_CATEGORIES,
  MOTION_TEMPLATES,
  MOTION_TEMPLATE_CARDS,
  getMotionTemplate,
  getMotionTemplateByComponent,
  getMotionTemplateCardsByCategory,
  getMotionTemplateCardShot,
  normalizeCardCounts,
  searchMotionTemplateCards,
  searchMotionTemplates,
} from '@ohb/data/motionRecipeCatalog'
import type { MotionCategoryKey, MotionTemplate } from '@ohb/data/motionRecipeCatalog'

// The browser reads `motionTemplate` / `useMotionTemplate` / `launchMotionTemplate`
// from the provider hook. The mock keeps its selection in React state so firing
// the "Use this template" button actually re-renders the browser (the active
// card, the single player, …), and mirrors the template into `harness.template`
// so a test can preset the selection before rendering.
const harness = vi.hoisted(() => {
  const state: {
    template: MotionTemplate | null
    setTemplate: ((t: MotionTemplate | null) => void) | null
  } = { template: null, setTemplate: null }
  return state
})

const useMotionTemplateMock = vi.fn<(template: MotionTemplate) => void>()
const launchMotionTemplateMock = vi.fn<(template: MotionTemplate) => void>()

vi.mock('../../DemoPersonalizeProvider', () => ({
  useDemoPersonalize: () => {
    const [motionTemplate, setMotionTemplate] = useState<MotionTemplate | null>(harness.template)
    harness.setTemplate = setMotionTemplate
    return {
      motionTemplate,
      useMotionTemplate: (template: MotionTemplate) => {
        harness.template = template
        setMotionTemplate(template)
        useMotionTemplateMock(template)
      },
      launchMotionTemplate: (template: MotionTemplate) => {
        harness.template = template
        setMotionTemplate(template)
        launchMotionTemplateMock(template)
      },
    }
  },
}))

// Mock lucide-react icons to keep the test output (and snapshot diffs) small
// and stable. The browser doesn't depend on icon internals.
vi.mock('lucide-react', () => {
  const Stub = ({ size, color }: { size?: number; color?: string }) =>
    <svg data-testid="icon" data-size={size} data-color={color} />
  return {
    Image: Stub,
    Search: Stub,
    ChevronRight: Stub,
    Sparkles: Stub,
    Type: Stub,
    Camera: Stub,
    Layers: Stub,
    Sliders: Stub,
    BarChart3: Stub,
    Hand: Stub,
    ArrowRightLeft: Stub,
    Music: Stub,
    Sparkle: Stub,
    LogIn: Stub,
    ExternalLink: Stub,
    Check: Stub,
    Clock: Stub,
    Box: Stub,
    FileImage: Stub,
    MonitorPlay: Stub,
    ShoppingBag: Stub,
    MessageSquareQuote: Stub,
    Film: Stub,
    FolderOpen: Stub,
    Upload: Stub,
    Video: Stub,
  }
})

// jsdom does not implement media playback; the browser's `play()` catch guard
// tolerates the missing return value. Silence the "not implemented" noise so
// it does not pollute the test output.
beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn(function play(this: HTMLMediaElement) {
    return undefined
  }) as unknown as typeof window.HTMLMediaElement.prototype.play
  window.HTMLMediaElement.prototype.pause = vi.fn() as unknown as typeof window.HTMLMediaElement.prototype.pause
  window.HTMLMediaElement.prototype.load = vi.fn() as unknown as typeof window.HTMLMediaElement.prototype.load
})

// Simplest value-based render helper: the browser's provider hook is re-read on
// every render. Defined after the component import so the mock wiring above is
// fully in place first.
function renderBrowser() {
  return render(<TemplateBrowser />)
}

// Import AFTER mocks so the component picks up the stubbed hook.
import { TemplateBrowser } from '../TemplateBrowser'

describe('Motion Studio catalog', () => {
  it('exposes 150 shots, 124 recipe cards and 10 categories', () => {
    // Regression guard for the catalog contract: the catalog subagent must
    // keep these totals. A change that breaks the library scope lands here.
    expect(MOTION_TEMPLATES.length).toBe(150)
    expect(MOTION_TEMPLATE_CARDS.length).toBe(124)
    expect(MOTION_CATEGORIES.length).toBe(10)
  })

  it('recipe-card category counts are runtime-derived and sum to 124', () => {
    const counts = normalizeCardCounts()
    const sum = Object.values(counts).reduce((acc, n) => acc + n, 0)
    expect(sum).toBe(MOTION_TEMPLATE_CARDS.length)
    expect(sum).toBe(124)
    // The grid derives tab badges from these computed counts, never from a
    // stale declared number.
    expect(counts).toEqual({
      opening: 11,
      typography: 22,
      'ui-entrance': 21,
      camera: 10,
      data: 5,
      interaction: 11,
      transition: 15,
      rhythm: 8,
      effects: 15,
      outro: 6,
    })
  })

  it('per-category shot counts sum to 150 and match the declared categories', () => {
    const byCategory: Record<string, number> = {}
    for (const template of MOTION_TEMPLATES) {
      byCategory[template.category] = (byCategory[template.category] ?? 0) + 1
    }
    for (const category of MOTION_CATEGORIES) {
      expect(byCategory[category.key]).toBe(category.count)
    }
  })

  it('catalog accessors return canonical entries', () => {
    const first = MOTION_TEMPLATES[0]
    expect(getMotionTemplate(first.id)?.id).toBe(first.id)
    expect(getMotionTemplateByComponent(first.componentName)?.componentName).toBe(first.componentName)
  })

  it('getMotionTemplateCardShot resolves a card to its representative shot', () => {
    for (const card of MOTION_TEMPLATE_CARDS) {
      const shot = getMotionTemplateCardShot(card)
      expect(shot, card.id).toBeTruthy()
      expect(shot!.id.startsWith(`${card.id}/`), card.id).toBe(true)
      const matchingPreview = MOTION_TEMPLATES.some(
        (t) => t.id.startsWith(`${card.id}/`) && t.preview === card.preview,
      )
      if (matchingPreview) {
        // Rule 1: the shot whose clip matches the card's own preview.
        expect(shot!.preview, card.id).toBe(card.preview)
      } else {
        // Rule 2 fallback (e.g. shot-transitions · flash-cut): the shot with
        // the card's componentName.
        expect(shot!.componentName, card.id).toBe(card.componentName)
      }
    }
  })

  it('cards keep a stable deterministic ordering for e2e picks', () => {
    expect(MOTION_TEMPLATE_CARDS[0]?.id).toBe('camera/basic-3d-scene')
    expect(MOTION_TEMPLATE_CARDS[1]?.id).toBe('camera/crash-zoom-punch')
  })

  it('searchMotionTemplateCards is case-insensitive and matches nameEn, slug, summary and component', () => {
    const crash = searchMotionTemplateCards('CRASH')
    expect(crash.length).toBeGreaterThan(0)
    for (const card of crash) {
      const haystack =
        `${card.name} ${card.nameEn} ${card.summary} ${card.summaryEn} ${card.slug} ${card.componentName}`.toLowerCase()
      expect(haystack).toContain('crash')
    }
  })

  it('searchMotionTemplates stays available for shot-level consumers', () => {
    const crash = searchMotionTemplates('CRASH')
    expect(crash.length).toBeGreaterThan(0)
    for (const t of crash) {
      const haystack =
        `${t.name} ${t.nameEn} ${t.categoryLabel} ${t.summary} ${t.summaryEn} ${t.slug}`.toLowerCase()
      expect(haystack).toContain('crash')
    }
  })

  it('every template has a unique id and componentName', () => {
    const ids = new Set([...MOTION_TEMPLATES, ...MOTION_TEMPLATE_CARDS].map((t) => t.id))
    expect(ids.size).toBe(MOTION_TEMPLATES.length + MOTION_TEMPLATE_CARDS.length)
    const components = new Set(MOTION_TEMPLATES.map((t) => t.componentName))
    expect(components.size).toBe(MOTION_TEMPLATES.length)
  })

  it('every template declares its asset-insertion matrix as a complete object', () => {
    // The browser renders asset badges from `template.assets`; a missing
    // key would silently drop the badge for that asset kind.
    const required: Array<keyof MotionTemplate['assets']> = ['logo', 'image', 'screenshot', 'product', 'text', 'cta']
    for (const template of [...MOTION_TEMPLATES, ...MOTION_TEMPLATE_CARDS]) {
      for (const key of required) {
        expect(typeof template.assets[key]).toBe('boolean')
      }
    }
  })
})

describe('TemplateBrowser (recipe-card grid)', () => {
  beforeEach(() => {
    useMotionTemplateMock.mockClear()
    launchMotionTemplateMock.mockClear()
    harness.template = null
    harness.setTemplate = null
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders all 10 Motion Studio categories as tabs', () => {
    renderBrowser()
    const tabs = screen.getAllByRole('tab')
    // 10 category tabs + 1 "All" tab
    expect(tabs.length).toBe(MOTION_CATEGORIES.length + 1)
  })

  it('category tabs carry runtime-derived card counts, not shot counts', () => {
    renderBrowser()
    // The browser renders tabs with short English labels (Camera, Opening,
    // …) defined in `CATEGORY_LABELS_EN`. The count badge mirrors the
    // per-category CARD count (e.g. camera: 10 cards, not 14 shots).
    const counts = normalizeCardCounts()
    const TAB_LABELS: Record<MotionCategoryKey, string> = {
      opening: 'Opening',
      typography: 'Typography',
      'ui-entrance': 'UI Entrance',
      camera: 'Camera',
      data: 'Data',
      interaction: 'Interaction',
      transition: 'Transitions',
      rhythm: 'Rhythm',
      effects: 'Effects',
      outro: 'Outro',
    }
    for (const category of MOTION_CATEGORIES) {
      expect(screen.getAllByText(TAB_LABELS[category.key]).length).toBeGreaterThan(0)
      expect(screen.getAllByText(String(counts[category.key])).length).toBeGreaterThan(0)
    }
  })

  it('shows the "All" tab active by default and renders all 124 recipe cards', () => {
    const { container } = renderBrowser()
    const cards = container.querySelectorAll('[data-testid="motion-template-card"]')
    expect(cards.length).toBe(124)
    const allTab = screen.getAllByRole('tab').find((node) => node.textContent?.includes('All'))
    expect(allTab?.getAttribute('aria-selected')).toBe('true')
  })

  it('the header badges report 124 recipe cards / 150 preview clips / 10 categories', () => {
    renderBrowser()
    expect(screen.getAllByText(/124 recipe cards/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/150 preview clips/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/10 categories/i).length).toBeGreaterThan(0)
    // The stale "150 shots" badge must be gone.
    expect(screen.queryByText(/150 shots/i)).toBeNull()
    // And the grid summary reads the same honest count.
    expect(screen.getAllByText(/All 124 recipe cards/i).length).toBeGreaterThan(0)
  })

  it('clicking a category tab narrows the visible cards to that category', () => {
    const { container } = renderBrowser()
    const category: MotionCategoryKey = 'camera'
    // The browser renders tabs with short English labels (e.g. "Camera").
    const tab = screen.getAllByRole('tab').find((node) => node.textContent?.includes('Camera'))
    expect(tab).toBeTruthy()
    fireEvent.click(tab!)
    const expected = getMotionTemplateCardsByCategory(category)
    expect(expected.length).toBe(10)
    const cards = container.querySelectorAll('[data-testid="motion-template-card"]')
    expect(cards.length).toBe(expected.length)
    for (const card of cards) {
      const templateId = card.getAttribute('data-template-id') ?? ''
      expect(templateId.startsWith('camera/')).toBe(true)
    }
  })

  it('search box filters the card grid by name/slug/summary/component', () => {
    const { container } = renderBrowser()
    const input = screen.getByPlaceholderText(/search by name/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'crash' } })
    const expected = searchMotionTemplateCards('crash')
    const cards = container.querySelectorAll('[data-testid="motion-template-card"]')
    expect(cards.length).toBe(expected.length)
    expect(expected.length).toBeGreaterThan(0)
  })

  it('shows an empty state when search yields no results', () => {
    renderBrowser()
    const input = screen.getByPlaceholderText(/search by name/i)
    fireEvent.change(input, { target: { value: 'zzzzzz-no-match' } })
    expect(screen.queryAllByTestId('motion-template-card').length).toBe(0)
    expect(screen.getByText(/no motion studio recipes match/i)).toBeTruthy()
  })

  it('calls the provider with the card\'s representative shot on "Use this template"', () => {
    renderBrowser()
    const firstCard = MOTION_TEMPLATE_CARDS[0]
    const useButtons = screen.getAllByTestId('motion-template-use')
    expect(useButtons.length).toBe(124)
    fireEvent.click(useButtons[0])
    expect(useMotionTemplateMock).toHaveBeenCalledTimes(1)
    const called = useMotionTemplateMock.mock.calls[0][0] as MotionTemplate
    // The pipeline identity must be the representative SHOT, not the card —
    // the provider persists `template.id` and restores it through the shot
    // lookup, so the id has to resolve there.
    expect(called.id.startsWith(`${firstCard.id}/`)).toBe(true)
    expect(getMotionTemplate(called.id)?.id).toBe(called.id)
    expect(called.componentName).toBeTruthy()
    expect(called.preview).toBe(firstCard.preview)
  })

  it('calls launchMotionTemplate with the representative shot on "Motion Studio"', () => {
    renderBrowser()
    const firstButton = screen.getAllByTestId('motion-template-launch')[0]
    expect(firstButton).toBeTruthy()
    fireEvent.click(firstButton)
    expect(launchMotionTemplateMock).toHaveBeenCalledTimes(1)
    const called = launchMotionTemplateMock.mock.calls[0][0] as MotionTemplate
    expect(called.id.startsWith(`${MOTION_TEMPLATE_CARDS[0].id}/`)).toBe(true)
  })

  it('every unselected recipe card autoplays its own silent clip', () => {
    const { container } = renderBrowser()
    const cards = [...container.querySelectorAll<HTMLElement>('[data-testid="motion-template-card"]')]
    expect(cards.length).toBe(124)
    for (const card of cards) {
      const id = card.getAttribute('data-template-id')!
      const template = MOTION_TEMPLATE_CARDS.find((t) => t.id === id)!
      if (!template.preview) continue
      const clip = card.querySelector('video[data-testid="card-preview-video"]') as HTMLVideoElement
      expect(clip, `card ${id} must play a preview clip`).toBeTruthy()
      expect(clip.getAttribute('src')).toBe(template.preview)
      expect(clip.muted && clip.loop && clip.autoplay && clip.playsInline).toBe(true)
      expect(clip.controls).toBe(false)
    }
  })

  it('marks the currently-selected template card as active and mounts its player', () => {
    // Select via the shot the provider would get: CrashImpactReal belongs to
    // the camera/crash-zoom-punch card.
    harness.template = getMotionTemplateByComponent('CrashImpactReal') ?? null
    const { container } = renderBrowser()
    const cardId = 'camera/crash-zoom-punch'
    const active = container.querySelector(`[data-testid="motion-template-card"][data-template-id="${cardId}"]`)
    expect(active).toBeTruthy()
    // The active card carries the "Selected" badge text.
    expect(active!.textContent).toMatch(/selected/i)
    // And it is the only card hosting the <video> player.
    const players = container.querySelectorAll('[data-testid="motion-template-player"]')
    expect(players.length).toBe(1)
    expect(players[0].getAttribute('data-template-id')).toBe(cardId)
  })

  it('an errored clip falls back to the poster with a Retry that re-mounts the player', () => {
    const { container } = renderBrowser()
    const useButton = screen.getAllByTestId('motion-template-use')[0]
    fireEvent.click(useButton)

    const player = container.querySelector('[data-testid="motion-template-player"]')
    expect(player).toBeTruthy()

    fireEvent.error(player!)

    // Fallback: the poster is shown again with the inline message + Retry,
    // and the <video> is gone.
    expect(container.querySelector('[data-testid="motion-template-player"]')).toBeNull()
    expect(container.querySelector('[data-testid="motion-template-player-fallback"]')).toBeTruthy()
    expect(screen.getByText(/preview unavailable — try another clip/i)).toBeTruthy()
    const retryButtons = screen.getAllByTestId('motion-template-retry')
    expect(retryButtons.length).toBe(1)

    // Retry re-mounts the player (same src, fresh element).
    fireEvent.click(retryButtons[0])
    const remounted = container.querySelector('[data-testid="motion-template-player"]')
    expect(remounted).toBeTruthy()
  })

  it('a slow clip shows a non-blocking "Still loading…" hint that can be retried', () => {
    vi.useFakeTimers()
    const { container } = renderBrowser()
    const useButton = screen.getAllByTestId('motion-template-use')[0]
    fireEvent.click(useButton)

    const player = container.querySelector('[data-testid="motion-template-player"]')
    expect(player).toBeTruthy()

    // jsdom never fires metadata events, so readyState stays 0: past the
    // grace period the hint must appear without the player being unmounted.
    act(() => {
      vi.advanceTimersByTime(8100)
    })
    expect(container.querySelector('[data-testid="motion-template-player"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="motion-template-loading-slow"]')).toBeTruthy()
    expect(screen.getAllByTestId('motion-template-retry').length).toBe(1)

    // Retrying from the hint re-mounts the player element.
    const retryButton = screen.getAllByTestId('motion-template-retry')[0]
    act(() => {
      fireEvent.click(retryButton)
    })
    expect(container.querySelector('[data-testid="motion-template-player"]')).toBeTruthy()
  })
})
