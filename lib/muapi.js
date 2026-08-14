// Muapi.ai Client - AI Model Integration for Video Personalization
// Based on SmartVideo implementation

class MuapiClient {
  constructor(apiKey) {
    if (!apiKey || String(apiKey).trim() === '') {
      throw new Error('MuapiClient requires a valid apiKey');
    }
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
    if (!file) {
      throw new Error('No file provided for upload');
    }

    // Simple type detection for size limits (matches muapi.ai docs).
    // Prefer browser MIME, then extension, then generic fallback.
    const browserMime = String(file.type || '').toLowerCase();
    const fileName = String(file.name || '');
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const imageExts = new Set(['jpg','jpeg','png','gif','webp','svg','bmp','tiff','heic','avif']);
    const videoExts = new Set(['mp4','mov','avi','mkv','webm','m4v','flv','wmv','3gp','ogv']);
    const isImage = browserMime.startsWith('image/') || imageExts.has(ext);
    const isVideo = browserMime.startsWith('video/') || videoExts.has(ext);
    const maxSize = isImage ? 10 * 1024 * 1024 : isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      const typeLabel = isImage ? 'Images' : isVideo ? 'Videos' : 'Files';
      throw new Error(`${typeLabel} must be under ${maxSize / 1024 / 1024}MB for muapi.ai upload`);
    }

    const formData = new FormData();
    formData.append('file', file);

    // Build proxy URL from Supabase config if available.
    let proxyUrl = '';
    try {
      const supabaseUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL;
      if (supabaseUrl) {
        proxyUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/muapi-proxy`;
      }
    } catch {
      // ignore
    }

    const isNetworkErr = (err) => {
      if (err.name === 'TypeError') {
        const msg = String(err.message || '').toLowerCase();
        return msg.includes('failed to fetch') || 
               msg.includes('networkerror') ||
               msg.includes('network');
      }
      return err.status === undefined;
    };

    const tryUpload = async (url, apiKey, headers = {}) => {
      const maxRetries = 2;
      let lastError;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000);
          
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'x-endpoint': 'upload_file',
              ...headers
            },
            body: formData,
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          
          let data = {};
          try {
            data = await response.json();
          } catch {
            if (response.ok) {
              const err = new Error('Upload Failed: Invalid response from server');
              err.retryable = false;
              throw err;
            }
          }
          
          if (!response.ok) {
            const err = new Error(`Upload failed: ${data.error || response.statusText}`);
            err.status = response.status;
            throw err;
          }
          
          const publicUrl = data.url || data.data?.url;
          if (!publicUrl) {
            const err = new Error('Upload Failed: No URL returned by the server');
            err.retryable = false;
            throw err;
          }
          return publicUrl;
        } catch (err) {
          lastError = err;
          
          if (err.retryable === false) throw err;
          const status = err.status;
          if (status === 402 || status === 403 || status === 413 || status === 422) throw err;
          
          const isTransientStatus = status === 502 || status === 503 || status === 429;
          const isNetworkError = isNetworkErr(err);
          
          if (attempt < maxRetries && (isTransientStatus || isNetworkError)) {
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          throw err;
        }
      }
      
      throw lastError;
    };

    try {
      if (proxyUrl) {
        return await tryUpload(proxyUrl, this.apiKey);
      }
      return await tryUpload(`${this.baseUrl}/api/v1/upload_file`, this.apiKey);
    } catch (err) {
      // If proxy failed and we haven't tried direct yet, try direct.
      if (proxyUrl && isNetworkErr(err)) {
        try {
          return await tryUpload(`${this.baseUrl}/api/v1/upload_file`, this.apiKey);
        } catch {
          // fall through to final error
        }
      }
      throw err;
    }
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