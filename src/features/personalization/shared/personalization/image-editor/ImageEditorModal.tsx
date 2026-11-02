'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  Check,
  ChevronDown,
  GitCompare,
  FlipHorizontal,
  FlipVertical,
  Grid3X3,
  Layers3,
  Loader2,
  MessageSquare,
  Paintbrush,
  Redo2,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Type,
  Undo2,
  Wand2,
  X,
} from 'lucide-react'
import { type ImageFormat, type ImageSize } from '@ohb/shared/api/openaiImage'
import { editSmartVideoGoImage } from './imageEditApi'
import { buttons, iconBadge, semantic } from '@ohb/shared/styles/designTokens'
import type {
  AssetRole,
  DiscoveredAssetCategory,
  PersonalizationVisionAnalysis,
  PersonalizationVisionValidation,
} from '../types'
import MaskEditor from './MaskEditor'
import { ensureModelSupportedImage } from './normalizeImage'
import {
  getAssetRecipe,
  getSourceAssetRecipe,
  getOperation,
  operationGroupsForAsset,
  resolveEditorAssetKind,
  type EditorOperationGroup,
  type EditorOperationId,
  IMAGE_EDIT_OPERATIONS,
} from './imageEditRegistry'
import {
  analyzePersonalizationImages,
  responsesSmartEditStream,
  validatePersonalizationImageEdit,
} from './responsesVisionApi'

export type PersonalizationImageEditorAsset = {
  id: string
  name?: string
  imageUrl: string
  originalImageUrl: string
  category?: DiscoveredAssetCategory
  role?: AssetRole
  source: 'discovered' | 'current-job' | 'saved-client'
  clientId?: string
  businessName?: string
  industry?: string
  productService?: string
  brandDescription?: string
  referenceImages?: string[]
  visionAnalysis?: PersonalizationVisionAnalysis
  file?: File
}

export type ImageEditorApplyResult = {
  dataUrl: string
  originalUrl: string
  operation: string
  prompt: string
  model: 'gpt-image-2.5-flare' | 'gpt-image-2.5-sunburst' | 'local'
  quality: string
  transparent: boolean
  videoReady: boolean
  visionAnalysis?: PersonalizationVisionAnalysis
  visionValidation?: PersonalizationVisionValidation
  responseId?: string | null
  imageGenerationCallId?: string | null
  revisedPrompt?: string | null
  outputFormat?: 'png' | 'jpeg' | 'webp'
  outputCompression?: number | null
  inputFidelity?: 'high' | 'low'
}

type Props = {
  open: boolean
  asset: PersonalizationImageEditorAsset | null
  onClose: () => void
  onApply: (result: ImageEditorApplyResult) => Promise<void> | void
  onDropAsset?: (payload: { assetId: string; source: string; assetType: string }) => void
}

type ModelMode = 'auto' | 'fast' | 'precision'
type AspectRatio = 'original' | '9:16' | '16:9' | '1:1' | '4:5'
type EditorMode = 'simple' | 'advanced'
type FitMode = 'contain' | 'cover'
type TextPosition = 'top' | 'center' | 'bottom'
type ProtectionKey = 'subject' | 'face' | 'product' | 'logo' | 'text' | 'brandColors'

type Protections = Record<ProtectionKey, boolean>

const PROTECTION_LABELS: Record<ProtectionKey, string> = {
  subject: 'Subject',
  face: 'Face / Identity',
  product: 'Product',
  logo: 'Logo',
  text: 'Text',
  brandColors: 'Brand Colors',
}

function defaultProtections(kind: ReturnType<typeof resolveEditorAssetKind>): Protections {
  return {
    subject: true,
    face: kind === 'person' || kind === 'team',
    product: kind === 'product',
    logo: kind === 'logo' || kind === 'brand' || kind === 'storefront' || kind === 'branded_vehicle' || kind === 'cta_graphic',
    text: kind === 'logo' || kind === 'product' || kind === 'brand' || kind === 'storefront' || kind === 'branded_vehicle' || kind === 'cta_graphic' || kind === 'last_frame',
    brandColors: kind !== 'general' && kind !== 'background_reference',
  }
}

type Version = {
  id: string
  label: string
  dataUrl: string
  operation: string
  prompt: string
  model: ImageEditorApplyResult['model']
  transparent: boolean
  videoReady: boolean
  responseId?: string | null
  imageGenerationCallId?: string | null
  revisedPrompt?: string | null
  visionValidation?: PersonalizationVisionValidation
}

const aspectSizes: Record<Exclude<AspectRatio, 'original'>, ImageSize> = {
  '9:16': '1024x1792',
  '16:9': '1792x1024',
  '1:1': '1024x1024',
  '4:5': '1024x1280',
}

const aspectCanvas: Record<Exclude<AspectRatio, 'original'>, [number, number]> = {
  '9:16': [1024, 1792],
  '16:9': [1792, 1024],
  '1:1': [1024, 1024],
  '4:5': [1024, 1280],
}

const GROUP_LABELS: Record<EditorOperationGroup, string> = {
  smart: 'Smart',
  background: 'Background',
  subject: 'Subject',
  people: 'People',
  product: 'Product',
  brand: 'Brand',
  object: 'Objects',
  text: 'Text',
  scene: 'Scene',
  video: 'Video',
  effects: 'Effects',
  transform: 'Transform',
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',')
  const header = parts[0] || ''
  const base64 = parts[1] || ''
  const mime = header.match(/:(.*?);/)?.[1] || 'image/png'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Unable to read image'))
    reader.readAsDataURL(blob)
  })
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Unable to load image'))
    if (/^https?:\/\//i.test(url)) {
      img.crossOrigin = 'anonymous'
    }
    img.src = url
  })
}


async function normalizeDataUrlToPng(dataUrl: string): Promise<string> {
  if (dataUrl.startsWith('data:image/png')) return dataUrl
  const image = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Browser canvas is unavailable')
  ctx.drawImage(image, 0, 0)
  return canvas.toDataURL('image/png')
}

function fileExtension(format: ImageFormat) {
  if (format === 'jpeg') return 'jpg'
  return format
}

export default function ImageEditorModal({ open, asset, onClose, onApply, onDropAsset }: Props) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const mountedRef = useRef(true)

  const [editorMode, setEditorMode] = useState<EditorMode>('simple')
  const [modelMode, setModelMode] = useState<ModelMode>('auto')
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('original')
  const [outputFormat, setOutputFormat] = useState<ImageFormat>('png')
  const [outputCompression, setOutputCompression] = useState<number | undefined>(undefined)
  const [versions, setVersions] = useState<Version[]>([])
  const [versionIndex, setVersionIndex] = useState(0)
  const [customPrompt, setCustomPrompt] = useState('')
  const [busyLabel, setBusyLabel] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [activeGroup, setActiveGroup] = useState<EditorOperationGroup>('smart')
  const [maskMode, setMaskMode] = useState(false)
  const [maskBlob, setMaskBlob] = useState<Blob | null>(null)
  const [safeArea, setSafeArea] = useState(false)
  const [protections, setProtections] = useState<Protections>(() => defaultProtections('general'))
  const [visionAnalysis, setVisionAnalysis] = useState<PersonalizationVisionAnalysis | undefined>(undefined)
  const [visionAnalyzing, setVisionAnalyzing] = useState(false)
  const [validationOverrideVersionId, setValidationOverrideVersionId] = useState<string | null>(null)
  const [streamingPreview, setStreamingPreview] = useState<string | null>(null)
  const [smartEditFailed, setSmartEditFailed] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const [rotation, setRotation] = useState(0)
  const [flipX, setFlipX] = useState(false)
  const [flipY, setFlipY] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [saturation, setSaturation] = useState(100)
  const [opacity, setOpacity] = useState(100)
  const [blur, setBlur] = useState(0)
  const [grayscale, setGrayscale] = useState(0)
  const [sepia, setSepia] = useState(0)
  const [padding, setPadding] = useState(0)
  const [borderSize, setBorderSize] = useState(0)
  const [shadow, setShadow] = useState(0)
  const [fitMode, setFitMode] = useState<FitMode>('contain')
  const [backgroundColor, setBackgroundColor] = useState('transparent')
  const [overlayText, setOverlayText] = useState('')
  const [textSize, setTextSize] = useState(48)
  const [textPosition, setTextPosition] = useState<TextPosition>('bottom')

  const kind = useMemo(() => resolveEditorAssetKind(asset?.category, asset?.role), [asset?.category, asset?.role])
  const recipe = useMemo(() => getAssetRecipe(asset?.category, asset?.role), [asset?.category, asset?.role])
  const sourceRecipe = useMemo(() => getSourceAssetRecipe(asset?.category, asset?.role), [asset?.category, asset?.role])
  const groupedOperations = useMemo(() => operationGroupsForAsset(kind), [kind])
  const mergedPreserve = useMemo(
    () => Array.from(new Set([
      ...(sourceRecipe.preserve || []),
      ...(recipe.preserve || []),
      ...(visionAnalysis?.preserve || []),
    ])),
    [recipe.preserve, sourceRecipe.preserve, visionAnalysis?.preserve],
  )

  useEffect(() => {
    if (!open || !asset) return
    previousFocusRef.current = document.activeElement as HTMLElement | null
    setEditorMode('simple')
    setModelMode('auto')
    setAspectRatio('original')
    setOutputFormat('png')
    setVersions([{
      id: 'original',
      label: 'Original',
      dataUrl: asset.originalImageUrl,
      operation: 'original',
      prompt: '',
      model: 'local',
      transparent: false,
      videoReady: false,
    }])
    setVersionIndex(0)
    setCustomPrompt('')
    setBusyLabel(null)
    setSaving(false)
    setError(null)
    setSmartEditFailed(false)
    setCompareMode(false)
    setActiveGroup('smart')
    setMaskMode(false)
    setMaskBlob(null)
    setSafeArea(false)
    setProtections(defaultProtections(kind))
    setVisionAnalysis(asset.visionAnalysis)
    setVisionAnalyzing(false)
    setValidationOverrideVersionId(null)
    setStreamingPreview(null)
    resetLocalControls()
  }, [open, asset?.id, kind])

  useEffect(() => {
    if (!open) return
    const modal = modalRef.current
    if (!modal) return
    const focusable = modal.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    first?.focus()

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      previousFocusRef.current?.focus()
    }
  }, [open, onClose])

  useEffect(() => {
    if (versions.length === 0) return
    setVersionIndex((value) => Math.max(0, Math.min(versions.length - 1, value)))
  }, [versions.length])

  const currentVersion = versions[versionIndex]
  const displayUrl = currentVersion?.dataUrl || asset?.imageUrl || ''
  const hasChanges = versionIndex > 0 || versions.length > 1

  const resolvedModel = useCallback((operationId: EditorOperationId) => {
    const operation = getOperation(operationId)
    if (modelMode === 'fast') return 'gpt-image-2.5-flare' as const
    if (modelMode === 'precision') return 'gpt-image-2.5-sunburst' as const
    return operation?.precision || sourceRecipe.precisionRecommended || recipe.precisionRecommended || visionAnalysis?.precisionRecommended
      ? 'gpt-image-2.5-sunburst' as const
      : 'gpt-image-2.5-flare' as const
  }, [modelMode, recipe.precisionRecommended, sourceRecipe.precisionRecommended, visionAnalysis?.precisionRecommended])

  const readDataUrl = useCallback(async (url: string) => {
    if (url.startsWith('data:')) return url
    if (url.startsWith('blob:')) {
      const sourceFile = asset?.file
      if (sourceFile instanceof File) {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || ''))
          reader.onerror = () => reject(new Error('Unable to read local image file'))
          reader.readAsDataURL(sourceFile)
        })
      }
    }

    const downloadRes = await fetch('/api/personalization/download-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ urls: [url] }),
    })
    let payload: Record<string, unknown>
    try {
      payload = await downloadRes.json()
    } catch {
      if (!downloadRes.ok) throw new Error('Unable to prepare image for editing')
      throw new Error('Unable to parse download response')
    }
    if (!downloadRes.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : `Download failed (HTTP ${downloadRes.status})`)
    const result = payload?.results?.[0]
    if (!result?.ok || !result?.dataUrl) throw new Error(typeof result?.error === 'string' ? result.error : 'Unable to download image')
    return result.dataUrl as string
  }, [asset?.file])

  // Websites serve SVG, ICO and AVIF files the models reject as "not a valid
  // image"; those are re-encoded as PNG. Supported images pass through at
  // their natural size, which MaskEditor's masks are drawn at.
  const prepareDataUrl = useCallback(
    async (url: string) => ensureModelSupportedImage(await readDataUrl(url)),
    [readDataUrl],
  )

  const analyzeCurrentImage = useCallback(async (sourceUrl = displayUrl) => {
    if (!asset) return undefined
    setVisionAnalyzing(true)
    try {
      const imageUrl = await prepareDataUrl(sourceUrl)
      const analyses = await analyzePersonalizationImages({
        images: [{
          id: asset.id,
          imageUrl,
          categoryHint: asset.category,
          roleHint: asset.role,
        }],
        businessContext: {
          businessName: asset.businessName,
          industry: asset.industry,
          productService: asset.productService,
          brandDescription: asset.brandDescription,
        },
        targetVideoFormat: aspectRatio === 'original' ? undefined : aspectRatio,
      })
      const analysis = analyses[0]
      if (analysis && mountedRef.current) {
        setVisionAnalysis(analysis)
        if (analysis.precisionRecommended && modelMode === 'auto') {
          // Auto routing will select Sunburst through resolvedModel.
        }
      }
      return analysis
    } finally {
      if (mountedRef.current) setVisionAnalyzing(false)
    }
  }, [asset, aspectRatio, displayUrl, modelMode, prepareDataUrl])

  const buildPrompt = useCallback((operationId: EditorOperationId, custom = '') => {
    const operation = getOperation(operationId)
    const businessContext = [asset?.businessName, asset?.industry].filter(Boolean).join(' - ')
    const preserve = mergedPreserve.length ? ' Preserve: ' + mergedPreserve.join(', ') + '.' : ''
    const explicitProtections = (Object.entries(protections) as [ProtectionKey, boolean][])
      .filter(([, enabled]) => enabled)
      .map(([key]) => PROTECTION_LABELS[key])
    const protectionInstruction = explicitProtections.length
      ? ' Do not alter these protected elements unless the requested operation explicitly requires it: ' + explicitProtections.join(', ') + '.'
      : ''
    const context = businessContext ? ' Business context: ' + businessContext + '.' : ''
    const ratio = aspectRatio === 'original' ? '' : ' Target composition: ' + aspectRatio + '.'
    const maskInstruction = maskBlob ? ' Apply the requested change primarily to the masked region and preserve unmasked content as closely as possible.' : ''
    const userInstruction = operationId === 'custom' ? custom.trim() : operation.prompt
    return 'Edit this image for SmartVideo GO. ' + userInstruction + preserve + protectionInstruction + context + ratio + maskInstruction
  }, [asset?.businessName, asset?.industry, aspectRatio, maskBlob, mergedPreserve, protections])

  const appendVersion = useCallback((version: Omit<Version, 'id'>) => {
    const next: Version = {
      ...version,
      id: 'version_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    }
    setVersions((previous) => {
      const truncated = previous.slice(0, versionIndex + 1)
      return [...truncated, next]
    })
    setVersionIndex(versionIndex + 1)
  }, [versionIndex])

  const executeAiEdit = useCallback(async (
    operationId: EditorOperationId,
    sourceUrl: string,
    custom = '',
    addVersion = true,
    options: { forceTransparent?: boolean; useMask?: boolean } = {},
  ) => {
    if (!asset) throw new Error('No image selected')
    const operation = getOperation(operationId)
    const activeMask = options.useMask === false ? null : maskBlob
    let sourceDataUrl = await prepareDataUrl(sourceUrl)
    if (activeMask) sourceDataUrl = await normalizeDataUrlToPng(sourceDataUrl)
    const sourceBlob = dataUrlToBlob(sourceDataUrl)
    const model = resolvedModel(operationId)
    const prompt = buildPrompt(operationId, custom)
    const transparent = Boolean(options.forceTransparent || operation.transparency || (operationId === 'video_ready' && recipe.transparencyRecommended))
    const quality = model === 'gpt-image-2.5-sunburst' ? (modelMode === 'precision' ? 'xhigh' : 'high') : 'medium'
    const size = aspectRatio === 'original' ? 'auto' : aspectSizes[aspectRatio]
    const format: ImageFormat = transparent && outputFormat === 'jpeg' ? 'png' : outputFormat

    const results = await editSmartVideoGoImage({
      operation: operationId,
      prompt,
      image: sourceBlob,
      mask: activeMask && operation.supportsMask ? activeMask : undefined,
      model,
      quality,
      size,
      outputFormat: format,
      background: transparent ? 'transparent' : 'auto',
      inputFidelity: operation?.precision || sourceRecipe.precisionRecommended || recipe.precisionRecommended || visionAnalysis?.precisionRecommended ? 'high' : 'low',
    })

    const first = results?.[0]
    let dataUrl = first?.b64_json ? 'data:image/' + format + ';base64,' + first.b64_json : ''

    if (!dataUrl && first?.url) dataUrl = await prepareDataUrl(first.url)
    if (!dataUrl) throw new Error('The AI edit completed without an image result')

    const version = {
      label: operation.label,
      dataUrl,
      operation: operationId,
      prompt,
      model,
      transparent,
      videoReady: operationId === 'video_ready',
    } satisfies Omit<Version, 'id'>

    if (addVersion) appendVersion(version)
    return version
  }, [appendVersion, aspectRatio, asset, buildPrompt, maskBlob, modelMode, outputFormat, prepareDataUrl, recipe.precisionRecommended, recipe.transparencyRecommended, resolvedModel, sourceRecipe.precisionRecommended, visionAnalysis?.precisionRecommended])

  const runAiEdit = useCallback(async (operationId: EditorOperationId, custom = '') => {
    if (operationId === 'custom' && !custom.trim()) return
    setError(null)
    setBusyLabel(getOperation(operationId).label)
    try {
      await executeAiEdit(operationId, displayUrl, custom)
      if (operationId === 'custom') setCustomPrompt('')
      setMaskBlob(null)
      setMaskMode(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image edit failed')
    } finally {
      setBusyLabel(null)
    }
  }, [displayUrl, executeAiEdit])

  const runResponsesSmartEdit = useCallback(async () => {
    if (!asset || !customPrompt.trim()) return
    // Masks are deterministic regional edits; keep those on the direct image-edit path.
    if (maskBlob) {
      await runAiEdit('custom', customPrompt)
      return
    }

    setError(null)
    setSmartEditFailed(false)
    setBusyLabel('Smart Edit')
    try {
      const canContinueConversation = Boolean(currentVersion?.responseId)
      const sourceImage = canContinueConversation ? undefined : await prepareDataUrl(displayUrl)
      const references = canContinueConversation
        ? []
        : (await Promise.all((asset.referenceImages || []).slice(0, 6).map((url) => prepareDataUrl(url).catch(() => '')))).filter(Boolean)
      const model = resolvedModel('custom')
      setStreamingPreview(null)
      const result = await responsesSmartEditStream({
        imageUrl: sourceImage,
        referenceImages: references,
        prompt: customPrompt.trim(),
        previousResponseId: currentVersion?.responseId || undefined,
        imageModel: model,
        action: canContinueConversation ? 'auto' : 'edit',
        quality: model === 'gpt-image-2.5-sunburst' ? (modelMode === 'precision' ? 'xhigh' : 'high') : 'medium',
        size: aspectRatio === 'original' ? undefined : aspectSizes[aspectRatio],
        background: 'auto',
        outputFormat,
        outputCompression,
        inputFidelity: sourceRecipe.precisionRecommended || recipe.precisionRecommended || visionAnalysis?.precisionRecommended ? 'high' : 'low',
        businessContext: {
          businessName: asset.businessName,
          industry: asset.industry,
          productService: asset.productService,
          brandDescription: asset.brandDescription,
          targetRole: visionAnalysis?.targetRole || recipe.outputRole,
          preserve: mergedPreserve,
        },
        partialImages: 2,
      }, (partialDataUrl) => {
        if (mountedRef.current) setStreamingPreview(partialDataUrl)
      })

      appendVersion({
        label: 'Smart Edit',
        dataUrl: result.imageDataUrl,
        operation: 'custom',
        prompt: customPrompt.trim(),
        model: result.model,
        transparent: false,
        videoReady: false,
        responseId: result.responseId,
        imageGenerationCallId: result.imageGenerationCallId,
        revisedPrompt: result.revisedPrompt,
      })
      if (mountedRef.current) setCustomPrompt('')
      if (mountedRef.current) setValidationOverrideVersionId(null)
      if (mountedRef.current) setSmartEditFailed(false)
    } catch (err) {
      if (mountedRef.current) {
        setSmartEditFailed(true)
        setError(err instanceof Error ? err.message : 'SmartVideo GO Smart Edit failed')
      }
    } finally {
      if (mountedRef.current) {
        setStreamingPreview(null)
        setBusyLabel(null)
      }
    }
  }, [
    appendVersion,
    aspectRatio,
    asset,
    currentVersion?.responseId,
    customPrompt,
    displayUrl,
    maskBlob,
    mergedPreserve,
    modelMode,
    prepareDataUrl,
    recipe.outputRole,
    resolvedModel,
    runAiEdit,
    smartEditFailed,
    visionAnalysis?.targetRole,
  ])

  const runVideoReady = useCallback(async () => {
    if (!asset) return
    setError(null)
    setBusyLabel('SmartVideo GO is analyzing this asset')
    try {
      const analysis = visionAnalysis || await analyzeCurrentImage(displayUrl)
      setBusyLabel('SmartVideo GO is making this video ready')
      let source = displayUrl
      let finalResult: Omit<Version, 'id'> | null = null
      let preserveTransparency = false

      const visionSteps = (analysis?.recommendedOperations || [])
        .filter((id): id is EditorOperationId => id in IMAGE_EDIT_OPERATIONS)
        .filter((id) => {
          const operation = IMAGE_EDIT_OPERATIONS[id]
          const applicable = operation.applicableTo
          return (
            id !== 'custom' &&
            id !== 'video_ready' &&
            !operation.destructiveCreative &&
            (!applicable || applicable.includes(kind))
          )
        })
        .slice(0, 3)
      const recipeSteps = recipe.makeVideoReadySteps.length ? recipe.makeVideoReadySteps : ['video_ready'] as EditorOperationId[]
      const steps = Array.from(new Set([...visionSteps, ...recipeSteps])).slice(0, 4)

      for (const stepId of steps) {
        const step = getOperation(stepId)
        preserveTransparency = preserveTransparency || Boolean(step.transparency) || (stepId === 'video_ready' && recipe.transparencyRecommended)
        finalResult = await executeAiEdit(stepId, source, '', false, {
          forceTransparent: preserveTransparency,
          useMask: false,
        })
        source = finalResult.dataUrl
      }

      if (finalResult && mountedRef.current) {
        appendVersion({
          ...finalResult,
          label: 'Make Video Ready',
          operation: 'video_ready',
          videoReady: true,
        })
      }
      if (mountedRef.current) {
        setMaskBlob(null)
        setMaskMode(false)
      }
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'Make Video Ready failed')
    } finally {
      if (mountedRef.current) setBusyLabel(null)
    }
  }, [analyzeCurrentImage, appendVersion, asset, displayUrl, executeAiEdit, kind, recipe.makeVideoReadySteps, visionAnalysis])

  function resetLocalControls() {
    setRotation(0)
    setFlipX(false)
    setFlipY(false)
    setZoom(100)
    setBrightness(100)
    setContrast(100)
    setSaturation(100)
    setOpacity(100)
    setBlur(0)
    setGrayscale(0)
    setSepia(0)
    setPadding(0)
    setBorderSize(0)
    setShadow(0)
    setFitMode('contain')
    setBackgroundColor('transparent')
    setOverlayText('')
    setTextSize(48)
    setTextPosition('bottom')
  }

  const applyLocalAdjustments = useCallback(async () => {
    setError(null)
    setBusyLabel('Applying local edit')
    try {
      // Try the fast path first: load the source image directly. data: /
      // blob: URLs are same-origin so they always succeed; remote http(s)
      // URLs go through crossOrigin='anonymous' and succeed when the
      // remote server returns permissive CORS headers. If the remote
      // server doesn't, fall through to the existing same-origin
      // /api/personalization/download-image proxy (which performs SSRF,
      // MIME, size and timeout checks) and load the data URL it returns.
      let source = displayUrl
      let image: HTMLImageElement
      try {
        image = await loadImage(displayUrl)
      } catch {
        source = await prepareDataUrl(displayUrl)
        image = await loadImage(source)
      }
      let canvasWidth = image.naturalWidth
      let canvasHeight = image.naturalHeight
      if (aspectRatio !== 'original') [canvasWidth, canvasHeight] = aspectCanvas[aspectRatio]

      const maxEdge = 2048
      const edgeScale = Math.min(1, maxEdge / Math.max(canvasWidth, canvasHeight))
      canvasWidth = Math.max(1, Math.round(canvasWidth * edgeScale))
      canvasHeight = Math.max(1, Math.round(canvasHeight * edgeScale))

      const canvas = document.createElement('canvas')
      canvas.width = canvasWidth
      canvas.height = canvasHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Browser canvas is unavailable')

      ctx.clearRect(0, 0, canvasWidth, canvasHeight)
      if (backgroundColor !== 'transparent') {
        ctx.fillStyle = backgroundColor
        ctx.fillRect(0, 0, canvasWidth, canvasHeight)
      }

      const innerWidth = Math.max(1, canvasWidth - padding * 2)
      const innerHeight = Math.max(1, canvasHeight - padding * 2)
      const containScale = Math.min(innerWidth / image.naturalWidth, innerHeight / image.naturalHeight)
      const coverScale = Math.max(innerWidth / image.naturalWidth, innerHeight / image.naturalHeight)
      const baseScale = fitMode === 'cover' ? coverScale : containScale
      const scale = baseScale * (zoom / 100)
      const drawWidth = image.naturalWidth * scale
      const drawHeight = image.naturalHeight * scale

      ctx.save()
      ctx.translate(canvasWidth / 2, canvasHeight / 2)
      ctx.rotate((rotation * Math.PI) / 180)
      ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1)
      ctx.globalAlpha = opacity / 100
      ctx.filter =
        'brightness(' + brightness + '%) contrast(' + contrast + '%) saturate(' + saturation + '%) ' +
        'blur(' + blur + 'px) grayscale(' + grayscale + '%) sepia(' + sepia + '%)'
      if (shadow > 0) {
        ctx.shadowColor = 'rgba(0,0,0,.45)'
        ctx.shadowBlur = shadow
        ctx.shadowOffsetY = Math.max(2, shadow / 3)
      }
      ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
      ctx.restore()

      if (borderSize > 0) {
        ctx.save()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = borderSize
        ctx.strokeRect(borderSize / 2, borderSize / 2, canvasWidth - borderSize, canvasHeight - borderSize)
        ctx.restore()
      }

      if (overlayText.trim()) {
        ctx.save()
        const scaledSize = Math.max(18, Math.round(textSize * edgeScale))
        ctx.font = '700 ' + scaledSize + 'px system-ui, -apple-system, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.lineWidth = Math.max(3, scaledSize * 0.08)
        ctx.strokeStyle = 'rgba(0,0,0,.75)'
        ctx.fillStyle = '#ffffff'
        const y = textPosition === 'top' ? scaledSize * 1.3 : textPosition === 'center' ? canvasHeight / 2 : canvasHeight - scaledSize * 1.3
        ctx.strokeText(overlayText.trim(), canvasWidth / 2, y, canvasWidth * 0.9)
        ctx.fillText(overlayText.trim(), canvasWidth / 2, y, canvasWidth * 0.9)
        ctx.restore()
      }

      const format: ImageFormat = backgroundColor === 'transparent' && outputFormat === 'jpeg' ? 'png' : outputFormat
      const mime = format === 'jpeg' ? 'image/jpeg' : 'image/' + format
      const dataUrl = canvas.toDataURL(mime, format === 'jpeg' || format === 'webp' ? 0.92 : undefined)

      appendVersion({
        label: 'Local Edit',
        dataUrl,
        operation: 'local_adjustments',
        prompt: '',
        model: 'local',
        transparent: backgroundColor === 'transparent',
        videoReady: currentVersion?.videoReady || false,
      })
      resetLocalControls()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Local edit failed')
    } finally {
      setBusyLabel(null)
      setSaving(false)
    }
  }, [
    appendVersion,
    aspectRatio,
    backgroundColor,
    blur,
    borderSize,
    brightness,
    contrast,
    currentVersion?.videoReady,
    displayUrl,
    fitMode,
    flipX,
    flipY,
    grayscale,
    opacity,
    outputFormat,
    overlayText,
    padding,
    prepareDataUrl,
    rotation,
    saturation,
    sepia,
    shadow,
    textPosition,
    textSize,
    zoom,
  ])

  const handleApply = useCallback(async () => {
    if (!asset || !currentVersion) return
    if (versionIndex === 0) {
      onClose()
      return
    }

    setSaving(true)
    setError(null)
    try {
      const dataUrl = await prepareDataUrl(currentVersion.dataUrl)
      let validation = currentVersion.visionValidation

      if (
        currentVersion.model !== 'local' &&
        validationOverrideVersionId !== currentVersion.id &&
        !validation?.passed
      ) {
        setBusyLabel('SmartVideo GO Vision is validating the edit')
      const originalUrlForValidation = await prepareDataUrl(asset.originalImageUrl)
      validation = await validatePersonalizationImageEdit({
        originalImageUrl: originalUrlForValidation,
        editedImageUrl: dataUrl,
        preserve: mergedPreserve,
        intendedOperation: currentVersion.operation,
        businessContext: {
          businessName: asset.businessName,
          industry: asset.industry,
        },
      })

        setVersions((previous) => previous.map((version) => (
          version.id === currentVersion.id ? { ...version, visionValidation: validation } : version
        )))

        if (!validation.passed) {
          setValidationOverrideVersionId(currentVersion.id)
          setError(
            'SmartVideo GO Vision found a possible unintended change: ' +
            (validation.issues.join(' • ') || validation.summary) +
            '. Review the comparison, then click Use Anyway if the result is acceptable.',
          )
          return
        }
      }

      await onApply({
        dataUrl,
        originalUrl: asset.originalImageUrl,
        operation: currentVersion.operation,
        prompt: currentVersion.prompt,
        model: currentVersion.model,
        quality: currentVersion.model === 'gpt-image-2.5-sunburst' ? 'high' : currentVersion.model === 'local' ? 'local' : 'medium',
        transparent: currentVersion.transparent,
        videoReady: currentVersion.videoReady,
        visionAnalysis,
        visionValidation: validation,
        responseId: currentVersion.responseId,
        imageGenerationCallId: currentVersion.imageGenerationCallId,
        revisedPrompt: currentVersion.revisedPrompt,
        outputFormat,
        outputCompression,
        inputFidelity: getOperation(currentVersion.operation as EditorOperationId)?.precision || sourceRecipe.precisionRecommended || recipe.precisionRecommended || visionAnalysis?.precisionRecommended ? 'high' : 'low',
      })
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'Unable to save edited asset')
    } finally {
      if (mountedRef.current) {
        setBusyLabel(null)
        setSaving(false)
      }
      onClose()
    }
  }, [
    asset,
    currentVersion,
    mergedPreserve,
    onApply,
    onClose,
    prepareDataUrl,
    validationOverrideVersionId,
    versionIndex,
    visionAnalysis,
  ])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)

    if (!onDropAsset) return

    let payload: { assetId: string; source: string; assetType: string } | null = null
    try {
      const data = e.dataTransfer.getData('application/json')
      if (data) payload = JSON.parse(data)
    } catch {
      // ignore invalid payload
    }
    if (payload) {
      onDropAsset(payload)
    }
  }, [onDropAsset])

  if (!open || !asset || !currentVersion) return null

  const recommendedOperationIds = (visionAnalysis?.recommendedOperations || recipe.recommended)
    .filter((id): id is EditorOperationId => id in IMAGE_EDIT_OPERATIONS)
    .filter((id) => {
      const applicable = IMAGE_EDIT_OPERATIONS[id].applicableTo
      return !applicable || applicable.includes(kind)
    })
  const recommendedOperations = recommendedOperationIds.map(getOperation)
  const advancedGroups = Array.from(groupedOperations.entries())
  const activeOperations = groupedOperations.get(activeGroup) || []

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="smartvideo-go-image-editor-title"
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        ref={modalRef}
        className={'relative mx-4 my-8 w-full rounded-2xl border border-white/10 ' + (editorMode === 'advanced' ? 'max-w-7xl' : 'max-w-4xl') + (dragOver ? ' border-cyan-400/60' : '')}
        style={{ background: 'var(--bg-panel)', boxShadow: dragOver ? '0 0 40px rgba(34,211,238,.18)' : undefined }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          {dragOver && (
            <div className="absolute inset-x-0 top-0 z-50 flex items-center justify-center rounded-t-2xl border border-cyan-400/40 bg-cyan-400/10 py-3 text-xs font-bold uppercase tracking-wide text-cyan-300">
              Drop asset to replace current image
            </div>
          )}
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-7 w-7 flex-none items-center justify-center rounded-md" style={{ ...iconBadge }}>
              <Sparkles size={14} className="text-black" />
            </div>
            <div className="min-w-0">
              <h2 id="smartvideo-go-image-editor-title" className="truncate text-lg font-bold text-white">SmartVideo GO Image Editor</h2>
              <p className="truncate text-[11px] text-white/40">{recipe.label} · {recipe.outputRole}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {versions.length > 1 && (
              <>
                <button type="button" onClick={() => setVersionIndex((value) => Math.max(0, value - 1))} disabled={versionIndex === 0} className="rounded-lg p-2 text-white/50 transition hover:bg-white/10 hover:text-white disabled:opacity-25" aria-label="Undo edit">
                  <Undo2 size={15} />
                </button>
                <button type="button" onClick={() => setVersionIndex((value) => Math.min(versions.length - 1, value + 1))} disabled={versionIndex >= versions.length - 1} className="rounded-lg p-2 text-white/50 transition hover:bg-white/10 hover:text-white disabled:opacity-25" aria-label="Redo edit">
                  <Redo2 size={15} />
                </button>
              </>
            )}
            {versionIndex > 0 && (
              <button
                type="button"
                onClick={async () => {
                  if (!asset) return
                  const originalDataUrl = await prepareDataUrl(asset.originalImageUrl)
                  appendVersion({
                    dataUrl: originalDataUrl,
                    label: 'Reverted to Original',
                    operation: 'original',
                    prompt: '',
                    model: 'local',
                    transparent: false,
                    videoReady: false,
                  })
                }}
                className="rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Revert to original"
              >
                Revert to Original
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Close SmartVideo GO image editor" className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </div>

        {editorMode === 'simple' ? (
          <div className="space-y-4 p-4">
            <MediaStage
              src={streamingPreview || displayUrl}
              originalSrc={asset.originalImageUrl}
              compareMode={compareMode}
              safeArea={safeArea}
              aspectRatio={aspectRatio}
              busyLabel={busyLabel}
              progressive={Boolean(streamingPreview)}
            />

            <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: semantic.textMuted }}>
              <span className="rounded-full bg-white/5 px-3 py-1 font-semibold uppercase tracking-wide text-white/70">{recipe.label}</span>
              <span>•</span>
              <span>{recipe.outputRole}</span>
              {currentVersion.transparent && <><span>•</span><span>Transparent</span></>}
              {currentVersion.videoReady && <><span>•</span><span style={{ color: semantic.success }}>Video Ready</span></>}
              {asset.source === 'discovered' && <><span>•</span><span>Discovered Asset</span></>}
            </div>

            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.04] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-white"><Sparkles size={15} className="text-cyan-300" /> SmartVideo GO recommends</div>
                  <p className="mt-1 text-xs leading-5 text-white/45">
                    {visionAnalysis?.summary || recipe.description} Output target: {visionAnalysis?.targetRole || recipe.outputRole}.
                  </p>
                  {visionAnalysis?.issues?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {visionAnalysis.issues.slice(0, 4).map((issue) => (
                        <span key={issue} className="rounded-full bg-white/[0.05] px-2 py-1 text-[9px] text-white/45">{issue}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => analyzeCurrentImage()} disabled={visionAnalyzing || Boolean(busyLabel)} className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold disabled:opacity-50" style={buttons.ghost}>
                    {visionAnalyzing ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                    {visionAnalysis ? 'Re-analyze' : 'Analyze Image'}
                  </button>
                  <button type="button" onClick={runVideoReady} disabled={Boolean(busyLabel)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold disabled:opacity-50" style={buttons.primary}>
                    <Sparkles size={14} /> Make Video Ready
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {recommendedOperations.slice(0, 6).map((operation) => (
                <button key={operation.id} type="button" onClick={() => runAiEdit(operation.id)} disabled={Boolean(busyLabel)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50" style={buttons.ghost}>
                  <Wand2 size={13} /> {operation.label}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-white/80"><MessageSquare size={14} /> Ask SmartVideo GO AI</div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <textarea
                  value={customPrompt}
                  onChange={(event) => setCustomPrompt(event.target.value)}
                  rows={3}
                  placeholder="Example: Remove the truck behind the contractor, but keep the contractor exactly the same."
                  className="min-h-[78px] flex-1 resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-400/50"
                />
                <button type="button" onClick={runResponsesSmartEdit} disabled={!customPrompt.trim() || Boolean(busyLabel)} className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50" style={buttons.primary}>
                  <Sparkles size={14} /> Smart Edit
                </button>
              </div>
            </div>

            <VersionStrip versions={versions} versionIndex={versionIndex} onSelect={(index) => { setVersionIndex(index); setValidationOverrideVersionId(null) }} />

            {currentVersion.revisedPrompt && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-[10px] leading-4 text-white/40">
                <span className="font-semibold text-white/60">Smart Edit context:</span> {currentVersion.revisedPrompt}
              </div>
            )}
            {currentVersion.visionValidation && (
              <div className="rounded-xl border p-3 text-[10px] leading-4" style={{
                borderColor: currentVersion.visionValidation.passed ? 'rgba(74,222,128,.25)' : 'rgba(251,191,36,.3)',
                background: currentVersion.visionValidation.passed ? 'rgba(74,222,128,.06)' : 'rgba(251,191,36,.06)',
                color: currentVersion.visionValidation.passed ? '#86efac' : '#fcd34d',
              }}>
                Vision QA: {currentVersion.visionValidation.passed ? 'Passed' : 'Review needed'} · {currentVersion.visionValidation.summary}
              </div>
            )}

            {error && (
              <div className="mt-2 flex items-center gap-2">
                <ErrorBox message={error} />
                {smartEditFailed && customPrompt.trim() && (
                  <button type="button" onClick={runResponsesSmartEdit} disabled={Boolean(busyLabel)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold disabled:opacity-50 shrink-0" style={buttons.primary}>
                    <RefreshCw size={14} /> Retry
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
              <div className="flex flex-wrap gap-2">
                {versions.length > 1 && (
                  <button type="button" onClick={() => setCompareMode((value) => !value)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold" style={buttons.ghost}>
                    <GitCompare size={14} /> {compareMode ? 'Single View' : 'Compare'}
                  </button>
                )}
                <button type="button" onClick={() => setSafeArea((value) => !value)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold" style={safeArea ? buttons.activePill : buttons.ghost}>
                  <Grid3X3 size={14} /> Safe Area
                </button>
                <button type="button" onClick={() => setEditorMode('advanced')} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold" style={buttons.ghost}>
                  <Layers3 size={14} /> Advanced Edit
                </button>
              </div>

              <button type="button" onClick={handleApply} disabled={saving || Boolean(busyLabel) || versionIndex === 0} className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold disabled:opacity-40" style={buttons.primary}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {currentVersion.visionValidation && !currentVersion.visionValidation.passed && validationOverrideVersionId === currentVersion.id ? 'Use Anyway' : 'Use Edited Asset'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid min-h-[700px] grid-cols-1 lg:grid-cols-[210px_minmax(0,1fr)_300px]">
            <aside className="border-r border-white/10 p-3">
              <button type="button" onClick={() => setEditorMode('simple')} className="mb-3 w-full rounded-xl px-3 py-2 text-left text-xs font-semibold" style={buttons.ghost}>← Back to Simple</button>
              <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[.15em] text-white/30">Tools</div>
              <div className="space-y-1">
                {advancedGroups.map(([group]) => (
                  <button key={group} type="button" onClick={() => setActiveGroup(group)} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold transition" style={activeGroup === group ? buttons.activePill : { color: 'rgba(255,255,255,.55)', background: 'transparent' }}>
                    {GROUP_LABELS[group]}
                  </button>
                ))}
              </div>
              <div className="mt-4 border-t border-white/10 pt-3">
                <button type="button" onClick={() => setMaskMode((value) => !value)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold" style={maskMode ? buttons.activePill : buttons.ghost}>
                  <Paintbrush size={14} /> Select / Mask Area
                </button>
              </div>
            </aside>

            <main className="min-w-0 border-r border-white/10 p-4">
              {maskMode ? (
                <MaskEditor imageUrl={displayUrl} active={maskMode} onMaskChange={setMaskBlob} />
              ) : (
                <>
                  <MediaStage
                    src={streamingPreview || displayUrl}
                    originalSrc={asset.originalImageUrl}
                    compareMode={compareMode}
                    safeArea={safeArea}
                    aspectRatio={aspectRatio}
                    busyLabel={busyLabel}
                    progressive={Boolean(streamingPreview)}
                    previewStyle={{
                      transform: 'scale(' + (zoom / 100) + ') rotate(' + rotation + 'deg) scaleX(' + (flipX ? -1 : 1) + ') scaleY(' + (flipY ? -1 : 1) + ')',
                      filter:
                        'brightness(' + brightness + '%) contrast(' + contrast + '%) saturate(' + saturation + '%) ' +
                        'blur(' + blur + 'px) grayscale(' + grayscale + '%) sepia(' + sepia + '%)',
                      opacity: opacity / 100,
                    }}
                  />
                  <VersionStrip versions={versions} versionIndex={versionIndex} onSelect={(index) => { setVersionIndex(index); setValidationOverrideVersionId(null) }} compact />
                </>
              )}

              {error && <div className="mt-3"><ErrorBox message={error} /></div>}
            </main>

            <aside className="max-h-[700px] overflow-y-auto p-4 custom-scrollbar">
              <div className="mb-4">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[.15em] text-white/30">{GROUP_LABELS[activeGroup]} AI Tools</div>
                <div className="space-y-2">
                  {activeOperations.map((operation) => (
                    <button key={operation.id} type="button" onClick={() => runAiEdit(operation.id)} disabled={Boolean(busyLabel)} className="w-full rounded-xl p-3 text-left disabled:opacity-50" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)' }}>
                      <div className="text-xs font-semibold text-white">{operation.label}</div>
                      <div className="mt-1 text-[10px] leading-4 text-white/40">{operation.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <details className="group rounded-xl border border-white/10 bg-white/[0.02] p-3" open>
                <summary className="cursor-pointer list-none text-xs font-semibold text-white">Output & AI</summary>
                <div className="mt-3 space-y-3">
                  <ControlLabel label="AI Mode">
                    <div className="grid grid-cols-3 gap-1">
                      {(['auto', 'fast', 'precision'] as ModelMode[]).map((mode) => (
                        <button key={mode} type="button" onClick={() => setModelMode(mode)} className="rounded-lg px-2 py-2 text-[9px] font-bold uppercase" style={modelMode === mode ? buttons.activePill : buttons.inactivePill}>{mode}</button>
                      ))}
                    </div>
                  </ControlLabel>

                  <ControlLabel label="Aspect Ratio">
                    <div className="grid grid-cols-5 gap-1">
                      {(['original', '9:16', '16:9', '1:1', '4:5'] as AspectRatio[]).map((ratio) => (
                        <button key={ratio} type="button" onClick={() => setAspectRatio(ratio)} className="rounded-lg px-1 py-2 text-[9px] font-bold" style={aspectRatio === ratio ? buttons.activePill : buttons.inactivePill}>{ratio === 'original' ? 'Orig' : ratio}</button>
                      ))}
                    </div>
                  </ControlLabel>

                  <ControlLabel label="Format">
                    <div className="grid grid-cols-3 gap-1">
                      {(['png', 'webp', 'jpeg'] as ImageFormat[]).map((format) => (
                        <button key={format} type="button" onClick={() => setOutputFormat(format)} className="rounded-lg px-2 py-2 text-[9px] font-bold uppercase" style={outputFormat === format ? buttons.activePill : buttons.inactivePill}>{fileExtension(format)}</button>
                      ))}
                    </div>
                  </ControlLabel>
                </div>
              </details>

              <details className="group mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <summary className="cursor-pointer list-none text-xs font-semibold text-white">Local Canvas Tools</summary>
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-3 gap-1">
                    <button type="button" onClick={() => setRotation((value) => (value + 90) % 360)} className="rounded-lg py-2" style={buttons.ghost}><RotateCw size={13} className="mx-auto" /></button>
                    <button type="button" onClick={() => setFlipX((value) => !value)} className="rounded-lg py-2" style={flipX ? buttons.activePill : buttons.ghost}><FlipHorizontal size={13} className="mx-auto" /></button>
                    <button type="button" onClick={() => setFlipY((value) => !value)} className="rounded-lg py-2" style={flipY ? buttons.activePill : buttons.ghost}><FlipVertical size={13} className="mx-auto" /></button>
                  </div>

                  <div className="grid grid-cols-2 gap-1">
                    <button type="button" onClick={() => setFitMode('contain')} className="rounded-lg px-2 py-2 text-[9px] font-bold uppercase" style={fitMode === 'contain' ? buttons.activePill : buttons.inactivePill}>Fit</button>
                    <button type="button" onClick={() => setFitMode('cover')} className="rounded-lg px-2 py-2 text-[9px] font-bold uppercase" style={fitMode === 'cover' ? buttons.activePill : buttons.inactivePill}>Fill / Crop</button>
                  </div>

                  <Slider label="Zoom" value={zoom} min={50} max={180} suffix="%" onChange={setZoom} />
                  <Slider label="Brightness" value={brightness} min={50} max={150} suffix="%" onChange={setBrightness} />
                  <Slider label="Contrast" value={contrast} min={50} max={150} suffix="%" onChange={setContrast} />
                  <Slider label="Saturation" value={saturation} min={0} max={180} suffix="%" onChange={setSaturation} />
                  <Slider label="Opacity" value={opacity} min={10} max={100} suffix="%" onChange={setOpacity} />
                  <Slider label="Blur" value={blur} min={0} max={20} suffix="px" onChange={setBlur} />
                  <Slider label="Grayscale" value={grayscale} min={0} max={100} suffix="%" onChange={setGrayscale} />
                  <Slider label="Sepia" value={sepia} min={0} max={100} suffix="%" onChange={setSepia} />
                  <Slider label="Padding" value={padding} min={0} max={240} suffix="px" onChange={setPadding} />
                  <Slider label="Border" value={borderSize} min={0} max={40} suffix="px" onChange={setBorderSize} />
                  <Slider label="Shadow" value={shadow} min={0} max={60} suffix="" onChange={setShadow} />

                  <ControlLabel label="Canvas Background">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setBackgroundColor('transparent')} className="flex-1 rounded-lg px-2 py-2 text-[9px] font-bold uppercase" style={backgroundColor === 'transparent' ? buttons.activePill : buttons.inactivePill}>Transparent</button>
                      <input type="color" value={backgroundColor === 'transparent' ? '#000000' : backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} className="h-9 w-12 rounded-lg border border-white/10 bg-transparent" aria-label="Canvas background color" />
                    </div>
                  </ControlLabel>

                  <button type="button" onClick={applyLocalAdjustments} disabled={Boolean(busyLabel)} className="w-full rounded-xl px-3 py-2.5 text-xs font-bold disabled:opacity-50" style={buttons.primary}>Apply Local Edit</button>
                </div>
              </details>

              <details className="group mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <summary className="cursor-pointer list-none text-xs font-semibold text-white"><Type size={13} className="mr-1 inline" /> Text Overlay</summary>
                <div className="mt-3 space-y-3">
                  <input value={overlayText} onChange={(event) => setOverlayText(event.target.value)} placeholder="Optional overlay text" className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none" />
                  <Slider label="Text Size" value={textSize} min={18} max={120} suffix="px" onChange={setTextSize} />
                  <div className="grid grid-cols-3 gap-1">
                    {(['top', 'center', 'bottom'] as TextPosition[]).map((position) => (
                      <button key={position} type="button" onClick={() => setTextPosition(position)} className="rounded-lg px-2 py-2 text-[9px] font-bold uppercase" style={textPosition === position ? buttons.activePill : buttons.inactivePill}>{position}</button>
                    ))}
                  </div>
                </div>
              </details>

              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-white"><ShieldCheck size={14} className="text-cyan-300" /> SmartVideo GO Asset Protection</div>
                <p className="mt-2 text-[10px] leading-4 text-white/40">Choose what SmartVideo GO AI should explicitly protect. The asset recipe also preserves {recipe.preserve.join(', ')}.</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(Object.keys(PROTECTION_LABELS) as ProtectionKey[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setProtections((previous) => ({ ...previous, [key]: !previous[key] }))}
                      className="rounded-lg px-2.5 py-1.5 text-[9px] font-semibold"
                      style={protections[key] ? buttons.activePill : buttons.inactivePill}
                    >
                      {protections[key] ? '✓ ' : ''}{PROTECTION_LABELS[key]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setSafeArea((value) => !value)} className="rounded-xl px-3 py-2 text-xs font-semibold" style={safeArea ? buttons.activePill : buttons.ghost}><Grid3X3 size={13} className="mr-1 inline" /> Safe Area</button>
                {versions.length > 1 && <button type="button" onClick={() => setCompareMode((value) => !value)} className="rounded-xl px-3 py-2 text-xs font-semibold" style={buttons.ghost}><GitCompare size={13} className="mr-1 inline" /> Compare</button>}
              </div>

              <button type="button" onClick={handleApply} disabled={saving || Boolean(busyLabel) || versionIndex === 0} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold disabled:opacity-40" style={buttons.primary}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Use Edited Asset
              </button>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}

function MediaStage({
  src,
  originalSrc,
  compareMode,
  safeArea,
  aspectRatio,
  busyLabel,
  progressive = false,
  previewStyle,
}: {
  src: string
  originalSrc: string
  compareMode: boolean
  safeArea: boolean
  aspectRatio: AspectRatio
  busyLabel: string | null
  progressive?: boolean
  previewStyle?: CSSProperties
}) {
  if (compareMode) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <PreviewCard label="Original" src={originalSrc} />
        <PreviewCard label="Edited" src={src} />
      </div>
    )
  }

  return (
    <div className="relative flex min-h-[360px] w-full items-center justify-center overflow-hidden rounded-xl bg-black">
      <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'linear-gradient(45deg,#222 25%,transparent 25%),linear-gradient(-45deg,#222 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#222 75%),linear-gradient(-45deg,transparent 75%,#222 75%)', backgroundSize: '22px 22px', backgroundPosition: '0 0,0 11px,11px -11px,-11px 0' }} />
      <img src={src} alt="SmartVideo GO edit preview" className="relative z-[1] max-h-[64vh] max-w-full object-contain transition-all" style={previewStyle} />

      {safeArea && (
        <div className="pointer-events-none absolute inset-[7%] z-[2] rounded-lg border border-dashed border-cyan-300/70">
          <div className="absolute left-1/2 top-0 h-full border-l border-dashed border-cyan-300/20" />
          <div className="absolute left-0 top-1/2 w-full border-t border-dashed border-cyan-300/20" />
          {aspectRatio === '9:16' && <div className="absolute inset-x-0 bottom-0 h-[16%] bg-black/20" />}
        </div>
      )}

      {busyLabel && (
        <div className={'absolute inset-0 z-[5] grid place-items-center backdrop-blur-[1px] ' + (progressive ? 'bg-black/20' : 'bg-black/70')}>
          <div className="rounded-2xl border border-cyan-400/30 bg-black/70 px-7 py-6 text-center">
            <Loader2 size={24} className="mx-auto mb-3 animate-spin text-cyan-300" />
            <div className="text-xs font-bold uppercase tracking-wide text-white">{busyLabel}</div>
            <div className="mt-1 text-[10px] text-white/40">{progressive ? 'Progressive GPT Image 2.5 preview' : 'SmartVideo GO is processing this asset.'}</div>
          </div>
        </div>
      )}
    </div>
  )
}

function PreviewCard({ label, src }: { label: string; src: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
      <div className="border-b border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-white/40">{label}</div>
      <div className="grid min-h-[320px] place-items-center p-2">
        <img src={src} alt={label} className="max-h-[58vh] max-w-full object-contain" />
      </div>
    </div>
  )
}

function VersionStrip({
  versions,
  versionIndex,
  onSelect,
  compact = false,
}: {
  versions: Version[]
  versionIndex: number
  onSelect: (index: number) => void
  compact?: boolean
}) {
  return (
    <div className={(compact ? 'mt-3 ' : '') + 'flex gap-2 overflow-x-auto pb-1'}>
      {versions.map((version, index) => (
        <button key={version.id} type="button" onClick={() => onSelect(index)} className="group flex-none overflow-hidden rounded-xl text-left" style={{ width: compact ? 88 : 108, border: '1px solid ' + (index === versionIndex ? 'var(--color-primary)' : 'rgba(255,255,255,.1)'), background: index === versionIndex ? 'rgba(34,211,238,.08)' : 'rgba(255,255,255,.02)' }}>
          <div className="h-14 overflow-hidden bg-black">
            <img src={version.dataUrl} alt={version.label} className="h-full w-full object-cover" />
          </div>
          <div className="truncate px-2 py-1.5 text-[9px] font-semibold" style={{ color: index === versionIndex ? 'var(--color-primary)' : 'rgba(255,255,255,.55)' }}>{version.label}</div>
        </button>
      ))}
    </div>
  )
}

function ControlLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-white/35">{label}</div>
      {children}
    </div>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  suffix: string
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-[9px] font-semibold text-white/45"><span>{label}</span><span>{value}{suffix}</span></div>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-cyan-400" />
    </label>
  )
}

function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-xl border border-red-400/20 bg-red-400/[0.06] p-3 text-xs leading-5 text-red-300">{message}</div>
}
