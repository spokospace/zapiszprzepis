import { describe, it, expect, vi, afterEach } from 'vitest'
import { isPrivateUrl, archiveImage, pickRecipeImage } from '@/lib/recipe-image-archive'

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

describe('pickRecipeImage — cover fallback for pages without og:image', () => {
  const PAGE = 'https://www.mniammniam.com/ptysie-z-bita-smietana-2'

  it('skips the ad counter pixel and takes the schema.org image (mniammniam)', () => {
    const html = `
      <img src="/pbook_ctr.php?id=427" class="reklama-eb-ctr" alt="">
      <img src="/img/book_adv/dieta1.jpg" style="max-width:250px" alt="">
      <img src="/obrazki/ptysie_bitasmietana6.jpg" alt="Ptysie z bitą śmietaną" itemprop="image">
      <img src="//assets.pinterest.com/images/pidgets/pin_it_button.png">
      <img src="obrazki/ptysie_bitasmietana2.jpg" width="650" height="950" alt="Ptysie z bitą śmietaną - etap 1">`
    expect(pickRecipeImage(html, PAGE)).toBe('https://www.mniammniam.com/obrazki/ptysie_bitasmietana6.jpg')
  })

  it('without itemprop, prefers the image whose name matches the page slug over an earlier ad', () => {
    const html = `
      <img src="/img/book_adv/dieta1.jpg" alt="">
      <img src="obrazki/ptysie_bitasmietana2.jpg" width="650" height="950" alt="etap 1">`
    expect(pickRecipeImage(html, PAGE)).toBe('https://www.mniammniam.com/obrazki/ptysie_bitasmietana2.jpg')
  })

  it('drops tracking pixels, tiny images, gifs and icons entirely', () => {
    const html = `
      <img height="1" width="1" src="//googleads.g.doubleclick.net/pagead/viewthroughconversion/1/">
      <img src="//pixel.quantserve.com/pixel/p-x.gif" height="1" width="1">
      <img src="/counter.php?id=1">
      <img src="/thumb.jpg" width="70" height="70">
      <img src="/wp-content/themes/x/icons/search.png">`
    expect(pickRecipeImage(html, PAGE)).toBeUndefined()
  })

  it('falls back to the first surviving image when nothing stands out', () => {
    const html = `<img src="https://cdn.example.com/a.jpg"><img src="https://cdn.example.com/b.jpg">`
    expect(pickRecipeImage(html)).toBe('https://cdn.example.com/a.jpg')
  })

  it('reads lazy-loaded sources before the placeholder src', () => {
    const html = `<img data-lazy-src="https://example.com/real.jpg" src="https://example.com/placeholder.png">`
    expect(pickRecipeImage(html)).toBe('https://example.com/real.jpg')
  })
})
