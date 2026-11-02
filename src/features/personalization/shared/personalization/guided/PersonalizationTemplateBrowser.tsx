'use client'

/**
 * PersonalizationTemplateBrowser — categorized gallery of video layout
 * templates for Step 3 of the Easy Personalization Wizard.
 *
 * Mirrors the Motion Studio TemplateBrowser pattern: category tabs, search,
 * and a responsive grid of selectable cards. Clicking a card calls
 * `onSelect(layoutId)` which applies the layout preset to the wizard's
 * preview settings. Browser-only: never makes a paid call.
 */

import {
  useMemo,
  useState,
  useCallback,
  useId,
  useRef,
  useEffect,
  type CSSProperties,
  type ReactElement,
} from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Search,
  Sparkles,
  Type as TypeIcon,
  Image as ImageIcon,
  Layers,
  Clock,
  Check,
  ArrowRightLeft,
  Music,
  Sparkle,
  LogIn,
  Camera,
  Box,
  ChevronRight,
} from 'lucide-react'
import { PREVIEW_LAYOUTS } from '../preview/presets'
import { LAYER_IDS_BY_LAYOUT } from '../preview/presets'
import type { PreviewLayoutId, PreviewLayerKind } from '../preview/types'
import { C, badgeStyle, hintStyle, inputStyle, panelStyle, primaryButtonStyle, softPanelStyle, tileStyle } from './tokens'
import { useDemoPersonalize } from '../DemoPersonalizeProvider'

/** Category keys for personalization layouts. */
export type PersonalizationCategoryKey =
  | 'introduction'
  | 'product'
  | 'service'
  | 'offer'
  | 'team'
  | 'transformation'
  | 'ending'

type IconComponent = LucideIcon

/** Map each layout ID to its category key. */
const LAYOUT_CATEGORY: Record<string, PersonalizationCategoryKey> = {
  'business-introduction': 'introduction',
  'product-showcase': 'product',
  'menu-item-highlight': 'product',
  'service-promotion': 'service',
  'customer-testimonial': 'service',
  'special-offer': 'offer',
  'event-promotion': 'offer',
  'team-member-intro': 'team',
  'before-after-transformation': 'transformation',
  'branded-ending': 'ending',
}

/** Category definitions with icons and labels. */
const CATEGORIES: Array<{ key: PersonalizationCategoryKey; label: string; icon: IconComponent }> = [
  { key: 'introduction', label: 'Introduction', icon: Sparkles },
  { key: 'product', label: 'Product', icon: ImageIcon },
  { key: 'service', label: 'Service', icon: Layers },
  { key: 'offer', label: 'Offer', icon: ArrowRightLeft },
  { key: 'team', label: 'Team', icon: Camera },
  { key: 'transformation', label: 'Transformation', icon: ArrowRightLeft },
  { key: 'ending', label: 'Ending', icon: LogIn },
]

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

function layoutCategoryKey(layoutId: PreviewLayoutId): PersonalizationCategoryKey {
  return LAYOUT_CATEGORY[layoutId] ?? 'introduction'
}

function categoryCount(key: PersonalizationCategoryKey): number {
  return PREVIEW_LAYOUTS.filter((l) => layoutCategoryKey(l.id) === key).length
}

function resolveIcon(key: PersonalizationCategoryKey): IconComponent {
  return CATEGORIES.find((c) => c.key === key)?.icon ?? Box
}

function resolveLabel(key: PersonalizationCategoryKey): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key
}

/** Preview video clip for each layout. Every template has a published MP4. */
const PREVIEW_VIDEO_URLS: Record<string, string | null> = {
  'business-introduction': '/media/personalization-templates/business-introduction.mp4',
  'product-showcase': '/media/personalization-templates/product-showcase.mp4',
  'service-promotion': '/media/personalization-templates/service-promotion.mp4',
  'special-offer': '/media/personalization-templates/special-offer.mp4',
  'branded-ending': '/media/personalization-templates/branded-ending.mp4',
  'customer-testimonial': '/media/personalization-templates/customer-testimonial.mp4',
  'before-after-transformation': '/media/personalization-templates/before-after-transformation.mp4',
  'team-member-intro': '/media/personalization-templates/team-member-intro.mp4',
  'event-promotion': '/media/personalization-templates/event-promotion.mp4',
  'menu-item-highlight': '/media/personalization-templates/menu-item-highlight.mp4',
}

/** Still poster frame for each layout, or null when none is published. */
const PREVIEW_POSTER_URLS: Record<string, string | null> = {
  'business-introduction': null,
  'product-showcase': null,
  'service-promotion': null,
  'special-offer': null,
  'branded-ending': null,
  'customer-testimonial': null,
  'before-after-transformation': null,
  'team-member-intro': null,
  'event-promotion': null,
  'menu-item-highlight': null,
}

/** Normalise a media reference into a URL a `<video>`/`` can load. */
function resolveMediaUrl(value: string | null | undefined): string | null {
  if (!value) return null
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  if (value.startsWith('/')) return value
  return `/${value}`
}

/** The MP4 clip for a layout, or null when no preview video exists. */
function previewVideoUrl(layoutId: PreviewLayoutId): string | null {
  return resolveMediaUrl(PREVIEW_VIDEO_URLS[layoutId])
}

/** The still poster frame for a layout, or null when none exists. */
function posterUrl(layoutId: PreviewLayoutId): string | null {
  return resolveMediaUrl(PREVIEW_POSTER_URLS[layoutId])
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
        background: 'linear-gradient(135deg, #12171c, #151a20)',
        border: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center' }}>
        {kinds.map((kind) => (
          <span
            key={kind}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: 'rgba(255,255,255,.04)',
              color: C.muted,
              fontSize: 8,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '.03em',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: kind === 'logo' ? C.green : kind === 'cta' ? C.cyan : C.cyanSoft,
              }}
            />
            {LAYER_BADGE_LABELS[kind]}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Props for the template browser. */
export interface PersonalizationTemplateBrowserProps {
  /** When a layout is selected, applies the preset via the provider. */
  onSelect?: (layoutId: PreviewLayoutId) => void
}

/** Categorized gallery of personalization layout templates. */
export function PersonalizationTemplateBrowser({ onSelect }: PersonalizationTemplateBrowserProps): React.JSX.Element {
  const ctx = useDemoPersonalize()
  const { previewSettings, setPreviewLayout } = ctx
  const [activeCategory, setActiveCategory] = useState<PersonalizationCategoryKey | 'all'>('all')
  const [query, setQuery] = useState('')
  const searchId = useId()

  const handleSelect = useCallback(
    (layoutId: PreviewLayoutId) => {
      if (onSelect) onSelect(layoutId)
      else setPreviewLayout(layoutId)
    },
    [onSelect, setPreviewLayout],
  )

  /** Visible layouts, filtered by category and search. */
  const visible = useMemo<PreviewLayoutId[]>(() => {
    const trimmed = query.trim().toLowerCase()
    return PREVIEW_LAYOUTS.filter((layout) => {
      if (activeCategory !== 'all' && layoutCategoryKey(layout.id) !== activeCategory) return false
      if (!trimmed) return true
      const haystack = `${layout.name} ${layout.description}`.toLowerCase()
      return haystack.includes(trimmed)
    }).map((layout) => layout.id)
  }, [query, activeCategory])

  const totalCount = PREVIEW_LAYOUTS.length

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
            Video layout templates
          </h3>
          <span style={badgeStyle('muted')}>{totalCount} templates</span>
          <span style={badgeStyle('cyan')}>{CATEGORIES.length} categories</span>
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
            placeholder="Search by name, category, or layer…"
            style={{ ...inputStyle, paddingLeft: 32 }}
          />
        </div>
        <p style={hintStyle}>
          Pick a layout to arrange your logo, photos and text on the video. Every template is editable —
          move, resize or hide any layer in the next step.
        </p>
      </div>

      {/* ── Category tabs ────────────────────────────────────────────────── */}
      <div style={panelStyle}>
        <div
          role="tablist"
          aria-label="Layout template categories"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}
        >
          <CategoryTab
            label="All"
            icon={Sparkles}
            active={activeCategory === 'all'}
            count={totalCount}
            onClick={() => setActiveCategory('all')}
          />
          {CATEGORIES.map((category) => {
            const Icon = resolveIcon(category.key)
            return (
              <CategoryTab
                key={category.key}
                label={category.label}
                icon={Icon}
                active={activeCategory === category.key}
                count={categoryCount(category.key)}
                onClick={() => setActiveCategory(category.key)}
              />
            )
          })}
        </div>
      </div>

      {/* ── Grid ────────────────────────────────────────────────────────── */}
      <div style={panelStyle}>
        {visible.length === 0 ? (
          <p style={hintStyle}>No templates match that search. Try a different query or category.</p>
        ) : (
          <>
            <p style={{ ...hintStyle, marginTop: 0, marginBottom: 10 }}>
              {visible.length === totalCount
                ? `All ${totalCount} layout templates.`
                : `Showing ${visible.length} of ${totalCount} templates.`}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3" style={{ gap: 10 }}>
              {visible.map((layoutId) => (
                <TemplateCard
                  key={layoutId}
                  layoutId={layoutId}
                  active={previewSettings.layout === layoutId}
                  onSelect={handleSelect}
                />
              ))}
            </div>
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
  layoutId,
  active,
  onSelect,
}: {
  layoutId: PreviewLayoutId
  active: boolean
  onSelect: (layoutId: PreviewLayoutId) => void
}): React.JSX.Element {
  const layout = PREVIEW_LAYOUTS.find((l) => l.id === layoutId)
  if (!layout) return <></>
  const kinds = LAYER_IDS_BY_LAYOUT[layoutId] ?? []
  const clip = previewVideoUrl(layoutId)
  const [hovering, setHovering] = useState(false)

  return (
    <div
      data-testid="personalization-template-card"
      data-template-id={layoutId}
      role="button"
      tabIndex={0}
      aria-pressed={active}
      aria-label={`Select ${layout.name} template`}
      onClick={() => onSelect(layoutId)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(layoutId)
        }
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        ...tileStyle(active),
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        cursor: 'pointer',
        userSelect: 'none',
        borderColor: hovering || active ? C.cyanBorder : C.border,
      }}
    >
      {clip ? (
        <TemplatePreview src={clip} active={active} hovering={hovering} />
      ) : (
        <TemplateLayerPreview layoutId={layoutId} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={badgeStyle('cyan')}>{resolveLabel(layoutCategoryKey(layoutId))}</span>
        {active && (
          <span style={badgeStyle('green')}>
            <Check size={9} /> Selected
          </span>
        )}
      </div>

      <div style={{ color: C.text, fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{layout.name}</div>
      <p style={{ ...hintStyle, margin: 0 }}>{layout.description}</p>

      {kinds.length > 0 && (
        <div
          aria-label="Layers included"
          style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
        >
          {kinds.map((kind) => (
            <span
              key={kind}
              data-testid={`layer-badge-${kind}`}
              title={LAYER_BADGE_LABELS[kind]}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
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
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 999,
                  background: kind === 'logo' ? C.green : kind === 'cta' ? C.cyan : C.cyanSoft,
                }}
              />
              {LAYER_BADGE_LABELS[kind]}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        data-testid="personalization-template-use"
        onClick={() => onSelect(layoutId)}
        style={{ ...primaryButtonStyle, flex: 1, minHeight: 36, fontSize: 11, padding: '0 12px' }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          Use this template <ChevronRight size={12} />
        </span>
      </button>
    </div>
  )
}

/**
 * The playing preview for a personalization layout template card.
 *
 * Every card shows a real `<video>` (never a still image). Selected cards
 * autoplay; unselected cards show the first frame paused so the user still
 * sees the template in motion context without ten videos playing at once.
 */
function TemplatePreview({
  src,
  active,
  hovering,
}: {
  src: string
  active: boolean
  hovering: boolean
}): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    const shouldPlay = active || hovering
    const attempt = shouldPlay ? el.play() : el.pause()
    if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {})
  }, [src, active, hovering])

  return (
    <video
      ref={videoRef}
      data-testid="personalization-template-player"
      src={src}
      muted
      playsInline
      loop
      autoPlay={active || hovering}
      style={{
        width: '100%',
        aspectRatio: '16 / 9',
        objectFit: 'cover',
        borderRadius: 8,
        display: 'block',
        background: '#000',
      }}
    />
  )
}
