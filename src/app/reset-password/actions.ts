'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function resetPassword(
  formData: FormData,
  code: string | undefined,
  email: string | undefined
): Promise<void> {
  const password = String(formData.get('password') ?? '')
  const passwordConfirm = String(formData.get('passwordConfirm') ?? '')
  const encodedEmail = email ? encodeURIComponent(email) : ''

  if (!code || !email) {
    redirect(`/reset-password?error=invalid_code`)
  }

  if (!password || password.length < 6) {
    redirect(`/reset-password?code=${code}&email=${encodedEmail}&error=weak_password`)
  }

  if (password !== passwordConfirm) {
    redirect(`/reset-password?code=${code}&email=${encodedEmail}&error=password_mismatch`)
  }

  const supabase = await createSupabaseServerClient()

  // Step 1: Verify the recovery OTP token from the reset email link
  const { error: verifyError } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: 'recovery',
  })

  if (verifyError) {
    console.error('verifyOtp failed', { code: verifyError.code, status: verifyError.status })
    redirect(`/reset-password?code=${code}&email=${encodedEmail}&error=invalid_code`)
  }

  // Step 2: Update the user's password
  const { error: updateError } = await supabase.auth.updateUser({
    password,
  })

  if (updateError) {
    console.error('updateUser failed', { code: updateError.code, status: updateError.status })
    redirect(`/reset-password?code=${code}&email=${encodedEmail}&error=unknown`)
  }

  redirect('/login?success=password_reset')
}
