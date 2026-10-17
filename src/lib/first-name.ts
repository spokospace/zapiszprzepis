// Private first name ("Imię") for the vocative greeting — E01-S13. Pure, apart
// from the getGreetingName() read at the bottom.
// The character rule mirrors public.set_first_name() in
// supabase/migrations/20261017181300_profile_avatar_first_name.sql.
import type { SupabaseClient } from '@supabase/supabase-js'
import { firstNameOf } from '@/lib/vocative'

export const FIRST_NAME_MAX = 40

/** Letters (any script), single spaces, hyphens or apostrophes between them. */
const FIRST_NAME_RE = /^\p{L}+(?:[ '-]\p{L}+)*$/u

export type FirstNameResult = { ok: true; value: string | null } | { ok: false; error: string }

/** Trim and collapse whitespace; blank clears the name (null). */
export function validateFirstName(raw: unknown): FirstNameResult {
  if (raw == null) return { ok: true, value: null }
  if (typeof raw !== 'string') return { ok: false, error: 'Podaj imię.' }
  const value = raw.trim().replace(/\s+/g, ' ')
  if (!value) return { ok: true, value: null }
  if (value.length > FIRST_NAME_MAX) {
    return { ok: false, error: `Imię może mieć najwyżej ${FIRST_NAME_MAX} znaków.` }
  }
  if (!FIRST_NAME_RE.test(value)) {
    return { ok: false, error: 'Imię może zawierać tylko litery, spację, myślnik i apostrof.' }
  }
  return { ok: true, value }
}

/**
 * The name the greeting inflects: the private first name when set, otherwise
 * the first word of the public display name (the E01-S12 behavior).
 */
export function greetingName(
  firstName: string | null | undefined,
  displayName: string | null | undefined,
): string | null {
  return firstNameOf(firstName) ?? firstNameOf(displayName)
}

/**
 * Read both names for the signed-in home greeting. A failed private read
 * (e.g. before the S13 migration) falls back to the display name.
 */
export async function getGreetingName(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const [{ data: profile }, { data: priv }] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle<{ display_name: string }>(),
    supabase.from('profiles_private').select('first_name').eq('id', userId).maybeSingle<{ first_name: string | null }>(),
  ])
  return greetingName(priv?.first_name, profile?.display_name)
}
