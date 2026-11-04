import { cache } from 'react'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env'
import { getCachedJwks } from './jwks-cache'
import { checkClaims, checkUser, SessionCheckError } from './user-check'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch (e) {
            // Server Component renders cannot write cookies — middleware.ts
            // refreshes the session, so this path is safe to swallow.
            // Anything else (e.g. a real failure in a Route Handler)
            // must surface, not silently lose the session.
            if (
              !(e instanceof Error) ||
              !e.message.includes('Cookies can only be modified')
            ) {
              throw e
            }
          }
        },
      },
    },
  )
}

/**
 * The full session check for this render (a getUser() round trip to the Auth
 * server), for requireUser(). Wrapped in React `cache()` so one render shares it.
 */
const checkCurrentUser = cache(async () => {
  const supabase = await createSupabaseServerClient()
  return { supabase, ...(await checkUser(supabase, 'server')) }
})

/**
 * The read-side session check for this render: the access token is verified locally
 * (getClaims), so a layout and its page cost no Auth round trip. Wrapped in React
 * `cache()` so they still share one check.
 */
const checkCurrentClaims = cache(async () => {
  const supabase = await createSupabaseServerClient()
  return checkClaims(supabase, 'server', await getCachedJwks(SUPABASE_URL))
})

/**
 * The signed-in user's id, or null for a guest (E01-S02 public routes). A check that
 * could not decide renders the public page as for a guest; it is logged. For reads:
 * a session revoked on another device still shows until its access token expires.
 */
export async function getCurrentUser() {
  return (await checkCurrentClaims()).user
}

/**
 * For a screen behind login: the user's id, or null for a real guest (the caller
 * sends them to /login). A check that could not decide throws SessionCheckError, so
 * the visitor gets the error page with a retry instead of being logged out.
 */
export async function getSignedInUser() {
  const { user, transient } = await checkCurrentClaims()
  if (!user && transient) throw new SessionCheckError()
  return user
}

/**
 * Auth guard for Server Actions / Server Components downstream of the proxy:
 * build the client, confirm a user, redirect to /login otherwise. Returns both
 * so callers needing only identity can ignore `supabase` and vice versa.
 */
export async function requireUser() {
  const { supabase, user, transient } = await checkCurrentUser()
  if (!user && transient) throw new SessionCheckError()
  if (!user) {
    redirect('/login')
  }
  return { supabase, user }
}
