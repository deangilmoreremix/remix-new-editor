export function isImageEditSupported(asset: {
  mimeType?: string
  url?: string
  previewUrl?: string
  editedDataUrl?: string
}): boolean {
  const mime = asset.mimeType || ''
  if (mime.startsWith('image/')) return true
  const candidate = asset.editedDataUrl || asset.url || asset.previewUrl || ''
  if (!candidate || candidate.startsWith('blob:')) return false

  if (candidate.startsWith('data:')) {
    const mimeMatch = candidate.match(/^data:([^;]+);/)
    if (mimeMatch && mimeMatch[1].startsWith('image/')) return true
    return false
  }

  const path = candidate.split(/[?#]/, 1)[0]
  const ext = path.split('.').pop()?.toLowerCase() || ''
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return true

  try {
    const parsed = new URL(candidate, 'http://localhost')
    const urlParam = parsed.searchParams.get('url') || parsed.searchParams.get('src') || ''
    if (urlParam) {
      const urlPath = urlParam.split(/[?#]/, 1)[0]
      const urlExt = urlPath.split('.').pop()?.toLowerCase() || ''
      if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(urlExt)) return true
    }
  } catch {
    // ignore
  }

  return false
}
