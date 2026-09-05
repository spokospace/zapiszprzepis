import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { safeNext, mapAuthError, inboundAuthError } from '@/lib/safe-redirect'

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'), origin)

  // Supabase rejects the token on its side (expired, or already consumed — an
  // email security scanner prefetching the link is enough) and redirects here
  // with its own error params and no code. Must be checked first.
  const inbound = inboundAuthError(searchParams.get('error_code'), searchParams.get('error'))
  if (inbound) {
    return NextResponse.redirect(new URL(`/login?error=${inbound}`, origin))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=invalid', origin))
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const mapped = mapAuthError(error.code)
    return NextResponse.redirect(new URL(`/login?error=${mapped}`, origin))
  }

  return NextResponse.redirect(new URL(next, origin))
}
