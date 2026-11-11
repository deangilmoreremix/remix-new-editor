function getSupabaseUrl(): string | undefined {
  // Next.js / Node
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  }
  // Vite
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_SUPABASE_URL
  }
  return undefined
}

// NOTE: OpenAI calls are proxied through /api/proxy/openai-enhance.
// The client never receives or persists raw API keys.

/**
 * Call OpenAI via the server-side proxy.
 * The client never receives or persists raw API keys.
 */
export async function callOpenAI(
  prompt: string,
  mode: 'enhance' | 'script' | 'campaign' = 'enhance'
): Promise<{ text: string; model: string }> {
  const response = await fetch('/api/proxy/openai-enhance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, mode }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `OpenAI error: ${response.status}`)
  }

  return response.json()
}

/**
 * Chat completion via the server-side proxy.
 * The client never receives or persists raw API keys.
 */
export async function callOpenAIChat(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const response = await fetch('/api/proxy/openai-enhance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, mode: 'chat' }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `OpenAI error: ${response.status}`)
  }

  const data = await response.json()
  return data.text || data.choices?.[0]?.message?.content || ''
}

/**
 * Call the OpenAI Responses API with the AUTHENTICATED USER'S OWN key (BYOK).
 * A server-side env key is never used as a fallback; a missing user key
 * produces a clear Settings error instead of an operator-billed upstream call.
 * Server-side callers resolve the user key via getOpenAiKeyForUser().
 */
export class MissingOpenAiKeyError extends Error {
  constructor() {
    super('No OpenAI API key provided. Add your OpenAI key in Settings and try again.')
    this.name = 'MissingOpenAiKeyError'
  }
}

export async function callOpenAIResponses(input: any[], apiKey?: string): Promise<string> {
  const key = apiKey && String(apiKey).trim()
  if (!key) {
    throw new MissingOpenAiKeyError()
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      input,
      max_output_tokens: 3000,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `OpenAI error: ${response.status}`)
  }

  const result = await response.json()
  return result.output?.[0]?.content?.[0]?.text || result.output_text || ''
}

/**
 * Enhance a video prompt using AI
 */
export async function enhancePrompt(prompt: string): Promise<string> {
  const result = await callOpenAI(prompt, 'enhance')
  return result.text
}

/**
 * Generate a video script from a description
 */
export async function generateScript(description: string): Promise<string> {
  const result = await callOpenAI(description, 'script')
  return result.text
}

/**
 * Generate campaign copy from a description
 */
export async function generateCampaignCopy(description: string): Promise<string> {
  const result = await callOpenAI(description, 'campaign')
  return result.text
}
