import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env'

/**
 * A cookie-free, anon Supabase client for the user-independent cached reads
 * (#445). `createSupabaseServerClient()` binds to `cookies()`, which cannot be
 * read inside `unstable_cache`; this client carries no session, so a cached read
 * is identical for every viewer and safe to share. Only the guest-safe
 * `public_recipes` view and the `category_tag_facets` RPC are read through it
 * (both anon-readable since E01-S02).
 *
 * Untyped like `createSupabaseServerClient` (no `Database` generic), so the
 * `public_recipes` view — which is not in the generated table types — resolves.
 * Module singleton: one client per Worker isolate, reused across invocations;
 * `persistSession`/`autoRefreshToken` are off because there is no user session.
 */
let anonClient: SupabaseClient | null = null

export function createSupabaseAnonClient(): SupabaseClient {
  if (!anonClient) {
    anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return anonClient
}
