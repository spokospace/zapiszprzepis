import { describe, it, expect, vi } from 'vitest'
import {
  FRESH_SECONDS,
  MAX_STALE_SECONDS,
  edgeCacheKey,
  isEdgeCacheable,
  isGuestRequest,
  isPublicPath,
  serveGuestPage,
} from './html-cache'

const RECIPE = 'https://zapiszprzepis.pl/przepis/sernik'
const PAGE = '<html>guest page</html>'
const T0 = 1_000_000_000_000
const VERSION = 'v-1'

class MemoryCache {
  store = new Map<string, Response>()
  async match(req: Request) {
    return this.store.get(req.url)?.clone()
  }
  async put(req: Request, res: Response) {
    this.store.set(req.url, res)
  }
  async delete(req: Request) {
    return this.store.delete(req.url)
  }
}

const html = (body = PAGE, init: ResponseInit = {}) =>
  new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store', ...init.headers }, ...init })

function setup(handle: (req: Request) => Promise<Response> = async () => html()) {
  const cache = new MemoryCache()
  const waits: Promise<unknown>[] = []
  const ctx = { waitUntil: (p: Promise<unknown>) => void waits.push(p) }
  const handler = vi.fn(handle)
  // null stands for "no version id": an `undefined` argument would take the default.
  const serve = async (req: Request, now = T0, version: string | null = VERSION) => {
    const res = await serveGuestPage(req, handler, cache, ctx, version ?? undefined, now)
    await Promise.all(waits.splice(0))
    return res
  }
  return { cache, ctx, handler, serve, waits }
}

const get = (url = RECIPE, headers: Record<string, string> = {}) => new Request(url, { headers })

describe('what may be cached (guests only)', () => {
  it('public paths: home, a recipe, a category; not .md, search, admin or the account', () => {
    for (const p of ['/', '/przepis/sernik', '/przepisy/obiady']) expect(isPublicPath(p), p).toBe(true)
    for (const p of ['/przepis/sernik.md', '/przepisy/obiady.md', '/szukaj', '/admin', '/ulubione', '/przepis/a/b', '/lab/przepis/x'])
      expect(isPublicPath(p), p).toBe(false)
  })

  it('a request with a Supabase auth cookie (also chunked or mid-OAuth) or Authorization is not a guest', () => {
    expect(isGuestRequest(get(RECIPE))).toBe(true)
    expect(isGuestRequest(get(RECIPE, { cookie: 'zp-text-scale=2; theme=dark' }))).toBe(true)
    expect(isGuestRequest(get(RECIPE, { cookie: 'a=1; sb-abc-auth-token=xyz' }))).toBe(false)
    expect(isGuestRequest(get(RECIPE, { cookie: 'sb-abc-auth-token.0=x; sb-abc-auth-token.1=y' }))).toBe(false)
    expect(isGuestRequest(get(RECIPE, { cookie: 'sb-abc-auth-token-code-verifier=v' }))).toBe(false)
    expect(isGuestRequest(get(RECIPE, { authorization: 'Bearer t' }))).toBe(false)
  })

  it('only a full-document GET without Range; never a client-side (RSC) request, _rsc or not', () => {
    expect(isEdgeCacheable(get())).toBe(true)
    expect(isEdgeCacheable(new Request(RECIPE, { method: 'POST' }))).toBe(false)
    expect(isEdgeCacheable(get(RECIPE, { range: 'bytes=0-9' }))).toBe(false)
    expect(isEdgeCacheable(get(RECIPE, { rsc: '1' }))).toBe(false)
    expect(isEdgeCacheable(get(`${RECIPE}?_rsc=abc`, { rsc: '1' }))).toBe(false)
    for (const name of ['next-router-state-tree', 'next-url', 'next-router-prefetch', 'next-router-segment-prefetch'])
      expect(isEdgeCacheable(get(RECIPE, { [name]: '1' })), name).toBe(false)
  })

  it('keys each URL apart', () => {
    expect(edgeCacheKey(`${RECIPE}?from=zupy`, VERSION)).not.toBe(edgeCacheKey(RECIPE, VERSION))
  })

  it('keys every Worker version apart, so a page cached before a deploy is never served after it', async () => {
    expect(edgeCacheKey(RECIPE, 'v-1')).not.toBe(edgeCacheKey(RECIPE, 'v-2'))
    const { handler, serve } = setup()
    await serve(get(), T0, 'v-1')
    const afterDeploy = await serve(get(), T0 + 1000, 'v-2')
    expect(afterDeploy.headers.get('x-edge-cache')).toBe('MISS')
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('does not cache at all without a version id (the binding is missing)', async () => {
    const { cache, handler, serve } = setup()
    const res = await serve(get(), T0, null)
    expect(res.headers.get('x-edge-cache')).toBeNull()
    await serve(get(), T0 + 1000, null)
    expect(handler).toHaveBeenCalledTimes(2)
    expect(cache.store.size).toBe(0)
  })
})

describe('serveGuestPage', () => {
  it('renders on a miss, then serves the next guest from the cache without rendering', async () => {
    const { handler, serve } = setup()
    const first = await serve(get())
    expect(first.headers.get('x-edge-cache')).toBe('MISS')
    expect(await first.text()).toBe(PAGE)

    const second = await serve(get(), T0 + 1000)
    expect(second.headers.get('x-edge-cache')).toBe('HIT')
    expect(await second.text()).toBe(PAGE)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('hands the guest the original Cache-Control back, with no internal headers', async () => {
    const { serve } = setup()
    await serve(get())
    const hit = await serve(get(), T0 + 1000)
    expect(hit.headers.get('cache-control')).toBe('private, no-store')
    expect(hit.headers.get('x-edge-cached-at')).toBeNull()
    expect(hit.headers.get('x-edge-original-cache-control')).toBeNull()
  })

  it('never reads or writes the cache for a signed-in request', async () => {
    const { cache, handler, serve } = setup()
    await serve(get())
    const signedIn = await serve(get(RECIPE, { cookie: 'sb-abc-auth-token=xyz' }), T0 + 1000)
    expect(signedIn.headers.get('x-edge-cache')).toBeNull()
    expect(handler).toHaveBeenCalledTimes(2)
    // and what it rendered is not stored for guests
    expect(cache.store.size).toBe(1)
  })

  it('does not keep a response that sets a cookie, a redirect, an error or a non-page', async () => {
    for (const make of [
      () => html(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8', 'set-cookie': 'a=b' } }),
      () => new Response(null, { status: 308, headers: { location: '/przepis/x' } }),
      () => new Response('nope', { status: 404, headers: { 'content-type': 'text/html' } }),
      () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    ]) {
      const { cache, serve } = setup(async () => make())
      await serve(get())
      expect(cache.store.size).toBe(0)
    }
  })

  it('serves a stale page at once and re-renders it in the background', async () => {
    let version = 1
    const { handler, serve, cache } = setup(async () => html(`v${version}`))
    await serve(get())
    version = 2
    const stale = await serve(get(), T0 + (FRESH_SECONDS + 1) * 1000)
    expect(stale.headers.get('x-edge-cache')).toBe('STALE')
    expect(await stale.text()).toBe('v1')
    expect(handler).toHaveBeenCalledTimes(2)
    expect(cache.store.size).toBe(2) // the page and the refresh lock

    const next = await serve(get(), T0 + (FRESH_SECONDS + 2) * 1000)
    expect(next.headers.get('x-edge-cache')).toBe('HIT')
    expect(await next.text()).toBe('v2')
  })

  it('answers with the stale page while the refresh is still running, and starts only one', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    let first = true
    const { cache, ctx, handler, serve, waits } = setup(async () => {
      if (first) {
        first = false
        return html('v1')
      }
      await gate
      return html('v2')
    })
    await serve(get())
    const late = T0 + (FRESH_SECONDS + 1) * 1000

    const stale = await serveGuestPage(get(), handler, cache, ctx, VERSION, late)
    expect(stale.headers.get('x-edge-cache')).toBe('STALE')
    expect(await stale.text()).toBe('v1')
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(2))

    const overlapping = await serveGuestPage(get(), handler, cache, ctx, VERSION, late + 1)
    expect(overlapping.headers.get('x-edge-cache')).toBe('STALE')
    release()
    await Promise.all(waits.splice(0))
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('keeps the old page when the refresh fails, and drops it when the recipe is gone', async () => {
    let status = 200
    const { cache, serve } = setup(async () => (status === 200 ? html() : new Response('x', { status })))
    await serve(get())
    status = 503
    await serve(get(), T0 + (FRESH_SECONDS + 1) * 1000)
    expect([...cache.store.keys()].some((k) => k.includes('__v=') && !k.includes('__lock'))).toBe(true)

    // lock expires in the real cache; the test clears it
    for (const k of cache.store.keys()) if (k.includes('__lock')) cache.store.delete(k)
    status = 404
    await serve(get(), T0 + (FRESH_SECONDS + 2) * 1000)
    expect([...cache.store.keys()].some((k) => k.includes('__v=') && !k.includes('__lock'))).toBe(false)
  })

  it('waits for a fresh render once the entry is older than the stale window', async () => {
    const { handler, serve } = setup()
    await serve(get())
    const old = await serve(get(), T0 + (MAX_STALE_SECONDS + 1) * 1000)
    expect(old.headers.get('x-edge-cache')).toBe('MISS')
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('falls back to rendering when the cache itself fails', async () => {
    const cache = { match: vi.fn().mockRejectedValue(new Error('down')), put: vi.fn(), delete: vi.fn() }
    const handler = vi.fn(async () => html())
    const ctx = { waitUntil: vi.fn() }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await serveGuestPage(get(), handler, cache, ctx, VERSION, T0)
    expect(await res.text()).toBe(PAGE)
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
