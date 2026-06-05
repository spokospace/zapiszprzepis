import 'server-only'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
export const SUPABASE_ANON_KEY = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? undefined

// Lazy-loaded Trigger.dev vars — only evaluated when called, not at module load
export function getTriggerSecretKey(): string {
  return requireEnv('TRIGGER_SECRET_KEY')
}

export function getTriggerProjectId(): string {
  return requireEnv('TRIGGER_PROJECT_ID')
}
