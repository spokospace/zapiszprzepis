import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env'
import { checkUser } from './user-check'

export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse
  user: User | null
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

  // getUser() validates the JWT with Supabase Auth and triggers a token
  // refresh + setAll if it expired. Do not put logic between createServerClient
  // and this call — it would race the cookie refresh.
  const { user, transient } = await checkUser(supabase, `middleware ${request.nextUrl.pathname}`)

  return { response, user, authTransient: transient, supabase }
}
