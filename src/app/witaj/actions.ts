'use server'

import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/supabase/server'
import { getSiteUrl } from '@/lib/site-url'
import { resolveLoginNext } from '@/lib/login-redirect'
import { genderSaveRedirect, parseGender, welcomePath } from '@/lib/first-login'

/**
 * Save the one-time gender choice (E01-S12, screen 3b). The set_gender RPC is
 * the only write path and is first-write-wins, so a double submit or a second
 * tab can never change a stored choice.
 */
export async function saveGender(formData: FormData): Promise<void> {
  const origin = new URL(await getSiteUrl()).origin
  const next = resolveLoginNext(formData.get('next'), origin, '/')
  const gender = parseGender(formData.get('gender'))

  if (!gender) {
    redirect(welcomePath(next, 'invalid'))
  }

  const { supabase } = await requireUser()
  const { data, error } = await supabase.rpc('set_gender', { p_gender: gender })

  if (error) {
    console.error('set_gender failed', { code: error.code })
    redirect(welcomePath(next, 'unknown'))
  }

  redirect(genderSaveRedirect(data, next))
}
