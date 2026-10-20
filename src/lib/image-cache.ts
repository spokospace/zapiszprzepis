/**
 * Edge cache and fallback around OpenNext's `/_next/image` handler (#357).
 *
 * The handler resizes through the Worker's IMAGES binding but caches nothing:
 * Supabase Storage serves the archived photos with `Cache-Control: no-cache`, so
 * the optimized response carried no cache header, every list view re-downloaded
 * every photo, and every request re-fetched and re-transformed its source. Here a
 * resized image is kept in the Workers Cache API and in the browser for a day,
 * one entry per URL and output format.
 *
 * When a transform fails (e.g. the Images quota is used up), the visitor is sent
 * to the original photo instead of a broken image — only for the Supabase Storage
 * host, so the fallback can never be used as an open redirect.
 */

/** A day: re-archiving a recipe overwrites its photo at the same URL. */
export const IMAGE_CACHE_CONTROL = 'public, max-age=86400'

type Format = 'avif' | 'webp' | 'orig'

/** The output format OpenNext picks from Accept; the Cache API ignores `Vary`. */
export function acceptedFormat(accept: string | null): Format {
  if (accept?.includes('image/avif')) return 'avif'
  if (accept?.includes('image/webp')) return 'webp'
  return 'orig'
}

/** One cache entry per image URL and output format. */
export function imageCacheKey(requestUrl: string, accept: string | null): string {
  const url = new URL(requestUrl)
  url.searchParams.set('__fmt', acceptedFormat(accept))
  return url.toString()
}

/** The original photo behind `/_next/image?url=…`, only when it is on our Supabase Storage. */
export function imageFallbackUrl(requestUrl: string, supabaseUrl: string | undefined): string | null {
  if (!supabaseUrl) return null
  const raw = new URL(requestUrl).searchParams.get('url')
  if (!raw) return null
  try {
    const target = new URL(raw)
    const storage = new URL(supabaseUrl)
    return target.protocol === 'https:' && target.host === storage.host && target.pathname.startsWith('/storage/v1/object/public/')
      ? target.toString()
      : null
  } catch {
    return null
  }
}

interface CacheLike {
  match(request: Request): Promise<Response | undefined>
  put(request: Request, response: Response): Promise<void>
}

interface WaitUntil {
  waitUntil(promise: Promise<unknown>): void
}

/** Serve `/_next/image` from the edge cache, else via `handle`, caching a success. */
export async function serveImage(
  request: Request,
  handle: (request: Request) => Promise<Response>,
  cache: CacheLike,
  ctx: WaitUntil,
  supabaseUrl: string | undefined,
): Promise<Response> {
  const key = new Request(imageCacheKey(request.url, request.headers.get('Accept')))
  const cached = await cache.match(key)
  if (cached) return cached

  let response: Response | null = null
  try {
    response = await handle(request)
  } catch (error) {
    console.error('[image] optimization failed', error)
  }

  if (!response || response.status >= 500) {
    const fallback = imageFallbackUrl(request.url, supabaseUrl)
    if (fallback) return Response.redirect(fallback, 302)
    return response ?? new Response('Image unavailable', { status: 502 })
  }
  if (!response.ok) return response

  const cacheable = new Response(response.body, response)
  cacheable.headers.set('Cache-Control', IMAGE_CACHE_CONTROL)
  ctx.waitUntil(cache.put(key, cacheable.clone()))
  return cacheable
}
