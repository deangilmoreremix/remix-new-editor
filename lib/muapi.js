// Muapi.ai Client - AI Model Integration for Video Personalization
// Based on SmartVideo implementation

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
        model: params.model || 'ltx-2.3-lipsync',
        video_url: params.video_url,
        audio_url: params.audio_url,
        image_url: params.image_url, // For image-based lip sync
        resolution: params.resolution || '1920x1080'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Lip-sync generation failed: ${data.error || response.statusText}`);
    }

    return this.pollForResult(data.request_id, 'video');
  }

  // Voice Cloning - Clone a voice from audio samples
  async cloneVoice(params) {
    const formData = new FormData();
    
    // Add audio samples
    if (params.audioFiles && Array.isArray(params.audioFiles)) {
      params.audioFiles.forEach((file, index) => {
        formData.append('files', file, `sample_${index + 1}.${file.type.split('/')[1] || 'wav'}`);
      });
    } else if (params.audioUrls && Array.isArray(params.audioUrls)) {
      formData.append('audio_urls', JSON.stringify(params.audioUrls));
    }
    
    formData.append('name', params.voiceName || 'Custom Voice');
    formData.append('description', params.description || `Cloned voice for ${params.voiceName}`);
    formData.append('model', params.model || 'elevenlabs-voice-clone');

    const response = await fetch(`${this.baseUrl}/api/v1/voices/clone`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey
      },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Voice cloning failed: ${data.error || response.statusText}`);
    }

    return {
      voiceId: data.voice_id,
      name: params.voiceName,
      status: data.status || 'training',
      previewUrl: data.preview_url
    };
  }

  // Get voice cloning status
  async getVoiceStatus(voiceId) {
    const response = await fetch(`${this.baseUrl}/api/v1/voices/${voiceId}`, {
      headers: this.headers
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to get voice status: ${data.error || response.statusText}`);
    }

    return {
      voiceId: data.voice_id,
      name: data.name,
      status: data.ready ? 'ready' : 'training',
      previewUrl: data.preview_url
    };
  }

  // Text-to-Speech using cloned or standard voices
  async textToSpeech(params) {
    const response = await fetch(`${this.baseUrl}/api/v1/tts`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        text: params.text,
        voice_id: params.voiceId,
        model: params.model || 'elevenlabs-tts',
        language: params.language || 'en',
        speed: params.speed || 1.0,
        stability: params.stability || 0.5,
        similarity_boost: params.similarityBoost || 0.8
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`TTS generation failed: ${data.error || response.statusText}`);
    }

    // Poll for audio result
    const result = await this.pollForResult(data.request_id, 'audio');
    
    return {
      url: result.url,
      duration: data.duration || this.estimateDuration(params.text, params.speed),
      format: 'mp3',
      voiceId: params.voiceId
    };
  }

  // List available voices
  async listVoices() {
    const response = await fetch(`${this.baseUrl}/api/v1/voices`, {
      headers: this.headers
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to list voices: ${data.error || response.statusText}`);
    }

    return data.voices || [];
  }

  // Delete a cloned voice
  async deleteVoice(voiceId) {
    const response = await fetch(`${this.baseUrl}/api/v1/voices/${voiceId}`, {
      method: 'DELETE',
      headers: this.headers
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(`Failed to delete voice: ${data.error || response.statusText}`);
    }

    return { success: true, voiceId };
  }

  // Estimate audio duration from text
  estimateDuration(text, speed = 1.0) {
    const wordsPerMinute = 150;
    const wordCount = text.split(/\s+/).length;
    return (wordCount / wordsPerMinute * 60) / speed;
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