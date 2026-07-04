'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSiteUrl } from '@/lib/site-url'
import { getInviteCode } from '@/lib/env'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Passwordless registration gated by an invite code. A valid code sends a
 * magic link that is allowed to create the user (`shouldCreateUser: true`);
 * clicking it provisions the account. The invite code is the only thing that
 * lets a brand-new email create an account — the /login magic-link path uses
 * `shouldCreateUser: false` so it can't be used to bypass this gate.
 */
export async function signUp(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const inviteCode = String(formData.get('inviteCode') ?? '').trim()
  const encodedEmail = encodeURIComponent(email)

  if (!EMAIL_RE.test(email)) {
    redirect(`/signup?error=invalid_email&email=${encodedEmail}`)
  }

  if (inviteCode !== getInviteCode()) {
    redirect(`/signup?error=invalid_code&email=${encodedEmail}`)
  }

  const supabase = await createSupabaseServerClient()
  const siteUrl = await getSiteUrl()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  })

  if (error) {
    if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
      redirect(`/signup?error=cooldown&email=${encodedEmail}`)
    }
    console.error('signUp signInWithOtp failed', { code: error.code, status: error.status })
    redirect(`/signup?error=unknown&email=${encodedEmail}`)
  }

  redirect(`/signup?sent=1&email=${encodedEmail}`)
}
