import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env'

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
            // Server Component renders cannot write cookies — proxy.ts
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
