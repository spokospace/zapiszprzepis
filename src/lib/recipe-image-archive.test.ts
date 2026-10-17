import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  isPrivateUrl,
  archiveImage,
  pickRecipeImage,
  pickGalleryImages,
  buildGallery,
  coverImage,
  jsonLdImage,
  archiveGallery,
  GALLERY_LIMIT,
  isArchivedImageUrl,
  proxiedImageUrl,
  insecureHttpUrl,
} from '@/lib/recipe-image-archive'

describe('archiveGallery — a failed re-archive never loses the stored gallery', () => {
  const PUBLIC = 'https://x.supabase.co/storage/v1/object/public/recipe-images/'
  const COVER = `${PUBLIC}user-1/7.jpg`

  /** A Storage bucket already holding `existing` in the recipe's gallery folder. */
  function makeStorage(existing: string[]) {
    const files = new Set(existing.map((name) => `user-1/7/${name}`))
    const bucket = {
      upload: vi.fn(async (path: string) => {
        files.add(path)
        return { error: null }
      }),
      getPublicUrl: (path: string) => ({ data: { publicUrl: `${PUBLIC}${path}` } }),
      list: vi.fn(async (folder: string) => ({
        data: [...files].filter((p) => p.startsWith(`${folder}/`)).map((p) => ({ name: p.slice(folder.length + 1) })),
        error: null,
      })),
      remove: vi.fn(async (paths: string[]) => {
        paths.forEach((p) => files.delete(p))
        return { error: null }
      }),
    }
    return { supabase: { storage: { from: () => bucket } } as any, bucket, files }
  }

  /** fetch answering a JPEG for the URLs in `ok` and a 404 for the rest. */
  function stubFetch(ok: string[]) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        ok.includes(url)
          ? { ok: true, headers: new Headers({ 'content-type': 'image/jpeg' }), arrayBuffer: async () => new ArrayBuffer(10) }
          : { ok: false, status: 404, headers: new Headers() },
      ),
    )
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('keeps the old files and returns null when no photo archives', async () => {
    const { supabase, bucket, files } = makeStorage(['0.jpg', '1.jpg'])
    stubFetch([])

    const result = await archiveGallery(supabase, 'user-1', 7, ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'], COVER)

    expect(result).toBeNull()
    expect(bucket.remove).not.toHaveBeenCalled()
    expect([...files]).toEqual(['user-1/7/0.jpg', 'user-1/7/1.jpg'])
  })

  it('stores the new photos under fresh names, then removes the old ones', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(36 * 36) // run id "100"
    const { supabase, bucket, files } = makeStorage(['0.jpg', '1.jpg'])
    stubFetch(['https://cdn.example/b.jpg'])

    const result = await archiveGallery(supabase, 'user-1', 7, ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'], COVER)

    expect(result).toEqual([COVER, `${PUBLIC}user-1/7/100-1.jpg`])
    expect(bucket.remove).toHaveBeenCalledWith(['user-1/7/0.jpg', 'user-1/7/1.jpg'])
    expect([...files]).toEqual(['user-1/7/100-1.jpg'])
  })

  it('clears the folder when the source has no gallery', async () => {
    const { supabase, files } = makeStorage(['0.jpg', '1.jpg'])
    stubFetch([])

    const result = await archiveGallery(supabase, 'user-1', 7, [], null)

    expect(result).toEqual([])
    expect(files.size).toBe(0)
  })
})

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

describe('coverImage — og:image vs the in-content photo', () => {
  const PAGE = 'https://kulinarnapolska.org/szaszlyki-z-piekarnika-prawdziwa-miesna-uczta-w-domu-przepis'
  const CONTENT = `
    <img src="/wp-content/uploads/2019/07/szaszlyki-z-piekarnika-przepis-2.jpg" alt="Szaszłyki z piekarnika">
    <img src="/wp-content/uploads/2018/04/pasek-kulinarna-polska.png" alt="">`

  it('resolves a relative og:image against the page', () => {
    const html = `<img src="/wp-content/uploads/2019/07/szaszlyki-z-piekarnika-przepis-2.jpg" alt="Szaszłyki">`
    expect(coverImage('/wp-content/uploads/2019/07/szaszlyki-z-piekarnika-przepis-2.jpg', html, PAGE)).toBe(
      'https://kulinarnapolska.org/wp-content/uploads/2019/07/szaszlyki-z-piekarnika-przepis-2.jpg',
    )
  })

  it('prefers the in-content photo over a stale site-wide og:image that misses the slug', () => {
    // The page's own og:image is the same unrelated "flaczki" photo on every
    // post; the in-content photo matches the szaszłyki slug, so it wins.
    expect(coverImage('/wp-content/uploads/2019/09/falszywe-flaczki-z-boczniakow-przepis-1-1.jpg', CONTENT, PAGE)).toBe(
      'https://kulinarnapolska.org/wp-content/uploads/2019/07/szaszlyki-z-piekarnika-przepis-2.jpg',
    )
  })

  it('ignores a related-recipe card in a noise section even when it matches the slug', () => {
    const og = 'https://kulinarnapolska.org/wp-content/uploads/2019/09/falszywe-flaczki-z-boczniakow.jpg'
    const html = `
      <img src="https://kulinarnapolska.org/wp-content/uploads/2019/07/szaszlyki-z-piekarnika-przepis-2.jpg" alt="Szaszłyki">
      <div class="related"><img src="https://kulinarnapolska.org/wp-content/uploads/x/szaszlyki-inne.jpg" alt="inne"></div>`
    // The in-content szaszłyki photo wins over the stale flaczki og; the
    // related-section card is cut before the pick.
    expect(coverImage(og, html, PAGE)).toBe(
      'https://kulinarnapolska.org/wp-content/uploads/2019/07/szaszlyki-z-piekarnika-przepis-2.jpg',
    )
  })

  it('keeps an og:image that matches the dish as well as the content photo', () => {
    const og = 'https://kulinarnapolska.org/wp-content/uploads/2019/07/szaszlyki-z-piekarnika-hero.jpg'
    expect(coverImage(og, CONTENT, PAGE)).toBe(og)
  })

  it('falls back to the in-content pick when there is no og:image, and undefined when neither', () => {
    expect(coverImage(undefined, CONTENT, PAGE)).toBe(
      'https://kulinarnapolska.org/wp-content/uploads/2019/07/szaszlyki-z-piekarnika-przepis-2.jpg',
    )
    expect(coverImage(undefined, '<p>no images</p>', PAGE)).toBeUndefined()
  })

  it('keeps the og:image when a lightbox <img> merely links back to the article (pysznosci)', () => {
    // pysznosci.pl (Wirtualna Polska) renders a lightbox whose `wpl-image`
    // placeholder's src is the article URL itself. It declares no size (so it
    // clears the size gate) and its "file name" is the page slug, so without a
    // guard it would score as the best cover and beat the real og:image —
    // which, being an obfuscated v.wpimg.pl URL, carries no slug word.
    const PAGE = 'https://pysznosci.pl/ciastka-owsiane-bez-cukru,6966548765367168a'
    const og = 'https://v.wpimg.pl/MGE5YjMxYiYkVy9ZYgNvM2cPewMkWmFlMBdj'
    const html = `
      <img class="wpl-image" aria-describedby="lightbox-caption" alt="" src="${PAGE}">
      <img role="presentation" class="absolute" src="https://v.wpimg.pl/ZXJfd3AudTkrBBIA" loading="lazy">
      <img src="https://v.wpimg.pl/NmFhYjU2YQwnCi9ZeklsGWRS">`
    expect(coverImage(og, html, PAGE)).toBe(og)
  })

  it('uses the schema.org JSON-LD image when the page ships no og:image (marta-gotuje)', () => {
    // marta-gotuje.pl/orzechowiec names the dish only in JSON-LD: no og:image,
    // and Firecrawl's main-content scrape returned no usable <img>. Before this,
    // the recipe fell back to the Facebook group's unrelated cover.
    const PAGE = 'https://www.marta-gotuje.pl/orzechowiec/'
    const html = `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
      {"@type":"WebSite","name":"marta-gotuje.pl"},
      {"@type":"Recipe","name":"Orzechowiec","image":{"@type":"ImageObject","url":"https://www.marta-gotuje.pl/wp-content/uploads/2014/12/Orzechowiec.jpg","width":450,"height":675}}]}</script>
      <p>no usable img tags here</p>`
    expect(coverImage(undefined, html, PAGE)).toBe('https://www.marta-gotuje.pl/wp-content/uploads/2014/12/Orzechowiec.jpg')
  })

  it('lets the JSON-LD dish image unseat a stale site-wide og:image', () => {
    const og = 'https://kulinarnapolska.org/wp-content/uploads/2019/09/falszywe-flaczki-z-boczniakow.jpg'
    const html = `<script type="application/ld+json">{"@type":"Recipe","image":"https://kulinarnapolska.org/wp-content/uploads/x/szaszlyki-z-piekarnika.jpg"}</script>`
    expect(coverImage(og, html, PAGE)).toBe('https://kulinarnapolska.org/wp-content/uploads/x/szaszlyki-z-piekarnika.jpg')
  })
})

describe('jsonLdImage — the schema.org dish photo', () => {
  it('reads an ImageObject url and resolves it against the page', () => {
    const html = `<script type="application/ld+json">{"@type":"Recipe","image":{"url":"/uploads/tort.jpg"}}</script>`
    expect(jsonLdImage(html, 'https://blog.example/tort/')).toBe('https://blog.example/uploads/tort.jpg')
  })

  it('reads a bare string and an array of images, taking the first', () => {
    expect(jsonLdImage(`<script type="application/ld+json">{"@type":"Recipe","image":"https://x/a.jpg"}</script>`)).toBe('https://x/a.jpg')
    expect(jsonLdImage(`<script type="application/ld+json">{"@type":"Recipe","image":["https://x/a.jpg","https://x/b.jpg"]}</script>`)).toBe('https://x/a.jpg')
  })

  it("prefers the Recipe node's image over an Article's or a WebPage's", () => {
    const html = `<script type="application/ld+json">{"@graph":[
      {"@type":"WebPage","image":"https://x/page.jpg"},
      {"@type":"Recipe","image":"https://x/dish.jpg"}]}</script>`
    expect(jsonLdImage(html)).toBe('https://x/dish.jpg')
  })

  it('ignores an avatar or logo under an unrelated node, and survives malformed JSON', () => {
    const html = `<script type="application/ld+json">{"@type":"Person","image":"https://x/avatar.jpg"}</script>
      <script type="application/ld+json">{ broken json</script>`
    expect(jsonLdImage(html)).toBeUndefined()
  })

  it('returns undefined when the page carries no JSON-LD image', () => {
    expect(jsonLdImage('<p>nothing here</p>')).toBeUndefined()
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

  it('keeps the post when a layout wrapper is named after its sidebar, still cutting the noise inside (krysiagotuje)', () => {
    // Trimmed from krysiagotuje.pl: the whole post sits in a
    // `layout-right-sidebar` container, and "sidebar" marks noise. Cutting the
    // container took both lazy-loaded photos; the share links and the real
    // sidebar must still go.
    const UP = 'https://www.krysiagotuje.pl/wp-content/uploads'
    const html = `
      <main id="content"><div class="container layout-2-col layout-right-sidebar">
        <div class="col-sm-8 content-column"><article class="post-12962">
          <div class="entry-content clearfix single-post-content">
            <a class="mashicon-facebook" href="https://www.facebook.com/sharer.php?u=x"><img src="${UP}/2020/09/share-card.jpg" width="1200" height="630"></a>
            <p><img class="alignnone size-full" data-src="${UP}/2020/09/krem-rafaello-2.jpg" width="700" height="392"></p>
            <p><img class="alignnone size-full" data-src="${UP}/2020/09/krem-rafaello-1.jpg" width="700" height="392"></p>
          </div>
        </article></div>
        <aside class="sidebar-column"><img src="${UP}/2020/08/inny-przepis.jpg" width="700" height="392"></aside>
      </div></main>`
    expect(pickGalleryImages(html, 'https://www.krysiagotuje.pl/domowy-krem-raffaello/')).toEqual([
      `${UP}/2020/09/krem-rafaello-2.jpg`,
      `${UP}/2020/09/krem-rafaello-1.jpg`,
    ])
  })

  it('keeps a Wix post whose page wrapper has banner breakpoint classes, at full size (kulinarneprzygody)', () => {
    // Trimmed from kulinarneprzygody.com: Wix wraps the page in a div whose
    // breakpoint classes read `lte-banner-w980`, and "banner" marks noise —
    // cutting it took the whole post. The raw html holds only blurred 147px
    // placeholders; the related-post cards and the promo banner stay out.
    const MEDIA = 'https://static.wixstatic.com/media'
    const html = `
      <div class="md gt-740 lte-banner-w980 lte-category-header-w980">
        <article data-hook="post"><section data-hook="post-description"><div data-id="content-viewer">
          <wow-image><img src="${MEDIA}/e92093_c7f9~mv2.jpg/v1/fill/w_147,h_83,al_c,q_80,blur_2,enc_avif,quality_auto/e92093_c7f9~mv2.jpg" alt=""></wow-image>
          <wow-image><img src="${MEDIA}/e92093_023b~mv2.jpg/v1/fill/w_740,h_1316,al_c,q_85,enc_avif,quality_auto/e92093_023b~mv2.jpg" alt=""></wow-image>
        </div></section></article>
        <div class="kkOpHH"><img alt="Muffiny" src="${MEDIA}/e92093_03d9~mv2.jpeg/v1/fill/w_289,h_162,al_c,q_80/e92093_03d9~mv2.jpeg"></div>
        <img src="${MEDIA}/e92093_444c~mv2.webp/v1/fill/w_356,h_178,al_c,q_80/week-day-baner-3.webp" alt="">
      </div>`
    const photos = pickGalleryImages(html, 'https://www.kulinarneprzygody.com/post/kruche-ciastka-z-marmolad%C4%85')
    expect(photos).toEqual([
      `${MEDIA}/e92093_c7f9~mv2.jpg/v1/fit/w_1600,h_1600,q_85/e92093_c7f9~mv2.jpg`,
      `${MEDIA}/e92093_023b~mv2.jpg/v1/fit/w_1600,h_1600,q_85/e92093_023b~mv2.jpg`,
    ])
    // The og:image is another rendition of the first photo, so it is not repeated.
    const cover = `${MEDIA}/e92093_c7f9~mv2.jpg/v1/fill/w_1000,h_562,al_c,q_85/e92093_c7f9~mv2.jpg`
    expect(buildGallery(cover, photos)).toEqual([cover, photos[1]])
  })

  it('drops a print button whose rendered tag lost its size (slodkisentyment)', () => {
    // Firecrawl's render of slodkisentyment.pl: the lazy loader strips the
    // button's width/height, so only its file name and wrapper give it away.
    const html = `
      <img src="https://www.slodkisentyment.pl/wp-content/uploads/2019/11/drugi.jpg" class="wp-image-1412" width="553" height="349">
      <div class="printfriendly pf-button pf-button-content pf-alignleft"><a href="#"><img src="https://www.slodkisentyment.pl/wp-content/uploads/2024/12/printfriendly-button.png" class="pf-button-img" style=""></a><img src="https://www.slodkisentyment.pl/wp-content/uploads/2024/12/pf-pdf-email.png"></div>
      <img src="https://blog.example/wp-content/uploads/share-button.png">`
    expect(pickGalleryImages(html)).toEqual(['https://www.slodkisentyment.pl/wp-content/uploads/2019/11/drugi.jpg'])
  })

  it('keeps the post when its wrapper merely mentions sharing', () => {
    const html = `<div class="entry-content has-share-buttons"><img src="https://blog.example/ciasto.jpg"></div>`
    expect(pickGalleryImages(html)).toEqual(['https://blog.example/ciasto.jpg'])
  })

  it('drops images linking to another page and video stills, keeps lightbox links (ciastkozercy)', () => {
    // Trimmed from Firecrawl's render of ciastkozercy.pl: step photos link to
    // their own files; a shop banner, shop product cards and a channel promo
    // link elsewhere; a YouTube facade shows the video's still.
    const html = `
      <a class="td_spot_img_all" href="https://sklep.ciastkozercy.pl/"><img width="2200" height="360" src="https://ciastkozercy.pl/wp-content/uploads/2023/04/blaszki.jpg"></a>
      <div class="epyt-video-wrapper"><img class="epyt-facade-poster skip-lazy" src="https://i.ytimg.com/vi/pTQCgs8MpX8/maxresdefault.jpg"></div>
      <a href="https://ciastkozercy.pl/wp-content/uploads/2019/09/Magdalenki-4.jpg"><img src="https://ciastkozercy.pl/wp-content/uploads/2019/09/Magdalenki-4.jpg" width="800" height="534"></a>
      <a class="czb-rz" href="https://sklep.ciastkozercy.pl/produkt/kratka/?blok=przepis"><img src="https://sklep.ciastkozercy.pl/wp-content/uploads/2019/02/KRATKA-600x600.jpg?wsr" width="350" height="350"><span>35,90 zł</span></a>
      <a href="https://www.youtube.com/channel/UCEAfsPXNHh7MNyiEWwaBU9Q"><img src="https://ciastkozercy.pl/wp-content/uploads/2017/05/Ciastkozercy-YouTube.jpg" width="800" height="520"></a>
      <img src="https://ciastkozercy.pl/wp-content/uploads/2019/09/Magdalenki-2.jpg" width="800" height="534">
      <a href="https://ciastkozercy.pl/magdalenki/magdalenki-8/?attachment_id=15339"><img src="https://ciastkozercy.pl/wp-content/uploads/2019/09/Magdalenki-8.jpg"></a>`
    expect(pickGalleryImages(html, 'https://ciastkozercy.pl/magdalenki')).toEqual([
      'https://ciastkozercy.pl/wp-content/uploads/2019/09/Magdalenki-4.jpg',
      'https://ciastkozercy.pl/wp-content/uploads/2019/09/Magdalenki-2.jpg',
      'https://ciastkozercy.pl/wp-content/uploads/2019/09/Magdalenki-8.jpg',
    ])
  })

  it('drops a decorative lightbox placeholder and an <img> self-linking the page (pysznosci)', () => {
    // pysznosci.pl's lightbox: a `role="presentation"` spinner repeated per
    // slot, a `wpl-image` whose src is the article URL, and an `aria-hidden`
    // flame icon in the exit-intent popup. All carry no size, so the size gate
    // alone lets them through; all are junk.
    const PAGE = 'https://pysznosci.pl/ciastka-owsiane-bez-cukru,6966548765367168a'
    const html = `
      <img class="wpl-image" aria-describedby="lightbox-caption" alt="" src="${PAGE}">
      <img role="presentation" class="absolute" src="https://v.wpimg.pl/ZXJfd3AudTkrBBIA" loading="lazy">
      <img src="https://v.wpimg.pl/MjhlM2MyYgsJDjsBYgJvHkpW" alt="" aria-hidden="true">
      <img src="https://v.wpimg.pl/NmFhYjU2YQwnCi9ZeklsGWRS">
      <img src="https://v.wpimg.pl/NGI2YWYxYSYoUC9kdgNsM2sI">`
    expect(pickGalleryImages(html, PAGE)).toEqual([
      'https://v.wpimg.pl/NmFhYjU2YQwnCi9ZeklsGWRS',
      'https://v.wpimg.pl/NGI2YWYxYSYoUC9kdgNsM2sI',
    ])
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

const EXTERNAL = 'https://www.najprzepis.pl/upload/66477920_8933c3cf37e485_full.jpg'

function okImageResponse() {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'image/jpeg', 'content-length': '100' }),
    arrayBuffer: async () => new ArrayBuffer(100),
  }
}

function storageMock(upload = vi.fn().mockResolvedValue({ error: null })) {
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

describe('insecureHttpUrl', () => {
  it('downgrades https to http', () => {
    expect(insecureHttpUrl('https://babskieporady.pl/a.jpg')).toBe('http://babskieporady.pl/a.jpg')
  })
  it('is null for a URL that is not https', () => {
    expect(insecureHttpUrl('http://babskieporady.pl/a.jpg')).toBeNull()
    expect(insecureHttpUrl('data:image/png;base64,xyz')).toBeNull()
  })
})

describe('archiveImage — http and proxy fallback for hosts the Worker cannot fetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('skips the http retry and goes straight to wsrv.nl when the direct download is refused', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 403, headers: new Headers() })
      .mockResolvedValueOnce(okImageResponse())
    vi.stubGlobal('fetch', fetchSpy)
    const { client, upload } = storageMock()

    const result = await archiveImage(client, 'user-1', 60, EXTERNAL)

    expect(result).toBe('https://supabase.co/storage/photo.jpg')
    // A refused status won't change over http, so no http attempt is made.
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy.mock.calls[0][0]).toBe(EXTERNAL)
    expect(fetchSpy.mock.calls[1][0]).toBe(proxiedImageUrl(EXTERNAL))
    expect(upload).toHaveBeenCalledWith('user-1/60.jpg', expect.any(Uint8Array), {
      contentType: 'image/jpeg',
      upsert: true,
    })
  })

  it('skips the http retry on a timeout — the http endpoint is just as slow', async () => {
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' })
    const fetchSpy = vi.fn().mockRejectedValueOnce(timeout).mockResolvedValueOnce(okImageResponse())
    vi.stubGlobal('fetch', fetchSpy)

    const result = await archiveImage(storageMock().client, 'user-1', 60, EXTERNAL)

    expect(result).toBe('https://supabase.co/storage/photo.jpg')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy.mock.calls[1][0]).toBe(proxiedImageUrl(EXTERNAL))
  })

  it('archives over plain http when https fails on an SSL-broken host', async () => {
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed')) // TLS cert mismatch
      .mockResolvedValueOnce(okImageResponse()) // same file over http
    vi.stubGlobal('fetch', fetchSpy)
    const { client, upload } = storageMock()

    const result = await archiveImage(client, 'user-1', 60, EXTERNAL)

    expect(result).toBe('https://supabase.co/storage/photo.jpg')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy.mock.calls[1][0]).toBe(insecureHttpUrl(EXTERNAL))
    expect(upload).toHaveBeenCalledOnce()
  })

  it('falls through to wsrv.nl when both https and http throw', async () => {
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(new Error('connect ETIMEDOUT'))
      .mockRejectedValueOnce(new Error('connect ETIMEDOUT'))
      .mockResolvedValueOnce(okImageResponse())
    vi.stubGlobal('fetch', fetchSpy)

    const result = await archiveImage(storageMock().client, 'user-1', 60, EXTERNAL)

    expect(result).toBe('https://supabase.co/storage/photo.jpg')
    expect(fetchSpy.mock.calls[2][0]).toBe(proxiedImageUrl(EXTERNAL))
  })

  it('does not retry when the direct download succeeds', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(okImageResponse())
    vi.stubGlobal('fetch', fetchSpy)

    await archiveImage(storageMock().client, 'user-1', 60, EXTERNAL)

    expect(fetchSpy).toHaveBeenCalledOnce()
  })

  it('returns null without uploading when every attempt fails', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 403, headers: new Headers() })
    vi.stubGlobal('fetch', fetchSpy)
    const { client, upload } = storageMock()

    const result = await archiveImage(client, 'user-1', 60, EXTERNAL)

    expect(result).toBeNull()
    // Direct (403) then proxy (403); the refused status skips the http retry.
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(upload).not.toHaveBeenCalled()
  })

  it('never sends a private URL to the proxy either', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    await archiveImage(storageMock().client, 'user-1', 60, 'http://10.0.0.1/secret.jpg')

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('archiveImage — full-size preference over a WordPress resize', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const RESIZE = 'https://blog.example/a/ciasto-696x464.jpg'
  const FULL = 'https://blog.example/a/ciasto.jpg'

  it('fetches the full-size original first when given a resize URL', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(okImageResponse())
    vi.stubGlobal('fetch', fetchSpy)

    const result = await archiveImage(storageMock().client, 'user-1', 60, RESIZE)

    expect(result).toBe('https://supabase.co/storage/photo.jpg')
    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(fetchSpy.mock.calls[0][0]).toBe(FULL)
  })

  it('falls back to the resize URL when the full-size cannot be archived (e.g. over the size cap)', async () => {
    // The full-size original and its proxy fail (404 / too large); the resize
    // then archives cleanly, so the cover is never lost.
    const fetchSpy = vi.fn((input: unknown) => {
      const url = String(input)
      const failing = url === FULL || url === proxiedImageUrl(FULL)
      return Promise.resolve(failing ? { ok: false, status: 404, headers: new Headers() } : okImageResponse())
    })
    vi.stubGlobal('fetch', fetchSpy)

    const result = await archiveImage(storageMock().client, 'user-1', 60, RESIZE)

    expect(result).toBe('https://supabase.co/storage/photo.jpg')
    expect(fetchSpy.mock.calls.map((c) => c[0])).toContain(RESIZE)
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
