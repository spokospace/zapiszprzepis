import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env'
import { getCachedJwks } from './jwks-cache'
import { checkClaims, type SessionUser } from './user-check'

export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse
  user: SessionUser | null
  /** The session could not be checked (see isTransientAuthError); `user` is then null. */
  authTransient: boolean
  supabase: SupabaseClient
}> {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          )
        },
      },
    },
  )

  // getClaims() verifies the access token locally against the project's signing keys
  // and refreshes it (+ setAll) only when it is about to expire. Do not put logic
  // between createServerClient and this call — it would race the cookie refresh. The
  // keys are fetched ahead of it: they touch no cookie.
  const { user, transient } = await checkClaims(
    supabase,
    `middleware ${request.nextUrl.pathname}`,
    await getCachedJwks(SUPABASE_URL),
  )

  return { response, user, authTransient: transient, supabase }
}
