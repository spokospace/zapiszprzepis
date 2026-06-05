import 'server-only'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    throw new Error(`Missing required env: ${name}`)
  }
  return value
}

// Lazy getters for Supabase vars — avoid eager validation at module load,
// which breaks middleware if env vars not yet available in Workers runtime.
// Next.js `collect page data` step at build time doesn't import these exports,
// so lazy evaluation is safe.
export function getSUPABASE_URL(): string {
  return requireEnv('NEXT_PUBLIC_SUPABASE_URL')
}

export function getSUPABASE_ANON_KEY(): string {
  return requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

// TRIGGER_SECRET_KEY is read lazily by @trigger.dev/sdk at first task.trigger() —
// eager validation here is hit by Next.js `collect page data` at build time.
