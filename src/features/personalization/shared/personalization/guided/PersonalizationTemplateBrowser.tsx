'use client'

/**
 * PersonalizationTemplateBrowser — the step 4 gallery of every Remotion
 * template the customer can put on their video.
 *
 * Two kinds of template share one grid:
 *  - **layouts** (`PREVIEW_LAYOUTS`): hand-built arrangements of the built-in
 *    logo / text / image layers;
 *  - **designs** (the Remotion design registry): the upstream Remotion
 *    templates — animated headlines, logo reveals, lower thirds, CTAs,
 *    effects, transitions, charts and full-scene intros.
 *
 * Every card renders a live Remotion preview of that template applied to the
 * customer's selected video and branding. Browser-only: never makes a paid
 * call.
 */

import { useMemo, useState, useCallback, useId, useRef, useEffect } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Search,
  Sparkles,
  Type as TypeIcon,
  Layers,
  Check,
  ArrowRightLeft,
  BarChart3,
  Clapperboard,
  Megaphone,
  PanelBottom,
  BadgeCheck,
  Wand2,
  LayoutTemplate,
  ChevronRight,
} from 'lucide-react'
import { Player } from '@remotion/player'
import type { PlayerRef } from '@remotion/player'
import {
  PREVIEW_LAYOUTS,
  LAYER_IDS_BY_LAYOUT,
  applyDesignTemplate,
  applyLayoutPreset,
} from '../preview/presets'
import type { ApplyLayoutContext } from '../preview/presets'
import { PersonalizationComposition } from '../preview/PersonalizationComposition'
import type { PreviewInputProps, PreviewLayoutId, PreviewLayerKind } from '../preview/types'
import {
  isRemotionDesignTemplateSupported,
  type RemotionDesignCategory,
  type RemotionDesignTemplate,
} from '../templates'
import { buildPreviewInput } from './buildPreviewInput'
import { C, badgeStyle, hintStyle, inputStyle, panelStyle, primaryButtonStyle, tileStyle } from './tokens'
import { useDemoPersonalize } from '../DemoPersonalizeProvider'

/** Gallery tab keys: all, the built-in layouts, then one per design category. */
export type PersonalizationCategoryKey = 'layouts' | RemotionDesignCategory

type IconComponent = LucideIcon

/** Tabs in display order. Tabs with no templates are hidden. */
const CATEGORIES: Array<{ key: PersonalizationCategoryKey; label: string; icon: IconComponent }> = [
  { key: 'layouts', label: 'Layouts', icon: LayoutTemplate },
  { key: 'animated-headline', label: 'Headlines', icon: TypeIcon },
  { key: 'logo-reveal', label: 'Logo reveals', icon: BadgeCheck },
  { key: 'lower-third', label: 'Lower thirds', icon: PanelBottom },
  { key: 'promo-cta', label: 'Calls to action', icon: Megaphone },
  { key: 'visual-effect', label: 'Effects', icon: Wand2 },
  { key: 'transition', label: 'Transitions', icon: ArrowRightLeft },
  { key: 'data-visualization', label: 'Charts & data', icon: BarChart3 },
  { key: 'full-scene', label: 'Full scenes', icon: Clapperboard },
  { key: 'other', label: 'Other', icon: Layers },
]

/** How many cards are rendered before "Show more". */
const PAGE_SIZE = 24

/** Layer kind → short label for badges. */
const LAYER_BADGE_LABELS: Record<PreviewLayerKind, string> = {
  logo: 'Logo',
  businessName: 'Business name',
  headline: 'Headline',
  offer: 'Offer',
  cta: 'CTA',
  productImage: 'Product image',
  serviceImage: 'Service image',
  tagline: 'Tagline',
  endCard: 'End card',
  design: 'Design',
}

const TEXT_FIELD_LABELS: Record<string, string> = {
  businessName: 'Business name',
  headline: 'Headline',
  offer: 'Offer',
  cta: 'CTA',
  phone: 'Phone',
  website: 'Website',
}

function categoryLabel(key: PersonalizationCategoryKey): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? 'Other'
}

/** One card in the gallery. */
type GalleryItem =
  | { kind: 'layout'; id: PreviewLayoutId; name: string; description: string; category: 'layouts' }
  | {
      kind: 'design'
      id: string
      name: string
      description: string
      category: RemotionDesignCategory
      design: RemotionDesignTemplate
    }

function buildItems(designs: RemotionDesignTemplate[]): GalleryItem[] {
  const layouts: GalleryItem[] = PREVIEW_LAYOUTS.map((layout) => ({
    kind: 'layout' as const,
    id: layout.id,
    name: layout.name,
    description: layout.description,
    category: 'layouts' as const,
  }))
  const designItems: GalleryItem[] = designs.map((design) => ({
    kind: 'design' as const,
    id: design.id,
    name: design.name,
    description: design.description,
    category: CATEGORIES.some((c) => c.key === design.category) ? design.category : 'other',
    design,
  }))
  return [...layouts, ...designItems]
}

/** Brand context for previews; sample copy keeps empty cards readable. */
function previewBrandContext(baseInput: PreviewInputProps): ApplyLayoutContext {
  const { brand } = baseInput
  return {
    businessName: brand.businessName || 'Your Business',
    headline: brand.headline || brand.businessName || 'Your headline here',
    offer: brand.offer || '20% off this week',
    cta: brand.cta || 'Book now',
    tagline: brand.businessName || 'Your Business',
    phone: brand.phone || '(555) 123-4567',
    website: brand.website || 'yourbusiness.com',
    logoUrl: brand.logoUrl ?? undefined,
    productUrl: brand.productUrl ?? undefined,
    serviceUrl: brand.serviceUrl ?? undefined,
  }
}

/** The frame a paused card rests on: after the template has animated in. */
function restFrameFor(item: GalleryItem, durationInFrames: number, fps: number): number {
  let frame = Math.round(fps * 1.5)
  if (item.kind === 'design') {
    const end = item.design.placement?.endFrame
    const anim = item.design.animation
    if (typeof end === 'number' && end > 0) {
      frame = Math.round(end * 0.55)
    } else if (anim) {
      frame = Math.round((anim.delayInFrames + anim.durationInFrames) * 0.7)
    }
  }
  // Never rest on the closing frames: the composition's end card plays there,
  // so a long design would otherwise show the end card instead of itself.
  const latest = Math.max(0, Math.round(durationInFrames * 0.6))
  return Math.max(0, Math.min(latest, frame))
}

/** Placeholder tile showing the layer arrangement as colored dots. */
function TemplateLayerPreview({ layoutId }: { layoutId: PreviewLayoutId }): React.JSX.Element {
  const kinds = LAYER_IDS_BY_LAYOUT[layoutId] ?? []
  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '16 / 9',
        borderRadius: 8,
        background: 'linear-gradient(135deg, #101010, #141414)',
        border: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        flexWrap: 'wrap',
      }}
    >
      {kinds.map((kind) => (
        <span key={kind} style={{ ...badgeStyle('muted'), fontSize: 8 }}>
          {LAYER_BADGE_LABELS[kind]}
        </span>
      ))}
    </div>
  )
}

/** Props for the template browser. */
export interface PersonalizationTemplateBrowserProps {
  /** When a layout is selected. Defaults to the provider's `setPreviewLayout`. */
  onSelect?: (layoutId: PreviewLayoutId) => void
  /** When a Remotion design is selected. Defaults to the provider's `setRemotionDesign`. */
  onSelectDesign?: (designId: string) => void
}

/** Categorized gallery of every layout and Remotion design template. */
export function PersonalizationTemplateBrowser({
  onSelect,
  onSelectDesign,
}: PersonalizationTemplateBrowserProps): React.JSX.Element {
  const ctx = useDemoPersonalize()
  const {
    previewSettings,
    setPreviewLayout,
    source,
    previewVideo,
    clientForm,
    assets,
    remotionDesignTemplates = [],
    activeRemotionDesignId = null,
    setRemotionDesign,
    remotionDesignError = null,
  } = ctx
  const [activeCategory, setActiveCategory] = useState<PersonalizationCategoryKey | 'all'>('all')
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const searchId = useId()

  const baseInput = useMemo<PreviewInputProps | null>(
    () =>
      previewSettings
        ? buildPreviewInput({ source, previewSettings, previewVideo, clientForm: clientForm ?? {}, assets })
        : null,
    [source, previewSettings, previewVideo, clientForm, assets],
  )

  const handleSelect = useCallback(
    (item: GalleryItem) => {
      if (item.kind === 'layout') {
        if (onSelect) onSelect(item.id)
        else setPreviewLayout(item.id)
      } else if (onSelectDesign) {
        onSelectDesign(item.id)
      } else {
        setRemotionDesign?.(item.id)
      }
    },
    [onSelect, onSelectDesign, setPreviewLayout, setRemotionDesign],
  )

  const items = useMemo(() => buildItems(remotionDesignTemplates), [remotionDesignTemplates])

  const counts = useMemo(() => {
    const map = new Map<PersonalizationCategoryKey, number>()
    for (const item of items) map.set(item.category, (map.get(item.category) ?? 0) + 1)
    return map
  }, [items])

  /** Visible items, filtered by category and search. */
  const visible = useMemo<GalleryItem[]>(() => {
    const trimmed = query.trim().toLowerCase()
    return items.filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) return false
      if (!trimmed) return true
      const haystack = `${item.name} ${item.description} ${categoryLabel(item.category)}`.toLowerCase()
      return haystack.includes(trimmed)
    })
  }, [items, query, activeCategory])

  // A new filter starts from the first page again.
  useEffect(() => setVisibleCount(PAGE_SIZE), [query, activeCategory])

  const totalCount = items.length
  const shown = visible.slice(0, visibleCount)

  const isActive = (item: GalleryItem): boolean =>
    item.kind === 'design'
      ? activeRemotionDesignId === item.id
      : !activeRemotionDesignId && previewSettings.layout === item.id

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── Header + search ──────────────────────────────────────────────── */}
      <div style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <Sparkles size={15} color={C.cyan} />
          <h3
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '.04em',
              color: C.text,
            }}
          >
            Video templates
          </h3>
          <span style={badgeStyle('muted')}>{totalCount} templates</span>
          <span style={badgeStyle('cyan')}>{counts.size} categories</span>
        </div>
        <label
          htmlFor={searchId}
          style={{
            display: 'block',
            color: C.muted,
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '.04em',
            marginBottom: 4,
          }}
        >
          Search templates
        </label>
        <div style={{ position: 'relative' }}>
          <Search
            size={14}
            color={C.muted}
            style={{ position: 'absolute', top: '50%', left: 11, transform: 'translateY(-50%)' }}
          />
          <input
            id={searchId}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or category — e.g. logo, chart, transition…"
            style={{ ...inputStyle, paddingLeft: 32 }}
          />
        </div>
        <p style={hintStyle}>
          Every template previews on your video with your branding. Pick one, then edit any text, colour or
          layer in the next step.
        </p>
      </div>

      {/* ── Category tabs ────────────────────────────────────────────────── */}
      <div style={panelStyle}>
        <div role="tablist" aria-label="Template categories" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <CategoryTab
            label="All"
            icon={Sparkles}
            active={activeCategory === 'all'}
            count={totalCount}
            onClick={() => setActiveCategory('all')}
          />
          {CATEGORIES.filter((category) => (counts.get(category.key) ?? 0) > 0).map((category) => (
            <CategoryTab
              key={category.key}
              label={category.label}
              icon={category.icon}
              active={activeCategory === category.key}
              count={counts.get(category.key) ?? 0}
              onClick={() => setActiveCategory(category.key)}
            />
          ))}
        </div>
      </div>

      {/* ── Grid ────────────────────────────────────────────────────────── */}
      <div style={panelStyle}>
        {remotionDesignError ? (
          <p style={{ ...hintStyle, color: C.danger, marginTop: 0 }}>{remotionDesignError}</p>
        ) : null}
        {visible.length === 0 ? (
          <p style={hintStyle}>No templates match that search. Try a different query or category.</p>
        ) : (
          <>
            <p style={{ ...hintStyle, marginTop: 0, marginBottom: 10 }}>
              {visible.length === totalCount
                ? `All ${totalCount} templates.`
                : `Showing ${visible.length} of ${totalCount} templates.`}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3" style={{ gap: 10 }}>
              {shown.map((item) => (
                <TemplateCard
                  key={`${item.kind}:${item.id}`}
                  item={item}
                  active={isActive(item)}
                  onSelect={handleSelect}
                  baseInput={baseInput}
                />
              ))}
            </div>
            {visible.length > shown.length ? (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                <button
                  type="button"
                  data-testid="personalization-template-show-more"
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                  style={{
                    minHeight: 36,
                    padding: '0 16px',
                    borderRadius: 999,
                    border: `1px solid ${C.cyanBorder}`,
                    background: C.cyanSoft,
                    color: C.cyan,
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Show more ({visible.length - shown.length} left)
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

/** Single category tab. */
function CategoryTab({
  label,
  icon: Icon,
  active,
  count,
  onClick,
}: {
  label: string
  icon: IconComponent
  active: boolean
  count: number
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        minHeight: 32,
        padding: '0 12px',
        borderRadius: 999,
        border: `1px solid ${active ? C.cyanBorder : C.border}`,
        background: active ? C.cyanSoft : 'transparent',
        color: active ? C.cyan : C.muted,
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      <Icon size={12} color={active ? C.cyan : C.muted} />
      {label}
      <span style={{ ...badgeStyle(active ? 'cyan' : 'muted'), marginLeft: 2 }}>{count}</span>
    </button>
  )
}

/** Single template card. */
function TemplateCard({
  item,
  active,
  onSelect,
  baseInput,
}: {
  item: GalleryItem
  active: boolean
  onSelect: (item: GalleryItem) => void
  /** The customer's current preview input; the card re-applies its template to it. */
  baseInput: PreviewInputProps | null
}): React.JSX.Element {
  const [hovering, setHovering] = useState(false)

  const inputProps = useMemo<PreviewInputProps | null>(() => {
    if (!baseInput) return null
    const brandCtx = previewBrandContext(baseInput)
    const settings =
      item.kind === 'layout'
        ? applyLayoutPreset(baseInput.settings, item.id, brandCtx)
        : applyDesignTemplate(baseInput.settings, item.id, brandCtx)
    return { ...baseInput, settings }
  }, [baseInput, item])

  const support =
    item.kind === 'design' && baseInput
      ? isRemotionDesignTemplateSupported(item.id, baseInput.settings.aspectRatio)
      : { supported: true as const }

  const chips: string[] =
    item.kind === 'layout'
      ? (LAYER_IDS_BY_LAYOUT[item.id] ?? []).map((kind) => LAYER_BADGE_LABELS[kind])
      : [
          ...(item.design.textSlots ?? []).map((slot) => slot.label || TEXT_FIELD_LABELS[slot.field] || slot.key),
          ...(item.design.media ?? []).map((binding) => binding.label || binding.role),
        ].slice(0, 5)

  const select = () => {
    if (support.supported) onSelect(item)
  }

  return (
    <div
      data-testid="personalization-template-card"
      data-template-id={item.id}
      data-template-kind={item.kind}
      role="button"
      tabIndex={0}
      aria-pressed={active}
      aria-disabled={!support.supported}
      aria-label={`Select ${item.name} template`}
      onClick={select}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          select()
        }
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        ...tileStyle(active),
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        cursor: support.supported ? 'pointer' : 'not-allowed',
        userSelect: 'none',
        opacity: support.supported ? 1 : 0.55,
        borderColor: hovering || active ? C.cyanBorder : C.border,
      }}
    >
      {inputProps ? (
        <TemplateLivePreview item={item} inputProps={inputProps} playing={active || hovering} />
      ) : item.kind === 'layout' ? (
        <TemplateLayerPreview layoutId={item.id} />
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={badgeStyle('cyan')}>{categoryLabel(item.category)}</span>
        {active && (
          <span style={badgeStyle('green')}>
            <Check size={9} /> Selected
          </span>
        )}
      </div>

      <div style={{ color: C.text, fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{item.name}</div>
      <p style={{ ...hintStyle, margin: 0 }}>{item.description}</p>

      {chips.length > 0 && (
        <div aria-label="Personalized fields" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {chips.map((chip) => (
            <span
              key={chip}
              style={{
                padding: '2px 6px',
                borderRadius: 6,
                border: `1px solid ${C.border}`,
                background: 'rgba(255,255,255,.03)',
                color: C.muted,
                fontSize: 8,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '.04em',
              }}
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        data-testid="personalization-template-use"
        disabled={!support.supported}
        title={support.supported ? undefined : support.reason}
        onClick={(event) => {
          event.stopPropagation()
          select()
        }}
        style={{
          ...primaryButtonStyle,
          flex: 1,
          minHeight: 36,
          fontSize: 11,
          padding: '0 12px',
          opacity: support.supported ? 1 : 0.6,
          cursor: support.supported ? 'pointer' : 'not-allowed',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {support.supported ? (
            <>
              Use this template <ChevronRight size={12} />
            </>
          ) : (
            'Not available for this video shape'
          )}
        </span>
      </button>
    </div>
  )
}

/**
 * Live Remotion preview for a template card.
 *
 * Renders the real `PersonalizationComposition` — the customer's selected
 * video with this template applied — so each card shows exactly what the
 * template will look like. The Player only exists while the card is near the
 * viewport (it unmounts again when scrolled away, so a long gallery never
 * holds dozens of decoders), and it only plays while the card is selected or
 * hovered.
 */
function TemplateLivePreview({
  item,
  inputProps,
  playing,
}: {
  item: GalleryItem
  inputProps: PreviewInputProps
  playing: boolean
}): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<PlayerRef>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => setInView(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: '300px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    try {
      if (playing) player.play()
      else player.pause()
    } catch {
      // Autoplay policies can reject play(); the still frame stays visible.
    }
  }, [playing, inView])

  const settings = inputProps.settings
  const durationInFrames = Math.max(1, Math.round(settings.durationInFrames))
  const restFrame = restFrameFor(item, durationInFrames, settings.fps)
  const PreviewComposition = PersonalizationComposition as unknown as React.ComponentType<Record<string, unknown>>

  return (
    <div
      ref={containerRef}
      data-testid="personalization-template-player"
      style={{
        width: '100%',
        aspectRatio: `${settings.width} / ${settings.height}`,
        maxHeight: 360,
        borderRadius: 8,
        overflow: 'hidden',
        background: '#000',
        // Clicks select the card; the preview itself is not interactive.
        pointerEvents: 'none',
      }}
    >
      {inView ? (
        <Player
          ref={playerRef}
          component={PreviewComposition}
          inputProps={inputProps as unknown as Record<string, unknown>}
          durationInFrames={durationInFrames}
          compositionWidth={settings.width}
          compositionHeight={settings.height}
          fps={settings.fps}
          initialFrame={restFrame}
          loop
          controls={false}
          clickToPlay={false}
          initiallyMuted
          autoPlay={playing}
          acknowledgeRemotionLicense
          style={{ width: '100%', height: '100%' }}
        />
      ) : null}
    </div>
  )
}
