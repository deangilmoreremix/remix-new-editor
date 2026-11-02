'use client'

import { useState } from 'react'
import { CheckCircle2, Download, Loader2, PlayCircle, ShieldCheck, Sparkles, Upload, X } from 'lucide-react'
import { useDemoPersonalize } from '../DemoPersonalizeProvider'
import { uploadPersonalizationAsset } from '../assetUploadService'
import { BeforeAfterPreview } from '../preview/BeforeAfterPreview'
import { buildPreviewInput } from './buildPreviewInput'
import { OverlayEditor } from './OverlayEditor'
import { C, badgeStyle, chipStyle, hintStyle, labelStyle, panelStyle, primaryButtonStyle, secondaryButtonStyle, softPanelStyle } from './tokens'
import { PREVIEW_ASPECT_RATIOS } from '../preview/types'
import { PREVIEW_LAYOUTS } from '../preview/presets'
import { getRemotionDesignFixedSvgIdWarning } from '../templates/catalog'
import { chooseFinalOutputPath } from '../finalOutput'

/**
 * Simple Mode step 4 — free Before/After preview, direct on-video overlay
 * editing, approval and handoff to one of two clearly different final-video
 * paths: a local branded render (overlays baked onto the selected video, no AI
 * credits) or the existing AI generation flow (changes that need new imagery).
 *
 * The branded render and AI generation are separate operations and the UI never
 * implies otherwise. Nothing in the preview itself calls MuAPI or OpenAI.
 */
export function StepPreviewApprove(): React.JSX.Element {
  const ctx = useDemoPersonalize()
  const {
    source,
    access,
    clientForm = {},
    assets,
    previewSettings,
    previewVideo,
    updatePreviewComposition,
    setPreviewLayout,
    remotionDesignTemplates = [],
    activeRemotionDesignId = null,
    setRemotionDesign = () => {},
    remotionDesignError = null,
    previewApproved,
    approvePersonalization,
    createFinalVideo,
    cancelExport,
    apiKey,
    generation,
    result,
    mode,
  } = ctx

  const isAnonymous = access !== 'authenticated'
  const generating = generation?.status === 'generating' || generation?.status === 'processing' || generation?.status === 'personalizing-prompt'
  const inputProps = buildPreviewInput({ source, previewSettings, previewVideo, clientForm, assets })
  // Overlay-only personalizations render locally; AI modes keep the generation
  // pipeline. The active path is the primary action; the other stays visible
  // (and disabled) so the two operations are never conflated.
  const finalPath = chooseFinalOutputPath({ personalizationMode: mode || null })
  const isBrandedPath = finalPath === 'branded-render'
  // Phase 3 item 13: some frozen upstream designs hardcode SVG `id`s, so a
  // second instance of the same design is clipped by the first. The catalog
  // declares which designs are constrained; Step 4 shows a non-blocking
  // note next to the "Designs" chip row when the selected one is affected.
  const fixedSvgIdWarning = getRemotionDesignFixedSvgIdWarning(activeRemotionDesignId)

  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)

  const handleCreate = async () => {
    if (generating) return
    try {
      await createFinalVideo()
    } catch {
      /* generation errors surface through the existing generation state */
    }
  }

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
    if (!result?.url || !apiKey) return
    setIsUploading(true)
    setUploadError(null)
    setUploadSuccess(false)
    try {
      const response = await fetch(result.url)
      const blob = await response.blob()
      const fileName = (result.metadata?.fileName as string) || `personalized-video.${blob.type.replace('video/', '')}`
      const file = new File([blob], fileName, { type: blob.type })
      await uploadPersonalizationAsset(apiKey, { file })
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
        {remotionDesignTemplates.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ ...labelStyle, marginBottom: 6 }}>Designs</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {remotionDesignTemplates.map((design) => (
                <button
                  key={design.id}
                  type="button"
                  onClick={() => setRemotionDesign(activeRemotionDesignId === design.id ? null : design.id)}
                  aria-pressed={activeRemotionDesignId === design.id}
                  title={design.description}
                  style={chipStyle(activeRemotionDesignId === design.id)}
                >
                  {design.name}
                </button>
              ))}
            </div>
            {fixedSvgIdWarning ? (
              <p role="note" style={{ ...hintStyle, marginTop: 8 }}>
                {fixedSvgIdWarning}
              </p>
            ) : null}
            {remotionDesignError ? (
              <p style={{ ...hintStyle, color: C.danger, marginTop: 8 }}>{remotionDesignError}</p>
            ) : null}
          </div>
        )}
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
      <OverlayEditor inputProps={inputProps} />

      {/* ── Approve & create ────────────────────────────────────────────── */}
      <div style={{ ...panelStyle, border: `1px solid ${previewApproved ? 'rgba(40,201,139,.45)' : C.border}` }}>
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
            disabled={generating}
            style={{ ...secondaryButtonStyle, opacity: previewApproved ? 0.6 : 1 }}
          >
            {previewApproved ? 'Approved' : 'Approve this personalization'}
          </button>
          {isAnonymous ? (
            <span style={{ color: C.muted, fontSize: 12 }}>
              Sign in to create your final video — the preview is always free.
            </span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={generating || !isBrandedPath}
                  aria-pressed={isBrandedPath}
                  style={{
                    ...(isBrandedPath ? primaryButtonStyle : secondaryButtonStyle),
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    opacity: generating ? 0.6 : isBrandedPath ? 1 : 0.5,
                  }}
                >
                  {generating && isBrandedPath ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
                  {generating && isBrandedPath
                    ? `Rendering… ${generation?.progress || 0}%`
                    : 'Render branded video'}
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={generating || isBrandedPath}
                  aria-pressed={!isBrandedPath}
                  style={{
                    ...(isBrandedPath ? secondaryButtonStyle : primaryButtonStyle),
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    opacity: generating ? 0.6 : isBrandedPath ? 0.5 : 1,
                  }}
                >
                  {generating && !isBrandedPath ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {generating && !isBrandedPath
                    ? `Generating… ${generation?.progress || 0}%`
                    : 'Generate with AI'}
                </button>
              </div>
              <p style={{ ...hintStyle, color: isBrandedPath ? C.cyan : C.muted }}>
                <strong style={{ fontWeight: 800 }}>Render branded video</strong> bakes your approved
                overlays (logo, text, CTA, end card) onto the selected video — no AI credits used.
              </p>
              <p style={{ ...hintStyle, color: isBrandedPath ? C.muted : C.cyan }}>
                <strong style={{ fontWeight: 800 }}>Generate with AI</strong> uses your account&apos;s AI
                generation for changes that need new imagery or footage.
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
                    background: 'rgba(239,91,103,.10)',
                  }}
                >
                  <X size={14} />
                  Cancel render
                </button>
              )}
            </div>
          )}
        </div>
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
