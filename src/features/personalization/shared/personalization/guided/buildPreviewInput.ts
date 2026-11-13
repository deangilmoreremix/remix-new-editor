/**
 * Builds the `PreviewInputProps` for the free, browser-only preview from the
 * personalization context.
 *
 * Kept as a standalone helper (rather than inline JSX) so the wizard's step 4,
 * the Advanced Editing overlay editor and the modal's overlay section all build
 * exactly the same input from the same data.
 */

import type {
  AssetLibrary,
  ClientProfile,
  PersonalizationAsset,
  PersonalizationSource,
} from '../types'
import type { ImageHints } from '../preview/imageStyle'
import { imageRoleFromCategory } from '../preview/imagePresets'
import type {
  PersonalizationPreviewSettings,
  PreviewInputProps,
  PreviewVideoRef,
} from '../preview/types'

export interface BuildPreviewInputContext {
  source: PersonalizationSource | null
  previewSettings: PersonalizationPreviewSettings
  previewVideo: PreviewVideoRef | null
  clientForm: Partial<ClientProfile>
  assets: AssetLibrary
}

function firstUrl(
  ...candidates: (string | undefined | null)[]
): string | null {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate
    }
  }
  return null
}

export function buildPreviewInput(
  ctx: BuildPreviewInputContext,
): PreviewInputProps {
  const { source, previewSettings, previewVideo, clientForm, assets } = ctx
  const isImageSource = source?.mediaType === 'image'

  const businessName = clientForm.businessName || clientForm.name || ''
  const website = clientForm.website || ''
  const callToAction =
    clientForm.callToAction ||
    (website ? `Visit ${website}` : clientForm.phone ? `Call ${clientForm.phone}` : '')

  // What the assets themselves say about each image (the measured hints saved with the
  // settings take precedence). `isHeadshot` is set ONLY for an asset the discovery
  // explicitly identified as a person photo with a portrait-like shape; a photo that merely
  // contains a person is not a headshot.
  const assetHints: Record<string, ImageHints> = {}
  const addHint = (asset: PersonalizationAsset | null | undefined) => {
    if (!asset) return
    const url = firstUrl(asset.uploadedUrl, asset.url)
    if (!url) return
    const aspect = asset.width && asset.height ? asset.width / asset.height : undefined
    const hint: ImageHints = {}
    if (aspect && aspect > 0) hint.aspect = aspect
    if (asset.hasTransparency) hint.hasTransparency = true
    if (asset.sourceCategory === 'person' && aspect && aspect >= 0.7 && aspect <= 1.4) hint.isHeadshot = true
    // The explicit role: logo slot → logo; otherwise the discovery category. Never a filename or discovery order.
    if (asset.role === 'logo') hint.role = 'logo'
    else if (asset.sourceCategory) hint.role = imageRoleFromCategory(asset.sourceCategory)
    if (Object.keys(hint).length) assetHints[url] = hint
  }
  addHint(assets.primaryLogo)
  assets.products?.slice(0, 2).forEach(addHint)
  const imageHints: Record<string, ImageHints> = { ...assetHints }
  for (const [url, measured] of Object.entries(previewSettings.imageHints ?? {})) {
    imageHints[url] = { ...assetHints[url], ...measured }
  }

  return {
    videoUrl: previewVideo?.url || source?.sourceMedia || null,
    posterUrl: previewVideo?.poster || source?.poster || null,
    isImageSource: source?.mediaType === 'image',
    audioUrl: previewSettings.audio?.url ?? previewVideo?.audioUrl ?? null,
    settings: Object.keys(imageHints).length ? { ...previewSettings, imageHints } : previewSettings,
    brand: {
      // The headline text itself lives on the layers; this is only the fallback
      // the composition uses when a text layer has no explicit text.
      businessName,
      headline: businessName,
      offer: clientForm.offer || '',
      cta: callToAction,
      phone: clientForm.phone || '',
      website,
      logoUrl: firstUrl(assets.primaryLogo?.uploadedUrl, assets.primaryLogo?.url),
      productUrl: firstUrl(assets.products?.[0]?.uploadedUrl, assets.products?.[0]?.url),
      serviceUrl: firstUrl(
        assets.products?.[1]?.uploadedUrl,
        assets.products?.[1]?.url,
        assets.products?.[0]?.uploadedUrl,
        assets.products?.[0]?.url,
      ),
    },
  }
}
