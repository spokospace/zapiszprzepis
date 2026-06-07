import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { response, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  // /auth/callback always passes through — the route handler manages its own
  // auth state by exchanging the PKCE code.
  if (pathname.startsWith('/auth/callback')) {
    return response
  }

  // Web Share Target API: allow POST /share without auth
  // Browser invokes this when user selects "Share with ZapiszPrzepis" from system menu
  // User may not be logged in yet; S-01 will handle auth requirements
  if (pathname === '/share' && request.method === 'POST') {
    return response
  }

  // Auth pages are accessible to all users
  const isAuthPage = pathname === '/login' || pathname.startsWith('/login/')
    || pathname === '/signup' || pathname.startsWith('/signup/')
    || pathname === '/forgot-password' || pathname.startsWith('/forgot-password/')
    || pathname === '/reset-password' || pathname.startsWith('/reset-password/')

  if (isAuthPage) {
    return user
      ? NextResponse.redirect(new URL('/', request.url))
      : response
  }

  // All other paths require a session.
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  // Skip Next.js internals and any public file with a static-asset extension.
  // Files under public/ are served at the URL root (no /public/ prefix), so
  // the original `public` token never matched and /logo.svg, /og-image.png
  // etc. got redirected to /login on every request.
  matcher: [
    '/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|avif|woff2?|ttf|otf|eot|map)$).*)',
  ],
}
