/**
 * Environment validation for personalization server routes.
 *
 * Validates required and optional configuration at startup/request boundaries.
 * Returns missing required variables or null when all required vars are present.
 */

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'INTERNAL_FUNCTION_SECRET',
]

const OPTIONAL_ENV_VARS = [
  'FIRECRAWL_API_KEY',
  'ENABLE_FIRECRAWL_FALLBACK',
  'ENABLE_BROWSER_DISCOVERY',
  'OPENAI_ASSET_CLASSIFICATION_MODEL',
]

export interface EnvValidationResult {
  valid: boolean
  missingRequired: string[]
  missingOptional: string[]
}

let cachedResult: EnvValidationResult | null = null

export function validatePersonalizationEnv(): EnvValidationResult {
  if (cachedResult) return cachedResult

  const missingRequired = REQUIRED_ENV_VARS.filter((key) => !process.env[key])
  const missingOptional = OPTIONAL_ENV_VARS.filter((key) => !process.env[key])

  cachedResult = {
    valid: missingRequired.length === 0,
    missingRequired,
    missingOptional,
  }

  return cachedResult
}

export function requirePersonalizationEnv(): EnvValidationResult {
  const result = validatePersonalizationEnv()
  if (!result.valid) {
    throw new Error(
      `Missing required environment variables: ${result.missingRequired.join(', ')}`
    )
  }
  return result
}
