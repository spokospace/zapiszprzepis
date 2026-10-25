// E02-S10 (audit D3): response security headers for every HTML response.
//
// Applied in src/middleware.ts to every NextResponse it returns (pages,
// redirects, rewrites). The matcher there excludes _next/static, images and
// sw.js, so static assets do not carry these headers — the acceptance criteria
// target HTML responses, where clickjacking and XSS containment matter.
//
// CSP is deliberately permissive for this first version (the issue's
// out-of-scope note): 'unsafe-inline' for Next's inline bootstrap, and
// `img-src … https:` because recipe gallery/step photos are hotlinked straight
// from arbitrary source blogs when they were never archived (see
// src/lib/image-remote-patterns.ts, `unoptimized`). A stricter, nonce-based CSP
// is a later tightening.

// The Supabase host only exists in the Worker's runtime vars, so a build/test
// without NEXT_PUBLIC_SUPABASE_URL falls back to the production project — the
// same fallback src/lib/image-remote-patterns.ts uses. (A shared supabase-URL
// helper across both modules is worth extracting in its own PR.)
const PRODUCTION_SUPABASE_ORIGIN = 'https://wvrlgddgdddwmgzbvtij.supabase.co'

type SecurityHeadersOptions = {
  supabaseUrl?: string
  isDev?: boolean
}

function supabaseOrigin(supabaseUrl: string | undefined): string {
  try {
    return new URL(supabaseUrl || PRODUCTION_SUPABASE_ORIGIN).origin
  } catch {
    return PRODUCTION_SUPABASE_ORIGIN
  }
}

/** Build the Content-Security-Policy string. */
export function buildContentSecurityPolicy({
  supabaseUrl,
  isDev = false,
}: SecurityHeadersOptions = {}): string {
  const origin = supabaseOrigin(supabaseUrl)
  const wsOrigin = origin.replace(/^https:/, 'wss:')

  // Turbopack HMR evaluates code at dev time; production needs no 'unsafe-eval'.
  const scriptSrc = ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])]

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'style-src': ["'self'", "'unsafe-inline'"],
    'script-src': scriptSrc,
    'connect-src': ["'self'", origin, wsOrigin],
    'frame-src': ['https://www.youtube-nocookie.com'],
  }

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ')
}

/**
 * The security headers every HTML response carries, as name→value entries.
 * HSTS is sent unconditionally; browsers ignore it on http/localhost. The
 * Cloudflare zone may also set it — see the PR note to avoid a duplicate.
 */
export function securityHeaders({
  supabaseUrl,
  isDev = false,
}: SecurityHeadersOptions = {}): [string, string][] {
  return [
    ['Content-Security-Policy', buildContentSecurityPolicy({ supabaseUrl, isDev })],
    ['X-Frame-Options', 'DENY'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['X-Content-Type-Options', 'nosniff'],
    ['Strict-Transport-Security', 'max-age=63072000; includeSubDomains'],
  ]
}
