/**
 * Plain-HTTP requests to the public site get a permanent redirect to HTTPS (#645).
 *
 * Without it `http://zapiszprzepis.pl/` answered 200 with the full page, so Google
 * indexed the http:// copy as "Duplicate without user-selected canonical". The
 * Worker sees the scheme the visitor used, so custom-worker.ts calls this before
 * handing the request to Next.js and the redirect covers every path, `/_next/*` and
 * `robots.txt` included.
 *
 * Only the host named by `siteUrl` (NEXT_PUBLIC_SITE_URL) is redirected, and only when
 * that URL is https: `wrangler dev` on http://localhost and any other host pass through.
 * GET/HEAD get a 301; any other method a 308, so a POST is not silently turned into a GET.
 */
export function httpsRedirect(request: Request, siteUrl: string | undefined): Response | null {
  if (!siteUrl) return null
  let site: URL
  try {
    site = new URL(siteUrl)
  } catch {
    return null
  }
  if (site.protocol !== 'https:') return null

  const url = new URL(request.url)
  if (url.protocol !== 'http:' || url.hostname !== site.hostname) return null

  url.protocol = 'https:'
  url.port = ''
  const status = request.method === 'GET' || request.method === 'HEAD' ? 301 : 308
  return Response.redirect(url.toString(), status)
}
