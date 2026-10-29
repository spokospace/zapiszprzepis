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
import { isPublicRoute, RECIPE_PAGE_RE, legacyRecipePathToCanonical, mdRewriteTarget } from '@/lib/routes'
import { loginPath, resolveLoginNext } from '@/lib/login-redirect'
import { securityHeaders } from '@/lib/security-headers'

// E02-S10 (audit D3): every response this middleware returns — page, redirect
// or rewrite — carries the security headers (frame-ancestors/CSP against
// clickjacking and XSS). Applied at the single exit point so no branch is
// missed. The matcher below excludes _next/static, images and sw.js, so static
// assets are not covered; the acceptance criteria target HTML responses.
// Both inputs are constant for the life of the Worker isolate, so the header
// list is built once on the first request and reused. Lazily, not at module
// load: on Workers process.env is populated per request, and an import-time
// read could capture an undefined Supabase URL and bake in the wrong CSP.
let cachedSecurityHeaders: [string, string][] | undefined

/** Set by the removed first-login gender check (E01-S12); only ever expired now (#376). */
const LEGACY_GENDER_COOKIE = 'zp-gender'

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const response = await handle(request)
  cachedSecurityHeaders ??= securityHeaders({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    isDev: process.env.NODE_ENV !== 'production',
  })
  for (const [name, value] of cachedSecurityHeaders) {
    response.headers.set(name, value)
  }
  return response
}

async function handle(request: NextRequest): Promise<NextResponse> {
  const { response, user, authTransient } = await updateSession(request)
  const { pathname, search, searchParams, origin } = request.nextUrl

  // /auth/callback and /auth/confirm always pass through — they open the
  // session themselves from the email link, whatever state the visitor is in.
  if (pathname.startsWith('/auth/')) {
    return response
  }

  // Web Share Target API: allow POST /share without auth
  // Browser invokes this when user selects "Share with Zapisz Przepis" from system menu
  // User may not be logged in yet; S-01 will handle auth requirements
  if (pathname === '/share' && request.method === 'POST') {
    return response
  }

  // Inngest webhook: external service hits this endpoint to sync functions
  // and trigger runs. Auth is verified by Inngest's own signature
  // (INNGEST_SIGNING_KEY, or INNGEST_SIGNING_KEY_2 on /api/inngest-2), not
  // Supabase session.
  if (pathname === '/api/inngest' || pathname === '/api/inngest-2') {
    return response
  }

  // Staff MCP endpoint: authenticated by a personal bearer token (staff_tokens), not
  // a Supabase session, so a client with no cookies must reach it. The route resolves
  // the token to an account and its roles on every request.
  if (pathname === '/api/mcp') {
    return response
  }

  // Dev-only QA sign-in: it opens the session itself, so a guest must reach it.
  // The route answers 404 outside an opted-in dev server.
  if (pathname === '/api/dev/login') {
    return response
  }

  // Auth pages are accessible to all users
  // /reset-password is intentionally excluded: after /auth/confirm verifies the
  // email link the user is authenticated, so it must be reachable while logged in.
  const isAuthPage = pathname === '/login' || pathname.startsWith('/login/')
    || pathname === '/rejestracja' || pathname.startsWith('/rejestracja/')
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

  // AI-citability (#363): /przepis/{slug}.md and /przepisy/{kategoria}.md rewrite
  // internally to their route handlers. Returned here, before the auth gate, so an
  // anonymous crawler reaches the Markdown instead of being bounced to /login; a
  // legacy /recipes/{slug}.md has already 301'd to /przepis/… just above.
  const mdTarget = mdRewriteTarget(pathname)
  if (mdTarget) {
    const rewrite = NextResponse.rewrite(new URL(mdTarget + search, request.url))
    response.cookies.getAll().forEach((cookie) => rewrite.cookies.set(cookie))
    return rewrite
  }

  // #376: gender is optional, so nobody is detoured to /witaj any more. Expire the
  // cookie that used to remember the check (it held the user id) wherever it lingers.
  if (request.cookies.has(LEGACY_GENDER_COOKIE)) {
    response.cookies.set(LEGACY_GENDER_COOKIE, '', { path: '/', maxAge: 0 })
  }

  // E01-S02 public routes: a guest may read the home and a single recipe. Data
  // visibility is decided by the database (owner-only RLS on recipes, guest reads via
  // the public_recipes view), not by this allowlist.
  // "/recipes" itself is "Moje przepisy" — owner-only — so it stays gated below.
  if (isPublicRoute(pathname)) {
    return response
  }

  // A session check that could not decide (Supabase unreachable, 5xx, 429) is not a
  // guest: let the request through and leave it to the screen's own check
  // (getSignedInUser / requireUser), which shows a retry instead of logging out.
  // A screen behind login must use one of those, not getCurrentUser(), which would
  // render it as for a guest.
  if (!user && authTransient) {
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
    // robots.txt / sitemap.xml / llms.txt and the /.well-known/ ARD catalog
    // (#546) are crawler endpoints served by their own routes; exclude them so
    // an anonymous crawler isn't bounced to /login.
    // (The `.md` alternates are NOT excluded — they rely on middleware's rewrite.)
    '/((?!_next/static|_next/image|robots\\.txt|sitemap\\.xml|llms\\.txt|\\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|avif|woff2?|ttf|otf|eot|map|js)$|sw\\.js).*)',
  ],
}
