import { AuthInvalidJwtError, isAuthApiError, isAuthSessionMissingError, type User } from '@supabase/supabase-js'

// On 2026-10-22 signed-in visitors were sent to /login for minutes at a time with a
// valid, unexpired session: auth.getUser() never reached Supabase, and a failed check
// was read as "logged out". A failure that says nothing about the session is
// transient: it is retried once, logged, and never turned into a guest redirect.

/** Whether a getUser() error leaves the session undecided: network, 5xx, 429, a non-JSON answer. */
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

interface AuthClient {
  auth: { getUser(): Promise<{ data: { user: User | null }; error: unknown }> }
}

const RETRY_DELAY_MS = 200

/** One getUser() call; a throw becomes the error. */
async function tryGetUser(supabase: AuthClient): Promise<{ user: User | null; error: unknown }> {
  try {
    const { data, error } = await supabase.auth.getUser()
    return { user: data.user, error }
  } catch (error) {
    return { user: null, error }
  }
}

/**
 * auth.getUser() with one retry on a transient failure; each failure is logged with
 * `where`. `transient` means the check could not decide, and `user` is then null.
 */
export async function checkUser(supabase: AuthClient, where: string): Promise<{ user: User | null; transient: boolean }> {
  let result = await tryGetUser(supabase)
  if (!isTransientAuthError(result.error)) return { user: result.user, transient: false }
  logFailure(where, 1, result.error)
  // A rate limit is still in force 200 ms later: retrying would only add load.
  if (isAuthApiError(result.error) && result.error.status === 429) return { user: null, transient: true }

  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
  result = await tryGetUser(supabase)
  if (!isTransientAuthError(result.error)) return { user: result.user, transient: false }
  logFailure(where, 2, result.error)
  return { user: null, transient: true }
}

/** The fields that identify the failure; an auth error never carries the token. */
function logFailure(where: string, attempt: number, error: unknown): void {
  const { status, code } = error as { status?: number; code?: string }
  const detail = error instanceof Error ? { name: error.name, message: error.message, status, code } : { error: String(error) }
  console.error('[auth] getUser failed', JSON.stringify({ where, attempt, ...detail }))
}
