/**
 * Motion Director page capture, run as a Netlify background function (the
 * `-background` suffix: the caller gets 202 at once and this keeps running for
 * up to 15 minutes). Ported from OpenHiggsBolt's
 * netlify/functions/motion-studio-capture-background.js. remix bundles this
 * function with esbuild (netlify.toml), so it imports the TypeScript worker
 * directly instead of OpenHiggsBolt's pre-compiled netlify/lib/motion-capture.cjs.
 *
 * Only `/api/motion-studio/capture` (personalization-api) calls it, with the
 * shared INTERNAL_FUNCTION_SECRET; anything else is rejected.
 */
import './_personalization/shims/env'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'
import { parseJobRequest, runMotionCapture } from './_personalization/src/server/motionCaptureWorker'
import type { CaptureStorage } from './_personalization/src/server/motionCapture'

const BUCKET = 'motion-capture'

function internalSecretOk(headers: Record<string, string | undefined>): boolean {
  const secret = process.env.INTERNAL_FUNCTION_SECRET || process.env.PERSONALIZATION_DISCOVERY_SECRET || ''
  if (!secret) return false
  const provided = headers['x-internal-service-token']
  if (typeof provided !== 'string' || !provided) return false
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(secret, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

export const handler = async (event: { headers?: Record<string, string | undefined>; body?: string | null }) => {
  if (!internalSecretOk(event.headers || {})) return { statusCode: 401, body: 'unauthorized' }
  let job: ReturnType<typeof parseJobRequest> = null
  try {
    job = parseJobRequest(JSON.parse(event.body || '{}'))
  } catch {
    job = null
  }
  if (!job) return { statusCode: 400, body: 'bad request' }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const storage = createClient(supabaseUrl, serviceRole).storage.from(BUCKET) as unknown as CaptureStorage
  await runMotionCapture(job, storage)
  return { statusCode: 202 }
}
