/**
 * Map remix-new-editor's environment names onto the names the ported
 * OpenHiggsBolt server code reads. Imported FIRST by the function entry so
 * module-scope reads (e.g. src/lib/supabase.ts) see the aliases.
 */
const env = process.env as Record<string, string | undefined>

function alias(target: string, ...sources: string[]): void {
  if (env[target]) return
  for (const source of sources) {
    if (env[source]) {
      env[target] = env[source]
      return
    }
  }
}

alias('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL', 'VITE_SUPABASE_URL')
alias('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL')
alias('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY')
alias('SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY')
// The internal worker token reuses remix's existing personalization secret
// when a dedicated one is not configured.
alias('INTERNAL_FUNCTION_SECRET', 'PERSONALIZATION_DISCOVERY_SECRET')
alias('NEXT_PUBLIC_SITE_URL', 'URL', 'DEPLOY_PRIME_URL')

export {}
