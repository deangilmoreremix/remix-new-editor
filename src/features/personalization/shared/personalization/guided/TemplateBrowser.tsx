'use client'

/**
 * TemplateBrowser — the Motion Studio library browser for Step 2 of the
 * Easy Personalization Wizard.
 *
 * Surfaces the Motion Studio recipe-card library — 124 recipe cards (150
 * preview clips / 10 categories) sourced from `src/data/motionRecipeCatalog`,
 * which is the single source of truth. The grid unit is the RECIPE CARD
 * (`MOTION_TEMPLATE_CARDS`); counts everywhere are derived from that array at
 * runtime. The browser is browser-only: it never makes a paid call and never
 * reaches for a Node.js / FFmpeg / desktop dependency. The "Use this template"
 * action resolves the card to its representative shot and sets it as the
 * wizard's in-modal preview; the secondary "Edit in Motion Studio" action
 * hands off to the canonical `/studio/motion-studio` route.
 */

import { useMemo, useState, useCallback, useEffect, useId, useRef, type CSSProperties } from 'react'
import {
  Image as ImageIcon,
  Search,
  ChevronRight,
  Sparkles,
  Type as TypeIcon,
  Camera,
  Layers,
  Sliders,
  BarChart3,
  Hand,
  ArrowRightLeft,
  Music,
  Sparkle,
  LogIn,
  ExternalLink,
  Check,
  Clock,
  Box,
  FileImage,
  MonitorPlay,
  ShoppingBag,
  MessageSquareQuote,
} from 'lucide-react'
import {
  MOTION_CATEGORIES,
  MOTION_TEMPLATES,
  MOTION_TEMPLATE_CARDS,
  getMotionTemplateCardShot,
  getMotionTemplateCardsByCategory,
  motionTemplateTitle,
  normalizeCardCounts,
  searchMotionTemplateCards,
  type MotionCategoryKey,
  type MotionTemplate,
} from '@ohb/data/motionRecipeCatalog'
import { C, badgeStyle, hintStyle, inputStyle, panelStyle, primaryButtonStyle, secondaryButtonStyle, softPanelStyle, tileStyle } from './tokens'
import { useDemoPersonalize } from '../DemoPersonalizeProvider'
import { CardPreviewVideo } from './CardPreviewVideo'

/** Map a category key to a small lucide icon so the tab bar reads at a glance. */
const CATEGORY_ICONS: Record<MotionCategoryKey, React.ComponentType<{ size?: number; color?: string }>> = {
  opening: Sparkles,
  typography: TypeIcon,
  'ui-entrance': Layers,
  camera: Camera,
  data: BarChart3,
  interaction: Hand,
  transition: ArrowRightLeft,
  rhythm: Music,
  effects: Sparkle,
  outro: LogIn,
}

/** English label for each category. The catalog carries the Chinese
 *  original as `categoryLabel`; this map supplies the English one for the
 *  UI. */
const CATEGORY_LABELS_EN: Record<MotionCategoryKey, string> = {
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

const ASSET_ICONS: Array<{ key: keyof MotionTemplate['assets']; label: string; icon: React.ComponentType<{ size?: number; color?: string }> }> = [
  { key: 'logo', label: 'Logo', icon: FileImage },
  { key: 'image', label: 'Image', icon: ImageIcon },
  { key: 'screenshot', label: 'Screenshot', icon: MonitorPlay },
  { key: 'product', label: 'Product', icon: ShoppingBag },
  { key: 'text', label: 'Text', icon: TypeIcon },
  { key: 'cta', label: 'CTA', icon: MessageSquareQuote },
]

/**
 * Normalise a catalog media reference into a URL a `<video>`/`<img>` element
 * can load. The catalog stores absolute URLs (the upstream ShotCraft release
 * / repository), a `/public/...` path, or a bare relative path.
 */
function resolveMediaUrl(value: string | undefined): string | null {
  if (!value) return null
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  if (value.startsWith('/')) return value
  return `/${value}`
}

/** The MP4 clip for a template, or null when upstream published no clip. */
function previewVideoUrl(template: MotionTemplate): string | null {
  return resolveMediaUrl(template.preview)
}

/** The still poster frame for a template, or null when upstream has none. */
function posterUrl(template: MotionTemplate): string | null {
  return resolveMediaUrl(template.poster)
}

/** Inline SVG placeholder used when a card has no poster image. Renders a
 *  tile that uses the catalog's category accent + the English name so the
 *  grid is visually complete even before previews are fetched. */
function TemplatePosterPlaceholder({ template }: { template: MotionTemplate }): React.JSX.Element {
  const Icon = CATEGORY_ICONS[template.category] ?? Box
  const unavailable = !template.preview
  return (
    <div
      data-testid="motion-template-placeholder"
      style={{
        width: '100%',
        aspectRatio: '16 / 9',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 6,
        background:
          `radial-gradient(circle at 30% 20%, ${C.cyanSoft}, transparent 60%),` +
          `linear-gradient(135deg, ${C.panelSoft}, ${C.field})`,
        border: `1px solid ${C.border}`,
      }}
    >
      <Icon size={36} color={C.cyan} />
      {unavailable && (
        <span style={{ color: C.muted2, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
          Preview unavailable
        </span>
      )}
    </div>
  )
}

/**
 * True when the persisted/selected motion template belongs to a recipe card:
 * the provider stores the representative SHOT (id `<card.id>/<Component>`),
 * so a card is active when the selected id is or prefixes that shot id.
 */
function isCardSelected(selectedId: string | undefined, cardId: string): boolean {
  if (!selectedId) return false
  return selectedId === cardId || selectedId.startsWith(`${cardId}/`)
}

export interface TemplateBrowserProps {
  /**
   * When true, "Use this template" calls the provider's
   * `useMotionTemplate` (sets the in-modal preview). When false, it calls
   * `launchMotionTemplate` (hands off to `/studio/motion-studio`). Defaults
   * to true — the wizard is the selection surface; the studio handoff is a
   * secondary action exposed on each card. Both callbacks receive the card's
   * resolved representative shot so persisted wizard state keeps the shot
   * identity the provider's restore path expects.
   */
  onSelect?: (template: MotionTemplate) => void
  onLaunch?: (template: MotionTemplate) => void
  /** Show the "Motion Studio" hand-off button (opens the Motion Director's Workbench). Default: shown, as upstream. */
  showStudioLaunch?: boolean
}

/**
 * The Motion Studio template browser. Renders 10 category tabs, a search
 * bar, and a responsive grid of selectable recipe cards. Two CTAs per card:
 * "Use this template" (in-modal preview) and "Edit in Motion Studio"
 * (canonical studio handoff).
 */
export function TemplateBrowser({ onSelect, onLaunch, showStudioLaunch = true }: TemplateBrowserProps): React.JSX.Element {
  const ctx = useDemoPersonalize()
  const [activeCategory, setActiveCategory] = useState<MotionCategoryKey | 'all'>('all')
  const [query, setQuery] = useState('')
  const searchId = useId()

  const handleSelect = useCallback(
    (card: MotionTemplate) => {
      // Resolve the card to its representative shot first: the provider
      // persists `template.id` and restores it through the shot lookup, so
      // the pipeline identity stays resolvable across reloads. Falls back to
      // the card itself only if the shot invariant is ever broken.
      const shot = getMotionTemplateCardShot(card) ?? card
      if (onSelect) onSelect(shot)
      else ctx.useMotionTemplate(shot)
    },
    [onSelect, ctx],
  )

  const handleLaunch = useCallback(
    (card: MotionTemplate) => {
      const shot = getMotionTemplateCardShot(card) ?? card
      if (onLaunch) onLaunch(shot)
      else ctx.launchMotionTemplate(shot)
    },
    [onLaunch, ctx],
  )

  /** Visible recipe cards, filtered by the active tab and the search box. */
  const visible = useMemo<MotionTemplate[]>(() => {
    const trimmed = query.trim()
    if (trimmed) return searchMotionTemplateCards(trimmed)
    if (activeCategory === 'all') return MOTION_TEMPLATE_CARDS.slice()
    return getMotionTemplateCardsByCategory(activeCategory)
  }, [query, activeCategory])

  const cardCount = MOTION_TEMPLATE_CARDS.length
  const cardCounts = useMemo(() => normalizeCardCounts(), [])
  const clipCount = useMemo(() => {
    const keys = new Set<string>()
    for (const template of MOTION_TEMPLATES) if (template.preview) keys.add(template.preview)
    for (const template of MOTION_TEMPLATE_CARDS) if (template.preview) keys.add(template.preview)
    return keys.size
  }, [])

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
            Motion Studio
          </h3>
          <span style={badgeStyle('muted')}>{cardCount} recipe cards</span>
          <span style={badgeStyle('muted')}>{clipCount} preview clips</span>
          <span style={badgeStyle('cyan')}>{MOTION_CATEGORIES.length} categories</span>
          <span style={{ marginLeft: 'auto', color: C.muted2, fontSize: 10 }}>
            Browser-only preview · hands off to the studio for editing & export
          </span>
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
          Search recipes
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
            placeholder="Search by name, category, or component…"
            style={{ ...inputStyle, paddingLeft: 32 }}
          />
        </div>
        <p style={hintStyle}>
          The Motion Studio library is the canonical recipe set: {MOTION_CATEGORIES.length} motion categories from
          opening shots to outros. Each card lists the assets the recipe accepts (logo, image, text, CTA,
          …) so the in-modal preview can wire them up.
        </p>
      </div>

      {/* ── Category tabs ────────────────────────────────────────────────── */}
      <div style={panelStyle}>
        <div
          role="tablist"
          aria-label="Motion Studio categories"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}
        >
          <CategoryTab
            label="All"
            icon={Sparkles}
            active={activeCategory === 'all'}
            count={cardCount}
            onClick={() => setActiveCategory('all')}
          />
          {MOTION_CATEGORIES.map((category) => {
            const Icon = CATEGORY_ICONS[category.key] ?? Box
            return (
              <CategoryTab
                key={category.key}
                label={CATEGORY_LABELS_EN[category.key]}
                icon={Icon}
                active={activeCategory === category.key}
                count={cardCounts[category.key]}
                onClick={() => setActiveCategory(category.key)}
              />
            )
          })}
        </div>
      </div>

      {/* ── Grid ────────────────────────────────────────────────────────── */}
      <div style={panelStyle}>
        {visible.length === 0 ? (
          <p style={hintStyle}>No Motion Studio recipes match that search. Try a different query or category.</p>
        ) : (
          <>
            <p style={{ ...hintStyle, marginTop: 0, marginBottom: 10 }}>
              {visible.length === cardCount
                ? `All ${cardCount} recipe cards from the full Motion Studio library.`
                : `Showing ${visible.length} of ${cardCount} recipe cards.`}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3" style={{ gap: 10 }}>
              {visible.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  active={isCardSelected(ctx.motionTemplate?.id, template.id)}
                  onSelect={handleSelect}
                  onLaunch={showStudioLaunch ? handleLaunch : null}
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
  icon: React.ComponentType<{ size?: number; color?: string }>
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

/** The still poster for an unselected card. If the poster URL fails to
 *  load (upstream has not published that JPEG), fall back to the SVG
 *  placeholder so the grid never shows a broken image. */
function TemplatePosterImage({ template, poster }: { template: MotionTemplate; poster: string }): React.JSX.Element {
  const [broken, setBroken] = useState(false)
  if (broken) return <TemplatePosterPlaceholder template={template} />
  return (
    <img
      src={poster}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
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

/** Single recipe card. */
function TemplateCard({
  template,
  active,
  onSelect,
  onLaunch,
}: {
  template: MotionTemplate
  active: boolean
  onSelect: (template: MotionTemplate) => void
  onLaunch: ((template: MotionTemplate) => void) | null
}): React.JSX.Element {
  const poster = posterUrl(template)
  const clip = previewVideoUrl(template)
  const supportedAssets = ASSET_ICONS.filter((entry) => template.assets[entry.key])
  const durationLabel = template.durationSec > 0 ? `${template.durationSec.toFixed(1)}s` : null
  // The SELECTED card hosts the real, playing clip with controls. Every other
  // card autoplays its own silent clip while on screen, over its poster.
  const showPlayer = active && Boolean(clip)
  const still = poster ? (
    <TemplatePosterImage template={template} poster={poster} />
  ) : (
    <TemplatePosterPlaceholder template={template} />
  )

  return (
    <div
      data-testid="motion-template-card"
      data-template-id={template.id}
      style={{ ...tileStyle(active), display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      {showPlayer ? (
        <MotionTemplatePlayer template={template} src={clip!} poster={poster} />
      ) : clip ? (
        <CardPreviewVideo src={clip} poster={poster} fallback={still} />
      ) : (
        still
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={badgeStyle('cyan')}>{CATEGORY_LABELS_EN[template.category]}</span>
        {durationLabel && (
          <span style={badgeStyle('muted')}>
            <Clock size={9} /> {durationLabel}
          </span>
        )}
        {active && (
          <span style={badgeStyle('green')}>
            <Check size={9} /> Selected
          </span>
        )}
      </div>

      <div style={{ color: C.text, fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{motionTemplateTitle(template)}</div>
      <div style={{ color: C.muted2, fontSize: 10 }}>{template.nameEn}</div>
      {template.summaryEn && (
        <p style={{ ...hintStyle, margin: 0 }}>{template.summaryEn}</p>
      )}

      {supportedAssets.length > 0 && (
        <div
          aria-label="Supported asset insertions"
          style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
        >
          {supportedAssets.map(({ key, label, icon: Icon }) => (
            <span
              key={key}
              data-testid={`asset-badge-${key}`}
              title={`Supports ${label}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '2px 6px',
                borderRadius: 6,
                border: `1px solid ${C.border}`,
                background: 'rgba(255,255,255,.03)',
                color: C.muted,
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '.04em',
              }}
            >
              <Icon size={9} color={C.muted} />
              {label}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
        <button
          type="button"
          data-testid="motion-template-use"
          onClick={() => onSelect(template)}
          style={{ ...primaryButtonStyle, flex: 1, minHeight: 36, fontSize: 11, padding: '0 12px' }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Use this template <ChevronRight size={12} />
          </span>
        </button>
        {onLaunch && (
          <button
            type="button"
            data-testid="motion-template-launch"
            onClick={() => onLaunch(template)}
            style={{ ...secondaryButtonStyle, minHeight: 36, fontSize: 11, padding: '0 12px' }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ExternalLink size={11} /> Motion Studio
            </span>
          </button>
        )}
      </div>
    </div>
  )
}

/** The playing preview for the SELECTED Motion Studio card.
 *
 * Renders the real upstream ShotCraft clip (an MP4 published in the
 * `gallery-media` GitHub release) instead of the still poster, so the user
 * sees the actual motion rather than a picture of it. `muted` + `playsInline`
 * let the browser autoplay the clip; the explicit `play()` call is the
 * fallback for browsers that still refuse the first attempt.
 *
 * Failure handling is non-destructive: a media error re-mounts back to the
 * poster with an inline "Preview unavailable — try another clip" state and a
 * Retry button, and a clip whose metadata has not arrived after a grace
 * period gets a small "Still loading…" hint. Neither state ever unmounts the
 * player on its own — Retry (or a new selection) is always the user's call,
 * so a slow load is never killed by a hard timeout.
 */
const LOADING_HINT_DELAY_MS = 8000

function MotionTemplatePlayer({
  template,
  src,
  poster,
}: {
  template: MotionTemplate
  src: string
  poster: string | null
}): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState(false)
  const [loadingSlow, setLoadingSlow] = useState(false)

  useEffect(() => {
    const el = videoRef.current
    if (el) {
      const play = el.play()
      if (play && typeof play.catch === 'function') play.catch(() => {})
    }
    setFailed(false)
    setLoadingSlow(false)
    const deadline = setTimeout(() => {
      const video = videoRef.current
      // Metadata still absent after the grace period — surface the hint but
      // keep the clip loading (a cold upstream can legitimately take longer).
      if (video && video.readyState < HTMLMediaElement.HAVE_METADATA && !video.error) {
        setLoadingSlow(true)
      }
    }, LOADING_HINT_DELAY_MS)
    return () => clearTimeout(deadline)
  }, [src, attempt])

  const retry = useCallback(() => {
    setFailed(false)
    setLoadingSlow(false)
    setAttempt((n) => n + 1)
  }, [])

  if (failed) {
    return (
      <div
        data-testid="motion-template-player-fallback"
        style={{ width: '100%' }}
      >
        {poster ? (
          <TemplatePosterImage template={template} poster={poster} />
        ) : (
          <TemplatePosterPlaceholder template={template} />
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 6,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: C.muted2, fontSize: 10 }}>Preview unavailable — try another clip</span>
          <button
            type="button"
            data-testid="motion-template-retry"
            onClick={retry}
            style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 10, padding: '0 10px' }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <video
        key={attempt}
        ref={videoRef}
        data-testid="motion-template-player"
        data-template-id={template.id}
        src={src}
        poster={poster ?? undefined}
        muted
        playsInline
        loop
        autoPlay
        controls
        onError={() => setFailed(true)}
        onLoadedMetadata={() => setLoadingSlow(false)}
        onCanPlay={() => setLoadingSlow(false)}
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          objectFit: 'contain',
          borderRadius: 8,
          display: 'block',
          background: '#000',
        }}
      />
      {loadingSlow && (
        <div
          data-testid="motion-template-loading-slow"
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 8px',
            borderRadius: 6,
            border: `1px solid ${C.border}`,
            background: 'rgba(0,0,0,.7)',
            color: C.muted,
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          <span>Still loading…</span>
          <button
            type="button"
            data-testid="motion-template-retry"
            onClick={retry}
            style={{ ...secondaryButtonStyle, minHeight: 22, fontSize: 9, padding: '0 8px' }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
