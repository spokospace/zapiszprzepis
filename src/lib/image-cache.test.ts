import { describe, it, expect, vi } from 'vitest'
import { acceptedFormat, IMAGE_CACHE_CONTROL, imageCacheKey, imageFallbackUrl, serveImage } from './image-cache'

const SUPABASE = 'https://abc.supabase.co'
const PHOTO = `${SUPABASE}/storage/v1/object/public/recipe-images/x/706.png`
const IMAGE_URL = `https://zapiszprzepis.pl/_next/image?url=${encodeURIComponent(PHOTO)}&w=48&q=75`

class MemoryCache {
  store = new Map<string, Response>()
  async match(req: Request) {
    return this.store.get(req.url)?.clone()
  }
  async put(req: Request, res: Response) {
    this.store.set(req.url, res)
  }
}

function setup(handle: (req: Request) => Promise<Response>) {
  const cache = new MemoryCache()
  const waits: Promise<unknown>[] = []
  const ctx = { waitUntil: (p: Promise<unknown>) => void waits.push(p) }
  const handler = vi.fn(handle)
  const serve = async (accept = 'image/avif,image/webp,*/*') => {
    const res = await serveImage(new Request(IMAGE_URL, { headers: { Accept: accept } }), handler, cache, ctx, SUPABASE)
    await Promise.all(waits)
    return res
  }
  return { cache, handler, serve }
}

describe('image cache keys (#357)', () => {
  it('keys by URL and the output format the Accept header selects', () => {
    expect(acceptedFormat('image/avif,image/webp')).toBe('avif')
    expect(acceptedFormat('image/webp,*/*')).toBe('webp')
    expect(acceptedFormat(null)).toBe('orig')
    expect(imageCacheKey(IMAGE_URL, 'image/webp')).toContain('&__fmt=webp')
    expect(imageCacheKey(IMAGE_URL, 'image/webp')).not.toBe(imageCacheKey(IMAGE_URL, null))
  })
})

describe('imageFallbackUrl', () => {
  it('returns the original photo on our Supabase Storage', () => {
    expect(imageFallbackUrl(IMAGE_URL, SUPABASE)).toBe(PHOTO)
  })

  it('never redirects elsewhere — another host, http, a non-public path, or no url', () => {
    const at = (u: string) => `https://zapiszprzepis.pl/_next/image?url=${encodeURIComponent(u)}&w=48&q=75`
    expect(imageFallbackUrl(at('https://evil.example/storage/v1/object/public/a.png'), SUPABASE)).toBeNull()
    expect(imageFallbackUrl(at('http://abc.supabase.co/storage/v1/object/public/a.png'), SUPABASE)).toBeNull()
    expect(imageFallbackUrl(at('https://abc.supabase.co/auth/v1/user'), SUPABASE)).toBeNull()
    expect(imageFallbackUrl('https://zapiszprzepis.pl/_next/image?w=48', SUPABASE)).toBeNull()
    expect(imageFallbackUrl(IMAGE_URL, undefined)).toBeNull()
  })
})

describe('serveImage', () => {
  it('caches a resized image for a day and serves repeats from the cache', async () => {
    const { handler, serve } = setup(async () => new Response('small', { headers: { 'Content-Type': 'image/webp' } }))
    const first = await serve()
    expect(first.headers.get('Cache-Control')).toBe(IMAGE_CACHE_CONTROL)
    expect(await first.text()).toBe('small')
    const second = await serve()
    expect(await second.text()).toBe('small')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('keeps one entry per output format', async () => {
    const { handler, serve } = setup(async () => new Response('img'))
    await serve('image/webp')
    await serve('image/png')
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('sends the visitor to the original photo when the transform fails, instead of a broken image', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const thrown = await setup(async () => {
      throw new Error('quota exceeded')
    }).serve()
    expect(thrown.status).toBe(302)
    expect(thrown.headers.get('Location')).toBe(PHOTO)

    const failed = await setup(async () => new Response('boom', { status: 500 })).serve()
    expect(failed.status).toBe(302)
  })

  it('passes a client error through uncached', async () => {
    const { cache, serve } = setup(async () => new Response('bad', { status: 400 }))
    expect((await serve()).status).toBe(400)
    expect(cache.store.size).toBe(0)
  })
})
