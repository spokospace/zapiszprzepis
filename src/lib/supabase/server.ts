import { cache } from 'react'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env'
import { checkUser, SessionCheckError } from './user-check'

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
 * The session check for this render. Wrapped in React `cache()` so a layout and
 * its page share ONE Auth round trip per render instead of each calling getUser().
 */
const checkCurrentUser = cache(async () => {
  const supabase = await createSupabaseServerClient()
  return { supabase, ...(await checkUser(supabase, 'server')) }
})

/**
 * The signed-in user, or null for a guest (E01-S02 public routes). A check that
 * could not decide renders the public page as for a guest; it is logged.
 */
export async function getCurrentUser() {
  return (await checkCurrentUser()).user
}

/**
 * For a screen behind login: the user, or null for a real guest (the caller sends
 * them to /login). A check that could not decide throws SessionCheckError, so the
 * visitor gets the error page with a retry instead of being logged out.
 */
export async function getSignedInUser() {
  const { user, transient } = await checkCurrentUser()
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
