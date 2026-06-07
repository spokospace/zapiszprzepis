'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSiteUrl } from '@/lib/site-url'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function forgotPassword(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const encodedEmail = encodeURIComponent(email)

  if (!EMAIL_RE.test(email)) {
    redirect(`/forgot-password?error=invalid_email&email=${encodedEmail}`)
  }

  const supabase = await createSupabaseServerClient()
  const siteUrl = await getSiteUrl()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/reset-password`,
  })

  if (error) {
    console.error('resetPasswordForEmail failed', { code: error.code, status: error.status })
    redirect(`/forgot-password?error=unknown&email=${encodedEmail}`)
  }

  redirect(`/forgot-password?sent=1&email=${encodedEmail}`)
}
