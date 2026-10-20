/**
 * A `text/markdown` HTTP response for the AI-citability endpoints (#363), with
 * the shared hour-long edge cache. When `canonical` is given (the `.md` page
 * alternates) it also sends `X-Robots-Tag: noindex, follow` so the HTML page
 * stays the indexed canonical, and a `Link: …; rel="canonical"` back to it.
 * llms.txt passes no canonical — it is itself discoverable.
 */
export function markdownResponse(body: string, opts: { canonical?: string } = {}): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate',
  }
  if (opts.canonical) {
    headers['X-Robots-Tag'] = 'noindex, follow'
    headers['Link'] = `<${opts.canonical}>; rel="canonical"`
  }
  return new Response(body, { headers })
}
