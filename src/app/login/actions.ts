'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSiteUrl } from '@/lib/site-url'
import { resolveLoginNext } from '@/lib/login-redirect'
import { enabledProvider, parseOAuthProviders } from '@/lib/oauth-providers'
import { postLoginPath } from '@/lib/first-login'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Supabase returns one of these from signInWithOtp with shouldCreateUser:false
// when the email has no account yet. Exact-equality Set match (not
// String.includes) so a new/unrelated code falls through to the generic
// branch instead of being silently miscategorized — see context/foundation/lessons.md.
const NO_ACCOUNT_CODES = new Set(['otp_disabled', 'user_not_found', 'signup_disabled'])

/**
 * Where to go after logging in, from the form's hidden `next` field (E01-S06).
 * `keep` is what error redirects carry back to /login so a failed attempt does
 * not lose the destination; it is null when the user did not ask for one.
 */
async function readNext(formData: FormData, fallback: string) {
  const raw = formData.get('next')
  const siteUrl = await getSiteUrl()
  const next = resolveLoginNext(raw, new URL(siteUrl).origin, fallback)
  return { siteUrl, next, keep: typeof raw === 'string' && raw.trim() !== '' ? next : null }
}

function backToLogin(params: Record<string, string>, keep: string | null): string {
  const query = new URLSearchParams(params)
  if (keep) query.set('next', keep)
  return `/login?${query.toString()}`
}

export async function signInWithEmail(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const { siteUrl, next, keep } = await readNext(formData, '/')

  if (!EMAIL_RE.test(email)) {
    redirect(backToLogin({ error: 'invalid_email', email }, keep))
  }

  const supabase = await createSupabaseServerClient()

  // shouldCreateUser:false closes the registration backdoor — the login
  // magic-link no longer provisions brand-new accounts. Existing users still
  // get their link; new accounts must go through /signup with an invite code.
  // `next` rides inside the email link; /auth/confirm re-validates it.
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${siteUrl}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  })

  if (error) {
    if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
      redirect(backToLogin({ error: 'cooldown', email }, keep))
    }
    if (NO_ACCOUNT_CODES.has(error.code ?? '')) {
      redirect(backToLogin({ error: 'no_account', email }, keep))
    }
    console.error('signInWithOtp failed', { code: error.code, status: error.status })
    redirect(backToLogin({ error: 'unknown', email }, keep))
  }

  redirect(backToLogin({ sent: '1', email }, keep))
}

/**
 * Start a Google/Facebook sign-in (E01-S12). The first OAuth login creates the
 * account. The provider must be listed in AUTH_OAUTH_PROVIDERS — the page only
 * renders enabled buttons, and this re-check stops a hand-crafted POST from
 * opening a provider the owner has not switched on. The SSR client keeps the
 * PKCE verifier in a cookie; /auth/callback exchanges the code and re-validates
 * `next`.
 */
export async function signInWithOAuthProvider(formData: FormData): Promise<void> {
  const { siteUrl, next, keep } = await readNext(formData, '/')
  const provider = enabledProvider(formData.get('provider'), parseOAuthProviders(process.env.AUTH_OAUTH_PROVIDERS))

  if (!provider) {
    redirect(backToLogin({ error: 'oauth_unavailable' }, keep))
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}` },
  })

  if (error || !data.url) {
    console.error('signInWithOAuth failed', { provider, code: error?.code, status: error?.status })
    redirect(backToLogin({ error: 'oauth_failed' }, keep))
  }

  redirect(data.url)
}

export async function signInWithPassword(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const { next, keep } = await readNext(formData, '/recipes')

  if (!EMAIL_RE.test(email)) {
    redirect(backToLogin({ error: 'invalid_email', email }, keep))
  }

  if (!password || password.length < 6) {
    redirect(backToLogin({ error: 'weak_password', email }, keep))
  }

  const supabase = await createSupabaseServerClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    if (error.status === 401 || error.code === 'invalid_credentials') {
      redirect(backToLogin({ error: 'invalid_credentials', email }, keep))
    }
    if (error.message.includes('Email not confirmed')) {
      redirect(backToLogin({ error: 'email_not_confirmed', email }, keep))
    }
    console.error('signInWithPassword failed', { code: error.code, status: error.status })
    redirect(backToLogin({ error: 'unknown', email }, keep))
  }

  // First login without a gender detours once through /witaj (E01-S12).
  redirect(await postLoginPath(supabase, next))
}
