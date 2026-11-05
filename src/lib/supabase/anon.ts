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
 * Module singleton: one client per Worker isolate, reused across invocations.
 *
 * `accessToken` keeps the auth client out of it. That client starts an `initializePromise`
 * in its constructor, and every query awaits it. On Workers a promise dies with the request
 * that started it, so if the first request ended early (error 1102, a client that left),
 * every later read in the isolate would hang. A null token falls back to the anon key.
 */
let anonClient: SupabaseClient | null = null

export function createSupabaseAnonClient(): SupabaseClient {
  if (!anonClient) {
    anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { accessToken: async () => null })
  }
  return anonClient
}
