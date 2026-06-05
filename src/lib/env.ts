import 'server-only'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    throw new Error(`Missing required env: ${name}`)
  }
  return value
}

export const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
export const SUPABASE_ANON_KEY = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

// TRIGGER_SECRET_KEY is read lazily by @trigger.dev/sdk at first task.trigger() —
// eager validation here is hit by Next.js `collect page data` at build time.
