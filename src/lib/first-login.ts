// First-login gender step (E01-S12). After any login, a user who has not yet
// chosen a gender goes once to /witaj (screen 3b); everyone else goes to `next`.
//
// Fails OPEN: if the read errors (e.g. the profiles_private migration is not
// applied yet), login continues to `next` — this feature must never block
// signing in.
import type { SupabaseClient } from '@supabase/supabase-js'

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
 * Pure decision: `gender` is the stored value (null = not chosen yet).
 */
export function firstLoginTarget(gender: string | null, next: string): string {
  if (gender) return next
  // Never wrap /witaj in itself.
  if (next === WELCOME_PATH || next.startsWith(`${WELCOME_PATH}?`)) return next
  return welcomePath(next)
}

/** Where to send a freshly signed-in user: /witaj when gender is unset, else `next`. */
export async function postLoginPath(supabase: SupabaseClient, next: string): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return next

  const { data, error } = await supabase
    .from('profiles_private')
    .select('gender')
    .eq('id', user.id)
    .maybeSingle<{ gender: string | null }>()

  if (error) {
    console.error('first-login gender read failed', { code: error.code })
    return next
  }
  return firstLoginTarget(data?.gender ?? null, next)
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
