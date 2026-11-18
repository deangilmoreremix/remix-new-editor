/** Draws an SVG data URL onto a canvas and returns a PNG data URL, so the designer (raster layers) can use it. */
export function rasterizeSvg(svgDataUrl: string, size = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth || size
      const h = img.naturalHeight || size
      const scale = size / Math.max(w, h)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(w * scale))
      canvas.height = Math.max(1, Math.round(h * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Drawing is not supported in this browser.'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('The SVG could not be drawn.'))
    img.src = svgDataUrl
  })
}
