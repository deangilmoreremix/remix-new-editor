// Muapi.ai Client - AI Model Integration for Video Personalization
// Based on Open-Higgsfield-AI implementation

class MuapiClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.muapi.ai';
    this.headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    };
  }

  // Generate AI Image (Text-to-Image)
  async generateImage(params) {
    const response = await fetch(`${this.baseUrl}/api/v1/generate`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        model: params.model || 'flux-dev',
        prompt: params.prompt,
        negative_prompt: params.negative_prompt || '',
        aspect_ratio: params.aspect_ratio || '1:1',
        resolution: params.resolution || '1024x1024',
        quality: params.quality || 'high',
        seed: params.seed || -1
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Image generation failed: ${data.error || response.statusText}`);
    }

    return this.pollForResult(data.request_id, 'image');
  }

  // Generate AI Video (Text-to-Video)
  async generateVideo(params) {
    const response = await fetch(`${this.baseUrl}/api/v1/generate`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        model: params.model || 'kling-v3.0-pro',
        prompt: params.prompt,
        aspect_ratio: params.aspect_ratio || '16:9',
        duration: params.duration || 5,
        resolution: params.resolution || '1920x1080',
        quality: params.quality || 'high'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Video generation failed: ${data.error || response.statusText}`);
    }

    return this.pollForResult(data.request_id, 'video');
  }

  // Generate Image-to-Video Animation
  async generateImageToVideo(params) {
    const response = await fetch(`${this.baseUrl}/api/v1/generate`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        model: params.model || 'kling-v3.0-pro-i2v',
        prompt: params.prompt || '',
        image_url: params.image_url,
        aspect_ratio: params.aspect_ratio || '16:9',
        duration: params.duration || 5,
        resolution: params.resolution || '1920x1080',
        quality: params.quality || 'high'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`I2V generation failed: ${data.error || response.statusText}`);
    }

    return this.pollForResult(data.request_id, 'video');
  }

  // Generate Lip-Sync Video (Video-to-Video with audio)
  async generateLipSync(params) {
    const response = await fetch(`${this.baseUrl}/api/v1/generate`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        model: 'ltx-2.3-lipsync', // Lip-sync model
        video_url: params.video_url,
        audio_url: params.audio_url,
        resolution: params.resolution || '1920x1080'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Lip-sync generation failed: ${data.error || response.statusText}`);
    }

    return this.pollForResult(data.request_id, 'video');
  }

  // Upload file to Muapi storage
  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseUrl}/api/v1/upload_file`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey
      },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`File upload failed: ${data.error || response.statusText}`);
    }

    return data.url;
  }

  // Poll for generation results
  async pollForResult(requestId, type = 'image') {
    const maxAttempts = type === 'video' ? 120 : 60; // Videos take longer
    const interval = 2000; // 2 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/api/v1/predictions/${requestId}/result`, {
          headers: this.headers
        });

        const data = await response.json();

        if (data.status === 'completed' || data.status === 'succeeded') {
          return {
            url: data.outputs?.[0]?.url || data.url,
            metadata: data,
            type: type
          };
        }

        if (data.status === 'failed') {
          throw new Error(`Generation failed: ${data.error || 'Unknown error'}`);
        }

        // Still processing, wait and try again
        await new Promise(resolve => setTimeout(resolve, interval));

      } catch (error) {
        if (attempt === maxAttempts - 1) {
          throw new Error(`Polling failed after ${maxAttempts} attempts: ${error.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }

    throw new Error(`Generation timed out after ${maxAttempts * interval / 1000} seconds`);
  }
}

// Export singleton instance
let muapiInstance = null;

export function getMuapiClient(apiKey) {
  if (!muapiInstance || muapiInstance.apiKey !== apiKey) {
    muapiInstance = new MuapiClient(apiKey);
  }
  return muapiInstance;
}

export { MuapiClient };
export default MuapiClient;