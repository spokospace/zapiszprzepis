import type { SupabaseClient } from '@supabase/supabase-js'
import { staffErrorCode, type StaffErrorCode } from './errors'

/**
 * Calls an admin_* wrapper with the caller's own session and reduces the answer to
 * "worked" (null) or a stable error code. The wrapper re-checks the permission in
 * SQL, so this is never the only gate. Free text from the database is logged, not
 * returned.
 */
export async function callAdmin(
  supabase: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<StaffErrorCode | null> {
  try {
    const { error } = await supabase.rpc(fn, args)
    if (!error) return null
    const code = staffErrorCode(error)
    if (code === 'unknown') console.error(`[staff] ${fn} failed:`, error.message)
    return code
  } catch (err) {
    console.error(`[staff] ${fn} threw:`, err)
    return 'unknown'
  }
}
