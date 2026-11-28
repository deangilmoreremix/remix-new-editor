/**
 * Platform UI safe zones as fractions of the frame (the area where the app draws its own buttons, captions and
 * profile). The platforms publish guidance in pixels for a 1080x1920 frame, and it changes, so every zone here is
 * flagged as an ESTIMATE and the UI says so. Values follow commonly published creator guidance.
 */
export interface PlatformZone {
  id: string
  label: string
  aspect: '9:16' | '1:1' | '4:5' | '16:9'
  /** Fractions of the frame to keep free of important text and faces. */
  top: number
  bottom: number
  left: number
  right: number
  estimate: true
  note: string
}

export const PLATFORM_ZONES: readonly PlatformZone[] = Object.freeze([
  { id: 'tiktok', label: 'TikTok', aspect: '9:16', top: 0.08, bottom: 0.2, left: 0.05, right: 0.14, estimate: true, note: 'Caption and buttons sit at the bottom and right.' },
  { id: 'reels', label: 'Instagram Reels', aspect: '9:16', top: 0.13, bottom: 0.25, left: 0.05, right: 0.12, estimate: true, note: 'Profile and caption cover the lower quarter.' },
  { id: 'shorts', label: 'YouTube Shorts', aspect: '9:16', top: 0.08, bottom: 0.2, left: 0.05, right: 0.14, estimate: true, note: 'Title and buttons sit at the bottom and right.' },
  { id: 'square', label: 'Instagram / Facebook square', aspect: '1:1', top: 0.04, bottom: 0.08, left: 0.04, right: 0.04, estimate: true, note: 'Feed crops can trim the edges slightly.' },
  { id: 'portrait', label: 'Instagram / Facebook 4:5', aspect: '4:5', top: 0.04, bottom: 0.1, left: 0.04, right: 0.04, estimate: true, note: 'Feed posts show the caption below the video.' },
  { id: 'linkedin', label: 'LinkedIn', aspect: '1:1', top: 0.04, bottom: 0.1, left: 0.04, right: 0.04, estimate: true, note: 'Square or 16:9 both work in the feed.' },
  { id: 'landscape', label: 'YouTube / website', aspect: '16:9', top: 0.05, bottom: 0.1, left: 0.05, right: 0.05, estimate: true, note: 'Player controls cover the bottom edge while hovering.' },
])

export function zonesForAspect(aspect: string): PlatformZone[] { return PLATFORM_ZONES.filter((z) => z.aspect === aspect) }

export interface Box { x: number; y: number; w: number; h: number }

/** Which platforms' UI the box overlaps (fractions of the frame). */
export function platformsOverlapping(box: Box, aspect: string): PlatformZone[] {
  return zonesForAspect(aspect).filter((z) => box.y < z.top || box.y + box.h > 1 - z.bottom || box.x < z.left || box.x + box.w > 1 - z.right)
}
