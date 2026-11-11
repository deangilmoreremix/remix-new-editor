/**
 * POST /api/proxy/openai-enhance
 *
 * Text helper for the ported personalization client
 * (src/features/personalization/shared/api/openai.ts). In OpenHiggsBolt this
 * was a Next.js proxy to the `enhance-prompt` Supabase edge function, which
 * remix does not have, so the handler calls OpenAI directly.
 *
 * Contract:
 *   { prompt, mode?: 'enhance' | 'script' | 'campaign' } → { text, model }
 *   { mode: 'chat', messages: [{ role, content }] }      → { text, model }
 *     (`callOpenAIChat`, used by the prompt personalizer; OpenHiggsBolt's
 *     edge function never handled this shape)
 *
 * Auth: a signed-in Clerk user. Key: the user's own OpenAI key from Settings
 * (`x-openai-key`) via getOpenAiKeyForUser(); no site-wide fallback.
 */
import { NextResponse } from '../shims/next-server'
import { auth } from '../shims/clerk-server'
import { getOpenAiKeyForUser } from '../src/lib/openaiKeyServer'

type Mode = 'enhance' | 'script' | 'campaign'
type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'
const MAX_MESSAGES = 40
const MAX_CHARS = 60_000

const SYSTEM_PROMPTS: Record<Mode, string> = {
  enhance:
    "You are an expert prompt engineer for AI image and video generation. " +
    "Rewrite the user's prompt so it is vivid, specific, and production-ready: " +
    'add concrete subject, composition, lighting, mood, style, lens, and quality ' +
    "cues while faithfully preserving the user's original intent. " +
    'Return ONLY the improved prompt as plain text — no preamble, no quotes, no markdown.',
  script:
    "You are a professional short-form video scriptwriter. Turn the user's " +
    'description into a tight, engaging script with a strong hook, clear beats, ' +
    'and a call to action. Keep it punchy and ready to record. ' +
    'Return ONLY the script as plain text — no preamble, no markdown.',
  campaign:
    "You are a senior marketing copywriter. Turn the user's description into " +
    'compelling campaign copy: a headline, a short body, and a call to action. ' +
    'Make it specific and conversion-focused. ' +
    'Return ONLY the copy as plain text — no preamble, no markdown.',
}

const MAX_TOKENS: Record<Mode | 'chat', number> = { enhance: 500, script: 1200, campaign: 800, chat: 1200 }

function normalizeMode(value: unknown): Mode {
  return value === 'script' || value === 'campaign' ? value : 'enhance'
}

function sanitizeMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) return null
  const out: ChatMessage[] = []
  let total = 0
  for (const item of value) {
    const role = (item as ChatMessage)?.role
    const content = (item as ChatMessage)?.content
    if (!['system', 'user', 'assistant'].includes(role) || typeof content !== 'string') return null
    total += content.length
    if (total > MAX_CHARS) return null
    out.push({ role, content })
  }
  return out
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })

  // OpenHiggsBolt answers a missing key with 401 UNAUTHENTICATED.
  const key = await getOpenAiKeyForUser()
  if (!key) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  let messages: ChatMessage[] | null
  let budget: number
  if (body.mode === 'chat') {
    messages = sanitizeMessages(body.messages)
    if (!messages) return NextResponse.json({ error: 'Invalid messages' }, { status: 400 })
    budget = MAX_TOKENS.chat
  } else {
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
    if (!prompt) return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
    if (prompt.length > MAX_CHARS) return NextResponse.json({ error: 'Prompt is too long' }, { status: 413 })
    const mode = normalizeMode(body.mode)
    messages = [
      { role: 'system', content: SYSTEM_PROMPTS[mode] },
      { role: 'user', content: prompt },
    ]
    budget = MAX_TOKENS[mode]
  }

  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages, max_tokens: budget }),
      signal: AbortSignal.timeout(60_000),
    })
    const data = (await upstream.json().catch(() => ({}))) as {
      choices?: Array<{ message?: { content?: string } }>
      error?: { message?: string }
    }
    if (!upstream.ok) {
      return NextResponse.json({ error: data?.error?.message || `OpenAI error: ${upstream.status}` }, { status: upstream.status })
    }
    const text = (data.choices?.[0]?.message?.content || '').trim()
    if (!text) return NextResponse.json({ error: 'OpenAI returned an empty response' }, { status: 502 })
    return NextResponse.json({ text, model: MODEL })
  } catch (err) {
    console.error('[openai-enhance] request failed:', (err as Error)?.message || err)
    return NextResponse.json({ error: 'Prompt enhancement failed' }, { status: 502 })
  }
}
