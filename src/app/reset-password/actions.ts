'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function resetPassword(formData: FormData, code: string): Promise<void> {
  const password = String(formData.get('password') ?? '')
  const passwordConfirm = String(formData.get('passwordConfirm') ?? '')

  if (!password || password.length < 6) {
    redirect(`/reset-password?code=${code}&error=weak_password`)
  }

  if (password !== passwordConfirm) {
    redirect(`/reset-password?code=${code}&error=password_mismatch`)
  }

  const supabase = await createSupabaseServerClient()

  // Verify the OTP token from the reset link
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token: code,
    type: 'recovery',
  })

  if (verifyError) {
    console.error('verifyOtp failed', { code: verifyError.code, status: verifyError.status })
    redirect(`/reset-password?code=${code}&error=invalid_code`)
  }

  // Now update the user's password
  const { error: updateError } = await supabase.auth.updateUser({
    password,
  })

  if (updateError) {
    console.error('updateUser failed', { code: updateError.code, status: updateError.status })
    redirect(`/reset-password?code=${code}&error=unknown`)
  }

  redirect('/login')
}
