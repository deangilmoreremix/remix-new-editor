// Text-to-Speech Service for Video Personalization
// Supports multiple TTS providers for natural voice synthesis

class TTSService {
  constructor(options = {}) {
    this.provider = options.provider || 'openai'; // 'coqui', 'openai', 'azure', 'elevenlabs'
    this.apiKey = options.apiKey;
    this.baseUrl = this.getBaseUrl();
    this.language = options.language || 'en';
    this.voiceCloning = options.voiceCloning || false;
    this.customVoiceModel = options.customVoiceModel || null;
  }

  getBaseUrl() {
    switch (this.provider) {
      case 'coqui':
        return 'https://api.coqui.ai';
      case 'openai':
        return 'https://api.openai.com/v1';
      case 'azure':
        return 'https://speech.microsoft.com';
      case 'elevenlabs':
        return 'https://api.elevenlabs.io/v1';
      default:
        return 'https://api.openai.com/v1';
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
      case 'elevenlabs':
        return await this.generateElevenLabsSpeech(text, { voice, language, speed });
      default:
        return await this.generateOpenAISpeech(text, { voice, language, speed });
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

  // ElevenLabs TTS Integration (High-quality voice synthesis)
  async generateElevenLabsSpeech(text, options) {
    const voiceMap = {
      'professional-male': '21m00Tcm4TlvDq8ikWAM', // Adam
      'professional-female': 'AZnzlk1XvdvUeBnXmlld', // Dora
      'friendly-male': '29vD33N1CtxCmqQRPOHJ', // Drew
      'friendly-female': 'EXAVITQu4vr4xnSDxMaL', // Bella
      'enthusiastic-male': 'ErXwobaYiN019PkySvjV', // Antoni
      'enthusiastic-female': 'MF3mGyEYCl7XYWbV9V6', // Elli
      'calm-male': 'VR6AewLTigWG4xSOukaG', // Arnold
      'calm-female': 'XB0fDUnXU5powFXDhCwa', // Josh
      'custom': this.customVoiceModel // For voice cloning
    };

    const voiceId = voiceMap[options.voice] || voiceMap['professional-male'];

    const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.5,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs TTS failed: ${response.statusText}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    return {
      url: audioUrl,
      duration: this.estimateDuration(text, options.speed),
      format: 'mp3',
      provider: 'elevenlabs',
      quality: 'premium'
    };
  }

  // Voice Cloning Methods
  async cloneVoice(audioSamples, voiceName) {
    if (this.provider !== 'elevenlabs') {
      throw new Error('Voice cloning is only supported with ElevenLabs provider');
    }

    const formData = new FormData();
    audioSamples.forEach((sample, index) => {
      formData.append('files', sample, `sample_${index + 1}.wav`);
    });

    formData.append('name', voiceName);
    formData.append('description', `Custom voice for ${voiceName}`);

    const response = await fetch(`${this.baseUrl}/voices/add`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Voice cloning failed: ${response.statusText}`);
    }

    const result = await response.json();
    this.customVoiceModel = result.voice_id;

    return {
      voiceId: result.voice_id,
      name: voiceName,
      status: 'trained'
    };
  }

  async getVoiceCloningStatus(voiceId) {
    const response = await fetch(`${this.baseUrl}/voices/${voiceId}`, {
      headers: {
        'xi-api-key': this.apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get voice status: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      status: result.ready ? 'ready' : 'training',
      voiceId: result.voice_id,
      name: result.name
    };
  }

  // Multi-language Support
  getSupportedLanguages() {
    return {
      openai: ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'tr', 'ru', 'nl', 'cs', 'ar', 'zh', 'ja', 'hu', 'ko'],
      elevenlabs: ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'tr', 'ru', 'nl', 'cs', 'ar', 'zh', 'ja', 'hu', 'ko', 'hi', 'sv', 'da', 'no', 'fi'],
      azure: ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar', 'ru', 'hi', 'th', 'vi', 'nl', 'sv', 'da', 'no', 'fi', 'pl', 'cs', 'tr'],
      coqui: ['en', 'es', 'fr', 'de']
    };
  }

  isLanguageSupported(language, provider = this.provider) {
    const supported = this.getSupportedLanguages()[provider] || [];
    return supported.includes(language);
  }

  // Get available voices for the current provider
  getAvailableVoices() {
    switch (this.provider) {
      case 'coqui':
        return [
          { id: 'professional-male', name: 'Professional Male', language: 'en', quality: 'standard' },
          { id: 'professional-female', name: 'Professional Female', language: 'en', quality: 'standard' },
          { id: 'friendly-male', name: 'Friendly Male', language: 'en', quality: 'standard' },
          { id: 'friendly-female', name: 'Friendly Female', language: 'en', quality: 'standard' },
          { id: 'enthusiastic-male', name: 'Enthusiastic Male', language: 'en', quality: 'standard' },
          { id: 'calm-female', name: 'Calm Female', language: 'en', quality: 'standard' }
        ];
      case 'openai':
        return [
          { id: 'alloy', name: 'Alloy', language: 'en', quality: 'high', multilingual: true },
          { id: 'echo', name: 'Echo', language: 'en', quality: 'high', multilingual: true },
          { id: 'fable', name: 'Fable', language: 'en', quality: 'high', multilingual: true },
          { id: 'onyx', name: 'Onyx', language: 'en', quality: 'high', multilingual: true },
          { id: 'nova', name: 'Nova', language: 'en', quality: 'high', multilingual: true },
          { id: 'shimmer', name: 'Shimmer', language: 'en', quality: 'high', multilingual: true }
        ];
      case 'azure':
        return [
          { id: 'professional-male', name: 'Brian (Professional)', language: 'en', quality: 'high', multilingual: true },
          { id: 'professional-female', name: 'Zira (Professional)', language: 'en', quality: 'high', multilingual: true },
          { id: 'friendly-male', name: 'Benjamin (Friendly)', language: 'en', quality: 'high', multilingual: true },
          { id: 'friendly-female', name: 'Aria (Friendly)', language: 'en', quality: 'high', multilingual: true }
        ];
      case 'elevenlabs':
        return [
          { id: 'professional-male', name: 'Adam (Professional)', language: 'en', quality: 'premium', cloning: true },
          { id: 'professional-female', name: 'Dora (Professional)', language: 'en', quality: 'premium', cloning: true },
          { id: 'friendly-male', name: 'Drew (Friendly)', language: 'en', quality: 'premium', cloning: true },
          { id: 'friendly-female', name: 'Bella (Friendly)', language: 'en', quality: 'premium', cloning: true },
          { id: 'enthusiastic-male', name: 'Antoni (Enthusiastic)', language: 'en', quality: 'premium', cloning: true },
          { id: 'enthusiastic-female', name: 'Elli (Enthusiastic)', language: 'en', quality: 'premium', cloning: true },
          { id: 'calm-male', name: 'Arnold (Calm)', language: 'en', quality: 'premium', cloning: true },
          { id: 'calm-female', name: 'Josh (Calm)', language: 'en', quality: 'premium', cloning: true },
          { id: 'custom', name: 'Custom Voice (Cloned)', language: 'en', quality: 'premium', cloning: true, custom: true }
        ];
      default:
        return [];
    }
  }

  // Get voice cloning capabilities
  supportsVoiceCloning() {
    return this.provider === 'elevenlabs';
  }

  // Get multi-language capabilities
  supportsMultiLanguage() {
    return ['openai', 'azure', 'elevenlabs'].includes(this.provider);
  }

  // Get premium voice options
  getPremiumVoices() {
    return this.getAvailableVoices().filter(voice => voice.quality === 'premium');
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