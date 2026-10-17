import 'server-only'
import type { User } from '@supabase/supabase-js'
import type { createSupabaseServerClient } from '@/lib/supabase/server'

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

/**
 * Whether the user may add recipes ("pełny dostęp": an access code or a
 * payment). The single seam for that decision: the menu lock (E01-S09) and the
 * add gate read it from here.
 *
 * Until E01-S11 (#214) stores the real flag, every signed-in user keeps the
 * capability they have today, so this returns true for any user. S11 replaces
 * the body (hence the unused `supabase` parameter); callers stay unchanged.
 */
export async function hasFullAccess(_supabase: ServerClient, user: User | null): Promise<boolean> {
  return user !== null
}
