import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { getSUPABASE_URL, getSUPABASE_ANON_KEY } from '@/lib/env'

export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    getSUPABASE_URL(),
    getSUPABASE_ANON_KEY(),
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
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user }
}
