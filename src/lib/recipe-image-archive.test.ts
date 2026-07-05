import { describe, it, expect, vi, afterEach } from 'vitest'
import { isPrivateUrl, archiveImage } from '@/lib/recipe-image-archive'

describe('isPrivateUrl — SSRF guard (Risk 6)', () => {
  it.each([
    ['http://localhost/image.jpg', true],
    ['http://127.0.0.1/image.jpg', true],
    ['http://0.0.0.1/image.jpg', true],
    ['http://10.0.0.1/image.jpg', true],
    ['http://172.16.0.1/image.jpg', true],
    ['http://172.31.255.255/image.jpg', true],
    ['http://192.168.1.1/image.jpg', true],
    ['http://169.254.169.254/latest/meta-data/', true],
    ['http://metadata.google.internal/', true],
    ['http://[::1]/image.jpg', true],
    ['http://[0:0:0:0:0:0:0:1]/image.jpg', true],
    ['http://[fe80::1]/image.jpg', true],
    ['http://[fd12:3456::1]/image.jpg', true],
    ['http://[fc00::1]/image.jpg', true],
    ['not-a-url', true],
    ['https://external-cdn.example.com/photo.jpg', false],
    ['https://images.unsplash.com/photo.jpg', false],
    ['https://172.32.0.1/photo.jpg', false],
  ] as const)('%s → %s', (url, expected) => {
    expect(isPrivateUrl(url)).toBe(expected)
  })
})

describe('archiveImage — fetch not called for private URLs (Risk 6)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null without calling fetch for a private URL', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const result = await archiveImage({} as any, 'user-1', 1, 'http://169.254.169.254/secret')

    expect(result).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('calls fetch for a legitimate external URL', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'image/jpeg', 'content-length': '100' }),
      arrayBuffer: async () => new ArrayBuffer(100),
    })
    vi.stubGlobal('fetch', fetchSpy)

    const mockSupabase = {
      storage: {
        from: () => ({
          upload: vi.fn().mockResolvedValue({ error: null }),
          getPublicUrl: () => ({ data: { publicUrl: 'https://supabase.co/storage/photo.jpg' } }),
        }),
      },
    } as any

    const result = await archiveImage(mockSupabase, 'user-1', 1, 'https://external-cdn.example.com/photo.jpg')

    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(result).toBe('https://supabase.co/storage/photo.jpg')
  })
})
