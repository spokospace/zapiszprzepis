import { describe, expect, it, vi } from 'vitest'
import { IMAGE_BASE_URL, STORED_IMAGE_CACHE_CONTROL, r2Storage, type R2BucketLike } from '@/lib/image-store'
import { extractStoragePath, isArchivedImageUrl } from '@/lib/recipe-image-archive'
import { imageFallbackUrl } from '@/lib/image-cache'
import { hasRemoteMatch } from 'next/dist/shared/lib/match-remote-pattern'
import { imageRemotePatterns } from '@/lib/image-remote-patterns'

function fakeBucket(keys: string[] = []): R2BucketLike & { put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> } {
  return {
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn(async ({ prefix = '' }: { prefix?: string } = {}) => ({
      objects: keys.filter((key) => key.startsWith(prefix) && !key.slice(prefix.length).includes('/')).map((key) => ({ key })),
      truncated: false,
    })),
  }
}

describe('r2Storage — the supabase.storage calls the archive makes, on an R2 bucket', () => {
  it('uploads with the content type and a year-long immutable cache header', async () => {
    const bucket = fakeBucket()
    const { error } = await r2Storage(bucket).storage.from('recipe-images').upload('u/1.webp', new Uint8Array([1]), {
      contentType: 'image/webp',
      upsert: true,
    })
    expect(error).toBeNull()
    expect(bucket.put).toHaveBeenCalledWith('u/1.webp', new Uint8Array([1]), {
      httpMetadata: { contentType: 'image/webp', cacheControl: STORED_IMAGE_CACHE_CONTROL },
    })
    expect(STORED_IMAGE_CACHE_CONTROL).toContain('immutable')
  })

  it('reports an upload failure instead of throwing', async () => {
    const bucket = fakeBucket()
    bucket.put.mockRejectedValue(new Error('boom'))
    const { error } = await r2Storage(bucket).storage.from('x').upload('a', new Uint8Array(), { contentType: 'image/jpeg' })
    expect(error).toEqual({ message: 'boom' })
  })

  it('builds the public URL on the image host', () => {
    expect(r2Storage(fakeBucket()).storage.from('x').getPublicUrl('u/1.webp').data.publicUrl).toBe(`${IMAGE_BASE_URL}/u/1.webp`)
  })

  it('lists the files directly inside a folder by name', async () => {
    const bucket = fakeBucket(['u/1/a.webp', 'u/1/b.webp', 'u/1.webp', 'u/2/c.webp'])
    const { data } = await r2Storage(bucket).storage.from('x').list('u/1')
    expect(data).toEqual([{ name: 'a.webp' }, { name: 'b.webp' }])
  })

  it('removes every path and says so', async () => {
    const bucket = fakeBucket()
    const { data, error } = await r2Storage(bucket).storage.from('x').remove(['u/1.webp', 'u/2.webp'])
    expect(bucket.delete).toHaveBeenCalledWith(['u/1.webp', 'u/2.webp'])
    expect(error).toBeNull()
    expect(data).toEqual([{ name: 'u/1.webp' }, { name: 'u/2.webp' }])
  })
})

describe('image URLs on the R2 host', () => {
  it('extractStoragePath reads the key and ignores the ?v= buster', () => {
    expect(extractStoragePath(`${IMAGE_BASE_URL}/user/60.webp?v=abc123`)).toBe('user/60.webp')
    expect(extractStoragePath(`${IMAGE_BASE_URL}/user/60/r1-0.webp`)).toBe('user/60/r1-0.webp')
  })

  it('still reads legacy Supabase URLs', () => {
    expect(extractStoragePath('https://x.supabase.co/storage/v1/object/public/recipe-images/user/60.jpg')).toBe('user/60.jpg')
  })

  it('does not treat another host as archived', () => {
    expect(isArchivedImageUrl('https://img.example.com/user/60.webp')).toBe(false)
    expect(isArchivedImageUrl(`${IMAGE_BASE_URL}.evil.com/user/60.webp`)).toBe(false)
  })

  it('lets the optimizer fetch the image host and keeps refusing others', () => {
    const allowed = (url: string) => hasRemoteMatch([], imageRemotePatterns(), new URL(url))
    expect(allowed(`${IMAGE_BASE_URL}/user/60.webp`)).toBe(true)
    expect(allowed('http://img.zapiszprzepis.pl/user/60.webp')).toBe(false)
    expect(allowed('https://evil.example/user/60.webp')).toBe(false)
  })

  it('falls back to the original on the image host, never on an arbitrary one', () => {
    const request = (url: string) => `https://zapiszprzepis.pl/_next/image?url=${encodeURIComponent(url)}&w=640&q=75`
    const supabase = 'https://wvrlgddgdddwmgzbvtij.supabase.co'
    expect(imageFallbackUrl(request(`${IMAGE_BASE_URL}/u/1.webp`), supabase)).toBe(`${IMAGE_BASE_URL}/u/1.webp`)
    expect(imageFallbackUrl(request('https://evil.example/u/1.webp'), supabase)).toBeNull()
  })
})
