import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Whether the signed-in user may add recipes ("pełny dostęp": an access code
 * or a payment). Callers pass `false` for a guest instead of calling this.
 *
 * Placeholder with E01-S11's (#214) exact signature so the two changes merge
 * in either order: S11's version calls the has_full_access() RPC (auth.uid(),
 * fails closed). Until it lands, every signed-in user keeps the capability
 * they have today.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature shared with S11's implementation
export async function getFullAccess(_supabase: SupabaseClient): Promise<boolean> {
  return true
}
