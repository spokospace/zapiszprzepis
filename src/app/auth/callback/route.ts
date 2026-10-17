import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { safeNext, mapAuthError, inboundAuthError, inboundOAuthError } from '@/lib/safe-redirect'
import { loginErrorPath } from '@/lib/login-redirect'
import { postLoginPath } from '@/lib/first-login'

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'), origin)

  // A failed Google/Facebook sign-in (E01-S12): cancelled, no email on the
  // provider account, email collision, provider switched off. Keep `next` so a
  // retry from /login still returns to where the user started.
  const oauth = inboundOAuthError(
    searchParams.get('error_code'),
    searchParams.get('error'),
    searchParams.get('error_description'),
  )
  if (oauth) {
    return NextResponse.redirect(new URL(loginErrorPath(oauth, next), origin))
  }

  // Supabase rejects the token on its side (expired, or already consumed — an
  // email security scanner prefetching the link is enough) and redirects here
  // with its own error params and no code. Must be checked before the
  // missing-code branch.
  const inbound = inboundAuthError(searchParams.get('error_code'), searchParams.get('error'))
  if (inbound) {
    return NextResponse.redirect(new URL(loginErrorPath(inbound, next), origin))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=invalid', origin))
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const mapped = mapAuthError(error.code)
    return NextResponse.redirect(new URL(loginErrorPath(mapped, next), origin))
  }

  // First login (no gender chosen yet) detours once through /witaj (E01-S12).
  return NextResponse.redirect(new URL(await postLoginPath(supabase, next), origin))
}
