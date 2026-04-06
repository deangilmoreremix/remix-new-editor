// Text-to-Speech Service for Video Personalization
// Supports multiple TTS providers for natural voice synthesis

class TTSService {
  constructor(options = {}) {
    this.provider = options.provider || 'coqui'; // 'coqui', 'openai', 'azure'
    this.apiKey = options.apiKey;
    this.baseUrl = this.getBaseUrl();
  }

  getBaseUrl() {
    switch (this.provider) {
      case 'coqui':
        return 'https://api.coqui.ai'; // Example - adjust based on actual API
      case 'openai':
        return 'https://api.openai.com/v1';
      case 'azure':
        return 'https://speech.microsoft.com';
      default:
        return 'https://api.coqui.ai';
    }
  }

  // Generate speech from text
  async generateSpeech(text, options = {}) {
    const {
      voice = 'professional-male',
      language = 'en',
      speed = 1.0,
      emotion = 'neutral'
    } = options;

    switch (this.provider) {
      case 'coqui':
        return await this.generateCoquiSpeech(text, { voice, language, speed });
      case 'openai':
        return await this.generateOpenAISpeech(text, { voice, language, speed });
      case 'azure':
        return await this.generateAzureSpeech(text, { voice, language, speed });
      default:
        return await this.generateCoquiSpeech(text, { voice, language, speed });
    }
  }

  // Coqui TTS Integration
  async generateCoquiSpeech(text, options) {
    const response = await fetch(`${this.baseUrl}/v1/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        text: text,
        voice: options.voice,
        language: options.language,
        speed: options.speed
      })
    });

    if (!response.ok) {
      throw new Error(`Coqui TTS failed: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      url: data.audio_url,
      duration: data.duration,
      format: 'mp3'
    };
  }

  // OpenAI TTS Integration
  async generateOpenAISpeech(text, options) {
    const voiceMap = {
      'professional-male': 'alloy',
      'professional-female': 'shimmer',
      'friendly-male': 'echo',
      'friendly-female': 'nova'
    };

    const response = await fetch(`${this.baseUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voiceMap[options.voice] || 'alloy',
        speed: options.speed
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI TTS failed: ${response.statusText}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    return {
      url: audioUrl,
      duration: this.estimateDuration(text, options.speed),
      format: 'mp3'
    };
  }

  // Azure TTS Integration
  async generateAzureSpeech(text, options) {
    const response = await fetch(`${this.baseUrl}/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/ssml+xml',
        'Ocp-Apim-Subscription-Key': this.apiKey,
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
      },
      body: this.createSSML(text, options)
    });

    if (!response.ok) {
      throw new Error(`Azure TTS failed: ${response.statusText}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    return {
      url: audioUrl,
      duration: this.estimateDuration(text, options.speed),
      format: 'mp3'
    };
  }

  // Create SSML for Azure TTS
  createSSML(text, options) {
    const voiceMap = {
      'professional-male': 'en-US-BrianRUS',
      'professional-female': 'en-US-ZiraRUS',
      'friendly-male': 'en-US-BenjaminRUS',
      'friendly-female': 'en-US-AriaRUS'
    };

    return `<?xml version="1.0"?>
    <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
      <voice name="${voiceMap[options.voice] || 'en-US-BrianRUS'}">
        <prosody rate="${options.speed * 100}%">
          ${text}
        </prosody>
      </voice>
    </speak>`;
  }

  // Estimate audio duration based on text length and speed
  estimateDuration(text, speed = 1.0) {
    // Rough estimate: ~150 words per minute for normal speech
    const wordsPerMinute = 150;
    const wordCount = text.split(' ').length;
    const durationMinutes = wordCount / wordsPerMinute;
    const durationSeconds = durationMinutes * 60;

    // Adjust for speed
    return durationSeconds / speed;
  }

  // Get available voices for the current provider
  getAvailableVoices() {
    switch (this.provider) {
      case 'coqui':
        return [
          { id: 'professional-male', name: 'Professional Male', language: 'en' },
          { id: 'professional-female', name: 'Professional Female', language: 'en' },
          { id: 'friendly-male', name: 'Friendly Male', language: 'en' },
          { id: 'friendly-female', name: 'Friendly Female', language: 'en' },
          { id: 'enthusiastic-male', name: 'Enthusiastic Male', language: 'en' },
          { id: 'calm-female', name: 'Calm Female', language: 'en' }
        ];
      case 'openai':
        return [
          { id: 'alloy', name: 'Alloy', language: 'en' },
          { id: 'echo', name: 'Echo', language: 'en' },
          { id: 'fable', name: 'Fable', language: 'en' },
          { id: 'onyx', name: 'Onyx', language: 'en' },
          { id: 'nova', name: 'Nova', language: 'en' },
          { id: 'shimmer', name: 'Shimmer', language: 'en' }
        ];
      case 'azure':
        return [
          { id: 'professional-male', name: 'Brian (Professional)', language: 'en' },
          { id: 'professional-female', name: 'Zira (Professional)', language: 'en' },
          { id: 'friendly-male', name: 'Benjamin (Friendly)', language: 'en' },
          { id: 'friendly-female', name: 'Aria (Friendly)', language: 'en' }
        ];
      default:
        return [];
    }
  }
}

// Export singleton instance
let ttsInstance = null;

export function getTTSService(options) {
  if (!ttsInstance || ttsInstance.provider !== options.provider) {
    ttsInstance = new TTSService(options);
  }
  return ttsInstance;
}

export { TTSService };
export default TTSService;