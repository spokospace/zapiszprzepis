'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSiteUrl } from '@/lib/site-url'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function signInWithEmail(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const encodedEmail = encodeURIComponent(email)

  if (!EMAIL_RE.test(email)) {
    redirect(`/login?error=invalid_email&email=${encodedEmail}`)
  }

  const supabase = await createSupabaseServerClient()
  const siteUrl = await getSiteUrl()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  })

  if (error) {
    if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
      redirect(`/login?error=cooldown&email=${encodedEmail}`)
    }
    console.error('signInWithOtp failed', { code: error.code, status: error.status })
    redirect(`/login?error=unknown&email=${encodedEmail}`)
  }

  redirect(`/login?sent=1&email=${encodedEmail}`)
}

export async function signInWithPassword(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const encodedEmail = encodeURIComponent(email)

  if (!EMAIL_RE.test(email)) {
    redirect(`/login?error=invalid_email&email=${encodedEmail}`)
  }

  if (!password || password.length < 6) {
    redirect(`/login?error=weak_password&email=${encodedEmail}`)
  }

  const supabase = await createSupabaseServerClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    if (error.status === 401 || error.code === 'invalid_credentials') {
      redirect(`/login?error=invalid_credentials&email=${encodedEmail}`)
    }
    if (error.message.includes('Email not confirmed')) {
      redirect(`/login?error=email_not_confirmed&email=${encodedEmail}`)
    }
    console.error('signInWithPassword failed', { code: error.code, status: error.status })
    redirect(`/login?error=unknown&email=${encodedEmail}`)
  }

  redirect('/recipes')
}
