// Pure helpers for the auth callback. They live here rather than in the route
// module so they can be unit-tested — the route imports `server-only` through
// the Supabase client, which cannot be loaded from a test environment.

// Supabase auth error codes, matched exactly. Substring matching (`includes`)
// would mis-bucket any future code that merely contains one of these words —
// a new `validation_paused` would read as "expired". Unknown codes must fall
// through to the default branch so they get noticed instead of guessed at.
const EXPIRED_CODES = new Set(['otp_expired', 'flow_state_expired', 'flow_state_not_found'])
const USED_CODES = new Set(['flow_state_used', 'otp_used'])

/**
 * Resolve the post-login redirect target against our own origin.
 *
 * A path-shaped regex allowlist is not enough. `new URL()` follows the WHATWG
 * rules, where a backslash is equivalent to a slash for special schemes, so
 * `/\evil.com` resolves to `https://evil.com/` — an open redirect reached
 * through a link that otherwise looks like ours. Parsing first and then
 * requiring the resolved origin to match closes that whole class of bypass
 * rather than the one instance you happened to think of.
 */
export function safeNext(rawNext: string | null, origin: string): string {
  if (!rawNext) return '/'

  // Second layer: reject the characters that drive the normalisation tricks, so
  // a future change in URL parsing cannot quietly reopen this.
  if (/[\\]|%2f|%5c/i.test(rawNext)) return '/'

  try {
    const url = new URL(rawNext, origin)
    if (url.origin !== origin) return '/'
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/'
  }
}

/**
 * Classify the error Supabase itself puts on the callback URL.
 *
 * When the one-time token is rejected, /auth/v1/verify redirects to our callback
 * with `?error=access_denied&error_code=otp_expired&error_description=Email+link+
 * is+invalid+or+has+expired` and **no** `code`. Read this before the missing-code
 * branch, otherwise every such failure falls through to the generic "invalid"
 * message and hides the reason. Verified against the deployed verify endpoint.
 *
 * Returns null when the URL carries no error at all.
 */
export function inboundAuthError(errorCode: string | null, error: string | null): string | null {
  if (!errorCode && !error) return null
  return mapAuthError(errorCode ?? undefined)
}

// Exact text GoTrue sends (as `error_description`, with error=server_error)
// when the provider returned no email — a Facebook account without a confirmed
// address. There is no dedicated error code for it, so match the whole string.
const NO_EMAIL_DESCRIPTION = 'Error getting user email from external provider'
const OAUTH_UNAVAILABLE_CODES = new Set(['provider_disabled', 'oauth_provider_not_supported'])

/**
 * Classify the error Supabase puts on the callback URL after an OAuth sign-in
 * (E01-S12). Returns null when the URL carries no OAuth-specific error, so the
 * caller falls back to inboundAuthError (email-link errors). Exact matches
 * only — an unknown code must reach the generic branch, not be guessed at.
 */
export function inboundOAuthError(
  errorCode: string | null,
  error: string | null,
  description: string | null,
): string | null {
  if (errorCode === 'email_exists') return 'oauth_email_exists'
  if (errorCode === 'provider_email_needs_verification') return 'oauth_verify_email'
  if (errorCode && OAUTH_UNAVAILABLE_CODES.has(errorCode)) return 'oauth_unavailable'
  if (error === 'server_error' && description === NO_EMAIL_DESCRIPTION) return 'oauth_no_email'
  // The user pressed "Cancel" at the provider: access_denied WITHOUT a code.
  // (Email-link failures carry access_denied WITH a code such as otp_expired.)
  if (error === 'access_denied' && !errorCode) return 'oauth_cancelled'
  return null
}

export function mapAuthError(code: string | undefined): string {
  if (!code) return 'unknown'
  if (EXPIRED_CODES.has(code)) return 'expired'
  if (USED_CODES.has(code)) return 'used'
  return 'unknown'
}

// The email link types /auth/confirm accepts — exactly what supabase/templates
// send. `email` covers both the magic link and the signup confirmation.
const EMAIL_OTP_TYPES = ['email', 'recovery'] as const
export type ConfirmOtpType = (typeof EMAIL_OTP_TYPES)[number]

/** Narrow the `type` param of an email link; null for anything we do not verify. */
export function parseEmailOtpType(raw: string | null | undefined): ConfirmOtpType | null {
  return (EMAIL_OTP_TYPES as readonly string[]).includes(raw ?? '') ? (raw as ConfirmOtpType) : null
}
