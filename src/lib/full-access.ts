import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * E01-S11 — may the current user add recipes? Full access comes from an access
 * code (screen 3c) or, later, a payment. Backed by the has_full_access() RPC,
 * which RLS on recipe_shares/recipes INSERT also uses, so the app and the
 * database agree. Fails CLOSED: any RPC error means "no access".
 */
export async function getFullAccess(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('has_full_access')
    if (error) {
      console.error('[full-access] has_full_access failed:', error.message)
      return false
    }
    return data === true
  } catch (err) {
    console.error('[full-access] has_full_access threw:', err)
    return false
  }
}

/** Thrown by triggerRecipeExtraction for a user without full access; /share maps it to ?add_error=no_access. */
export const NO_FULL_ACCESS = 'No full access'
