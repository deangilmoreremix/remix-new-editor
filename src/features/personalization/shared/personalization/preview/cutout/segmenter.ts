import type { Mask } from './maskMath'

/**
 * Turns one image into a presenter mask. The real implementation is MediaPipe's Image Segmenter (selfie model),
 * loaded lazily so the ~15 MB engine is only fetched when somebody actually removes a background, and served
 * from this site (/mediapipe) so no third-party host or CSP change is needed.
 */
export interface Segmenter {
  segment(source: HTMLCanvasElement): Mask
  close(): void
}

export const MEDIAPIPE_WASM_PATH = '/mediapipe/wasm'
export const MEDIAPIPE_MODEL_PATH = '/mediapipe/selfie_segmenter.tflite'

export async function createMediaPipeSegmenter(): Promise<Segmenter> {
  const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision')
  const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH)
  const segmenter = await ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MEDIAPIPE_MODEL_PATH, delegate: 'CPU' },
    runningMode: 'IMAGE',
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  })
  return {
    segment(source) {
      const result = segmenter.segment(source)
      try {
        const confidence = result.confidenceMasks?.[0]
        if (!confidence) throw new Error('The segmentation model returned no mask.')
        const floats = confidence.getAsFloat32Array()
        const data = new Uint8ClampedArray(floats.length)
        for (let i = 0; i < floats.length; i++) data[i] = floats[i] * 255
        return { w: confidence.width, h: confidence.height, data }
      } finally {
        result.close()
      }
    },
    close() {
      segmenter.close()
    },
  }
}
