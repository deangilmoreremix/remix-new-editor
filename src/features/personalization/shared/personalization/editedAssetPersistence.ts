/**
 * Client-side persistence service for edited Personalization images.
 *
 * After a successful image edit in the Personalization Image Editor, the
 * edited result is uploaded to Supabase Storage via the
 * `/api/personalization/persist-edited-asset` API route.
 *
 * This replaces transient data URLs / base64 blobs with durable public URLs
 * so edited images survive browser clears and are accessible across devices.
 *
 * Alpha transparency is verified programmatically before the upload is
 * considered successful.
 */

export interface PersistEditedAssetClientInput {
  assetId: string
  dataUrl: string
  blob: Blob
  mimeType: string
  width: number
  height: number
  originalAssetId?: string
  clientId?: string
  projectSourceType?: string
  category?: string
  role?: string
  name: string
  operation?: string
  prompt?: string
  model?: string
  quality?: string
  outputFormat?: 'png' | 'jpeg' | 'webp'
  outputCompression?: number | null
  inputFidelity?: 'high' | 'low'
  responseId?: string | null
  imageGenerationCallId?: string | null
  revisedPrompt?: string | null
  editMetadata?: Record<string, unknown>
  visionAnalysis?: Record<string, unknown>
  visionValidation?: Record<string, unknown>
  sourceCategory?: string
  sourceType?: string
  sourceDiscoveredAssetId?: string
  videoReady?: boolean
  transparent?: boolean
}

export interface PersistEditedAssetClientResult {
  ok: boolean
  assetId: string
  publicUrl: string
  hasTransparency: boolean
  transparentPixelCount: number
  totalPixelCount: number
  error?: string
}

const API_ROUTE = '/api/personalization/persist-edited-asset'

/**
 * Persist an edited Personalization image to Supabase Storage.
 *
 * Call this after the user clicks "Use Edited Asset" in the Image Editor.
 * The edited image is uploaded to the `personalization-assets` storage bucket
 * and its metadata is recorded in `personalization_edited_assets`.
 *
 * Returns a durable public URL that can be stored in the PersonalizationAsset
 * and used for generation, Studio handoff, and sharing.
 */
export async function persistEditedPersonalizationAsset(
  input: PersistEditedAssetClientInput,
): Promise<PersistEditedAssetClientResult> {
  const form = new FormData()
  form.append('image', input.blob, input.name || 'edited-image.png')

  const metadata: Record<string, unknown> = {
    assetId: input.assetId,
    originalAssetId: input.originalAssetId,
    clientId: input.clientId,
    projectSourceType: input.projectSourceType,
    category: input.category,
    role: input.role,
    name: input.name,
    operation: input.operation,
    prompt: input.prompt,
    model: input.model,
    quality: input.quality,
    outputFormat: input.outputFormat,
    outputCompression: input.outputCompression,
    inputFidelity: input.inputFidelity,
    responseId: input.responseId,
    imageGenerationCallId: input.imageGenerationCallId,
    revisedPrompt: input.revisedPrompt,
    editMetadata: input.editMetadata,
    visionAnalysis: input.visionAnalysis,
    visionValidation: input.visionValidation,
    sourceCategory: input.sourceCategory,
    sourceType: input.sourceType,
    sourceDiscoveredAssetId: input.sourceDiscoveredAssetId,
    videoReady: input.videoReady,
    transparent: input.transparent,
    width: input.width,
    height: input.height,
  }

  form.append('metadata', JSON.stringify(metadata))

  try {
    const response = await fetch(API_ROUTE, {
      method: 'POST',
      credentials: 'same-origin',
      body: form,
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      return {
        ok: false,
        assetId: input.assetId,
        publicUrl: '',
        hasTransparency: false,
        transparentPixelCount: 0,
        totalPixelCount: 0,
        error: payload?.error || `HTTP ${response.status}`,
      }
    }

    return {
      ok: true,
      assetId: payload.assetId || input.assetId,
      publicUrl: payload.publicUrl || '',
      hasTransparency: Boolean(payload.hasTransparency),
      transparentPixelCount: payload.transparentPixelCount || 0,
      totalPixelCount: payload.totalPixelCount || 0,
    }
  } catch (error) {
    return {
      ok: false,
      assetId: input.assetId,
      publicUrl: '',
      hasTransparency: false,
      transparentPixelCount: 0,
      totalPixelCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
