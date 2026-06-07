'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function resetPassword(
  formData: FormData,
  _token: string | undefined, // Token is not used - session is set by Supabase /auth/v1/verify
  email: string | undefined
): Promise<void> {
  const password = String(formData.get('password') ?? '')
  const passwordConfirm = String(formData.get('passwordConfirm') ?? '')
  const encodedEmail = email ? encodeURIComponent(email) : ''

  if (!password || password.length < 6) {
    redirect(`/reset-password?error=weak_password`)
  }

  if (password !== passwordConfirm) {
    redirect(`/reset-password?error=password_mismatch`)
  }

  const supabase = await createSupabaseServerClient()

  // User is already logged in by Supabase /auth/v1/verify endpoint.
  // Token in URL was already verified by Supabase before redirect.
  // Just update the password for the authenticated user.
  const { error: updateError } = await supabase.auth.updateUser({
    password,
  })

  if (updateError) {
    console.error('updateUser failed', { code: updateError.code, status: updateError.status })
    redirect(`/reset-password?error=unknown`)
  }

  redirect('/login?success=password_reset')
}
