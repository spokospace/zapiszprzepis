import { describe, it, expect, vi } from 'vitest'
import { readerScrape } from '@/lib/jina-reader'
import { fetchPublicHtml } from '@/lib/public-fetch'

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
    expect(fetch.mock.calls[0][1].headers).toEqual({ Accept: 'application/json' })
    expect(page).toEqual({
      markdown: '# Barszcz ukraiński\n\n## Składniki:\n* 2 ziemniaki',
      html: '<html><img src="/barszcz.jpg"></html>',
      metadata: { url: PAGE, ogImage: 'https://blog.example/barszcz.jpg', statusCode: 200 },
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

  it('is null when Jina errors, returns no content or cannot be reached', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const withJina = (jina: () => Promise<unknown>) =>
      vi.fn().mockImplementation((url: string) =>
        url.startsWith('https://r.jina.ai/') ? jina() : Promise.resolve(htmlResponse('<p>x</p>')),
      )

    expect(await readerScrape(PAGE, { fetch: withJina(() => Promise.resolve(jinaResponse({}, 451))) })).toBeNull()
    expect(await readerScrape(PAGE, { fetch: withJina(() => Promise.resolve(jinaResponse({ content: '  ' }))) })).toBeNull()
    expect(await readerScrape(PAGE, { fetch: withJina(() => Promise.reject(new Error('timeout'))) })).toBeNull()
  })

  it('never sends a private address anywhere', async () => {
    const fetch = vi.fn()

    expect(await readerScrape('http://127.0.0.1/admin', { fetch })).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
})
