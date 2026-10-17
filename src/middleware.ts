// Deliberately the deprecated `middleware` convention, not Next 16's `proxy`.
// Next compiles `proxy.ts` to the Node.js runtime only (the compiler rejects
// an edge opt-in), and @opennextjs/cloudflare then bundles that Node
// middleware into the Worker: ~356 KB of edge middleware becomes ~4.6 MB,
// past the free-tier 3 MiB script limit. Every Workers Build after the rename
// in #119 failed at upload while production stayed on #118. Stay on
// `middleware.ts` until the adapter ships a lean Node-middleware path:
//   https://github.com/opennextjs/opennextjs-cloudflare/issues/1373
//   https://github.com/opennextjs/opennextjs-cloudflare/issues/1213
import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import { isPublicRoute, RECIPE_PAGE_RE, legacyRecipePathToCanonical } from '@/lib/routes'
import { loginPath, resolveLoginNext } from '@/lib/login-redirect'

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { response, user } = await updateSession(request)
  const { pathname, search, searchParams, origin } = request.nextUrl

  // /auth/callback and /auth/confirm always pass through — they open the
  // session themselves from the email link, whatever state the visitor is in.
  if (pathname.startsWith('/auth/')) {
    return response
  }

  // Web Share Target API: allow POST /share without auth
  // Browser invokes this when user selects "Share with ZapiszPrzepis" from system menu
  // User may not be logged in yet; S-01 will handle auth requirements
  if (pathname === '/share' && request.method === 'POST') {
    return response
  }

  // Inngest webhook: external service hits this endpoint to sync functions
  // and trigger runs. Auth is verified by Inngest's own signature
  // (INNGEST_SIGNING_KEY), not Supabase session.
  if (pathname === '/api/inngest') {
    return response
  }

  // Auth pages are accessible to all users
  // /reset-password is intentionally excluded: after /auth/confirm verifies the
  // email link the user is authenticated, so it must be reachable while logged in.
  const isAuthPage = pathname === '/login' || pathname.startsWith('/login/')
    || pathname === '/signup' || pathname.startsWith('/signup/')
    || pathname === '/forgot-password' || pathname.startsWith('/forgot-password/')

  if (isAuthPage) {
    // Already signed in: honour where the login link was meant to lead (E01-S06),
    // validated the same way as after logging in.
    return user
      ? NextResponse.redirect(new URL(resolveLoginNext(searchParams.get('next'), origin, '/'), request.url))
      : response
  }

  // E01-S03b: the canonical recipe URL is /przepis/{slug}. The legacy public
  // /recipes/{slug} permanently redirects to it — pure path math (swap the
  // prefix, keep the slug segment verbatim so it is not re-encoded), with the
  // query string preserved. "/recipes" (Moje przepisy) and deeper paths don't
  // match RECIPE_PAGE_RE (single segment), so they are untouched.
  if (RECIPE_PAGE_RE.test(pathname)) {
    return NextResponse.redirect(new URL(legacyRecipePathToCanonical(pathname) + search, request.url), { status: 301 })
  }

  // E01-S02 public routes: a guest may read the home and a single recipe. Data
  // visibility is decided by the database (owner-only RLS on recipes, guest reads via
  // the public_recipes view), not by this allowlist.
  // "/recipes" itself is "Moje przepisy" — owner-only — so it stays gated below.
  if (isPublicRoute(pathname)) {
    return response
  }

  // All other paths require a session; come back here after logging in (E01-S06).
  if (!user) {
    return NextResponse.redirect(new URL(loginPath(pathname + search), request.url))
  }

  return response
}

export const config = {
  // Skip Next.js internals and any public file with a static-asset extension.
  // Files under public/ are served at the URL root (no /public/ prefix), so
  // the original `public` token never matched and /logo.svg, /og-image.png
  // etc. got redirected to /login on every request.
  matcher: [
    '/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|avif|woff2?|ttf|otf|eot|map|js)$|sw\\.js).*)',
  ],
}
