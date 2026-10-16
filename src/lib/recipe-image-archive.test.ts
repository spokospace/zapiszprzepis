import { describe, it, expect, vi, afterEach } from 'vitest'
import { isPrivateUrl, archiveImage, isArchivedImageUrl, proxiedImageUrl } from '@/lib/recipe-image-archive'

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

const EXTERNAL = 'https://www.najprzepis.pl/upload/66477920_8933c3cf37e485_full.jpg'

function okImageResponse() {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'image/jpeg', 'content-length': '100' }),
    arrayBuffer: async () => new ArrayBuffer(100),
  }
}

function mockSupabase(upload = vi.fn().mockResolvedValue({ error: null })) {
  return {
    upload,
    client: {
      storage: {
        from: () => ({
          upload,
          getPublicUrl: () => ({ data: { publicUrl: 'https://supabase.co/storage/photo.jpg' } }),
        }),
      },
    } as any,
  }
}

describe('archiveImage — proxy fallback for hosts that refuse the Worker', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('retries through wsrv.nl when the direct download is refused', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 403, headers: new Headers() })
      .mockResolvedValueOnce(okImageResponse())
    vi.stubGlobal('fetch', fetchSpy)
    const { client, upload } = mockSupabase()

    const result = await archiveImage(client, 'user-1', 60, EXTERNAL)

    expect(result).toBe('https://supabase.co/storage/photo.jpg')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy.mock.calls[0][0]).toBe(EXTERNAL)
    expect(fetchSpy.mock.calls[1][0]).toBe(proxiedImageUrl(EXTERNAL))
    expect(upload).toHaveBeenCalledWith('user-1/60.jpg', expect.any(Uint8Array), {
      contentType: 'image/jpeg',
      upsert: true,
    })
  })

  it('retries through wsrv.nl when the direct download throws', async () => {
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(new Error('connect ETIMEDOUT'))
      .mockResolvedValueOnce(okImageResponse())
    vi.stubGlobal('fetch', fetchSpy)
    const { client } = mockSupabase()

    const result = await archiveImage(client, 'user-1', 60, EXTERNAL)

    expect(result).toBe('https://supabase.co/storage/photo.jpg')
    expect(fetchSpy.mock.calls[1][0]).toBe(proxiedImageUrl(EXTERNAL))
  })

  it('does not use the proxy when the direct download succeeds', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(okImageResponse())
    vi.stubGlobal('fetch', fetchSpy)
    const { client } = mockSupabase()

    await archiveImage(client, 'user-1', 60, EXTERNAL)

    expect(fetchSpy).toHaveBeenCalledOnce()
  })

  it('returns null without uploading when both attempts fail', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 403, headers: new Headers() })
    vi.stubGlobal('fetch', fetchSpy)
    const { client, upload } = mockSupabase()

    const result = await archiveImage(client, 'user-1', 60, EXTERNAL)

    expect(result).toBeNull()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(upload).not.toHaveBeenCalled()
  })

  it('never sends a private URL to the proxy either', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    await archiveImage(mockSupabase().client, 'user-1', 60, 'http://10.0.0.1/secret.jpg')

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('proxiedImageUrl', () => {
  it('encodes the source URL as the wsrv.nl url parameter', () => {
    expect(proxiedImageUrl('https://example.com/a b.jpg?x=1&y=2')).toBe(
      'https://wsrv.nl/?url=https%3A%2F%2Fexample.com%2Fa%20b.jpg%3Fx%3D1%26y%3D2',
    )
  })
})

describe('isArchivedImageUrl', () => {
  it.each([
    ['https://xyz.supabase.co/storage/v1/object/public/recipe-images/user/60.jpg', true],
    ['https://www.najprzepis.pl/upload/66477920_8933c3cf37e485_full.jpg', false],
  ] as const)('%s → %s', (url, expected) => {
    expect(isArchivedImageUrl(url)).toBe(expected)
  })
})
