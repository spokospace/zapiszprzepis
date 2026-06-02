import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { mapAuthError } from '@/lib/auth-errors'
import { isSafeNext } from '@/lib/auth-validation'

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next')
  const next = rawNext && isSafeNext(rawNext) ? rawNext : '/'

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
