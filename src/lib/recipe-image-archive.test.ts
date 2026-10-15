import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  isPrivateUrl,
  archiveImage,
  pickRecipeImage,
  pickGalleryImages,
  buildGallery,
  GALLERY_LIMIT,
} from '@/lib/recipe-image-archive'

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

describe('pickGalleryImages — the recipe photos for the gallery', () => {
  const PAGE = 'https://aniagotuje.pl/przepis/ciastka-maslane-z-marmolada'
  const CDN = 'https://cdn.aniagotuje.com'

  it("keeps the post's photos and drops badges, other recipes and readers' photos (aniagotuje)", () => {
    // Trimmed from Firecrawl's main-content html of the page: the author badge,
    // the hero (declared 1×1, though the file is 1000px), step photos, cards
    // linking to other recipes, an avatar in the comments and a reader's photo.
    const html = `
      <img src="${CDN}/app/client/static/imgs/ania/ania_kolo_216.jpg" width="216" height="216" alt="Ania Gotuje">
      <img src="${CDN}/pictures/articles/2019/01/193306-v-1000x1000.jpg" alt="Ciasteczka maślane" class="img-fluid" width="1" height="1">
      <img style="position: absolute" src="${CDN}/pictures/articles/2019/01/193312-v-1080x1506.jpg" alt="Upieczone ciasteczka">
      <img style="position: absolute" src="${CDN}/pictures/articles/2019/01/193322-v-1080x1440.jpg" alt="Masło w misie">
      <img loading="lazy" src="${CDN}/pictures/articles/2015/11/644752-v-360x360.jpg" alt="Ciasteczka do kawy" class="post-picture">
      <img src="${CDN}/app/client/static/imgs/ania/profile/ania-24x24.jpg">
      <img loading="lazy" src="${CDN}/pictures/comments/84/1548328698884.jpg" alt="zdjecie uzytkownika" class="img-fluid comment-img">`
    expect(pickGalleryImages(html, PAGE)).toEqual([
      `${CDN}/pictures/articles/2019/01/193306-v-1000x1000.jpg`,
      `${CDN}/pictures/articles/2019/01/193312-v-1080x1506.jpg`,
      `${CDN}/pictures/articles/2019/01/193322-v-1080x1440.jpg`,
    ])
  })

  it('drops WordPress thumbnails and related-post cards, keeps photos that declare no size', () => {
    const html = `
      <img src="/wp-content/uploads/2024/05/sernik-150x150.jpg">
      <img src="/wp-content/uploads/2024/05/sernik-1024x768.jpg" width="1024" height="768">
      <img src="/wp-content/uploads/2024/05/sernik-krok.jpg">
      <div class="related-posts"><img src="/wp-content/uploads/2023/01/inny.jpg" class="related-thumb"></div>`
    expect(pickGalleryImages(html, 'https://blog.example/sernik/')).toEqual([
      'https://blog.example/wp-content/uploads/2024/05/sernik-1024x768.jpg',
      'https://blog.example/wp-content/uploads/2024/05/sernik-krok.jpg',
    ])
  })

  it('drops photos inside ad banners and other-recipe sections, keeps a pasted Facebook post (kuron)', () => {
    // Trimmed from kuron.com.pl: the post's photos sit in a pasted Facebook
    // post (`UFICommentBody`), then a book banner and a "see also" grid whose
    // images carry no telltale class of their own.
    const html = `
      <img class="jku-recipe-featured-image" src="https://kuron.com.pl/wp-content/uploads/2016/12/rogaliki.jpg">
      <span class="UFICommentBody _1n4g"><img width="1280" height="960" src="https://kuron.com.pl/wp-content/uploads/2018/11/PA301095.jpg" class="attachment-full size-full"></span>
      <div class="empik-banner" style="margin-bottom:20px;"><a href="https://www.empik.com/to-mi-smakuje"><div><img src="https://kuron.com.pl/wp-content/uploads/2025/10/To-mi-smakuje-social_2128x788_v2.png" width="2128" height="788"></div></a></div>
      <p><img src="https://kuron.com.pl/wp-content/uploads/2016/12/rogaliki-w-piekarniku.jpg"></p>
      <section class="jku-post-grid-wrapper jku-similar-posts-wrapper"><div class="jku-post-grid-item">
        <a class="jku-post-grid-image" href="https://kuron.com.pl/artykuly/przepisy/wolowina/"><img width="429" height="550" src="https://kuron.com.pl/wp-content/uploads/2016/11/wolowina-po-b.jpg" class="wp-post-image"></a>
      </div></section>`
    expect(pickGalleryImages(html, 'https://kuron.com.pl/artykuly/przepisy/ciasta-i-ciastka/rogaliki-z-konfitura-rozana/')).toEqual([
      'https://kuron.com.pl/wp-content/uploads/2016/12/rogaliki.jpg',
      'https://kuron.com.pl/wp-content/uploads/2018/11/PA301095.jpg',
      'https://kuron.com.pl/wp-content/uploads/2016/12/rogaliki-w-piekarniku.jpg',
    ])
  })

  it('drops a print button whose rendered tag lost its size (slodkisentyment)', () => {
    // Firecrawl's render of slodkisentyment.pl: the lazy loader strips the
    // button's width/height, so only its file name and wrapper give it away.
    const html = `
      <img src="https://www.slodkisentyment.pl/wp-content/uploads/2019/11/drugi.jpg" class="wp-image-1412" width="553" height="349">
      <div class="printfriendly pf-button pf-button-content pf-alignleft"><a href="#"><img src="https://www.slodkisentyment.pl/wp-content/uploads/2024/12/printfriendly-button.png" class="pf-button-img" style=""></a></div>
      <img src="https://blog.example/wp-content/uploads/share-button.png">`
    expect(pickGalleryImages(html)).toEqual(['https://www.slodkisentyment.pl/wp-content/uploads/2019/11/drugi.jpg'])
  })

  it('keeps the post when its wrapper merely mentions sharing', () => {
    const html = `<div class="entry-content has-share-buttons"><img src="https://blog.example/ciasto.jpg"></div>`
    expect(pickGalleryImages(html)).toEqual(['https://blog.example/ciasto.jpg'])
  })

  it('leaves a noise section in when its closing tag is missing', () => {
    const html = `<div class="sidebar"><img src="https://blog.example/a.jpg"><img src="https://blog.example/b.jpg">`
    expect(pickGalleryImages(html)).toEqual(['https://blog.example/a.jpg', 'https://blog.example/b.jpg'])
  })

  it('asks Blogger for the full-size rendition instead of the in-post thumbnail', () => {
    const html = `
      <a href="https://blogger.googleusercontent.com/img/b/R29v/AVvX/s1600/ciasto.jpg">
        <img src="https://blogger.googleusercontent.com/img/b/R29v/AVvX/s320/ciasto.jpg" width="320" height="240"></a>
      <img src="https://1.bp.blogspot.com/-abc/X/AAA/def/w400-h300/krok.jpg" width="400" height="300">`
    expect(pickGalleryImages(html)).toEqual([
      'https://blogger.googleusercontent.com/img/b/R29v/AVvX/s1600/ciasto.jpg',
      'https://1.bp.blogspot.com/-abc/X/AAA/def/s1600/krok.jpg',
    ])
  })
})

describe('buildGallery', () => {
  it('puts the cover first and keeps each photo once across sizes and CDN edges', () => {
    const cover = 'https://scontent-waw2-1.xx.fbcdn.net/v/t1/82207020_n.jpg?ctp=p600x600&oe=1'
    const photos = [
      'https://scontent-waw2-2.xx.fbcdn.net/v/t1/82207020_n.jpg?ctp=s720x960&oe=2',
      'https://scontent-waw2-2.xx.fbcdn.net/v/t1/100961545_n.jpg?oe=2',
    ]
    expect(buildGallery(cover, photos)).toEqual([cover, photos[1]])
    expect(
      buildGallery('https://blog.example/a/sernik.jpg', [
        'https://blog.example/a/sernik-1024x768.jpg',
        'https://blog.example/a/krok.jpg',
      ]),
    ).toEqual(['https://blog.example/a/sernik.jpg', 'https://blog.example/a/krok.jpg'])
  })

  it(`stops at ${GALLERY_LIMIT} photos`, () => {
    const photos = Array.from({ length: 20 }, (_, i) => `https://cdn.example/p${i}.jpg`)
    expect(buildGallery(undefined, photos)).toEqual(photos.slice(0, GALLERY_LIMIT))
  })

  it('is empty when there is nothing beyond the cover', () => {
    expect(buildGallery('https://cdn.example/a.jpg', ['https://cdn.example/a.jpg'])).toEqual([])
    expect(buildGallery(undefined, [])).toEqual([])
  })
})
