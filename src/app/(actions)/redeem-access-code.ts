'use server'

import { requireUser } from '@/lib/supabase/server'

export type RedeemStatus = 'idle' | 'ok' | 'invalid' | 'rate_limited' | 'error'
export type RedeemState = { status: RedeemStatus }

// redeem_access_code() return tokens → UI state. Exact lookup, never substring
// matching (context/foundation/lessons.md). 'already' means the user had full
// access before; for them the gate simply opens.
const RPC_RESULT: Record<string, RedeemStatus> = {
  ok: 'ok',
  already: 'ok',
  invalid: 'invalid',
  rate_limited: 'rate_limited',
}

/**
 * E01-S11 screen 3c — redeem an access code for full access (may add recipes).
 * All validation (hash match, expiry, use limit, one redemption per account,
 * rate limit) happens inside the redeem_access_code() SECURITY DEFINER RPC in
 * one transaction; this action only maps its answer. No revalidatePath: the
 * gate itself swaps to the add form on success, and the home page is dynamic,
 * so the next visit reads the new entitlement anyway.
 */
export async function redeemAccessCode(_prev: RedeemState, formData: FormData): Promise<RedeemState> {
  const code = String(formData.get('code') ?? '').trim()
  if (!code) return { status: 'invalid' }

  const { supabase } = await requireUser()
  const { data, error } = await supabase.rpc('redeem_access_code', { p_code: code })
  if (error) {
    console.error('[redeemAccessCode] RPC failed:', error.message)
    return { status: 'error' }
  }
  return { status: typeof data === 'string' && Object.hasOwn(RPC_RESULT, data) ? RPC_RESULT[data] : 'error' }
}
