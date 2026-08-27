import { useEffect, useRef } from 'react'

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
   openthorn: () => import('./OpenThornStudio.js').then(m => m.OpenThornStudio()),
 }

export default function StudioWrapper({ studioPath }: { studioPath: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const studioRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    if (studioRef.current?.cleanup) {
      studioRef.current.cleanup()
    }
    studioRef.current = null

    const loader = STUDIO_LOADERS[studioPath]
    if (!loader) return

    containerRef.current.innerHTML = ''
    const loading = document.createElement('div')
    loading.className = 'w-full h-full flex items-center justify-center'
    loading.innerHTML = '<div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>'
    containerRef.current.appendChild(loading)

    loader()
      .then(element => {
        if (!containerRef.current) return
        containerRef.current.innerHTML = ''
        containerRef.current.appendChild(element as HTMLElement)
        studioRef.current = element as HTMLElement
      })
      .catch(err => {
        console.error(`[StudioWrapper] Failed to load studio: ${studioPath}`, err)
        if (containerRef.current) {
          containerRef.current.innerHTML = `<div class="w-full h-full flex items-center justify-center text-red-400 text-sm">Failed to load studio: ${err.message}</div>`
        }
      })

    return () => {
      if (studioRef.current?.cleanup) {
        studioRef.current.cleanup()
      }
    }
  }, [studioPath])

  return <div ref={containerRef} className="w-full h-full" />
}
