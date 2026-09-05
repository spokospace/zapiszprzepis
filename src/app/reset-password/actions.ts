'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function resetPassword(formData: FormData): Promise<void> {
  const password = String(formData.get('password') ?? '')
  const passwordConfirm = String(formData.get('passwordConfirm') ?? '')

  if (!password || password.length < 6) {
    redirect(`/reset-password?error=weak_password`)
  }

  if (password !== passwordConfirm) {
    redirect(`/reset-password?error=password_mismatch`)
  }

  const supabase = await createSupabaseServerClient()

  // Session was already established by /auth/callback (PKCE exchange happened there).
  // We only need to update the password on the active recovery session.
  const { error: updateError } = await supabase.auth.updateUser({ password })

  if (updateError) {
    console.error('updateUser failed', { code: updateError.code, status: updateError.status })
    redirect(`/reset-password?error=unknown`)
  }

  // Sign out so the user must log in with their new password.
  // Without this, the proxy would redirect /login → / (user already has session).
  // scope:'global' is deliberate here and the opposite of the sign-out action:
  // a password change should invalidate every other device's session too.
  await supabase.auth.signOut({ scope: 'global' })
  redirect('/login?success=password_reset')
}
