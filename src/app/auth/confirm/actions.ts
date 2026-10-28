'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSiteUrl } from '@/lib/site-url'
import { safeNext, mapAuthError, parseEmailOtpType } from '@/lib/safe-redirect'
import { postLoginPath } from '@/lib/first-login'

/**
 * Verify the one-time token from an email link and open the session.
 *
 * Unlike the PKCE code exchange in /auth/callback, verifyOtp with a token_hash
 * needs no code_verifier cookie, so the link works in any browser or device —
 * not only the one that submitted the form.
 */
export async function confirmEmailLink(formData: FormData): Promise<void> {
  const tokenHash = formData.get('token_hash')
  const type = parseEmailOtpType(formData.get('type') as string | null)
  const origin = new URL(await getSiteUrl()).origin
  const next = safeNext(formData.get('next') as string | null, origin)

  if (typeof tokenHash !== 'string' || !tokenHash || !type) {
    redirect('/login?error=invalid')
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })

  if (error) {
    console.error('verifyOtp failed', { code: error.code, status: error.status })
    redirect(`/login?error=${mapAuthError(error.code)}`)
  }

  // A sign-in link goes through the common login exit (favorite intent); a
  // password-recovery link goes straight to setting the password.
  redirect(type === 'email' ? await postLoginPath(supabase, next) : next)
}
