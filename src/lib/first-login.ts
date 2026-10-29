// The common exit of every login path, and the /witaj gender screen (E01-S12).
//
// Gender is optional (#376, owner decision 2026-10-28: neutral wording rather
// than a pop-up question): no login is detoured to /witaj any more. The screen
// itself still works when opened directly, and a stored gender still shapes the
// wording a user sees about themselves.
import type { SupabaseClient } from '@supabase/supabase-js'
import { applyFavoriteIntent } from './favorites'
import { checkUser } from './supabase/user-check'

export const WELCOME_PATH = '/witaj'
export const GENDERS = ['female', 'male'] as const
export type Gender = (typeof GENDERS)[number]

/** `/witaj`, carrying where to continue afterwards. */
export function welcomePath(next: string, error?: string): string {
  const query = new URLSearchParams()
  if (error) query.set('error', error)
  query.set('next', next)
  return `${WELCOME_PATH}?${query.toString()}`
}

/**
 * Where to send a freshly signed-in user: `next`, after applying a guest heart's
 * favorite intent carried in it (E01-S06). Never detours to /witaj (#376).
 */
export async function postLoginPath(supabase: SupabaseClient, requestedNext: string): Promise<string> {
  // An undecided check fails open: continue to `next`.
  const { user } = await checkUser(supabase, 'postLoginPath')
  if (!user) return requestedNext
  return applyFavoriteIntent(supabase, user.id, requestedNext)
}

/** Narrow an untrusted form value to a gender; null otherwise. */
export function parseGender(raw: unknown): Gender | null {
  return typeof raw === 'string' && (GENDERS as readonly string[]).includes(raw) ? (raw as Gender) : null
}

/** Where the /witaj save goes, from the set_gender RPC result. */
export function genderSaveRedirect(result: unknown, next: string): string {
  if (result === 'ok' || result === 'already_set') return next
  if (result === 'invalid') return welcomePath(next, 'invalid')
  return welcomePath(next, 'unknown')
}
