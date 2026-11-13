'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Film, FolderOpen, Play, Sparkles, Upload, Video } from 'lucide-react'
import { useDemoPersonalize } from '../DemoPersonalizeProvider'
import { demoDurationInFrames } from './curatedDemos'
import {
  C,
  badgeStyle,
  chipStyle,
  hintStyle,
  labelStyle,
  panelStyle,
  secondaryButtonStyle,
  softPanelStyle,
  tileStyle,
} from './tokens'
import { TemplateBrowser } from './TemplateBrowser'
import { RecastOption } from './RecastOption'
import {
  ALL_DEMOS_CATEGORY_ID,
  DEMO_CATEGORIES,
  DEMO_STYLE_CATEGORIES,
  countDemosByCategory,
  getDemoCategory,
  getDemoSubcategoryIds,
  getQualifiedSubcategoryId,
  humanizeTaxonomyId,
  isCategoryActiveForDemo,
  matchesDemoQuery,
} from './demoCategories'
import { DemoCategoryTabs, DemoFilterSelect, DemoSearchInput } from './DemoGalleryControls'
import { CardPreviewVideo } from './CardPreviewVideo'
import {
  DEMO_LIBRARY_REGISTRY,
  demoCollections,
  toVideoDemo,
  type DemoLibraryEntry,
} from '@ohb/data/demoLibraryRegistry'
import type { VideoDemo } from '@ohb/data/types'
import type { SharedMediaEntry } from '../types'
import type { PreviewVideoRef } from '../preview/types'

function isVideoUrl(url: string | null | undefined): boolean {
  if (!url || url.startsWith('blob:')) return false
  return /\.(mp4|webm|mov|m4v|m3u8)(\?|$)/i.test(url) || url.includes('/video')
}

function savedVideoUrl(entry: SharedMediaEntry): string | null {
  const output = Array.isArray(entry.outputUrls) ? entry.outputUrls.find((url) => isVideoUrl(url)) : undefined
  if (output) return output
  if (isVideoUrl(entry.sourceMedia)) return entry.sourceMedia || null
  return null
}

// ---------------------------------------------------------------------------
// Demos tab — gallery model
// ---------------------------------------------------------------------------

/**
 * A demo the Demos tab can offer.
 *
 * `entry` is the registry record: it carries the stable, source-qualified id
 * (`"<collection>:<slug>"`) the selection is tracked by. `demo` is the legacy
 * `VideoDemo` view of the same record — the shape the shared taxonomy
 * helpers in `./demoCategories.ts` expect.
 */
type DemoGalleryItem = {
  entry: DemoLibraryEntry
  demo: VideoDemo
}

/** Every eligible demo video, in registry order. */
const DEMO_GALLERY_ITEMS: readonly DemoGalleryItem[] = DEMO_LIBRARY_REGISTRY.map((entry) => ({
  entry,
  demo: toVideoDemo(entry),
}))

/** Registry id → taxonomy view, so a picked demo can be timed without a rebuild. */
const DEMO_VIDEO_BY_ENTRY_ID = new Map(DEMO_GALLERY_ITEMS.map((item) => [item.entry.id, item.demo]))

/** Cards mounted before the customer asks for more. */
const DEMO_GALLERY_INITIAL = 12

/** Extra cards mounted per "Show more" click. */
const DEMO_GALLERY_STEP = 10

/**
 * Counts over the whole library.
 *
 * Used to decide which category TABS exist: a niche that holds no demo at all
 * is not offered, because an empty tab is a dead end. The counts SHOWN on the
 * tabs are computed again from the current filter set (see `demoGallery`).
 */
const DEMO_LIBRARY_CATEGORY_COUNTS = countDemosByCategory(DEMO_GALLERY_ITEMS.map((item) => item.demo))

/** "All Demos" first, then every niche that actually holds at least one demo. */
const DEMO_VISIBLE_CATEGORIES = DEMO_CATEGORIES.filter(
  (category) =>
    category.id === ALL_DEMOS_CATEGORY_ID || (DEMO_LIBRARY_CATEGORY_COUNTS[category.id] ?? 0) > 0,
)

/** A single select option. */
type DemoOption = { value: string; label: string }

/**
 * Build a select's option list.
 *
 * The "all" entry always comes first. The currently selected value is kept in
 * the list even when the data no longer offers it, so the control never
 * silently drops the customer's own choice.
 */
function demoFilterOptions(
  options: readonly DemoOption[],
  current: string,
  allLabel: string,
  currentLabel?: string,
): DemoOption[] {
  const list: DemoOption[] = [{ value: 'all', label: allLabel }]
  if (current !== 'all' && !options.some((option) => option.value === current)) {
    list.push({ value: current, label: currentLabel ?? current })
  }
  return [...list, ...options]
}

/**
 * Simple Mode step 2 — choose the video to personalize.
 *
 * The video the customer opened with is preselected automatically, so arriving
 * here requires no action. The demo library, previously saved videos and a
 * browser-local upload are optional ways to change it. No paid call is made.
 */
export function StepChooseVideo(): React.JSX.Element {
  const ctx = useDemoPersonalize()
  const { source, previewVideo, setPreviewVideo, previewSettings, updatePreviewComposition, sharedMediaEntries = [] } = ctx
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadNote, setUploadNote] = useState(false)
  const [hoveredDemoKey, setHoveredDemoKey] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'source' | 'demos' | 'motion' | 'upload'>('source')

  // ── Demos tab state ──────────────────────────────────────────────────────
  // The selection itself is NOT held here: it lives in the provider
  // (`previewVideo`), so switching category, filter or search can never
  // change what the customer picked.
  const [demoCategoryId, setDemoCategoryId] = useState<string>(ALL_DEMOS_CATEGORY_ID)
  const [demoQuery, setDemoQuery] = useState('')
  const [demoSourceId, setDemoSourceId] = useState('all')
  const [demoStyleId, setDemoStyleId] = useState('all')
  const [demoAspect, setDemoAspect] = useState('all')
  const [demoSubcategoryId, setDemoSubcategoryId] = useState('all')
  // The visible window is keyed by the filter set: changing any filter starts
  // a fresh window without a stale "Show more" count.
  const [demoWindow, setDemoWindow] = useState({ key: '', count: DEMO_GALLERY_INITIAL })

  const fps = previewSettings?.fps || 30

  // Auto-select the launch video. Guarded by the source URL so it runs once
  // per source: the customer never has to click anything to continue, and
  // switching sources (or reopening the modal) reselects that new video.
  const autoSelectedSourceRef = useRef<string | null>(null)
  useEffect(() => {
    const url = source?.sourceMedia
    if (!url) return
    if (previewVideo?.url) return
    if (autoSelectedSourceRef.current === url) return
    autoSelectedSourceRef.current = url
    setPreviewVideo({
      url,
      poster: source.poster || null,
      title: source.title || 'Your video',
      kind: 'source',
    })
  }, [source?.sourceMedia, source?.poster, source?.title, previewVideo?.url, setPreviewVideo])

  const savedVideos = sharedMediaEntries
    .map((entry) => ({ entry, url: savedVideoUrl(entry) }))
    .filter((item): item is { entry: SharedMediaEntry; url: string } => Boolean(item.url))
    .slice(0, 8)

  const pick = (video: PreviewVideoRef) => setPreviewVideo(video)

  const pickDemo = (demo: DemoLibraryEntry) => {
    // A demo without a playable videoSrc must not be selected and must never
    // silently substitute another demo. Show an unavailable state instead.
    if (!demo.videoSrc) {
      return
    }
    // `demoId` is the registry's source-qualified id ("<collection>:<slug>").
    // The source catalogs reuse numeric ids across libraries, so a bare
    // number would point at a different video in another collection.
    pick({ url: demo.videoSrc, poster: demo.posterSrc || null, title: demo.title, kind: 'demo', demoId: demo.id })
    const videoDemo = DEMO_VIDEO_BY_ENTRY_ID.get(demo.id) ?? toVideoDemo(demo)
    updatePreviewComposition({ durationInFrames: demoDurationInFrames(videoDemo, fps) })
  }

  const handleUpload = (file: File | undefined) => {
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    pick({ url: objectUrl, poster: null, title: file.name, kind: 'uploaded' })
    setUploadNote(true)
  }

  const selectedUrl = previewVideo?.url || source?.sourceMedia || null

  // ── Demos tab: the filtered gallery ─────────────────────────────────────
  const demoGallery = useMemo(() => {
    const query = demoQuery.trim().toLowerCase()

    // ONE pass over the library, one boolean per dimension. The taxonomy
    // matcher is the expensive part, so it is never asked the same question
    // twice.
    const rows = DEMO_GALLERY_ITEMS.map((item) => ({
      item,
      query:
        query === '' ||
        matchesDemoQuery(item.demo, query) ||
        item.entry.collectionName.toLowerCase().includes(query),
      source: demoSourceId === 'all' || item.entry.collectionId === demoSourceId,
      style: demoStyleId === 'all' || isCategoryActiveForDemo(demoStyleId, item.demo),
      aspect: demoAspect === 'all' || item.entry.aspectRatio === demoAspect,
      category: isCategoryActiveForDemo(demoCategoryId, item.demo),
      subcategory:
        demoSubcategoryId === 'all' || isCategoryActiveForDemo(demoSubcategoryId, item.demo),
    }))

    // Every dimension except the category: the per-tab counts describe how
    // many of the CURRENTLY FILTERED demos each category would hold.
    const facetSet = rows.filter((row) => row.query && row.source && row.style && row.aspect)
    // The final list: every dimension applied.
    const filtered = facetSet.filter((row) => row.category && row.subcategory)

    // Each option list ignores the dimension it describes, so a value the
    // customer already picked never disappears from its own list.
    const sourceCandidates = rows.filter((row) => row.query && row.style && row.aspect && row.category)
    const styleCandidates = rows.filter((row) => row.query && row.source && row.aspect && row.category)
    const aspectCandidates = rows.filter((row) => row.query && row.source && row.style && row.category)
    const subcategoryCandidates = rows.filter((row) => row.query && row.category)

    // Source collection — derived from the registry, never hardcoded.
    const sourceCounts = new Map<string, number>()
    for (const row of sourceCandidates) {
      sourceCounts.set(
        row.item.entry.collectionId,
        (sourceCounts.get(row.item.entry.collectionId) ?? 0) + 1,
      )
    }
    const sourceOptions: DemoOption[] = demoCollections
      .filter((collection) => sourceCounts.has(collection.id))
      .map((collection) => ({
        value: collection.id,
        label: `${collection.label} (${sourceCounts.get(collection.id) ?? 0})`,
      }))

    // Video style — the seven canonical AI Viral style buckets, restricted to
    // the ones that actually occur in the current set.
    const stylesPresent = new Set<string>()
    for (const row of styleCandidates) stylesPresent.add(row.item.demo.category.toLowerCase())
    const styleOptions: DemoOption[] = DEMO_STYLE_CATEGORIES.filter((style) =>
      stylesPresent.has(style.id),
    ).map((style) => ({ value: style.id, label: style.label }))

    // Aspect ratio — the distinct values the registry actually carries.
    const aspectCounts = new Map<string, number>()
    for (const row of aspectCandidates) {
      aspectCounts.set(
        row.item.entry.aspectRatio,
        (aspectCounts.get(row.item.entry.aspectRatio) ?? 0) + 1,
      )
    }
    const aspectOptions: DemoOption[] = [...aspectCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, label: `${value} (${count})` }))

    // Sub-category — only meaningful inside one business niche, and only when
    // the demos in that niche actually carry sub-niches. Without a real
    // sub-niche the control is not rendered at all.
    const subcategoryOptions: DemoOption[] = []
    if (demoCategoryId !== ALL_DEMOS_CATEGORY_ID) {
      const labels = new Map<string, string>()
      for (const row of subcategoryCandidates) {
        for (const subId of getDemoSubcategoryIds(row.item.demo, demoCategoryId)) {
          const qualified = getQualifiedSubcategoryId(demoCategoryId, subId)
          if (!labels.has(qualified)) labels.set(qualified, humanizeTaxonomyId(subId))
        }
      }
      if (labels.size > 0) {
        subcategoryOptions.push({ value: 'all', label: 'All sub-categories' })
        for (const [value, label] of labels) subcategoryOptions.push({ value, label })
        // Keep the customer's own choice selectable even when the data no
        // longer offers it.
        if (demoSubcategoryId !== 'all' && !labels.has(demoSubcategoryId)) {
          subcategoryOptions.push({
            value: demoSubcategoryId,
            label: humanizeTaxonomyId(demoSubcategoryId.split('/')[1] ?? demoSubcategoryId),
          })
        }
      }
    }

    return {
      filtered: filtered.map((row) => row.item),
      // Counts on the category tabs reflect the current filter set.
      categoryCounts: countDemosByCategory(facetSet.map((row) => row.item.demo)),
      sourceOptions: demoFilterOptions(
        sourceOptions,
        demoSourceId,
        'All sources',
        demoCollections.find((collection) => collection.id === demoSourceId)?.label,
      ),
      styleOptions: demoFilterOptions(
        styleOptions,
        demoStyleId,
        'All styles',
        getDemoCategory(demoStyleId)?.label,
      ),
      aspectOptions: demoFilterOptions(aspectOptions, demoAspect, 'All aspect ratios'),
      subcategoryOptions,
    }
  }, [demoQuery, demoSourceId, demoStyleId, demoAspect, demoCategoryId, demoSubcategoryId])

  // The visible window restarts whenever the filter set changes.
  const demoFilterKey = `${demoCategoryId}|${demoQuery}|${demoSourceId}|${demoStyleId}|${demoAspect}|${demoSubcategoryId}`
  const demoVisibleLimit = demoWindow.key === demoFilterKey ? demoWindow.count : DEMO_GALLERY_INITIAL
  const demoVisible = demoGallery.filtered.slice(0, demoVisibleLimit)
  const demoRemaining = demoGallery.filtered.length - demoVisible.length

  const demoHasActiveFilters =
    demoCategoryId !== ALL_DEMOS_CATEGORY_ID ||
    demoQuery.trim() !== '' ||
    demoSourceId !== 'all' ||
    demoStyleId !== 'all' ||
    demoAspect !== 'all' ||
    demoSubcategoryId !== 'all'

  const resetDemoFilters = () => {
    setDemoCategoryId(ALL_DEMOS_CATEGORY_ID)
    setDemoQuery('')
    setDemoSourceId('all')
    setDemoStyleId('all')
    setDemoAspect('all')
    setDemoSubcategoryId('all')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.text }}>Choose a video to personalize</h2>
        <p style={{ margin: '4px 0 0', color: C.muted, fontSize: 12, lineHeight: 1.55 }}>
          Pick the video you opened, an AI demo, a Motion Studio recipe, or upload your own — your business
          details and edits stay either way.
        </p>
      </div>

      {/* ── Source / Demos / Motion Studio / Upload tabs ─────────────────── */}
      <div
        role="tablist"
        aria-label="Step 2 video source"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}
      >
        <TabButton
          label="Your video"
          icon={Video}
          active={activeTab === 'source'}
          onClick={() => setActiveTab('source')}
        />
        <TabButton
          label={`AI Demos (${DEMO_LIBRARY_REGISTRY.length})`}
          icon={Film}
          active={activeTab === 'demos'}
          onClick={() => setActiveTab('demos')}
        />
        <TabButton
          label="Motion Studio"
          icon={Sparkles}
          active={activeTab === 'motion'}
          onClick={() => setActiveTab('motion')}
        />
        <TabButton
          label="Upload"
          icon={Upload}
          active={activeTab === 'upload'}
          onClick={() => setActiveTab('upload')}
        />
      </div>

      {/* ── Current video (preselected automatically) ───────────────────── */}
      {activeTab === 'source' && source?.sourceMedia && (
        <div style={panelStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <Video size={15} color={C.cyan} />
            <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: C.text }}>
              Your video
            </h3>
            {selectedUrl === source.sourceMedia && <span style={badgeStyle('green')}>Selected — nothing to do</span>}
          </div>
          <button
            type="button"
            onClick={() => pick({ url: source.sourceMedia as string, poster: source.poster || null, title: source.title, kind: 'source' })}
            style={tileStyle(selectedUrl === source.sourceMedia)}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {source.poster && (
                <img
                  src={source.poster}
                  alt=""
                  style={{ width: 128, borderRadius: 8, border: `1px solid ${C.border}`, display: 'block' }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>{source.title}</div>
                {source.durationLabel && <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{source.durationLabel}</div>}
                <div style={{ marginTop: 8 }}>
                  {selectedUrl === source.sourceMedia ? (
                    <span style={badgeStyle('green')}>
                      <Check size={10} /> Selected
                    </span>
                  ) : (
                    <span style={badgeStyle()}>Use this video</span>
                  )}
                </div>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* ── Demo library (optional) ─────────────────────────────────────── */}
      {activeTab === 'demos' && (
      <div style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <Film size={15} color={C.cyan} />
          <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: C.text }}>
            Choose a different video (optional)
          </h3>
          <span style={{ marginLeft: 'auto', color: C.muted2, fontSize: 10 }}>
            {DEMO_LIBRARY_REGISTRY.length} eligible demos
          </span>
        </div>
        {DEMO_LIBRARY_REGISTRY.length === 0 && (
          <p style={hintStyle}>No demo videos available right now.</p>
        )}
        {DEMO_LIBRARY_REGISTRY.length > 0 && (
          <>
            <p style={{ ...hintStyle, marginTop: 0, marginBottom: 10 }}>
              SmartVideo GO AI sample videos you can brand instead of your own.
            </p>

            {/* ── Category tabs ─────────────────────────────────────────── */}
            <DemoCategoryTabs
              categories={DEMO_VISIBLE_CATEGORIES}
              counts={demoGallery.categoryCounts}
              activeId={demoCategoryId}
              onChange={(categoryId) => {
                setDemoCategoryId(categoryId)
                // A sub-category id is qualified by its niche, so it cannot
                // survive a category change.
                setDemoSubcategoryId('all')
              }}
              ariaLabel="Demo categories"
            />

            {/* ── Search + filters ─────────────────────────────────────── */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 10,
                marginTop: 12,
                alignItems: 'end',
              }}
            >
              <DemoSearchInput
                value={demoQuery}
                onChange={setDemoQuery}
                placeholder="Search demos…"
                ariaLabel="Search demos"
              />
              <DemoFilterSelect
                label="Source"
                value={demoSourceId}
                options={demoGallery.sourceOptions}
                onChange={setDemoSourceId}
              />
              <DemoFilterSelect
                label="Style"
                value={demoStyleId}
                options={demoGallery.styleOptions}
                onChange={setDemoStyleId}
              />
              <DemoFilterSelect
                label="Aspect ratio"
                value={demoAspect}
                options={demoGallery.aspectOptions}
                onChange={setDemoAspect}
              />
              {/* The sub-category control only exists when the active
                  category actually carries sub-categories. */}
              {demoGallery.subcategoryOptions.length > 0 && (
                <DemoFilterSelect
                  label="Sub-category"
                  value={demoSubcategoryId}
                  options={demoGallery.subcategoryOptions}
                  onChange={setDemoSubcategoryId}
                />
              )}
            </div>

            {/* ── Result summary ───────────────────────────────────────── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginTop: 12,
                marginBottom: 8,
                flexWrap: 'wrap',
              }}
            >
              <span data-testid="demo-gallery-count" style={{ color: C.muted2, fontSize: 11 }}>
                Showing {demoVisible.length} of {demoGallery.filtered.length} demos
              </span>
              {demoHasActiveFilters && (
                <button
                  type="button"
                  onClick={resetDemoFilters}
                  data-testid="demo-clear-filters"
                  style={{
                    background: 'transparent',
                    border: `1px solid ${C.border}`,
                    borderRadius: 999,
                    color: C.muted,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '3px 9px',
                    cursor: 'pointer',
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>

            {demoGallery.filtered.length === 0 ? (
              /* ── Empty state ──────────────────────────────────────────── */
              <div
                data-testid="demo-empty-state"
                style={{
                  ...softPanelStyle,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  padding: 22,
                  textAlign: 'center',
                }}
              >
                <p style={{ margin: 0, color: C.text, fontSize: 13, fontWeight: 700 }}>
                  No demos match these filters
                </p>
                <p style={{ margin: 0, color: C.muted, fontSize: 11, lineHeight: 1.5 }}>
                  Try a different category, a broader search term, or clear the filters to see all{' '}
                  {DEMO_LIBRARY_REGISTRY.length} demos.
                </p>
                <button
                  type="button"
                  onClick={resetDemoFilters}
                  data-testid="demo-empty-clear-filters"
                  style={secondaryButtonStyle}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4" style={{ gap: 10 }}>
                  {demoVisible.map((item) => {
                    const demo = item.entry
                    // Selection is matched on the video URL, never on the demo id:
                    // the minimax and seedance libraries reuse the same numeric ids,
                    // so an id match would light up (and mount a second player for)
                    // a different demo.
                    const active = selectedUrl === demo.videoSrc
                    const unavailable = !demo.videoSrc
                    return (
                      // A <div role="button"> rather than a real <button>: the card
                      // contains a native <video controls> and a play overlay
                      // <button>, and a button inside a button is invalid HTML that
                      // React reports as a hydration error.
                      <div
                        key={demo.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={active}
                        aria-disabled={unavailable || undefined}
                        title={unavailable ? 'Video coming soon' : undefined}
                        aria-label={unavailable ? `${demo.title} (video coming soon)` : `Select ${demo.title}`}
                        data-testid={`demo-card-${demo.legacyId}-${demo.slug}`}
                        data-demo-id={demo.id}
                        onClick={() => pickDemo(demo)}
                        onKeyDown={(event) => {
                          // Only react to keys pressed on the CARD itself. A key
                          // pressed inside the nested `<video controls>` (Space
                          // toggles playback, arrows seek) must reach the media
                          // element — swallowing it here would break the native
                          // player controls.
                          if (event.target !== event.currentTarget) return
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            pickDemo(demo)
                          }
                        }}
                        style={{
                          ...tileStyle(active),
                          // The selected card is the player, so it takes the whole
                          // width of the grid and moves to the top — the customer
                          // sees the demo playing without scrolling.
                          ...(active ? { gridColumn: '1 / -1', order: -1 } : {}),
                          ...(unavailable ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
                        }}
                      >
                        <div style={{ position: 'relative' }}>
                          {/* The selected card IS the player: a real, muted, looping
                              <video> with controls. Every other card autoplays its
                              own silent clip while on screen, over the poster it
                              falls back to. */}
                          {active ? (
                            <DemoCardPlayer key={`demo-player-${demo.id}`} demo={demo} />
                          ) : (
                            <CardPreviewVideo
                              src={demo.videoSrc}
                              poster={demo.posterSrc}
                              fallback={
                                <img
                                  src={demo.posterSrc}
                                  alt=""
                                  loading="lazy"
                                  style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 8, display: 'block', background: '#000' }}
                                />
                              }
                            />
                          )}
                          {/* Play overlay — makes the card clearly a playable video, not a static image.
                              On the selected card it shrinks to a corner badge so it never
                              covers the native video controls. */}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); pickDemo(demo) }}
                            onMouseEnter={() => setHoveredDemoKey(demo.id)}
                            onMouseLeave={() => setHoveredDemoKey(null)}
                            aria-label={`Play ${demo.title}`}
                            style={{
                              position: 'absolute',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              cursor: 'pointer',
                              opacity: active || hoveredDemoKey === demo.id ? 1 : 0,
                              transition: 'opacity .15s ease',
                              ...(active
                                ? { top: 6, left: 6, width: 28, height: 28, borderRadius: 999, background: 'rgba(0,0,0,.6)', border: '1px solid rgba(255,255,255,.25)' }
                                : { inset: 0, borderRadius: 8, background: 'rgba(0,0,0,.35)', border: 'none' }),
                            }}
                          >
                            <Play size={active ? 13 : 26} color="#fff" />
                          </button>
                          {active && (
                            <span style={{ ...badgeStyle('green'), position: 'absolute', top: 6, right: 6 }}>
                              <Check size={10} /> Selected
                            </span>
                          )}
                          {/* The "VIDEO" chip sits bottom-left, where the native
                              control bar's play button lives — it is hidden on the
                              selected card so the two never overlap. */}
                          {!active && (
                            <span style={{ position: 'absolute', bottom: 6, left: 6, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#fff', background: 'rgba(0,0,0,.55)', padding: '2px 6px', borderRadius: 4 }}>VIDEO</span>
                          )}
                        </div>
                        <div style={{ color: C.text, fontSize: 12, fontWeight: 700, marginTop: 8, lineHeight: 1.35 }}>{demo.title}</div>
                        {demo.durationLabel && <div style={{ color: C.muted2, fontSize: 10, marginTop: 2 }}>{demo.durationLabel}</div>}
                        {unavailable && <div data-testid="demo-unavailable" style={{ color: C.muted2, fontSize: 10, marginTop: 2 }}>Video coming soon</div>}
                      </div>
                    )
                  })}
                </div>

                {/* ── Show more ─────────────────────────────────────────────
                    The library holds 123 videos, so they are mounted in
                    windows. Every video stays reachable: the button below
                    reveals the next window and the counter above always
                    shows how many of the matching demos are on screen. */}
                {demoRemaining > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                    <button
                      type="button"
                      data-testid="demo-show-more"
                      onClick={() =>
                        setDemoWindow({ key: demoFilterKey, count: demoVisibleLimit + DEMO_GALLERY_STEP })
                      }
                      style={secondaryButtonStyle}
                    >
                      Show more ({demoRemaining} more)
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ── Now playing ────────────────────────────────────────────────
                The selected card already renders the real, playing video, so
                this is a caption only — a second <video> here would only
                duplicate the player (and make two elements load the same
                clip). */}
            {previewVideo?.kind === 'demo' && previewVideo.url && (
              <p style={{ ...hintStyle, marginTop: 10, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Video size={12} color={C.cyan} />
                Playing the real demo video source ({previewVideo.poster ? 'poster shown before play' : 'no poster available'}).
              </p>
            )}
          </>
        )}
      </div>
      )}

      {/* ── Motion Studio (full library: 124 cards / 150 shots / 10 categories) ── */}
      {activeTab === 'motion' && (
        <TemplateBrowser />
      )}

      {/* ── Saved / previously generated videos ─────────────────────────── */}
      {activeTab === 'source' && savedVideos.length > 0 && (
        <div style={panelStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <FolderOpen size={15} color={C.cyan} />
            <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: C.text }}>
              Your saved videos
            </h3>
            <span style={{ marginLeft: 'auto', color: C.muted2, fontSize: 10 }}>Optional</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4" style={{ gap: 10 }}>
            {savedVideos.map(({ entry, url }) => {
              const active = selectedUrl === url
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => pick({ url, poster: null, title: entry.sourceDemoSlug || 'Saved video', kind: 'saved' })}
                  style={tileStyle(active)}
                >
                  <div style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 8, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Video size={22} color={C.muted} />
                  </div>
                  <div style={{ color: C.text, fontSize: 12, fontWeight: 700, marginTop: 8 }}>{entry.sourceDemoSlug || 'Saved video'}</div>
                  <div style={{ color: C.muted2, fontSize: 10, marginTop: 2 }}>From {entry.originStudio || 'your library'}</div>
                  {entry.layersMissing && (
                    <div data-testid="saved-video-layers-missing" style={{ color: '#fcd34d', fontSize: 10, marginTop: 2 }}>Without your on-video layers</div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Upload (optional) ───────────────────────────────────────────── */}
      {activeTab === 'upload' && (
      <div style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Upload size={15} color={C.cyan} />
          <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: C.text }}>
            Upload your own video (optional)
          </h3>
        </div>
        <p style={{ ...hintStyle, marginTop: 0, marginBottom: 8 }}>
          Only needed if you would rather brand a video from your computer instead.
        </p>
        <label style={{ ...labelStyle, marginBottom: 6 }} htmlFor="guided-video-upload">Video file</label>
        <input
          id="guided-video-upload"
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={(event) => handleUpload(event.target.files?.[0])}
          style={{ ...softPanelStyle, width: '100%', color: C.text, fontSize: 12 }}
        />
        {uploadNote && (
          <p style={hintStyle}>Uploaded videos stay in this browser preview — nothing is uploaded to a server.</p>
        )}
      </div>
      )}

      {/* Optional AI recast: skipping keeps the original video (the default). */}
      {Boolean(selectedUrl) && source?.mediaType === 'video' && <RecastOption />}
    </div>
  )
}

/** Grace period before a selected card with no media metadata shows a hint. */
const DEMO_PLAYER_METADATA_GRACE_MS = 8000

/**
 * Inline player for the demo card that is currently selected.
 *
 * The card is the player: the poster thumbnail is replaced by a real, muted,
 * looping <video> so the customer immediately sees the demo moving. The
 * player is mounted inside the card of the *selected* demo only, so React
 * unmounts the previous player (and stops the previous clip) the moment the
 * selection changes.
 *
 * Robustness: a broken clip must never trap the customer in a broken card.
 *   - On a media ERROR the player swaps back to the card's poster and shows a
 *     small, non-blocking "Preview unavailable — try another video" note with
 *     a Retry button that re-mounts the player.
 *   - While the clip loads, a "Still loading…" hint appears after a grace
 *     period without metadata (no silent, forever-empty player).
 * Both states are captions within THIS card only: other demo cards stay
 * selectable the whole time.
 */
function DemoCardPlayer({
  demo,
}: {
  demo: DemoLibraryEntry
}): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  // Bumped by the Retry button to force a fresh <video> mount (a failed
  // media load is not retried by the browser on its own).
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [playbackFailed, setPlaybackFailed] = useState(false)
  const [metadataSlow, setMetadataSlow] = useState(false)

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    // `muted` already allows autoplay in every modern browser; this explicit
    // call is the fallback for the cases where the browser still refuses
    // (reduced data mode, backgrounded tab on first paint).
    const attempt = el.play()
    if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {})
  }, [demo.videoSrc, loadAttempt])

  useEffect(() => {
    // Every (re)mount starts clean: a demo change or a Retry re-arms the
    // slow-metadata watch below.
    setPlaybackFailed(false)
    setMetadataSlow(false)
    const timer = window.setTimeout(() => {
      const el = videoRef.current
      if (el && el.readyState < HTMLMediaElement.HAVE_METADATA && !el.error) setMetadataSlow(true)
    }, DEMO_PLAYER_METADATA_GRACE_MS)
    return () => window.clearTimeout(timer)
  }, [demo.videoSrc, loadAttempt])

  if (playbackFailed) {
    return (
      <div>
        <img
          src={demo.posterSrc}
          alt=""
          loading="lazy"
          style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 8, display: 'block', background: '#000' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          <span style={{ color: C.muted, fontSize: 11 }}>Preview unavailable — try another video</span>
          <button
            type="button"
            data-testid="demo-player-retry"
            onClick={(event) => {
              // Never re-trigger the card's own selection handler.
              event.stopPropagation()
              setLoadAttempt((attempt) => attempt + 1)
            }}
            style={secondaryButtonStyle}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <video
        // The inner key re-mounts the element (and thus reloads the clip)
        // without disturbing the parent-mounted player lifecycle.
        key={`demo-player-clip-${demo.videoSrc}-${loadAttempt}`}
        ref={videoRef}
        data-testid="demo-player"
        src={demo.videoSrc}
        poster={demo.posterSrc}
        muted
        playsInline
        loop
        autoPlay
        controls
        // Clicking the native controls must not re-trigger the card selection.
        onClick={(event) => event.stopPropagation()}
        onError={() => setPlaybackFailed(true)}
        onLoadedMetadata={() => setMetadataSlow(false)}
        onCanPlay={() => setMetadataSlow(false)}
        style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'contain', maxHeight: 340, borderRadius: 8, display: 'block', background: '#000' }}
      />
      {metadataSlow && (
        <span style={{ color: C.muted2, fontSize: 10, marginTop: 4, display: 'block' }}>Still loading…</span>
      )}
    </div>
  )
}

/**
 * Tab button used by Step 2's source picker. Renders an icon + label and
 * applies the active/cyan accent when `active` is true.
 */
function TabButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string
  icon: React.ComponentType<{ size?: number; color?: string }>
  active: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={chipStyle(active)}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Icon size={12} color={active ? C.cyan : C.muted} />
        {label}
      </span>
    </button>
  )
}
