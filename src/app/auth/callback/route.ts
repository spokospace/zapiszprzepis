import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const SAFE_NEXT = /^\/(?!\/)/

function mapAuthError(code: string | undefined): string {
  if (!code) return 'unknown'
  if (code.includes('expired')) return 'expired'
  if (code.includes('used')) return 'used'
  if (code === 'flow_state_not_found') return 'expired'
  return 'unknown'
}

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next')
  const next = rawNext && SAFE_NEXT.test(rawNext) ? rawNext : '/'

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
