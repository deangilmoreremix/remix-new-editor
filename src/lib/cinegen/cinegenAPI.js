/**
 * CineGen API Service — Integrates existing APIs into CineGen features
 *
 * APIs Used:
 * - OpenAI Responses API (https://api.openai.com/v1/responses) — LLM features
 * - MuAPI (via Supabase proxy) — Video/image generation
 * - fal.ai — SAM3 segmentation
 */

import { apiKeyManager } from '../apiKeyManager.js';
import { openaiConfig } from '../config/openaiConfig.js';

const MUAPI_PROXY_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/muapi-proxy`
  : '/functions/v1/muapi-proxy';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const FAL_API_URL = 'https://fal.run/fal-ai';

export class CineGenAPIService {
  constructor() {
    this.openaiKey = null;
    this.falKey = null;
  }

  // === API Key Management ===

  _getOpenAIKey() {
    return this.openaiKey || apiKeyManager.getOpenAIKey();
  }

  _getFalKey() {
    return this.falKey || localStorage.getItem('fal_ai_key') || '';
  }

  setOpenAIKey(key) {
    this.openaiKey = key;
  }

  setFalKey(key) {
    this.falKey = key;
    localStorage.setItem('fal_ai_key', key);
  }

  // === OpenAI Responses API (LLM Features) ===

  /**
   * Call OpenAI Responses API for text generation
   * Used by: DirectorTab LLM breakdown, CINEDANCE rewrite, LLMEnhancer, Storyboarder
   */
  async callLLM(prompt, options = {}) {
    const key = this._getOpenAIKey();
    if (!key) {
      throw new Error('OpenAI API key not configured. Add your key in Settings.');
    }

    const model = options.model || openaiConfig.getResponsesModel?.() || 'gpt-5.6';
    const body = {
      model,
      input: [{ role: 'user', content: prompt }],
      store: options.store ?? true,
    };

    if (options.previousResponseId) {
      body.previous_response_id = options.previousResponseId;
    }

    if (options.maxOutputTokens) {
      body.max_output_tokens = options.maxOutputTokens;
    }

    try {
      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      return this._parseResponsesOutput(data);
    } catch (error) {
      if (error.message.includes('API key')) throw error;
      throw new Error(`LLM call failed: ${error.message}`);
    }
  }

  /**
   * Call OpenAI Responses API with streaming
   */
  async callLLMStream(prompt, onChunk, options = {}) {
    const key = this._getOpenAIKey();
    if (!key) {
      throw new Error('OpenAI API key not configured.');
    }

    const model = options.model || openaiConfig.getResponsesModel?.() || 'gpt-5.6';
    const body = {
      model,
      input: [{ role: 'user', content: prompt }],
      stream: true,
      store: true,
    };

    const response = await fetch(`${OPENAI_RESPONSES_URL}?stream=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error('Streaming request failed');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (onChunk) onChunk(data);
          } catch (e) {
            // Skip malformed chunks
          }
        }
      }
    }
  }

  _parseResponsesOutput(data) {
    if (!data) return { text: '', responseId: null, images: [] };

    let text = '';
    const images = [];

    if (data.output) {
      for (const item of data.output) {
        if (item.type === 'message' && item.content) {
          for (const content of item.content) {
            if (content.type === 'output_text') {
              text += content.text;
            }
          }
        }
        if (item.type === 'image_generation_call' && item.result) {
          images.push({
            base64: item.result,
            revisedPrompt: item.revised_prompt
          });
        }
      }
    }

    return {
      text: text.trim(),
      responseId: data.id,
      images,
      usage: data.usage
    };
  }

  // === MuAPI (Video/Image Generation) ===

  /**
   * Generate video via MuAPI
   * Used by: NodeWorkflow video generation, Storyboarder video gen
   */
  async generateVideo(params) {
    const muapiKey = apiKeyManager.getMuapiKey();
    if (!muapiKey) {
      throw new Error('MuAPI key not configured. Add your key in Settings.');
    }

    const endpoint = params.endpoint || params.model || 'generate_video';
    const payload = {
      prompt: params.prompt,
      duration: params.duration || 5,
      aspect_ratio: params.aspectRatio || '16:9',
      resolution: params.resolution || '1080p',
      ...params.extraParams
    };

    if (params.imageUrl) {
      payload.image_url = params.imageUrl;
    }

    if (params.negativePrompt) {
      payload.negative_prompt = params.negativePrompt;
    }

    try {
      // Submit generation request
      const response = await fetch(MUAPI_PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': muapiKey,
          'x-endpoint': endpoint
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`MuAPI request failed: ${response.status}`);
      }

      const data = await response.json();
      const requestId = data.request_id || data.data?.request_id;

      if (!requestId) {
        throw new Error('No request ID returned from MuAPI');
      }

      // Poll for completion
      return await this._pollMuAPIResult(requestId, muapiKey);
    } catch (error) {
      throw new Error(`Video generation failed: ${error.message}`);
    }
  }

  /**
   * Generate image via MuAPI
   */
  async generateImage(params) {
    const muapiKey = apiKeyManager.getMuapiKey();
    if (!muapiKey) {
      throw new Error('MuAPI key not configured.');
    }

    const endpoint = params.endpoint || params.model || 'generate_image';
    const payload = {
      prompt: params.prompt,
      aspect_ratio: params.aspectRatio || '16:9',
      resolution: params.resolution || '1080p',
      negative_prompt: params.negativePrompt || ''
    };

    const response = await fetch(MUAPI_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': muapiKey,
        'x-endpoint': endpoint
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`MuAPI image request failed: ${response.status}`);
    }

    const data = await response.json();
    const requestId = data.request_id || data.data?.request_id;

    if (!requestId) {
      throw new Error('No request ID returned');
    }

    return await this._pollMuAPIResult(requestId, muapiKey);
  }

  async _pollMuAPIResult(requestId, muapiKey, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

      const statusResponse = await fetch(MUAPI_PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': muapiKey,
          'x-endpoint': 'check_status'
        },
        body: JSON.stringify({ request_id: requestId })
      });

      if (!statusResponse.ok) continue;

      const statusData = await statusResponse.json();
      const status = statusData.status || statusData.data?.status;

      if (status === 'completed' || status === 'success') {
        return {
          success: true,
          url: statusData.url || statusData.data?.url || statusData.output?.[0],
          requestId
        };
      }

      if (status === 'failed' || status === 'error') {
        throw new Error(statusData.error || statusData.data?.error || 'Generation failed');
      }
    }

    throw new Error('Generation timed out');
  }

  // === fal.ai (SAM3 Segmentation) ===

  /**
   * Run SAM3 segmentation via fal.ai
   * Used by: SAM3 Segmentation feature
   */
  async segmentImage(imageUrl, prompt, options = {}) {
    const falKey = this._getFalKey();
    if (!falKey) {
      throw new Error('fal.ai key not configured. Add your key in Settings.');
    }

    const endpoint = `${FAL_API_URL}/sam3/segment`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Key ${falKey}`
        },
        body: JSON.stringify({
          image_url: imageUrl,
          prompt: prompt,
          threshold: options.threshold || 0.5,
          return_multiple: options.returnMultiple || false
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`fal.ai error: ${error.detail || response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        masks: data.masks || [{
          id: `mask-${Date.now()}`,
          confidence: data.confidence || 0.9,
          area: data.area || 0.3,
          data: data.mask_data || [],
          bbox: data.bounding_box
        }]
      };
    } catch (error) {
      if (error.message.includes('fal.ai key')) throw error;
      throw new Error(`Segmentation failed: ${error.message}`);
    }
  }

  /**
   * Check fal.ai queue status
   */
  async checkFalStatus(requestId) {
    const falKey = this._getFalKey();
    if (!falKey) throw new Error('fal.ai key not configured');

    const response = await fetch(`${FAL_API_URL}/requests/${requestId}/status`, {
      headers: { 'Authorization': `Key ${falKey}` }
    });

    if (!response.ok) throw new Error('Status check failed');
    return await response.json();
  }
}

// Singleton instance
export const cineGenAPI = new CineGenAPIService();

export default CineGenAPIService;
