import { AuthInvalidJwtError, isAuthApiError, isAuthSessionMissingError, type JWK, type User } from '@supabase/supabase-js'

// On 2026-10-22 signed-in visitors were sent to /login for minutes at a time with a
// valid, unexpired session: auth.getUser() never reached Supabase, and a failed check
// was read as "logged out". A failure that says nothing about the session is
// transient: it is retried once, logged, and never turned into a guest redirect.

/** Whether an auth error leaves the session undecided: network, 5xx, 429, a non-JSON answer. */
export function isTransientAuthError(error: unknown): boolean {
  if (!error) return false
  // No session cookie, or a token that does not even parse: a real guest.
  if (isAuthSessionMissingError(error) || error instanceof AuthInvalidJwtError) return false
  // Supabase looked at the token and answered: any 4xx but 429 rejects the session
  // (bad_jwt, session_not_found, user_not_found).
  if (isAuthApiError(error)) return error.status === 429 || error.status >= 500
  return true
}

/** Thrown when the session could not be checked; the error page offers a retry. */
export class SessionCheckError extends Error {
  constructor() {
    super('The session could not be checked; try again.')
    this.name = 'SessionCheckError'
  }
}

/** The signed-in identity: all a read needs. A claims check cannot supply more (email, created_at). */
export interface SessionUser {
  id: string
}

interface AuthClient {
  auth: { getUser(): Promise<{ data: { user: User | null }; error: unknown }> }
}

interface ClaimsClient {
  auth: {
    getClaims(
      jwt?: string,
      options?: { jwks?: { keys: JWK[] } },
    ): Promise<{ data: { claims: { sub?: string } } | null; error: unknown }>
  }
}

const RETRY_DELAY_MS = 200

type Attempt<T> = () => Promise<{ value: T | null; error: unknown }>

/** One attempt; a throw becomes the error. */
async function settle<T>(attempt: Attempt<T>): Promise<{ value: T | null; error: unknown }> {
  try {
    return await attempt()
  } catch (error) {
    return { value: null, error }
  }
}

/**
 * Runs `attempt` with one retry on a transient failure; each failure is logged with
 * `method` and `where`. `transient` means the check could not decide, and `value` is
 * then null.
 */
async function checkWithRetry<T>(
  attempt: Attempt<T>,
  method: string,
  where: string,
): Promise<{ value: T | null; transient: boolean }> {
  let result = await settle(attempt)
  if (!isTransientAuthError(result.error)) return { value: result.value, transient: false }
  logFailure(method, where, 1, result.error)
  // A rate limit is still in force 200 ms later: retrying would only add load.
  if (isAuthApiError(result.error) && result.error.status === 429) return { value: null, transient: true }

  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
  result = await settle(attempt)
  if (!isTransientAuthError(result.error)) return { value: result.value, transient: false }
  logFailure(method, where, 2, result.error)
  return { value: null, transient: true }
}

/**
 * auth.getUser() with one retry on a transient failure: always a round trip to the
 * Auth server, so it also sees a session revoked elsewhere. For writes and for the
 * screens that read the full user (email, created_at).
 */
export async function checkUser(supabase: AuthClient, where: string): Promise<{ user: User | null; transient: boolean }> {
  const { value, transient } = await checkWithRetry(
    async () => {
      const { data, error } = await supabase.auth.getUser()
      return { value: data.user, error }
    },
    'getUser',
    where,
  )
  return { user: value, transient }
}

/**
 * auth.getClaims() with one retry on a transient failure: the access token is verified
 * locally against `jwks` (see getCachedJwks), and only an expiring session is refreshed
 * over the network. With a shared-secret project it falls back to a getUser() round
 * trip. A session revoked elsewhere shows until the access token expires (1 h by
 * default), the same window the database gives that token, so use it for reads only.
 */
export async function checkClaims(
  supabase: ClaimsClient,
  where: string,
  jwks?: { keys: JWK[] },
): Promise<{ user: SessionUser | null; transient: boolean }> {
  const { value, transient } = await checkWithRetry<SessionUser>(
    async () => {
      const { data, error } = await supabase.auth.getClaims(undefined, { jwks })
      // No session at all comes back as no data and no error: a guest.
      const sub = data?.claims.sub
      return { value: sub ? { id: sub } : null, error }
    },
    'getClaims',
    where,
  )
  return { user: value, transient }
}

/** The fields that identify the failure; an auth error never carries the token. */
function logFailure(method: string, where: string, attempt: number, error: unknown): void {
  const { status, code } = error as { status?: number; code?: string }
  const detail = error instanceof Error ? { name: error.name, message: error.message, status, code } : { error: String(error) }
  console.error(`[auth] ${method} failed`, JSON.stringify({ where, attempt, ...detail }))
}
