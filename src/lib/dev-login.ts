// Gate for the dev-only QA sign-in (/api/dev/login). Pure so it can be
// unit-tested without the route's `server-only` imports.
//
// Local dev talks to the PRODUCTION Supabase project, so this route signs a
// browser in as a real account. It must never answer in a production build:
// NODE_ENV is fixed to 'production' by `next build`, and the explicit
// DEV_LOGIN_ENABLED flag keeps it off on a dev server nobody opted in on.

export type DevLoginRole = 'full' | 'free'

type Env = Record<string, string | undefined>

/**
 * The email of the QA account to sign in as, or null when the route must 404:
 * not a dev server, the flag is not exactly '1', the role is unknown, or the
 * matching DEV_LOGIN_EMAIL_* is unset. `as` defaults to the full-access account.
 */
export function devLoginEmail(rawAs: string | null, env: Env = process.env): string | null {
  if (env.NODE_ENV !== 'development') return null
  if (env.DEV_LOGIN_ENABLED !== '1') return null

  const role = rawAs ?? 'full'
  if (role !== 'full' && role !== 'free') return null

  const email = (role === 'full' ? env.DEV_LOGIN_EMAIL_FULL : env.DEV_LOGIN_EMAIL_FREE)?.trim()
  return email ? email : null
}
