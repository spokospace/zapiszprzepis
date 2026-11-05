import type { JWK } from '@supabase/supabase-js'

// auth.getClaims() checks an access token's signature against the project's public
// signing keys. The Supabase client keeps those keys on the client instance, and every
// request builds a new one, so left alone each request would fetch them again, one
// network call in place of the one getClaims() is there to save. The keys are kept per
// isolate here and handed to getClaims() instead.

const JWKS_TTL_MS = 10 * 60 * 1000
// An empty answer (a project that signs with a shared secret, a failed fetch) is kept
// briefly, so an outage costs one fetch per half minute instead of one per request.
const EMPTY_TTL_MS = 30 * 1000
const FETCH_TIMEOUT_MS = 3000

// Only a finished result is kept, never a fetch in progress. On Workers a promise belongs to
// the request that started it: if that request ends early (error 1102, a client that left),
// the promise never settles, and every later request in the isolate awaiting it hangs until
// the isolate is replaced. A few parallel fetches on an expired cache are the cheap price.
let cache: { url: string; keys: JWK[]; expiresAt: number } | undefined

/** The published keys, or none when the fetch fails or the project publishes none. */
async function fetchKeys(supabaseUrl: string): Promise<JWK[]> {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/.well-known/jwks.json`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!response.ok) return []
    const body = (await response.json()) as { keys?: JWK[] }
    return Array.isArray(body.keys) ? body.keys : []
  } catch {
    return []
  }
}

/**
 * The project's public signing keys, from memory while fresh; otherwise each caller
 * fetches for itself. Never throws: with no keys, getClaims() asks the Auth server itself
 * (a getUser() round trip) and reports a failure through the usual error path.
 */
export async function getCachedJwks(supabaseUrl: string): Promise<{ keys: JWK[] }> {
  if (cache && cache.url === supabaseUrl && Date.now() < cache.expiresAt) {
    return { keys: cache.keys }
  }
  const keys = await fetchKeys(supabaseUrl)
  cache = { url: supabaseUrl, keys, expiresAt: Date.now() + (keys.length ? JWKS_TTL_MS : EMPTY_TTL_MS) }
  return { keys }
}

/** Forget the kept keys; for tests. */
export function resetJwksCache(): void {
  cache = undefined
}
