'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function signUp(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const passwordConfirm = String(formData.get('passwordConfirm') ?? '')
  const encodedEmail = encodeURIComponent(email)

  if (!EMAIL_RE.test(email)) {
    redirect(`/signup?error=invalid_email&email=${encodedEmail}`)
  }

  if (!password || password.length < 6) {
    redirect(`/signup?error=weak_password&email=${encodedEmail}`)
  }

  if (password !== passwordConfirm) {
    redirect(`/signup?error=password_mismatch&email=${encodedEmail}`)
  }

  const supabase = await createSupabaseServerClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) {
    if (error.code === 'user_already_exists' || error.message.includes('already exists')) {
      redirect(`/signup?error=user_already_exists&email=${encodedEmail}`)
    }
    console.error('signUp failed', { code: error.code, status: error.status })
    redirect(`/signup?error=unknown&email=${encodedEmail}`)
  }

  // After successful signup, redirect to login with info to check email or login directly
  redirect(`/login?email=${encodedEmail}`)
}
