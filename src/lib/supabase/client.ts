import { createBrowserClient } from '@supabase/ssr'

// Next.js inlines NEXT_PUBLIC_* only on literal `process.env.NEXT_PUBLIC_X`
// access at build time. lib/env.ts is server-only and cannot be imported here.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
