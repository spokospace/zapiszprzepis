'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function resetPassword(
  formData: FormData,
  accessToken: string | undefined,
  email: string | undefined
): Promise<void> {
  const password = String(formData.get('password') ?? '')
  const passwordConfirm = String(formData.get('passwordConfirm') ?? '')
  const encodedEmail = email ? encodeURIComponent(email) : ''

  if (!accessToken || !email) {
    redirect(`/reset-password?error=invalid_code`)
  }

  if (!password || password.length < 6) {
    redirect(`/reset-password?email=${encodedEmail}&error=weak_password`)
  }

  if (password !== passwordConfirm) {
    redirect(`/reset-password?email=${encodedEmail}&error=password_mismatch`)
  }

  const supabase = await createSupabaseServerClient()

  // Set the session with the access token from the reset link
  const { error: setSessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: '', // Not needed for password reset
  })

  if (setSessionError) {
    console.error('setSession failed', { code: setSessionError.code, status: setSessionError.status })
    redirect(`/reset-password?email=${encodedEmail}&error=invalid_code`)
  }

  // Update the user's password
  const { error: updateError } = await supabase.auth.updateUser({
    password,
  })

  if (updateError) {
    console.error('updateUser failed', { code: updateError.code, status: updateError.status })
    redirect(`/reset-password?email=${encodedEmail}&error=unknown`)
  }

  redirect('/login')
}
