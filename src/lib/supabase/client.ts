import { createBrowserClient } from '@supabase/ssr'
import { PRODUCTION_SUPABASE_URL } from '@/lib/image-remote-patterns'

// Both are public by design and also in wrangler.jsonc `vars`. A NEXT_PUBLIC_ value
// reaches the browser only when it is set at build time, so production is the fallback.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || PRODUCTION_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_49CjHG7pAqYIFe7roJDZdA_5c_jBzj2'

/**
 * Reads the session cookie the server wrote. No refresh timer: middleware refreshes the
 * session on every page, and a second timer would race it for the rotating refresh token,
 * so the browser refreshes only when `getSession()` finds the token expired. No URL
 * detection: /auth/callback and /auth/confirm open the session on the server.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false },
  })
}
