/**
 * Edge cache for the public pages a guest sees, in front of the OpenNext handler.
 *
 * On the Workers Free plan (10 ms CPU per request) some requests that reach Next.js end in
 * error 1102: about 6% over 24 h, far more under a burst, with a median of 13-15 ms CPU
 * per invocation (#701). Two guest responses for one recipe were byte-identical, so a
 * render can be reused for other guests through the Workers Cache API. Not yet measured:
 * whether a hit in this Worker really stays under the limit, as it still loads the full bundle.
 *
 * Only requests that cannot carry a user are eligible: GET, no Supabase auth cookie, no
 * Authorization header, a public path. A signed-in request never reads or writes the
 * cache, so nothing personal can leak through it.
 *
 * Freshness: an entry is fresh for FRESH_SECONDS (the 120 s budget the guest-read cache
 * already uses, #445). Up to MAX_STALE_SECONDS it is still served at once and re-rendered
 * in the background (stale-while-revalidate); older than that, the next visitor waits
 * for a render. The Cache API is per data centre and cannot be purged from elsewhere, so
 * that bound is also how long a deleted or hidden recipe could stay visible to guests.
 */

export const FRESH_SECONDS = 120
export const MAX_STALE_SECONDS = 900
/** One background refresh per entry at a time (best effort: the Cache API has no lock). */
const LOCK_SECONDS = 20

/** The home page, a recipe and a category list. `.md` alternates are routes of their own. */
const PUBLIC_PATHS = [/^\/$/, /^\/przepis\/[^/]+$/, /^\/przepisy\/[^/]+$/]

/** Supabase's session cookie, also when chunked or while an OAuth sign-in is in progress. */
const AUTH_COOKIE = /(?:^|;\s*)sb-[^=;\s]*-auth-token/

const CACHED_AT = 'x-edge-cached-at'
const ORIGINAL_CACHE_CONTROL = 'x-edge-original-cache-control'
const STATE_HEADER = 'x-edge-cache'
const FALLBACK_CACHE_CONTROL = 'private, no-cache, no-store, max-age=0, must-revalidate'

export type EdgeCacheState = 'HIT' | 'STALE' | 'MISS'

export function isPublicPath(pathname: string): boolean {
  return !pathname.endsWith('.md') && PUBLIC_PATHS.some((re) => re.test(pathname))
}

/** No credentials of any kind on the request: it can only be served the guest page. */
export function isGuestRequest(request: Request): boolean {
  return !request.headers.has('authorization') && !AUTH_COOKIE.test(request.headers.get('cookie') ?? '')
}

/** What marks a client-side navigation or prefetch; its payload depends on these headers. */
const ROUTER_HEADERS = ['rsc', 'next-router-state-tree', 'next-url', 'next-router-prefetch', 'next-router-segment-prefetch']

/**
 * Full documents only. An RSC payload of a dynamic page depends on the router headers, so
 * it would need a key per source page. Next does check `_rsc` against those headers
 * (`validateRSCRequestHeaders`, on by default).
 */
export function isEdgeCacheable(request: Request): boolean {
  if (request.method !== 'GET' || request.headers.has('range')) return false
  if (ROUTER_HEADERS.some((name) => request.headers.has(name))) return false
  return isPublicPath(new URL(request.url).pathname) && isGuestRequest(request)
}

/**
 * One entry per URL and Worker version. The version matters because a deploy replaces the
 * hashed `/_next/static` files: a page cached by the previous version would point at files
 * that no longer exist (no CSS, ChunkLoadError, the incident `pnpm smoke:prod` was written for).
 */
export function edgeCacheKey(requestUrl: string, version: string): string {
  const url = new URL(requestUrl)
  url.searchParams.set('__v', version)
  return url.toString()
}

interface CacheLike {
  match(request: Request): Promise<Response | undefined>
  put(request: Request, response: Response): Promise<void>
  delete(request: Request): Promise<boolean>
}

interface WaitUntil {
  waitUntil(promise: Promise<unknown>): void
}

/** Only a complete, user-independent page is kept: no cookie to set, nothing but HTML. */
function isStorable(response: Response): boolean {
  if (response.status !== 200 || !response.body || response.headers.has('set-cookie')) return false
  return (response.headers.get('content-type') ?? '').includes('text/html')
}

async function store(cache: CacheLike, key: Request, response: Response, now: number): Promise<void> {
  const headers = new Headers(response.headers)
  headers.set(ORIGINAL_CACHE_CONTROL, headers.get('cache-control') ?? FALLBACK_CACHE_CONTROL)
  headers.set(CACHED_AT, String(now))
  headers.set('cache-control', `public, max-age=${MAX_STALE_SECONDS}`)
  // The Cache API ignores Vary; the key already carries the variant.
  headers.delete('vary')
  headers.delete('content-length')
  await cache.put(key, new Response(response.body, { status: 200, headers }))
}

function present(response: Response, state: EdgeCacheState): Response {
  const headers = new Headers(response.headers)
  headers.set('cache-control', headers.get(ORIGINAL_CACHE_CONTROL) || FALLBACK_CACHE_CONTROL)
  headers.delete(ORIGINAL_CACHE_CONTROL)
  headers.delete(CACHED_AT)
  headers.set(STATE_HEADER, state)
  return new Response(response.body, { status: response.status, headers })
}

/** Re-render in the background; a recipe that is gone (404, redirect) is dropped, a failure keeps the old page. */
async function refresh(
  request: Request,
  key: Request,
  handle: (request: Request) => Promise<Response>,
  cache: CacheLike,
  now: number,
): Promise<void> {
  const lock = new Request(`${key.url}&__lock=1`)
  if (await cache.match(lock)) return
  await cache.put(lock, new Response('1', { headers: { 'cache-control': `public, max-age=${LOCK_SECONDS}` } }))
  const response = await handle(request)
  if (isStorable(response)) await store(cache, key, response, now)
  else if (response.status < 500) await cache.delete(key)
}

/**
 * Serve a public guest page from the edge cache, else through `handle`, keeping a
 * successful render. Anything not eligible, any cache failure, and a Worker with no
 * version id (the `CF_VERSION_METADATA` binding is missing) go straight to `handle`:
 * without the version a cached page could outlive the files it points at.
 */
export async function serveGuestPage(
  request: Request,
  handle: (request: Request) => Promise<Response>,
  cache: CacheLike,
  ctx: WaitUntil,
  version: string | undefined,
  now: number = Date.now(),
): Promise<Response> {
  if (!version || !isEdgeCacheable(request)) return handle(request)

  const key = new Request(edgeCacheKey(request.url, version))
  let cached: Response | undefined
  try {
    cached = await cache.match(key)
  } catch (error) {
    console.error('[edge-cache] lookup failed', error)
  }

  if (cached) {
    const age = (now - Number(cached.headers.get(CACHED_AT))) / 1000
    if (age >= 0 && age <= MAX_STALE_SECONDS) {
      const stale = age > FRESH_SECONDS
      if (stale) {
        ctx.waitUntil(
          refresh(request, key, handle, cache, now).catch((error) => console.error('[edge-cache] refresh failed', error)),
        )
      }
      return present(cached, stale ? 'STALE' : 'HIT')
    }
  }

  const response = await handle(request)
  if (isStorable(response)) {
    ctx.waitUntil(store(cache, key, response.clone(), now).catch((error) => console.error('[edge-cache] store failed', error)))
  }
  const headers = new Headers(response.headers)
  headers.set(STATE_HEADER, 'MISS')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}
