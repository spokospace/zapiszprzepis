'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function resetPassword(
  formData: FormData,
  code: string | undefined,
): Promise<void> {
  const password = String(formData.get('password') ?? '')
  const passwordConfirm = String(formData.get('passwordConfirm') ?? '')

  if (!code) {
    redirect(`/reset-password?error=invalid_code`)
  }

  if (!password || password.length < 6) {
    redirect(`/reset-password?code=${code}&error=weak_password`)
  }

  if (password !== passwordConfirm) {
    redirect(`/reset-password?code=${code}&error=password_mismatch`)
  }

  const supabase = await createSupabaseServerClient()

  // @supabase/ssr uses PKCE by default — the ?code= in the URL is a PKCE
  // authorization code, not an OTP token. exchangeCodeForSession is correct;
  // verifyOtp would always fail with this type of token.
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('exchangeCodeForSession failed', { code: exchangeError.code, status: exchangeError.status })
    redirect(`/reset-password?code=${code}&error=invalid_code`)
  }

  const { error: updateError } = await supabase.auth.updateUser({ password })

  if (updateError) {
    console.error('updateUser failed', { code: updateError.code, status: updateError.status })
    redirect(`/reset-password?code=${code}&error=unknown`)
  }

  // Sign out so the user must log in with their new password.
  // Without this, middleware would redirect /login → / (user already has session).
  await supabase.auth.signOut()
  redirect('/login?success=password_reset')
}
