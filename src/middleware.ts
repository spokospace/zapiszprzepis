import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Dev-only smoke page; remove once real share-target flow lands.
  // Bypass before updateSession() to skip the Supabase auth roundtrip.
  if (pathname.startsWith('/test-trigger')) {
    return NextResponse.next({ request })
  }

  const { response, user } = await updateSession(request)

  // /auth/callback always passes through — the route handler manages its own
  // auth state by exchanging the PKCE code.
  if (pathname.startsWith('/auth/callback')) {
    return response
  }

  // Signed-in users skip the login screen.
  if (pathname === '/login' || pathname.startsWith('/login/')) {
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
