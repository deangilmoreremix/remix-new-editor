'use client'

import { AddDesignsPanel } from './AddDesignsPanel'
import { ShapeExportPanel } from './ShapeExportPanel'
import { useEffect, useState } from 'react'
import { useAuthConfig } from '@ohb/lib/authConfig'
import type { FinalOutputPath } from '../finalOutput'
import { DesignGallery } from './DesignGallery'
import type { DesignSlot } from '../preview/types'
import { CheckCircle2, Download, Loader2, PlayCircle, ShieldCheck, Sparkles, Upload, X } from 'lucide-react'
import { useDemoPersonalize } from '../DemoPersonalizeProvider'
import { saveToRemixAssetLibrary } from '@ohb/lib/remixAssetLibrary'
import { BeforeAfterPreview } from '../preview/BeforeAfterPreview'
import { buildPreviewInput } from './buildPreviewInput'
import { OverlayEditor } from './OverlayEditor'
import { Tip } from './editor/Tip'
import { RemoveBrandingControl } from './RemoveBrandingControl'
import { videoBeforeRecast } from '../DemoPersonalizeProvider'
import { LayoutQualityPanel } from './LayoutQualityPanel'
import { useLayoutQuality } from './useLayoutQuality'
import { C, badgeStyle, chipStyle, hintStyle, inputStyle, labelStyle, panelStyle, primaryButtonStyle, secondaryButtonStyle, softPanelStyle } from './tokens'
import { PREVIEW_ASPECT_RATIOS } from '../preview/types'
import { PREVIEW_LAYOUTS } from '../preview/presets'
import { chooseFinalOutputPath } from '../finalOutput'
import { ExtraFormatsExport } from './ExtraFormatsExport'
import { CaptionsPanel } from './CaptionsPanel'

/**
 * Simple Mode step 4 — free Before/After preview, direct on-video overlay
 * editing, approval and handoff to one of two clearly different final-video
 * paths: a local branded render (overlays baked onto the selected video, no AI
 * credits) or the existing AI generation flow (changes that need new imagery).
 *
 * The branded render and AI generation are separate operations and the UI never
 * implies otherwise. Nothing in the preview itself calls MuAPI or OpenAI.
 */
/** Title of the preview video produced by "Remove branding", so the original can be offered back. */
const BRANDING_REMOVED_TITLE = 'Branding removed'

/** The two scenes that play around the video; designs that sit on top of it are added in the panel above. */
const SCENE_TABS: { slot: Exclude<DesignSlot, 'overlay'>; label: string; hint: string; none: string }[] = [
  { slot: 'intro', label: 'Opening scene', hint: 'Plays before your video starts. Any design works here.', none: 'None: start straight on your video' },
  { slot: 'outro', label: 'Closing scene', hint: 'Plays after your video ends, instead of the branded end card. Any design works here.', none: 'None: keep the branded end card' },
]

export function StepPreviewApprove(): React.JSX.Element {
  const ctx = useDemoPersonalize()
  const {
    source,
    access,
    clientForm = {},
    assets,
    previewSettings,
    previewVideo,
    setPreviewVideo,
    restoreOriginalVideo,
    updatePreviewComposition,
    remotionDesignTemplates = [],
    activeRemotionSceneIds = { intro: null, outro: null },
    setRemotionDesign = () => {},
    setPreviewLayout,
    previewApproved,
    approvalStale,
    approvePersonalization,
    setViewMode,
    setAdvancedTab,
    setAdvancedSection,
    createFinalVideo,
    shapeExport = { status: 'idle', items: [] },
    exportAllShapes = async () => {},
    cancelShapeExport = () => {},
    cancelExport,
    apiKey,
    generation,
    result,
    mode,
  } = ctx

  const generating = generation?.status === 'generating' || generation?.status === 'processing' || generation?.status === 'personalizing-prompt'
  const [sceneTab, setSceneTab] = useState<Exclude<DesignSlot, 'overlay'>>('intro')
  const inputProps = buildPreviewInput({ source, previewSettings, previewVideo, clientForm, assets })
  const quality = useLayoutQuality(inputProps)
  // Only a CONFIRMED critical rendering failure blocks the branded render; layout
  // judgments (Needs adjustment / Review required) only warn.
  const exportBlocked = quality.report.blocksExport
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  // True while "Also export other shapes" renders: the main render shares its renderer, so it waits.
  const [extraRunning, setExtraRunning] = useState(false)
  const rightsGate = quality.rightsNeedConfirmation && !rightsConfirmed
  // Overlay-only personalizations render locally; AI modes keep the generation
  // pipeline. The active path is the primary action; the other stays visible
  // (and disabled) so the two operations are never conflated.
  const finalPath = chooseFinalOutputPath({ personalizationMode: mode || null })
  // Two separate buttons, two separate operations: the free in-browser branded render, and AI generation on the visitor's own
  // key. Both are always available; `runningPath` remembers which one was pressed, `finalPath` which one the mode suggests.
  const [runningPath, setRunningPath] = useState<FinalOutputPath | null>(null)
  const isBrandedPath = (runningPath ?? finalPath) === 'branded-render'
  // Videos are generated on MuAPI, images on OpenAI: each with the visitor's own key for that service, kept in their browser.
  const auth = useAuthConfig()
  const isImageSource = source?.mediaType === 'image'
  const aiKeyName = isImageSource ? 'OpenAI' : 'MuAPI'
  const aiKey = isImageSource ? auth.openaiKey : auth.apiKey
  const saveAiKey = isImageSource ? auth.setOpenAiKey : auth.setApiKey
  const [showKeyForm, setShowKeyForm] = useState(false)
  const [keyDraft, setKeyDraft] = useState('')
  const [runAiAfterKey, setRunAiAfterKey] = useState(false)

  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)

  const runPath = async (path: FinalOutputPath) => {
    if (generating) return
    setRunningPath(path)
    try {
      await createFinalVideo({ path })
    } catch {
      /* generation errors surface through the existing generation state */
    }
  }

  const handleRender = () => runPath('branded-render')

  const handleGenerateAi = () => {
    // AI generation needs the visitor's own key: ask for it in place.
    if (!aiKey) {
      setShowKeyForm(true)
      return
    }
    void runPath('ai-generation')
  }

  const saveKeyAndGenerate = () => {
    const key = keyDraft.trim()
    if (!key) return
    saveAiKey(key)
    setKeyDraft('')
    setShowKeyForm(false)
    // The provider sees the new key on its next render; generate then.
    setRunAiAfterKey(true)
  }

  useEffect(() => {
    if (!runAiAfterKey || !aiKey) return
    setRunAiAfterKey(false)
    void runPath('ai-generation')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runAiAfterKey, aiKey])

  const handleDownload = () => {
    if (!result?.url) return
    const link = document.createElement('a')
    link.href = result.url
    link.download = (result.metadata?.fileName as string) || 'personalized-video.mp4'
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const handleUpload = async () => {
    if (!result?.url) return
    setIsUploading(true)
    setUploadError(null)
    setUploadSuccess(false)
    try {
      const response = await fetch(result.url)
      const blob = await response.blob()
      const fileName = (result.metadata?.fileName as string) || `personalized-video.${blob.type.replace('video/', '')}`
      const file = new File([blob], fileName, { type: blob.type })
      // remix: save into the permanent Asset Library the Library page lists.
      await saveToRemixAssetLibrary(file)
      setUploadSuccess(true)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.text }}>Preview and approve</h2>
        <p style={{ margin: '4px 0 0', color: C.muted, fontSize: 12, lineHeight: 1.55 }}>
          Watch the original and your personalized version side by side. Drag, resize and edit your branding
          directly on the video below. Previews are free and run in your browser.
        </p>
      </div>

      {/* ── Before / After ──────────────────────────────────────────────── */}
      <div style={panelStyle}>
        <BeforeAfterPreview inputProps={inputProps} defaultMode="toggle" />
      </div>

      {/* ── Quick adjustments ───────────────────────────────────────────── */}
      <div style={panelStyle}>
        <h3 style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: C.text }}>
          Quick adjustments
        </h3>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {PREVIEW_LAYOUTS.map((layout) => (
            <button
              key={layout.id}
              type="button"
              onClick={() => setPreviewLayout(layout.id)}
              aria-pressed={previewSettings.layout === layout.id}
              style={chipStyle(previewSettings.layout === layout.id)}
            >
              {layout.name}
            </button>
          ))}
        </div>
        <AddDesignsPanel />
        {remotionDesignTemplates.length > 0 ? (
          <div data-testid="scene-designs" style={{ marginTop: 14 }}>
            <div style={{ ...labelStyle, marginBottom: 6 }}>Opening and closing scenes <span style={{ color: C.muted, fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
            <div role="tablist" aria-label="Which scene" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {SCENE_TABS.map((tab) => {
                const chosen = remotionDesignTemplates.find((design) => design.id === activeRemotionSceneIds[tab.slot])
                return (
                  <button key={tab.slot} type="button" role="tab" aria-selected={sceneTab === tab.slot} onClick={() => setSceneTab(tab.slot)} style={{ ...chipStyle(sceneTab === tab.slot), display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, padding: '6px 12px', borderRadius: 10 }}>
                    <span>{tab.label}</span>
                    <span style={{ fontSize: 9, fontWeight: 600, color: chosen ? C.cyan : C.muted }}>{chosen ? chosen.name : 'None'}</span>
                  </button>
                )
              })}
            </div>
            <p style={{ ...hintStyle, marginTop: 0, marginBottom: 8 }}>
              {SCENE_TABS.find((tab) => tab.slot === sceneTab)?.hint} Each card uses your own logo, text and colors. Hover a card to watch it play, click to add it.
            </p>
            <DesignGallery
              key={sceneTab}
              designs={remotionDesignTemplates}
              activeDesignId={activeRemotionSceneIds[sceneTab]}
              onSelect={(designId) => setRemotionDesign(designId, sceneTab)}
              inputProps={inputProps}
              slot={sceneTab}
              noneLabel={SCENE_TABS.find((tab) => tab.slot === sceneTab)?.none}
            />
          </div>
        ) : null}
        <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 12 }}>
          <div>
            <label style={labelStyle} htmlFor="guided-aspect">Video shape</label>
            <select
              id="guided-aspect"
              value={previewSettings.aspectRatio}
              onChange={(event) =>
                updatePreviewComposition({ aspectRatio: event.target.value as (typeof PREVIEW_ASPECT_RATIOS)[number] })
              }
              style={{ ...softPanelStyle, width: '100%', color: C.text, fontSize: 12 }}
            >
              {PREVIEW_ASPECT_RATIOS.map((ratio) => (
                <option key={ratio} value={ratio}>{ratio}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle} htmlFor="guided-fps">Smoothness (frames per second)</label>
            <select
              id="guided-fps"
              value={previewSettings.fps}
              onChange={(event) => updatePreviewComposition({ fps: Number(event.target.value) })}
              style={{ ...softPanelStyle, width: '100%', color: C.text, fontSize: 12 }}
            >
              <option value={24}>24</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
            </select>
          </div>
          <div>
            <label style={labelStyle} htmlFor="guided-duration">Length (seconds)</label>
            <input
              id="guided-duration"
              type="number"
              min={1}
              max={120}
              value={Math.round(previewSettings.durationInFrames / (previewSettings.fps || 30))}
              onChange={(event) => {
                const seconds = Math.max(1, Number(event.target.value) || 1)
                updatePreviewComposition({ durationInFrames: Math.round(seconds * (previewSettings.fps || 30)) })
              }}
              style={{ ...softPanelStyle, width: '100%', color: C.text, fontSize: 12 }}
            />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: C.text, fontSize: 12, marginTop: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={previewSettings.showEndCard}
            onChange={(event) => updatePreviewComposition({ showEndCard: event.target.checked })}
          />
          End with a branded card (logo, contact details and final call to action)
        </label>
      </div>

      {/* ── Direct on-video overlay editing ─────────────────────────────── */}
      {/* The layout quality check sits directly under the video (no scrolling). */}
      <OverlayEditor
        inputProps={inputProps}
        liveStage
        belowStage={<LayoutQualityPanel compact quality={quality} layers={previewSettings.layers} />}
      />

      {/* ── Approve & create ────────────────────────────────────────────── */}
      <div style={{ ...panelStyle, border: `1px solid ${previewApproved ? 'rgba(34,197,94,.45)' : C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <ShieldCheck size={15} color={previewApproved ? C.green : C.cyan} />
          <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: C.text }}>
            Approve and create
          </h3>
          {previewApproved && <span style={badgeStyle('green')}><CheckCircle2 size={10} /> Approved</span>}
        </div>
        <p style={{ ...hintStyle, marginBottom: 12 }}>
          Approving saves your layout, colors and overlay positions. Previews are always free — choose
          how the final video is produced below: a branded render bakes your approved overlays onto the
          selected video, while AI generation is only for changes that need new imagery.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => approvePersonalization()}
            disabled={generating || previewApproved}
            style={{ ...secondaryButtonStyle, opacity: previewApproved ? 0.6 : 1 }}
          >
            {previewApproved ? 'Approved ✓' : 'Approve this personalization'}
          </button>
          {approvalStale && !previewApproved && (
            <span data-testid="guided-approval-stale" style={{ color: '#fcd34d', fontSize: 12 }}>
              Changed since you approved — approve again.
            </span>
          )}
          {(
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <Tip id="renderBranded" side="top">
                <button
                  type="button"
                  onClick={handleRender}
                  // The render uses exactly what was approved.
                  disabled={generating || extraRunning || shapeExport.status === 'running' || !previewApproved || exportBlocked || rightsGate}
                  title={isBrandedPath && !previewApproved ? 'Approve the preview first' : exportBlocked ? 'Fix the critical layout problem first' : rightsGate ? 'Confirm you may use this clip' : undefined}
                  aria-pressed={isBrandedPath}
                  style={{
                    ...(isBrandedPath ? primaryButtonStyle : secondaryButtonStyle),
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    opacity: generating ? 0.6 : previewApproved ? 1 : 0.5,
                  }}
                >
                  {generating && isBrandedPath ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
                  {generating && isBrandedPath
                    ? `Rendering… ${generation?.progress || 0}%`
                    : 'Render branded video'}
                </button>
                </Tip>
                <Tip id="generateAi" side="top">
                <button
                  type="button"
                  onClick={handleGenerateAi}
                  disabled={generating || rightsGate}
                  aria-pressed={!isBrandedPath}
                  style={{
                    ...(isBrandedPath ? secondaryButtonStyle : primaryButtonStyle),
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    opacity: generating ? 0.6 : 1,
                  }}
                >
                  {generating && !isBrandedPath ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {generating && !isBrandedPath
                    ? `Generating… ${generation?.progress || 0}%`
                    : 'Generate with AI'}
                </button>
                </Tip>
              </div>
              {showKeyForm && (
                <div data-testid="ai-key-form" style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ ...labelStyle, margin: 0 }} htmlFor="ai-key-input">
                    Your {aiKeyName} key
                  </label>
                  <p style={{ ...hintStyle, margin: 0 }}>
                    {isImageSource ? 'Images are made on OpenAI' : 'Videos are made on MuAPI'}, with your own key. It is kept in this browser only.
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      id="ai-key-input"
                      type="password"
                      autoComplete="off"
                      value={keyDraft}
                      onChange={(event) => setKeyDraft(event.target.value)}
                      placeholder={`Paste your ${aiKeyName} key`}
                      style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                    />
                    <button type="button" onClick={saveKeyAndGenerate} disabled={!keyDraft.trim()} style={primaryButtonStyle}>
                      Save key and generate
                    </button>
                    <button type="button" onClick={() => setShowKeyForm(false)} style={secondaryButtonStyle}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <RemoveBrandingControl
                apiKey={apiKey}
                videoUrl={inputProps.videoUrl}
                blocked={rightsGate}
                canRestore={previewVideo?.kind === 'recast' && previewVideo.title === BRANDING_REMOVED_TITLE}
                onApply={(url) => setPreviewVideo?.({ url, poster: null, title: BRANDING_REMOVED_TITLE, kind: 'recast', beforeRecast: videoBeforeRecast(previewVideo) })}
                onRestore={() => restoreOriginalVideo?.()}
              />
              {quality.rightsNeedConfirmation && (
                <label data-testid="guided-rights-confirm" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: C.text, cursor: 'pointer' }}>
                  <input type="checkbox" checked={rightsConfirmed} onChange={(e) => setRightsConfirmed(e.target.checked)} style={{ marginTop: 2 }} />
                  <span>
                    {quality.profile.rightsNote} I confirm I have the right to use this video commercially in my own
                    personalized video.
                  </span>
                </label>
              )}
              {exportBlocked && (
                <p data-testid="guided-export-blocked" style={{ ...hintStyle, color: C.danger }}>
                  The render is blocked: {quality.report.issues.filter((i) => i.severity === 'critical').map((i) => i.message).join(' ')}
                </p>
              )}
              {isBrandedPath && !previewApproved && !generating && (
                <p data-testid="guided-render-needs-approval" style={{ ...hintStyle, color: '#fcd34d' }}>
                  Approve the preview first — the render uses exactly what you approve.
                </p>
              )}
              {isBrandedPath && (
                <p data-testid="guided-ai-needs-mode" style={{ ...hintStyle }}>
                  To use <strong style={{ fontWeight: 800 }}>Generate with AI</strong>, choose an AI mode (Face only,
                  Full presenter, Recreate or Complete){' '}
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('advanced')
                      setAdvancedSection?.('create', 'output')
                      setAdvancedTab?.('create')
                    }}
                    style={{ background: 'none', border: 0, padding: 0, color: C.cyan, fontWeight: 800, cursor: 'pointer', font: 'inherit' }}
                  >
                    in Advanced Editing →
                  </button>
                </p>
              )}
              <p style={{ ...hintStyle, color: isBrandedPath ? C.cyan : C.muted }}>
                <strong style={{ fontWeight: 800 }}>Render branded video</strong> bakes your approved
                overlays (logo, text, CTA, end card) onto the selected video — no AI credits used.
              </p>
              <p style={{ ...hintStyle, color: isBrandedPath ? C.muted : C.cyan }}>
                <strong style={{ fontWeight: 800 }}>Generate with AI</strong> uses your own key for changes that need new imagery or footage.
              </p>
              {generating && isBrandedPath && (
                <button
                  type="button"
                  onClick={() => cancelExport()}
                  style={{
                    ...secondaryButtonStyle,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 4,
                    border: `1px solid ${C.danger}`,
                    color: C.danger,
                    background: 'rgba(239,68,68,.10)',
                  }}
                >
                  <X size={14} />
                  Cancel render
                </button>
              )}
            </div>
          )}
        </div>
        {isBrandedPath && !inputProps.isImageSource && <CaptionsPanel videoUrl={inputProps.videoUrl} disabled={generating} brand={inputProps.brand} />}
        {isBrandedPath && previewApproved && (
          <>
            {/* Two free ways to export other shapes. They share one renderer, so each is disabled while the other runs. */}
            <ExtraFormatsExport inputProps={inputProps} disabled={generating || exportBlocked || rightsGate || shapeExport.status === 'running'} onRunningChange={setExtraRunning} />
            <ShapeExportPanel
              state={shapeExport}
              disabled={generating || exportBlocked || rightsGate || extraRunning}
              onStart={() => { void exportAllShapes() }}
              onCancel={cancelShapeExport}
            />
          </>
        )}
        {generating && generation?.progressMessage && (
          <p style={{ ...hintStyle, marginTop: 8, color: C.cyan }}>{generation.progressMessage}</p>
        )}
        {generation?.status === 'error' && generation?.errorMessage && (
          <p style={{ ...hintStyle, marginTop: 8, color: C.danger }}>{generation.errorMessage}</p>
        )}
        {generation?.status === 'complete' && result?.type === 'video' && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
            <button
              type="button"
              onClick={handleDownload}
              style={{ ...primaryButtonStyle, display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <Download size={14} />
              Download video
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={isUploading || uploadSuccess}
              style={{ ...secondaryButtonStyle, display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {isUploading ? 'Uploading…' : uploadSuccess ? 'Uploaded' : 'Upload to Asset Library'}
            </button>
            {uploadError && <p style={{ ...hintStyle, color: C.danger }}>{uploadError}</p>}
            {uploadSuccess && <p style={{ ...hintStyle, color: C.green }}>Uploaded to Asset Library</p>}
          </div>
        )}
      </div>
    </div>
  )
}
