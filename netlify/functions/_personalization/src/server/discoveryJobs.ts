import { getSupabaseAdmin } from '../lib/supabaseServer'

export type DiscoveryJobStatus = 'queued' | 'running' | 'complete' | 'error'

export interface DiscoveryJobRow {
  id: string
  clerk_user_id: string
  website_url: string
  status: DiscoveryJobStatus
  fast_result_json: unknown | null
  browser_result_json: unknown | null
  final_result_json: unknown | null
  telemetry_json: unknown | null
  error_code: string | null
  error_message: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
  expires_at: string
}

export interface CreateDiscoveryJobInput {
  clerkUserId: string
  websiteUrl: string
  fastResult?: unknown
  telemetry?: Record<string, unknown>
}

export interface UpdateDiscoveryJobInput {
  status?: DiscoveryJobStatus
  startedAt?: string | null
  completedAt?: string | null
  /** Only update when the job currently has this status. Prevents the
   * stale-job watchdog from overwriting a job the worker just completed. */
  expectedStatus?: DiscoveryJobStatus
  /** The static/HTTP result, kept separately so it survives a failed browser phase. */
  fastResult?: unknown
  browserResult?: unknown
  finalResult?: unknown
  telemetry?: Record<string, unknown>
  errorCode?: string
  errorMessage?: string
}

export async function createDiscoveryJob(input: CreateDiscoveryJobInput): Promise<DiscoveryJobRow> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('lead_finder_discovery_jobs')
    .insert({
      clerk_user_id: input.clerkUserId,
      website_url: input.websiteUrl,
      status: 'queued',
      fast_result_json: input.fastResult ?? null,
      telemetry_json: input.telemetry ?? null,
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to create discovery job: ${error.message}`)
  }

  return data as DiscoveryJobRow
}

export async function updateDiscoveryJob(id: string, input: UpdateDiscoveryJobInput): Promise<DiscoveryJobRow | null> {
  const supabase = getSupabaseAdmin()
  const payload: Record<string, unknown> = {}

  if (input.status) payload.status = input.status
  if (input.startedAt !== undefined) payload.started_at = input.startedAt
  if (input.completedAt !== undefined) payload.completed_at = input.completedAt
  if (input.fastResult !== undefined) payload.fast_result_json = input.fastResult
  if (input.browserResult !== undefined) payload.browser_result_json = input.browserResult
  if (input.finalResult !== undefined) payload.final_result_json = input.finalResult
  if (input.telemetry) payload.telemetry_json = input.telemetry
  if (input.errorCode !== undefined) payload.error_code = input.errorCode
  if (input.errorMessage !== undefined) payload.error_message = input.errorMessage

  let query = supabase
    .from('lead_finder_discovery_jobs')
    .update(payload)
    .eq('id', id)
  if (input.expectedStatus) {
    query = query.eq('status', input.expectedStatus)
  }
  // `.single()` turns "no row matched" into an error; a conditional update
  // that lost the race must instead come back as null.
  const { data, error } = input.expectedStatus
    ? await query.select('*').maybeSingle()
    : await query.select('*').single()

  if (error) {
    throw new Error(`Failed to update discovery job: ${error.message}`)
  }
  if (!data && input.expectedStatus) {
    // The job's current status does not match the expected status — another
    // process already transitioned it. Return null so the caller can re-read
    // and act on the current state.
    return null
  }
  if (!data) {
    throw new Error('Failed to update discovery job: no rows affected')
  }

  return data as DiscoveryJobRow
}

export async function getDiscoveryJobForUser(id: string, clerkUserId: string): Promise<DiscoveryJobRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('lead_finder_discovery_jobs')
    .select('*')
    .eq('id', id)
    .eq('clerk_user_id', clerkUserId)
    .single()

  if (error || !data) {
    return null
  }

  return data as DiscoveryJobRow
}

export async function getDiscoveryJobById(id: string): Promise<DiscoveryJobRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('lead_finder_discovery_jobs')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return null
  }

  return data as DiscoveryJobRow
}
