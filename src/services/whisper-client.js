/**
 * WhisperService - Speech-to-Text Transcription Client
 * Handles audio transcription using OpenAI Whisper (primary), MuAPI, or local Whisper fallback
 * Provides word-level timestamps and multi-language support
 */

import { RateLimiter } from '../lib/services/RateLimiter.js';
import { CircuitBreaker } from '../lib/services/CircuitBreaker.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';

class WhisperService {
  constructor(options = {}) {
    // Configuration
    this.muapiUrl = options.muapiUrl || import.meta.env.VITE_MUAPI_URL || 'https://api.muapi.ai';
    // MuAPI provider keys are SERVER-ONLY. Any VITE_-prefixed variable is
    // inlined into the public client bundle by Vite, so this client must
    // never read one. MuAPI access is routed exclusively through the
    // muapi-proxy server function (supabase/functions/muapi-proxy), which
    // resolves the key server-side; a user may also supply their own key
    // in Settings (apiKeyManager) and it is forwarded to the proxy only.
    this.proxyUrl = options.proxyUrl || (() => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) return '';
      return `${supabaseUrl}/functions/v1/muapi-proxy`;
    })();
    this.useMuAPI = options.useMuAPI !== false && Boolean(this.proxyUrl);
    this.localWhisperUrl = options.localWhisperUrl || import.meta.env.VITE_WHISPER_LOCAL_URL || 'http://localhost:8080';
    this.backendUrl = options.backendUrl || (import.meta.env.VITE_BACKEND_URL || '');

    // Initialize supporting services
    this.rateLimiter = new RateLimiter({
      rate: options.rateLimit || 10, // 10 transcription requests per minute
      duration: 60000
    });

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeout: 30000
    });

    // Add services to circuit breaker
    this.circuitBreaker.addService('openai-whisper', {
      failureThreshold: 3,
      recoveryTimeout: 30000
    });

    this.circuitBreaker.addService('muapi', {
      failureThreshold: 3,
      recoveryTimeout: 30000
    });

    this.circuitBreaker.addService('local-whisper', {
      failureThreshold: 5,
      recoveryTimeout: 60000
    });

    // Statistics tracking
    this.stats = {
      requests: 0,
      openaiRequests: 0,
      muapiRequests: 0,
      localRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      fallbacks: 0
    };

    console.log(`[WhisperService] Initialized - OpenAI: ${apiKeyManager.hasOpenAIKey()}, MuAPI: ${this.useMuAPI}, Local: ${this.localWhisperUrl}`);
  }

  /**
   * Check if service is available
   */
  isAvailable() {
    return apiKeyManager.hasOpenAIKey() || this.useMuAPI || this.localWhisperUrl;
  }

  /**
   * Transcribe audio file to text with timestamps
   * @param {File|Blob|string} audioSource - Audio file, blob, or URL
   * @param {Object} options - Transcription options
   * @returns {Promise<Object>} Transcription result with segments and words
   */
  async transcribe(audioSource, options = {}) {
    const {
      language = 'auto',
      model = 'base',
      wordTimestamps = true,
      maxDuration = 3600, // 1 hour max
      onProgress
    } = options;

    this.stats.requests++;

    try {
      // Try OpenAI Whisper first if available
      if (apiKeyManager.hasOpenAIKey() && this.circuitBreaker.isAvailable('openai-whisper')) {
        try {
          return await this._transcribeWithOpenAI(audioSource, { language, model, wordTimestamps, onProgress });
        } catch (openaiErr) {
          console.warn('[WhisperService] OpenAI Whisper failed, trying MuAPI:', openaiErr.message);
          this.stats.fallbacks++;
          this.circuitBreaker.recordFailure('openai-whisper');
        }
      }

      // Try MuAPI next if available
      if (this.useMuAPI && this.circuitBreaker.isAvailable('muapi')) {
        try {
          return await this._transcribeWithMuAPI(audioSource, { language, model, wordTimestamps, onProgress });
        } catch (muapiErr) {
          console.warn('[WhisperService] MuAPI transcription failed, trying local Whisper:', muapiErr.message);
          this.stats.fallbacks++;
          this.circuitBreaker.recordFailure('muapi');
        }
      }

      // Fallback to local Whisper
      if (this.circuitBreaker.isAvailable('local-whisper')) {
        return await this._transcribeWithLocalWhisper(audioSource, { language, model, wordTimestamps, onProgress });
      }

      throw new Error('No transcription service available');
    } catch (error) {
      this.stats.errors++;
      console.error('[WhisperService] Transcription failed:', error);
      throw error;
    }
  }

  /**
   * Transcribe using OpenAI Whisper API via backend proxy
   */
  async _transcribeWithOpenAI(audioSource, options) {
    await this.rateLimiter.waitForSlot();

    const openaiKey = apiKeyManager.getOpenAIKey();
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const formData = new FormData();

    if (audioSource instanceof File || audioSource instanceof Blob) {
      formData.append('input', audioSource);
    } else if (typeof audioSource === 'string') {
      // Assume it's a URL - download first
      const response = await fetch(audioSource);
      const blob = await response.blob();
      formData.append('input', blob);
    }

    formData.append('model', 'whisper-1');
    if (options.language && options.language !== 'auto') {
      formData.append('language', options.language);
    }
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'word');

    const apiKeyHeader = apiKeyManager.getOpenAIKey();

    const response = await fetch(`${this.backendUrl || ''}/videoagent/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: audioSource instanceof File || audioSource instanceof Blob 
          ? await this._blobToBase64(audioSource) 
          : audioSource,
        apiKey: apiKeyHeader,
        settings: { apiKey: apiKeyHeader },
        model: 'whisper-1',
        language: options.language === 'auto' ? undefined : options.language,
        response_format: 'verbose_json',
        timestamp_granularities: ['word']
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI Whisper transcription failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
    }

    const result = await response.json();
    this.stats.openaiRequests++;

    return this._normalizeOpenAIResult(result);
  }

  async _blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Normalize OpenAI Whisper result to standard format
   */
  _normalizeOpenAIResult(result) {
    const transcription = result.transcription || result.text || '';
    const raw = result.raw || result;
    
    // OpenAI verbose_json returns segments with words
    const segments = [];
    if (raw.segments && Array.isArray(raw.segments)) {
      for (const segment of raw.segments) {
        const words = [];
        if (segment.words && Array.isArray(segment.words)) {
          for (const word of segment.words) {
            words.push({
              word: word.word || '',
              start: word.start || 0,
              end: word.end || 0,
              confidence: word.confidence || 1.0
            });
          }
        }
        segments.push({
          start: segment.start || 0,
          end: segment.end || 0,
          text: segment.text || '',
          words
        });
      }
    }

    return {
      text: transcription,
      language: raw.language || 'unknown',
      segments,
      duration: raw.duration || 0
    };
  }

  /**
   * Transcribe using MuAPI
   */
  async _transcribeWithMuAPI(audioSource, options) {
    await this.rateLimiter.waitForSlot();

    // Fail closed: MuAPI provider keys never reach the browser, so the
    // direct-to-MuAPI path is gone. Transcription must go through the
    // muapi-proxy server function, which requires a configured proxy URL
    // and (per the proxy's multipart contract) the user's own key.
    if (!this.proxyUrl) {
      throw new Error(
        'MuAPI transcription requires the server proxy (muapi-proxy). Set VITE_SUPABASE_URL so transcription routes through the server function — the MuAPI provider key is never sent to the browser.'
      );
    }
    if (!apiKeyManager.hasMuapiKey()) {
      throw new Error('MuAPI API key not configured. Add your key in Settings.');
    }

    const formData = new FormData();

    if (audioSource instanceof File || audioSource instanceof Blob) {
      formData.append('audio', audioSource);
    } else if (typeof audioSource === 'string') {
      // Assume it's a URL - download first
      const response = await fetch(audioSource);
      const blob = await response.blob();
      formData.append('audio', blob);
    }

    formData.append('language', options.language);
    formData.append('model', options.model);
    formData.append('word_timestamps', options.wordTimestamps.toString());

    const response = await fetch(this.proxyUrl, {
      method: 'POST',
      headers: {
        'x-endpoint': 'transcribe',
        'x-api-key': apiKeyManager.getMuapiKey(),
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`MuAPI transcription failed: ${response.status}`);
    }

    const result = await response.json();
    this.stats.muapiRequests++;

    return this._normalizeMuAPIResult(result);
  }

  /**
   * Transcribe using local Whisper
   */
  async _transcribeWithLocalWhisper(audioSource, options) {
    await this.rateLimiter.waitForSlot();

    const formData = new FormData();

    if (audioSource instanceof File || audioSource instanceof Blob) {
      formData.append('audio', audioSource);
    } else if (typeof audioSource === 'string') {
      const response = await fetch(audioSource);
      const blob = await response.blob();
      formData.append('audio', blob);
    }

    formData.append('language', options.language);
    formData.append('model', options.model);
    formData.append('word_timestamps', 'true');

    const response = await fetch(`${this.localWhisperUrl}/transcribe`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Local Whisper transcription failed: ${response.status}`);
    }

    const result = await response.json();
    this.stats.localRequests++;

    return this._normalizeLocalResult(result);
  }

  /**
   * Normalize MuAPI result to standard format
   */
  _normalizeMuAPIResult(result) {
    return {
      text: result.text || '',
      language: result.language || 'unknown',
      segments: (result.segments || []).map(segment => ({
        start: segment.start,
        end: segment.end,
        text: segment.text,
        words: (segment.words || []).map(word => ({
          word: word.word,
          start: word.start,
          end: word.end,
          confidence: word.confidence || 1.0
        }))
      })),
      duration: result.duration || 0
    };
  }

  /**
   * Normalize local Whisper result to standard format
   */
  _normalizeLocalResult(result) {
    return {
      text: result.text || '',
      language: result.language || 'unknown',
      segments: (result.segments || []).map(segment => ({
        start: segment.start,
        end: segment.end,
        text: segment.text,
        words: (segment.words || []).map(word => ({
          word: word.word,
          start: word.start,
          end: word.end,
          confidence: word.confidence || 1.0
        }))
      })),
      duration: result.duration || 0
    };
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages() {
    return [
      { code: 'auto', name: 'Auto Detect' },
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ru', name: 'Russian' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'zh', name: 'Chinese' },
      { code: 'ar', name: 'Arabic' },
      { code: 'hi', name: 'Hindi' },
      { code: 'nl', name: 'Dutch' },
      { code: 'pl', name: 'Polish' },
      { code: 'tr', name: 'Turkish' },
      { code: 'sv', name: 'Swedish' },
      { code: 'da', name: 'Danish' },
      { code: 'no', name: 'Norwegian' },
      { code: 'fi', name: 'Finnish' }
    ];
  }

  /**
   * Get service statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      requests: 0,
      openaiRequests: 0,
      muapiRequests: 0,
      localRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      fallbacks: 0
    };
  }
}

// Create default instance
const whisperService = new WhisperService();

export { WhisperService, whisperService };