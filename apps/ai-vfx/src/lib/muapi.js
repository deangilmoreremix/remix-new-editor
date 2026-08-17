const MUAPI_BASE_URL = 'https://api.muapi.ai/api/v1'

// Authoritative allowlist for generate_wan_ai_effects `name` values.
// Sourced from src/lib/models.js enums (ai-video-effects: 64, motion-controls: 47, vfx: 9).
// Kept in sync with the live API schema — update when models.js is regenerated.
const ALLOWED_WAN_EFFECT_NAMES = new Set([
  // ai-video-effects (64)
  "360 Rotation","Abandoned Places","Angry","Animal Documentary","Assassin It","Baby It","Boxing","Bride It","Cakeify","Cartoon Jaw Drop","Cats","Crush It","Crying","Cyberpunk 2077","Deflate It","Disney Princess It","Dogs","Eye Close-Up","Fantasy Landscapes","Film Noir","Fire","Glamor","Goblin","Gun Reveal","Hug Jesus","Hulk Transformation","Inflate It","Jungle It","Jumpscare","Kamehameha","Kiss Cam","Kissing","Lego","Laughing","Little Planet","Live Wallpaper","Looping Pixel Art","Melt It","Mona Lisa It","Museum It","Muscle Show Off","Orc","Pixar","Pirate Captain","POV Driving","Princess It","Puppy it","Robotic Face Reveal","Samurai It","Sharingan Eyes","Skyrim Fus-Ro-Dah","Snow White It","Squish It","Steamboat Willie","Super Saiyan Transformation","Tsunami","Ultra Wide","VHS Footage","VIP It","Warrior It","Wind Blast","Younger Self Selfie","Zen It","Zoom Call",
  // motion-controls (47)
  "360 Orbit","Arc Shot","Car Chase","Car Mount Cam","Crash Zoom In","Crash Zoom Out","Crane Down","Crane Overhead","Crane Punch-In","Crane Up","Dirty Lens","Dolly In","Dolly Left","Dolly Out","Dolly Right","Dolly Zoom In","Dolly Zoom Out","Dutch Angle","Fast Dolly Zoom In","Fast Dolly Zoom Out","Fisheye Lens","Focus Shift","FPV Drone Cam","Handheld Cam","Head Tracking","Hero Run","Human Timelapse","Landscape Timelapse","Lazy Susan","Lens Crack","Lens Flare","Matrix Shot","Motion Blur","Object POV","Overhead","Rap Video Cam","Robotic Cam","Snorricam","Tilt Down","Tilt Up","Whip Pan","Wiggle","Zoom In","Zoom In Through Object","Zoom Into Mouth","Zoom Out","Zoom Out Through Object",
  // vfx (9)
  "Building Explosion","Car Explosion","Decay Time-Lapse","Disintegration","Electricity","Flying","Huge Explosion","Levitate","Tornado"
])

const getApiKey = () => import.meta.env.VITE_MUAPI_KEY

const headers = () => ({
  'Content-Type': 'application/json',
  'x-api-key': getApiKey()
})

export async function uploadFile(file) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('VITE_MUAPI_KEY not configured')

  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${MUAPI_BASE_URL}/upload_file`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: formData
  })

  if (!response.ok) throw new Error(`Upload failed: ${response.status}`)
  return response.json()
}

export async function generateImage(prompt, options = {}) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('VITE_MUAPI_KEY not configured')

  const response = await fetch(`${MUAPI_BASE_URL}/nano-banana`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ prompt, ...options })
  })

  if (!response.ok) throw new Error(`Image generation failed: ${response.status}`)
  return response.json()
}

export async function generateImageV2(prompt, options = {}) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('VITE_MUAPI_KEY not configured')

  const response = await fetch(`${MUAPI_BASE_URL}/nano-banana-2`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ prompt, ...options })
  })

  if (!response.ok) throw new Error(`Image generation failed: ${response.status}`)
  return response.json()
}

export async function editImage(imageUrl, maskUrl, prompt, options = {}) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('VITE_MUAPI_KEY not configured')

  const response = await fetch(`${MUAPI_BASE_URL}/nano-banana-edit`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ image_url: imageUrl, mask_url: maskUrl, prompt, ...options })
  })

  if (!response.ok) throw new Error(`Image edit failed: ${response.status}`)
  return response.json()
}

export async function generateVideo(prompt, options = {}) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('VITE_MUAPI_KEY not configured')

  const response = await fetch(`${MUAPI_BASE_URL}/seedance-lite-t2v`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ prompt, ...options })
  })

  if (!response.ok) throw new Error(`Video generation failed: ${response.status}`)
  return response.json()
}

export async function imageToVideo(imageUrl, options = {}) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('VITE_MUAPI_KEY not configured')

  const response = await fetch(`${MUAPI_BASE_URL}/seedance-lite-i2v`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ image_url: imageUrl, ...options })
  })

  if (!response.ok) throw new Error(`Image-to-video failed: ${response.status}`)
  return response.json()
}

const WAN_VALID_RESOLUTIONS = ['480p', '720p']
const WAN_VALID_QUALITIES = ['medium', 'high']

// Validate and normalize params for the generate_wan_ai_effects endpoint.
// Prevents the API's opaque "Invalid input" 400/422 by enforcing the documented
// contract up front and surfacing a clear, actionable error otherwise.
function normalizeWanParams(name, options = {}) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('An effect name is required to apply a video effect.')
  }
  const trimmed = name.trim()
  if (!ALLOWED_WAN_EFFECT_NAMES.has(trimmed)) {
    throw new Error(`Effect "${trimmed}" is not supported by the API. Pick a preset from the studio's effect list.`)
  }
  const resolution = WAN_VALID_RESOLUTIONS.includes(options.resolution) ? options.resolution : '480p'
  const quality = WAN_VALID_QUALITIES.includes(options.quality) ? options.quality : 'medium'
  return { name: trimmed, resolution, quality }
}

async function submitWanEffect(imageUrl, prompt, name, options = {}) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('VITE_MUAPI_KEY not configured')

  const { resolution, quality } = normalizeWanParams(name, options)

  const response = await fetch(`${MUAPI_BASE_URL}/generate_wan_ai_effects`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      image_url: imageUrl,
      prompt,
      name,
      aspect_ratio: options.aspectRatio || '16:9',
      resolution,
      quality,
      duration: options.duration || 5
    })
  })

  if (!response.ok) {
    let detail = ''
    try {
      const body = await response.json()
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail || '')
    } catch { /* ignore parse errors */ }
    throw new Error(`Video effect "${name}" failed (${response.status}). ${detail || 'The effect may be unavailable.'}`)
  }
  return response.json()
}

export async function applyVFX(imageUrl, prompt, name, options = {}) {
  return submitWanEffect(imageUrl, prompt, name, options)
}

export async function applyMotion(imageUrl, prompt, name, options = {}) {
  return submitWanEffect(imageUrl, prompt, name, options)
}

export async function applyAIEffects(imageUrl, prompt, name, options = {}) {
  return submitWanEffect(imageUrl, prompt, name, options)
}

export async function generateSpeech(text, options = {}) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('VITE_MUAPI_KEY not configured')

  const response = await fetch(`${MUAPI_BASE_URL}/tts`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ text, ...options })
  })

  if (!response.ok) throw new Error(`Speech generation failed: ${response.status}`)
  return response.json()
}

export async function lipSync(videoUrl, audioUrl, options = {}) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('VITE_MUAPI_KEY not configured')

  const response = await fetch(`${MUAPI_BASE_URL}/sync-lipsync`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ video_url: videoUrl, audio_url: audioUrl, ...options })
  })

  if (!response.ok) throw new Error(`Lip sync failed: ${response.status}`)
  return response.json()
}

export async function lipSyncLatentSync(imageUrl, audioUrl, options = {}) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('VITE_MUAPI_KEY not configured')

  const response = await fetch(`${MUAPI_BASE_URL}/latentsync-video`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ image_url: imageUrl, audio_url: audioUrl, ...options })
  })

  if (!response.ok) throw new Error(`LatentSync failed: ${response.status}`)
  return response.json()
}

export async function sunoCreateMusic(prompt, options = {}) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('VITE_MUAPI_KEY not configured')

  const response = await fetch(`${MUAPI_BASE_URL}/suno-create-music`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ prompt, ...options })
  })

  if (!response.ok) throw new Error(`Music creation failed: ${response.status}`)
  return response.json()
}

export async function sunoRemixMusic(audioUrl, options = {}) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('VITE_MUAPI_KEY not configured')

  const response = await fetch(`${MUAPI_BASE_URL}/suno-remix-music`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ audio_url: audioUrl, ...options })
  })

  if (!response.ok) throw new Error(`Music remix failed: ${response.status}`)
  return response.json()
}

export async function sunoExtendMusic(audioUrl, options = {}) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('VITE_MUAPI_KEY not configured')

  const response = await fetch(`${MUAPI_BASE_URL}/suno-extend-music`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ audio_url: audioUrl, ...options })
  })

  if (!response.ok) throw new Error(`Music extension failed: ${response.status}`)
  return response.json()
}

export async function MMAudioTextToAudio(prompt, options = {}) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('VITE_MUAPI_KEY not configured')

  const response = await fetch(`${MUAPI_BASE_URL}/mmaudio-v2/text-to-audio`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ prompt, ...options })
  })

  if (!response.ok) throw new Error(`Audio generation failed: ${response.status}`)
  return response.json()
}

export async function MMAudioVideoToVideo(videoUrl, options = {}) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('VITE_MUAPI_KEY not configured')

  const response = await fetch(`${MUAPI_BASE_URL}/mmaudio-v2/video-to-video`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ video_url: videoUrl, ...options })
  })

  if (!response.ok) throw new Error(`Audio video-to-video failed: ${response.status}`)
  return response.json()
}

export async function pollPrediction(requestId, maxAttempts = 60) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('VITE_MUAPI_KEY not configured')

  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`${MUAPI_BASE_URL}/predictions/${requestId}/result`, {
      headers: { 'x-api-key': apiKey }
    })

    if (!response.ok) throw new Error(`Poll failed: ${response.status}`)

    const result = await response.json()
    const status = result.data?.status

    if (status === 'completed') {
      return result
    }
    if (status === 'failed') {
      throw new Error(result.error || 'Generation failed')
    }

    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  throw new Error('Timeout waiting for generation')
}

export async function generateWithPolling(endpoint, body, options = {}) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('VITE_MUAPI_KEY not configured')

  const response = await fetch(`${MUAPI_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body)
  })

  if (!response.ok) throw new Error(`Generation failed: ${response.status}`)

  const result = await response.json()
  const requestId = result.data?.request_id

  if (!requestId) return result

  return pollPrediction(requestId, options.maxAttempts || 60)
}