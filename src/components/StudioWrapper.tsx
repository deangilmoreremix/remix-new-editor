import { useEffect, useRef, useState, createElement } from 'react'
import { createPortal } from 'react-dom'
import React from 'react'

const STUDIO_LOADERS = {
  image: () => import('./ImageStudio.js').then(m => m.ImageStudio()),
  video: () => import('./VideoStudio.js').then(m => m.VideoStudio()),
  cinema: () => import('./CinemaStudio.js').then(m => m.CinemaStudio()),
  character: () => import('./CharacterStudio.js').then(m => m.CharacterStudio()),
  effects: () => import('./EffectsStudio.js').then(m => m.EffectsStudio()),
  edit: () => import('./EditStudio.js').then(m => m.EditStudio()),
  upscale: () => import('./UpscaleStudio.js').then(m => m.UpscaleStudio()),
  audio: () => import('./AudioStudio.js').then(m => m.AudioStudio()),
  avatar: () => import('./AvatarStudio.js').then(m => m.AvatarStudio()),
  influencer: () => import('./InfluencerStudio.js').then(m => m.InfluencerStudio()),
  commercial: () => import('./CommercialStudio.js').then(m => m.CommercialStudio()),
  storyboard: () => import('./StoryboardStudio.js').then(m => m.StoryboardStudio()),
  training: () => import('./TrainingStudio.js').then(m => m.TrainingStudio()),
  videotools: () => import('./VideoToolsStudio.js').then(m => m.VideoToolsStudio()),
  chat: () => import('./ChatStudio.js').then(m => m.ChatStudio()),
  lipsync: () => import('./LipSyncStudio.js').then(m => m.LipSyncStudio()),
  apps: () => import('./AppsHub.js').then(m => m.AppsHub()),
  explore: () => import('./ExplorePage.js').then(m => m.ExplorePage()),
  render: () => import('./RenderPage.js').then(m => m.RenderPage()),
  'video-agent': () => import('./VideoAgentPage.js').then(m => m.VideoAgentPage()),
  director: () => import('./DirectorPage.js').then(m => m.DirectorPage()),
  timeline: () => import('./TimelineEditorPage.jsx').then(m => m.TimelineEditorPage()),
  'ai-vfx': () => import('./AIVFXPage.js').then(m => m.AIVFXPage()),
  'text-to-image': () => import('./TextToImagePage.js').then(m => m.TextToImagePage()),
  'image-to-image': () => import('./ImageToImagePage.js').then(m => m.ImageToImagePage()),
  'text-to-video': () => import('./TextToVideoPage.js').then(m => m.TextToVideoPage()),
  'image-to-video': () => import('./ImageToVideoPage.js').then(m => m.ImageToVideoPage()),
  'video-to-video': () => import('./VideoToVideoPage.js').then(m => m.VideoToVideoPage()),
  'video-watermark': () => import('./VideoWatermarkPage.js').then(m => m.VideoWatermarkPage()),
  'storyboard-page': () => import('./StoryboardPage.js').then(m => m.StoryboardPage()),
  'character-page': () => import('./CharacterPage.js').then(m => m.CharacterPage()),
  'effects-page': () => import('./EffectsPage.js').then(m => m.EffectsPage()),
  'cinema-page': () => import('./CinemaPage.js').then(m => m.CinemaPage()),
  'influencer-page': () => import('./InfluencerPage.js').then(m => m.InfluencerPage()),
  'commercial-page': () => import('./CommercialPage.js').then(m => m.CommercialPage()),
  'upscale-page': () => import('./UpscalePage.js').then(m => m.UpscalePage()),
  assist: () => import('./AssistPage.js').then(m => m.AssistPage()),
  smartvideo: () => import('./SmartVideoStudio.js').then(m => m.SmartVideoStudio()),
  brightbean: () => import('./SmartVideoScheduler.js').then(m => m.SmartVideoScheduler()),
}

// Error boundary for studio loading failures
class StudioErrorBoundary extends React.Component<
  { children: React.ReactNode; studioPath: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; studioPath: string }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[StudioErrorBoundary] ${this.props.studioPath}:`, error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return createElement('div', {
        className: 'w-full h-full flex flex-col items-center justify-center text-red-400 text-sm p-8 text-center',
      }, 'Failed to load studio. Please refresh the page or try again.')
    }
    return this.props.children
  }
}

export default function StudioWrapper({ studioPath }: { studioPath: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const studioRef = useRef<HTMLElement | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Cleanup previous studio
    if (studioRef.current?.cleanup) {
      studioRef.current.cleanup()
    }
    studioRef.current = null

    const loader = STUDIO_LOADERS[studioPath]
    if (!loader) return

    // Clear container safely
    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild)
    }

    loader()
      .then(element => {
        if (!containerRef.current) return
        // Clear loading indicator
        while (containerRef.current.firstChild) {
          containerRef.current.removeChild(containerRef.current.firstChild)
        }
        containerRef.current.appendChild(element as HTMLElement)
        studioRef.current = element as HTMLElement
      })
      .catch(err => {
        console.error(`[StudioWrapper] Failed to load studio: ${studioPath}`, err)
        setError(err instanceof Error ? err : new Error(String(err)))
      })

    return () => {
      if (studioRef.current?.cleanup) {
        studioRef.current.cleanup()
      }
    }
  }, [studioPath])

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-red-400 text-sm p-8 text-center">
        Failed to load studio: {error.message}
        <button
          className="mt-4 px-4 py-2 bg-red-500/20 rounded-lg hover:bg-red-500/30 transition-colors"
          onClick={() => {
            setError(null)
            // Force re-render by navigating away and back
            window.location.reload()
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <StudioErrorBoundary studioPath={studioPath}>
      <div ref={containerRef} className="w-full h-full" />
    </StudioErrorBoundary>
  )
}
