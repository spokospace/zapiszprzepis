import { describe, it, expect, vi } from 'vitest'
import { readerScrape, readableHtml } from '@/lib/jina-reader'
import { fetchPublicHtml } from '@/lib/public-fetch'
import { pickGalleryImages } from '@/lib/recipe-image-archive'

const PAGE = 'https://blog.example/2018/01/22/spaghetti'

function jinaResponse(data: Record<string, unknown>, status = 200) {
  return { ok: status < 400, status, json: async () => ({ code: status, data }) }
}

function htmlResponse(html: string, status = 200) {
  return { ok: status < 400, status, headers: new Headers(), text: async () => html }
}

function redirectResponse(location: string) {
  return { ok: false, status: 301, headers: new Headers({ location }), text: async () => '' }
}

describe('fetchPublicHtml', () => {
  it('follows a redirect to the trailing-slash URL', async () => {
    const fetch = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(url === PAGE ? redirectResponse(`${PAGE}/`) : htmlResponse('<p>Przepis</p>')),
    )

    expect(await fetchPublicHtml(PAGE, { fetch })).toBe('<p>Przepis</p>')
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([PAGE, `${PAGE}/`])
    expect(fetch.mock.calls[0][1].redirect).toBe('manual')
  })

  it('never follows a redirect to a private address', async () => {
    const fetch = vi.fn().mockResolvedValue(redirectResponse('http://169.254.169.254/latest/meta-data'))

    expect(await fetchPublicHtml(PAGE, { fetch })).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('treats any redirect as a failure when told to follow none', async () => {
    const fetch = vi.fn().mockResolvedValue(redirectResponse(`${PAGE}/`))

    expect(await fetchPublicHtml(PAGE, { fetch, maxRedirects: 0 })).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('gives up on an endless redirect loop', async () => {
    const fetch = vi.fn().mockResolvedValue(redirectResponse(PAGE))

    expect(await fetchPublicHtml(PAGE, { fetch })).toBeNull()
  })

  it('is null for an error page or a network failure', async () => {
    expect(await fetchPublicHtml(PAGE, { fetch: vi.fn().mockResolvedValue(htmlResponse('nope', 404)) })).toBeNull()
    expect(await fetchPublicHtml(PAGE, { fetch: vi.fn().mockRejectedValue(new Error('fetch failed')) })).toBeNull()
  })
})

describe('readerScrape', () => {
  it('returns Jina markdown led by the title, plus og:image, status and the raw HTML', async () => {
    const fetch = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        url.startsWith('https://r.jina.ai/')
          ? jinaResponse({
              title: 'Barszcz ukraiński',
              url: PAGE,
              content: '## Składniki:\n* 2 ziemniaki',
              httpStatus: 200,
              metadata: { 'og:image': 'https://blog.example/barszcz.jpg' },
            })
          : htmlResponse('<html><img src="/barszcz.jpg"></html>'),
      ),
    )

    const page = await readerScrape(PAGE, { fetch })

    expect(fetch.mock.calls[0][0]).toBe(`https://r.jina.ai/${PAGE}`)
    expect(fetch.mock.calls[0][1].headers).toEqual({ Accept: 'application/json', 'X-With-Images-Summary': 'true' })
    expect(page).toEqual({
      markdown: '# Barszcz ukraiński\n\n## Składniki:\n* 2 ziemniaki',
      html: '<html><img src="/barszcz.jpg"></html>',
      metadata: { url: PAGE, ogImage: 'https://blog.example/barszcz.jpg', statusCode: 200 },
    })
  })

  it('sends JINA_API_KEY as a bearer token when it is set', async () => {
    vi.stubEnv('JINA_API_KEY', 'jina_test')
    const fetch = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(url.startsWith('https://r.jina.ai/') ? jinaResponse({ content: 'Składniki' }) : htmlResponse('')),
    )

    await readerScrape(PAGE, { fetch })
    vi.unstubAllEnvs()

    expect(fetch.mock.calls[0][1].headers).toEqual({
      Accept: 'application/json',
      'X-With-Images-Summary': 'true',
      Authorization: 'Bearer jina_test',
    })
  })

  it('does not repeat a title the markdown already holds', async () => {
    const fetch = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        url.startsWith('https://r.jina.ai/')
          ? jinaResponse({ title: 'Spaghetti', content: '#### Spaghetti\n\nSkładniki' })
          : htmlResponse(''),
      ),
    )

    expect((await readerScrape(PAGE, { fetch }))?.markdown).toBe('#### Spaghetti\n\nSkładniki')
  })

  it('keeps the markdown when the page itself cannot be fetched', async () => {
    const fetch = vi.fn().mockImplementation((url: string) =>
      url.startsWith('https://r.jina.ai/')
        ? Promise.resolve(jinaResponse({ content: 'Składniki' }))
        : Promise.reject(new Error('fetch failed')),
    )

    expect(await readerScrape(PAGE, { fetch })).toEqual({ markdown: 'Składniki', html: '', metadata: {} })
  })

  it('throws the reason when Jina errors, returns no content or cannot be reached', async () => {
    const withJina = (jina: () => Promise<unknown>) =>
      vi.fn().mockImplementation((url: string) =>
        url.startsWith('https://r.jina.ai/') ? jina() : Promise.resolve(htmlResponse('<p>x</p>')),
      )

    await expect(
      readerScrape(PAGE, { fetch: withJina(() => Promise.resolve(jinaResponse({}, 429))) }),
    ).rejects.toThrow(/^Jina Reader: HTTP 429$/)
    await expect(
      readerScrape(PAGE, { fetch: withJina(() => Promise.resolve(jinaResponse({ content: '  ' }))) }),
    ).rejects.toThrow(/^Jina Reader: no content$/)
    await expect(
      readerScrape(PAGE, { fetch: withJina(() => Promise.reject(new Error('The operation timed out'))) }),
    ).rejects.toThrow(/^Jina Reader: The operation timed out$/)
  })

  it('never sends a private address anywhere', async () => {
    const fetch = vi.fn()

    await expect(readerScrape('http://127.0.0.1/admin', { fetch })).rejects.toThrow('Jina Reader: private address')
    expect(fetch).not.toHaveBeenCalled()
  })

  it("recovers og:image from the raw HTML when Jina's metadata omits it", async () => {
    // A Nuxt SSR blog (aniagotuje.pl): Jina returns no og:image, so a page
    // whose only good cover is its og:image used to come through with none —
    // the raw HTML the reader fetches alongside carries the page's own tag.
    const fetch = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        url.startsWith('https://r.jina.ai/')
          ? jinaResponse({ content: 'Składniki', httpStatus: 200 })
          : htmlResponse('<html><head><meta data-n-head="ssr" property="og:image" content="https://cdn.example/dish-1500x1500.jpg"></head></html>'),
      ),
    )

    expect((await readerScrape(PAGE, { fetch })).metadata.ogImage).toBe('https://cdn.example/dish-1500x1500.jpg')
  })

  it("prefers Jina's own og:image over the HTML tag", async () => {
    const fetch = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        url.startsWith('https://r.jina.ai/')
          ? jinaResponse({ content: 'x', metadata: { 'og:image': 'https://jina.example/pick.jpg' } })
          : htmlResponse('<meta property="og:image" content="https://html.example/other.jpg">'),
      ),
    )

    expect((await readerScrape(PAGE, { fetch })).metadata.ogImage).toBe('https://jina.example/pick.jpg')
  })

  it('reads a content-first og:image tag and decodes its entities', async () => {
    const fetch = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        url.startsWith('https://r.jina.ai/')
          ? jinaResponse({ content: 'x' })
          : htmlResponse('<meta content="https://cdn.example/a.jpg?w=1&amp;h=2" property="og:image">'),
      ),
    )

    expect((await readerScrape(PAGE, { fetch })).metadata.ogImage).toBe('https://cdn.example/a.jpg?w=1&h=2')
  })

  it("falls back to Jina's rendered HTML when the site refuses the direct fetch", async () => {
    // aniagotuje.pl answers Jina but not the Worker: no gallery or step photo
    // could come through until the HTML did too.
    const fetch = vi.fn().mockImplementation((url: string, init?: { headers?: Record<string, string> }) => {
      if (!url.startsWith('https://r.jina.ai/')) return Promise.resolve(htmlResponse('', 403))
      return Promise.resolve(
        init?.headers?.['X-Return-Format'] === 'html'
          ? jinaResponse({ html: '<article><img src="https://cdn.example/step1.jpg"></article>' })
          : jinaResponse({ content: 'Składniki' }),
      )
    })

    const page = await readerScrape(PAGE, { fetch })
    expect(page.html).toContain('https://cdn.example/step1.jpg')
    expect(page.markdown).toBe('Składniki')
  })

  it('treats a bot-check interstitial as no page and asks Jina for the HTML', async () => {
    const fetch = vi.fn().mockImplementation((url: string, init?: { headers?: Record<string, string> }) => {
      if (!url.startsWith('https://r.jina.ai/'))
        return Promise.resolve(htmlResponse('<html><head><title>Just a moment...</title></head></html>'))
      return Promise.resolve(
        init?.headers?.['X-Return-Format'] === 'html'
          ? jinaResponse({ html: '<article>Przepis</article>' })
          : jinaResponse({ content: 'Składniki' }),
      )
    })

    expect((await readerScrape(PAGE, { fetch })).html).toBe('<article>Przepis</article>')
  })

  describe('when both HTML fetches hit the bot check', () => {
    // howsweeteats.com (#536): the Worker and Jina's own browser both got
    // Cloudflare's "Just a moment…", so the gallery scan saw no <img>, while
    // the markdown read got through with its image summary.
    const POST = 'https://www.howsweeteats.com/2026/08/prosciutto-fig-jam-pizza/'
    const UPLOADS = 'https://www.howsweeteats.com/wp-content/uploads'
    const CHALLENGE = '<html><head><title>Just a moment...</title></head><body>challenge-platform</body></html>'
    const images = {
      'Image 1: How Sweet Eats Logo': 'https://www.howsweeteats.com/wp-content/themes/hse/images/logo@2x.png',
      'Image 2: Easy Everyday book cover.': `${UPLOADS}/2025/01/easyeveryday-sm.jpg`,
      'Image 3,1: fig jam prosciutto pizza': `${UPLOADS}/2026/08/fig-jam-prosciutto-pizza-8-scaled.jpg`,
      'Image 4,2: fig jam prosciutto pizza': 'blob:http://localhost/2c584051647a1deba35f792035f6c3d7',
      'Image 5: fig jam prosciutto pizza': `${UPLOADS}/2026/08/fig-jam-prosciutto-pizza-scaled.jpg`,
      'Image 6': `${UPLOADS}/2026/08/fig-jam-prosciutto-pizza-6-250x250.jpg`,
      'Image 7': `${UPLOADS}/2026/08/IMG_2041.jpg`,
      'Image 8: Jessica in a leopard print top': `${UPLOADS}/2020/10/about-sm.jpg`,
      'Image 9': 'https://secure.gravatar.com/avatar/6166?s=60',
    }
    const blockedFetch = (summary: Record<string, string> = images) =>
      vi.fn().mockImplementation((url: string, init?: { headers?: Record<string, string> }) => {
        if (!url.startsWith('https://r.jina.ai/')) return Promise.resolve(htmlResponse(CHALLENGE, 403))
        return Promise.resolve(
          init?.headers?.['X-Return-Format'] === 'html'
            ? jinaResponse({ html: CHALLENGE })
            : jinaResponse({ content: 'Fig jam pizza', images: summary }),
        )
      })

    it("hands on the summary's photos of the dish, not the challenge page", async () => {
      const { html } = await readerScrape(POST, { fetch: blockedFetch() })

      expect(html).not.toContain('Just a moment')
      expect(html).not.toContain('blob:')
      expect(html).not.toContain('easyeveryday')
      expect(html).not.toContain('about-sm')
      expect(html).not.toContain('logo')
      expect(html).toContain('alt="fig jam prosciutto pizza"')
      expect(pickGalleryImages(html, POST)).toEqual([
        `${UPLOADS}/2026/08/fig-jam-prosciutto-pizza-8-scaled.jpg`,
        `${UPLOADS}/2026/08/fig-jam-prosciutto-pizza-scaled.jpg`,
      ])
    })

    it('hands on no HTML when no summary image names the dish', async () => {
      const { html } = await readerScrape(POST, {
        fetch: blockedFetch({ 'Image 1: How Sweet Eats Logo': `${UPLOADS}/logo.png` }),
      })

      expect(html).toBe('')
    })

    it('leaves HTML that has photos of its own alone', async () => {
      const fetch = vi.fn().mockImplementation((url: string) =>
        Promise.resolve(
          url.startsWith('https://r.jina.ai/')
            ? jinaResponse({ content: 'x', images })
            : htmlResponse('<article><img src="https://cdn.example/dish.jpg"></article>'),
        ),
      )

      expect((await readerScrape(POST, { fetch })).html).toBe('<article><img src="https://cdn.example/dish.jpg"></article>')
    })

    it('escapes the alt text, writes the URL as it is and skips one that would need escaping', async () => {
      const { html } = await readerScrape(POST, {
        fetch: blockedFetch({
          'Image 1: pizza "with" <figs> & ham': `${UPLOADS}/pizza.jpg?resize=1200,800&ssl=1`,
          'Image 2: pizza': `${UPLOADS}/pizza".jpg`,
        }),
      })

      expect(html).toBe(`<img src="${UPLOADS}/pizza.jpg?resize=1200,800&ssl=1" alt="pizza &quot;with&quot; &lt;figs> &amp; ham">`)
    })

    it("keeps Jina's HTML of an ordinary page that carries Cloudflare's beacon script", async () => {
      const page =
        '<html><head><script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script></head>' +
        `<body><article><img src="${UPLOADS}/2026/08/dish.jpg"></article></body></html>`
      const fetch = vi.fn().mockImplementation((url: string, init?: { headers?: Record<string, string> }) => {
        if (!url.startsWith('https://r.jina.ai/')) return Promise.resolve(htmlResponse(CHALLENGE, 403))
        return Promise.resolve(
          init?.headers?.['X-Return-Format'] === 'html' ? jinaResponse({ html: page }) : jinaResponse({ content: 'x', images }),
        )
      })

      const { html } = await readerScrape(POST, { fetch })
      expect(html).toContain(`<article><img src="${UPLOADS}/2026/08/dish.jpg"></article>`)
      expect(html).not.toContain('alt="fig jam prosciutto pizza"')
    })
  })

  it('does not ask Jina for the HTML when the direct fetch works', async () => {
    const fetch = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(url.startsWith('https://r.jina.ai/') ? jinaResponse({ content: 'x' }) : htmlResponse('<p>Przepis</p>')),
    )

    await readerScrape(PAGE, { fetch })
    expect(fetch.mock.calls.filter((c) => String(c[0]).startsWith('https://r.jina.ai/'))).toHaveLength(1)
  })

  it('hands on content-only HTML so the article is not buried under <head>', async () => {
    // A Nuxt/SSR blog: a huge inlined <head> pushed the article (its per-step
    // <img>) past the slice the LLM and photo scans read; readableHtml lifts it.
    const bigHead = `<head><style>${'x'.repeat(5000)}</style><script>${'y'.repeat(5000)}</script></head>`
    const raw = `${bigHead}<body><article><img src="https://cdn.example/step1.jpg"></article></body>`
    const fetch = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(url.startsWith('https://r.jina.ai/') ? jinaResponse({ content: 'Składniki' }) : htmlResponse(raw)),
    )

    const html = (await readerScrape(PAGE, { fetch })).html
    expect(html).toContain('https://cdn.example/step1.jpg')
    expect(html).not.toContain('<style')
    expect(html.indexOf('step1.jpg')).toBeLessThan(200)
  })
})

describe('readableHtml', () => {
  it('drops scripts, styles, svg, link and comments but keeps ld+json and content images', () => {
    const html =
      '<head>' +
      '<link rel="preload" href="/x.css">' +
      '<style>.a{color:red}</style>' +
      '<script>window.__NUXT__=1</script>' +
      '<script type="application/ld+json">{"@type":"Recipe"}</script>' +
      '</head>' +
      '<body><!-- c --><svg><path/></svg>' +
      '<article><img src="/dish.jpg"><div class="step"><img src="/step1.jpg"></div></article></body>'
    const out = readableHtml(html)

    expect(out).not.toContain('<style')
    expect(out).not.toContain('window.__NUXT__')
    expect(out).not.toContain('<svg')
    expect(out).not.toContain('<link')
    expect(out).not.toContain('<!--')
    expect(out).toContain('application/ld+json')
    expect(out).toContain('/dish.jpg')
    expect(out).toContain('/step1.jpg')
  })

  it('leaves a page without such chrome unchanged', () => {
    const html = '<article><img src="/a.jpg"></article>'
    expect(readableHtml(html)).toBe(html)
  })
})
