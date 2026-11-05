import { createBrowserClient } from '@supabase/ssr'
import { PUBLIC_SUPABASE_KEY, PUBLIC_SUPABASE_URL } from './public-config'

/**
 * Reads the session cookie the server wrote. No refresh timer: middleware refreshes the
 * session on every page, and a second timer would race it for the rotating refresh token,
 * so the browser refreshes only when `getSession()` finds the token expired. No URL
 * detection: /auth/callback and /auth/confirm open the session on the server.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_KEY, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false },
  })
}
