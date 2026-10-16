import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runExtractRecipe } from '@/inngest/run-extract-recipe'
import { archiveImage, archiveRecipeImages } from '@/lib/recipe-image-archive'
import { LABEL_MODEL } from '@/lib/recipe-labeling'

// archiveImage uses the global fetch, not the injected one, so it must be
// stubbed or a test with an og:image goes out to the network. Default: the
// archive fails, which is the branch where image_url persistence matters.
vi.mock('@/lib/recipe-image-archive', async (importActual) => {
  const archiveImage = vi.fn().mockResolvedValue(null)
  return {
    ...(await importActual<typeof import('@/lib/recipe-image-archive')>()),
    archiveImage,
    // Routes the cover through the archiveImage stub and hands back one
    // Storage URL per gallery photo, so tests see what would be stored.
    archiveRecipeImages: vi.fn(
      async (supabase: unknown, userId: string, recipeId: number, cover: string | undefined, gallery: string[]) => ({
        cover: cover != null ? await archiveImage(supabase, userId, recipeId, cover) : null,
        gallery: gallery.map((_, i) => `https://storage.example/u/${recipeId}/${i}.jpg`),
      }),
    ),
  }
})

beforeEach(() => {
  vi.mocked(archiveImage).mockResolvedValue(null)
  vi.mocked(archiveRecipeImages).mockClear()
})

const BASE_EVENT = {
  shareId: 1,
  sharedUrl: 'https://example.com/recipe',
  userId: 'user-1',
  sourceType: 'web_blog' as const,
}

const VALID_RECIPE_JSON = JSON.stringify({
  title: 'Naleśniki',
  ingredients: [{ name: 'Mąka', amount: '200', unit: 'g', section: '' }],
  steps: ['Wymieszaj składniki', 'Smaż na patelni'],
  category: 'sniadania',
  prepTimeMinutes: 10,
  cookTimeMinutes: 20,
  totalTimeMinutes: 30,
})

const JUNK_RECIPE_JSON = JSON.stringify({
  title: 'Naleśniki',
  ingredients: [],
  steps: [],
  category: 'sniadania',
})

// The labelling pass (title casing, note, tags) is a second OpenAI call on its
// own model; extraction tests count and inspect only the extraction calls.
const isLabelingCall = (init?: RequestInit) =>
  init?.body != null && JSON.parse(String(init.body)).model === LABEL_MODEL

// Creates a chainable Supabase mock. Each call to from(table) returns a fresh chain.
// Results for .single() are served from a per-table FIFO queue.
function makeSupabaseMock() {
  const queues: Record<string, Array<{ data: any; error: any }>> = {}
  const calls: Array<{ table: string; op: string; args?: any }> = []

  function makeChain(table: string) {
    const chain: any = {}
    chain.insert = vi.fn().mockImplementation((args: any) => {
      calls.push({ table, op: 'insert', args })
      return chain
    })
    chain.update = vi.fn().mockImplementation((args: any) => {
      calls.push({ table, op: 'update', args })
      return chain
    })
    chain.select = vi.fn().mockReturnValue(chain)
    chain.eq = vi.fn().mockReturnValue(chain)
    chain.neq = vi.fn().mockReturnValue(chain)
    chain.order = vi.fn().mockReturnValue(chain)
    chain.limit = vi.fn().mockReturnValue(chain)
    chain.single = vi.fn().mockImplementation(() => {
      const val = queues[table]?.shift() ?? { data: null, error: null }
      return Promise.resolve(val)
    })
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    // Make chain awaitable for update().eq() calls without .single()
    chain.then = (resolve: any, reject: any) =>
      Promise.resolve({ data: null, error: null }).then(resolve, reject)
    return chain
  }

  const supabase = {
    from: vi.fn().mockImplementation((table: string) => makeChain(table)),
  }

  return {
    supabase,
    /** Queue a .single() result for the next call on this table */
    queue(table: string, result: { data: any; error: any }) {
      if (!queues[table]) queues[table] = []
      queues[table].push(result)
    },
    didInsert: (table: string) => calls.some(c => c.table === table && c.op === 'insert'),
    insertArgs: (table: string) => calls.find(c => c.table === table && c.op === 'insert')?.args,
    didUpdate: (table: string, partial?: Record<string, any>) =>
      calls.some(c => {
        if (c.table !== table || c.op !== 'update') return false
        if (!partial) return true
        return Object.entries(partial).every(([k, v]) => c.args?.[k] === v)
      }),
  }
}

// Routes fetch by URL prefix — Firecrawl and OpenAI paths
function makeFetchMock({
  firecrawlMarkdown = 'Przepis na naleśniki. '.repeat(30),
  firecrawlHtml = '<p>Przepis na naleśniki.</p>'.repeat(20),
  openaiContent = VALID_RECIPE_JSON,
}: {
  firecrawlMarkdown?: string
  firecrawlHtml?: string
  openaiContent?: string
} = {}) {
  return vi.fn().mockImplementation((url: string) => {
    if (url.includes('firecrawl.dev')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: { markdown: firecrawlMarkdown, html: firecrawlHtml, metadata: {} },
        }),
      })
    }
    if (url.includes('openai.com')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ choices: [{ message: { content: openaiContent } }] }),
      })
    }
    return Promise.reject(new Error(`Unexpected fetch URL: ${url}`))
  })
}

describe('runExtractRecipe — Risk 2: junk input gate', () => {
  it('throws before recipe insert when scraped content is junk', async () => {
    const mock = makeSupabaseMock()
    // Firecrawl returns empty content — looksUnextractable fires
    const fetch = makeFetchMock({ firecrawlMarkdown: '', firecrawlHtml: '' })

    await expect(
      runExtractRecipe(BASE_EVENT, { fetch, supabase: mock.supabase as any })
    ).rejects.toThrow('no readable recipe content')

    expect(mock.didInsert('recipes')).toBe(false)
  })
})

describe('runExtractRecipe — LLM output the database would reject (#134)', () => {
  const withCategory = (category: unknown) => JSON.stringify({ ...JSON.parse(VALID_RECIPE_JSON), category })

  it.each([
    ['sałatki', 'salatki'],
    ['Sałatki', 'salatki'],
    ['kolacje', 'inne'],
  ])('stores category %j as the enum value %s', async (raw, value) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })

    await runExtractRecipe(BASE_EVENT, {
      fetch: makeFetchMock({ openaiContent: withCategory(raw) }),
      supabase: mock.supabase as any,
    })

    expect(mock.insertArgs('recipes')?.category).toBe(value)
  })

  it('coerces the category on a refresh too', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })

    await runExtractRecipe(
      { ...BASE_EVENT, force: true },
      { fetch: makeFetchMock({ openaiContent: withCategory('kolacje') }), supabase: mock.supabase as any },
    )

    expect(mock.didUpdate('recipes', { category: 'inne' })).toBe(true)
  })

  it('asks for JSON mode and reads a fenced answer', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })
    const fetch = makeFetchMock({ openaiContent: '```json\n' + VALID_RECIPE_JSON + '\n```' })

    await runExtractRecipe(BASE_EVENT, { fetch, supabase: mock.supabase as any })

    const extraction = fetch.mock.calls.find((c) => String(c[0]).includes('openai.com') && !isLabelingCall(c[1]))
    expect(JSON.parse(String(extraction?.[1]?.body)).response_format).toEqual({ type: 'json_object' })
    expect(mock.insertArgs('recipes')?.title).toBe('Naleśniki')
  })

  it('fails with a Polish message, not a SyntaxError, when the answer is not JSON', async () => {
    const mock = makeSupabaseMock()

    await expect(
      runExtractRecipe(BASE_EVENT, {
        fetch: makeFetchMock({ openaiContent: 'Oto przepis: naleśniki' }),
        supabase: mock.supabase as any,
      }),
    ).rejects.toThrow('Nie udało się odczytać przepisu z odpowiedzi modelu')
    expect(mock.didInsert('recipes')).toBe(false)
  })
})

describe('runExtractRecipe — article split over pages (#168)', () => {
  const ARTICLE = 'https://obiady.foodmeld.com/babcine-ciasteczka/2819/2026/'
  const NAV = (n: number) => `<nav class="post-page-nav"><a href="${ARTICLE}${n}/">Dalej »</a></nav>`

  /** A short link redirecting to a two-page article; Firecrawl drops the nav. */
  function makePagedFetch(pages: Record<string, { markdown: string; raw: string }>) {
    return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes('firecrawl.dev')) {
        const target = JSON.parse(String(init?.body)).url as string
        const page = pages[target] ?? pages['https://beltoc.com/s/x']
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              markdown: page.markdown,
              html: `<p>${page.markdown}</p>`,
              // A private address resolves to itself, so the guard is what stops it.
              metadata: { url: target.startsWith('http://169.254') ? undefined : ARTICLE },
            },
          }),
        })
      }
      if (url.includes('openai.com')) {
        return Promise.resolve({ ok: true, json: async () => ({ choices: [{ message: { content: VALID_RECIPE_JSON } }] }) })
      }
      const page = pages[url]
      return page
        ? Promise.resolve({ ok: true, text: async () => page.raw })
        : Promise.reject(new Error(`Unexpected fetch URL: ${url}`))
    })
  }

  it('reads the following pages and extracts from all of them', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })
    const page1 = { markdown: 'Babcine ciasteczka. Składniki: 350 g mąki, 150 g masła. '.repeat(5), raw: NAV(2) }
    const page2 = { markdown: 'Sposób przygotowania: wymieszaj i piecz 12 minut.', raw: `<nav><a href="${ARTICLE}">Wstecz</a></nav>` }
    const fetch = makePagedFetch({ 'https://beltoc.com/s/x': page1, [ARTICLE]: page1, [`${ARTICLE}2/`]: page2 })

    await runExtractRecipe({ ...BASE_EVENT, sharedUrl: 'https://beltoc.com/s/x' }, { fetch, supabase: mock.supabase as any })

    const extraction = fetch.mock.calls.find((c) => String(c[0]).includes('openai.com') && !isLabelingCall(c[1]))
    const prompt = JSON.parse(String(extraction?.[1]?.body)).messages[1].content as string
    expect(prompt).toContain('350 g mąki')
    expect(prompt).toContain('piecz 12 minut')
    expect(mock.didInsert('recipes')).toBe(true)
  })

  it('never fetches a private address for page detection, and never follows redirects', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })
    const page1 = { markdown: 'Strona 1 przepisu. '.repeat(20), raw: NAV(2) }
    const fetch = makePagedFetch({ 'https://beltoc.com/s/x': page1, [ARTICLE]: page1 })

    await runExtractRecipe({ ...BASE_EVENT, sharedUrl: 'http://169.254.169.254/latest/' }, { fetch, supabase: mock.supabase as any })
    const raw = fetch.mock.calls.filter((c) => !/firecrawl\.dev|openai\.com/.test(String(c[0])))
    expect(raw).toEqual([])

    // A public article is fetched, but without following redirects.
    const mock2 = makeSupabaseMock()
    mock2.queue('recipes', { data: { id: 8 }, error: null })
    await runExtractRecipe({ ...BASE_EVENT, sharedUrl: 'https://beltoc.com/s/x' }, { fetch, supabase: mock2.supabase as any })
    const publicRaw = fetch.mock.calls.filter((c) => !/firecrawl\.dev|openai\.com/.test(String(c[0])))
    expect(publicRaw.length).toBeGreaterThan(0)
    expect(publicRaw.every((c) => (c[1] as RequestInit | undefined)?.redirect === 'manual')).toBe(true)
  })

  it('stops after the cap of extra pages', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })
    const pages: Record<string, { markdown: string; raw: string }> = {
      [ARTICLE]: { markdown: 'Strona 1 przepisu. '.repeat(20), raw: NAV(2) },
    }
    // Every page links to the next one, forever.
    for (let n = 2; n <= 20; n++) pages[`${ARTICLE}${n}/`] = { markdown: `Strona ${n}.`, raw: NAV(n + 1) }
    const fetch = makePagedFetch({ ...pages, 'https://beltoc.com/s/x': pages[ARTICLE] })

    await runExtractRecipe({ ...BASE_EVENT, sharedUrl: ARTICLE }, { fetch, supabase: mock.supabase as any })

    const scrapedPages = fetch.mock.calls
      .filter((c) => String(c[0]).includes('firecrawl.dev'))
      .map((c) => JSON.parse(String(c[1]?.body)).url as string)
      .filter((u) => u.startsWith(ARTICLE) && /^\d+\/$/.test(u.slice(ARTICLE.length)))
    expect(scrapedPages).toEqual([2, 3, 4, 5].map((n) => `${ARTICLE}${n}/`))
  })
})

describe('runExtractRecipe — Risk 2: output gate', () => {
  it('throws before recipe insert when LLM returns empty ingredients and steps', async () => {
    const mock = makeSupabaseMock()
    const fetch = makeFetchMock({ openaiContent: JUNK_RECIPE_JSON })

    await expect(
      runExtractRecipe(BASE_EVENT, { fetch, supabase: mock.supabase as any })
    ).rejects.toThrow('no usable recipe')

    expect(mock.didInsert('recipes')).toBe(false)
  })

  it('throws before force-refresh update when LLM returns empty body', async () => {
    const mock = makeSupabaseMock()
    const fetch = makeFetchMock({ openaiContent: JUNK_RECIPE_JSON })

    await expect(
      runExtractRecipe({ ...BASE_EVENT, force: true }, { fetch, supabase: mock.supabase as any })
    ).rejects.toThrow('no usable recipe')

    // The force-refresh recipes.update must not have been called
    expect(mock.didUpdate('recipes')).toBe(false)
  })
})

describe('runExtractRecipe — URL collision gap-fill', () => {
  it('gap-fills youtube_id on URL collision and links share to existing recipe', async () => {
    const mock = makeSupabaseMock()
    // YouTube URL with a valid 11-char video ID (youtubeIdFromUrl requires exactly 11 chars)
    const videoId = 'dQw4w9WgXcQ'
    const event = { ...BASE_EVENT, sharedUrl: `https://www.youtube.com/watch?v=${videoId}`, sourceType: 'youtube' as const }

    // First insert hits the URL unique constraint
    mock.queue('recipes', {
      data: null,
      error: { message: 'duplicate key value violates unique constraint "recipes_user_source_url_uniq"' },
    })
    // Gap-fill select returns existing recipe with null youtube_id
    mock.queue('recipes', {
      data: {
        id: 99,
        prep_time_minutes: null,
        cook_time_minutes: null,
        total_time_minutes: null,
        image_url: null,
        youtube_id: null,
      },
      error: null,
    })

    const result = await runExtractRecipe(event, { fetch: makeFetchMock(), supabase: mock.supabase as any })

    expect(result.status).toBe('completed')
    expect(mock.didUpdate('recipes', { youtube_id: videoId })).toBe(true)
    expect(mock.didUpdate('recipe_shares', { status: 'completed' })).toBe(true)
  })
})

describe('runExtractRecipe — happy path', () => {
  it('inserts recipe and marks share completed', async () => {
    const mock = makeSupabaseMock()
    // No ogImage in metadata → archiveImage not called
    mock.queue('recipes', { data: { id: 42 }, error: null })

    const result = await runExtractRecipe(BASE_EVENT, { fetch: makeFetchMock(), supabase: mock.supabase as any })

    expect(result).toMatchObject({ recipeId: 42, status: 'completed' })
    expect(mock.didInsert('recipes')).toBe(true)
    expect(mock.didUpdate('recipe_shares', { status: 'completed' })).toBe(true)
  })

  it('stores the note and the tags, keeping only allowed ones and the title-named one', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 42 }, error: null })
    const openaiContent = JSON.stringify({
      ...JSON.parse(VALID_RECIPE_JSON),
      title: 'Kruche ciastka',
      description: 'z rowkami, na żółtkach.',
      tags: ['czekoladowe', 'wymyślony-tag', 'szybkie'],
      totalTimeMinutes: 90,
    })

    await runExtractRecipe(BASE_EVENT, { fetch: makeFetchMock({ openaiContent }), supabase: mock.supabase as any })

    expect(mock.insertArgs('recipes')).toMatchObject({
      title: 'Kruche ciastka',
      description: 'z rowkami, na żółtkach',
      tags: ['kruche', 'czekoladowe'],
    })
  })

  it("shows the LLM the user's existing recipes so the note can tell them apart", async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 42 }, error: null })
    const fetch = makeFetchMock()

    await runExtractRecipe(BASE_EVENT, { fetch, supabase: mock.supabase as any })

    const labelingCall = vi.mocked(fetch).mock.calls.find(([url, init]) => String(url).includes('openai.com') && isLabelingCall(init))
    const body = JSON.parse(String((labelingCall?.[1] as RequestInit).body))
    expect(body.messages[0].content).toContain("The user's existing recipes")
    expect(body.messages[0].content).toContain('sentence case')
  })
})

// Facebook reels/videos: the caption comes from the embedded-video plugin, not
// from Firecrawl (a logged-out scrape of the reel page returns og tags only).
const FB_EVENT = {
  ...BASE_EVENT,
  sharedUrl: 'https://www.facebook.com/share/r/1B4yZLSPVp/',
  sourceType: 'facebook_text' as const,
}

// The two shapes a caption-less plugin page comes in: the error card it shows
// when it will not embed the post at all, and a player over a post whose
// author simply wrote nothing.
const PLUGIN_REFUSED_HTML =
  '<html><body><div class="_3i0p">Nie można osadzić tego filmu</div></body></html>'
const PLUGIN_NO_TEXT_HTML = '<html><body><video src="reel.mp4"></video></body></html>'

const FB_CAPTION = 'Placki z twarogu\nSKŁADNIKI:\n250g twarogu, 3 łyżki mąki\nPRZYGOTOWANIE:\npiec 20 minut w 200 stopniach'

function makeFacebookFetchMock({
  caption = FB_CAPTION,
  ogDescription = '',
  embedRefused = false,
  ...base
}: {
  caption?: string | null
  ogDescription?: string
  /** With no caption: did the plugin show its error card, or a player over a
   *  post that simply carries no text? Defaults to the latter. */
  embedRefused?: boolean
  firecrawlMarkdown?: string
  firecrawlHtml?: string
} = {}) {
  const fallback = makeFetchMock({ firecrawlMarkdown: '', firecrawlHtml: '', ...base })
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes('/plugins/video.php')) {
      const body = caption != null
        ? `<html><body><div data-testid="post_message"><p>${caption.replace(/\n/g, '<br />')}</p></div></body></html>`
        : embedRefused
          ? PLUGIN_REFUSED_HTML
          : PLUGIN_NO_TEXT_HTML
      return Promise.resolve({ ok: true, status: 200, url, text: async () => body })
    }
    if (url.includes('facebook.com')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        url: 'https://www.facebook.com/reel/943809852095733/?rdid=abc',
        text: async () =>
          '<meta property="og:image" content="https://scontent.xx.fbcdn.net/thumb.jpg" />' +
          `<meta property="og:description" content="${ogDescription}" />`,
      })
    }
    return fallback(url, init)
  })
}

// A post inside a group: the video plugin refuses it, so the only caption text
// is the permalink's og:description — a teaser plus the author's blog link.
describe('runExtractRecipe — Facebook post linking out to a blog', () => {
  const BLOG_URL = 'https://kulinarnecuda.pl/ciasto-kruche-ze-sliwkami/'
  const TEASER = `Kruche ciasto ze śliwkami jest obłędne! Przepis: ${BLOG_URL}`

  it('scrapes the linked blog instead of giving up on the post', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 9 }, error: null })
    const fetch = makeFacebookFetchMock({
      caption: null,
      ogDescription: TEASER,
      firecrawlMarkdown: 'Ciasto kruche ze śliwkami. Składniki: mąka, masło. '.repeat(10),
    })

    const result = await runExtractRecipe(FB_EVENT, { fetch, supabase: mock.supabase as any })

    expect(result).toMatchObject({ recipeId: 9, status: 'completed' })

    const firecrawlBody = fetch.mock.calls
      .filter((c) => String(c[0]).includes('firecrawl.dev'))
      .map((c) => JSON.parse(String(c[1]?.body)))
    expect(firecrawlBody.length).toBeGreaterThan(0)
    expect(firecrawlBody.every((b) => b.url === BLOG_URL)).toBe(true)

    const openaiCall = fetch.mock.calls.find((c) => String(c[0]).includes('openai.com') && !isLabelingCall(c[1]))
    expect(JSON.parse(String(openaiCall?.[1]?.body)).messages[1].content).toContain('Ciasto kruche')
  })

  it('still stores the share under the Facebook URL the user sent', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 9 }, error: null })
    const fetch = makeFacebookFetchMock({
      caption: null,
      ogDescription: TEASER,
      firecrawlMarkdown: 'Ciasto kruche ze śliwkami. Składniki: mąka, masło. '.repeat(10),
    })

    await runExtractRecipe(FB_EVENT, { fetch, supabase: mock.supabase as any })

    const inserted = mock.supabase.from.mock.results
      .map((r) => r.value.insert.mock.calls[0]?.[0])
      .find((args) => args?.source_url)
    expect(inserted.source_url).toBe(FB_EVENT.sharedUrl)
    expect(inserted.source_type).toBe('facebook_text')
  })

  it('leaves a caption that carries the recipe on the caption path', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 9 }, error: null })
    // The plugin caption is a full recipe; the blog link at the end is a
    // "more on my blog" pointer, not the source of truth.
    const fetch = makeFacebookFetchMock({
      caption: `${FB_CAPTION} `.repeat(4) + 'Więcej na https://blog.example/',
    })

    await runExtractRecipe(FB_EVENT, { fetch, supabase: mock.supabase as any })

    expect(fetch.mock.calls.some((c) => String(c[0]).includes('firecrawl.dev'))).toBe(false)
  })
})

describe('runExtractRecipe — Facebook reel caption', () => {
  it('feeds the plugin caption to the LLM and skips Firecrawl entirely', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })
    const fetch = makeFacebookFetchMock()

    const result = await runExtractRecipe(FB_EVENT, { fetch, supabase: mock.supabase as any })

    expect(result).toMatchObject({ recipeId: 7, status: 'completed' })

    const urls = fetch.mock.calls.map((c) => String(c[0]))
    expect(urls.some((u) => u.includes('firecrawl.dev'))).toBe(false)

    const openaiCall = fetch.mock.calls.find((c) => String(c[0]).includes('openai.com') && !isLabelingCall(c[1]))
    expect(JSON.parse(String(openaiCall?.[1]?.body)).messages[1].content).toContain('250g twarogu')
  })

  it('sends the plugin the canonical reel URL, not the share link', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })
    const fetch = makeFacebookFetchMock()

    await runExtractRecipe(FB_EVENT, { fetch, supabase: mock.supabase as any })

    const pluginUrl = fetch.mock.calls.map((c) => String(c[0])).find((u) => u.includes('/plugins/video.php'))
    expect(pluginUrl).toContain(encodeURIComponent('https://www.facebook.com/reel/943809852095733/'))
  })

  it('blames the post, not Facebook, when it embedded fine and carries no text', async () => {
    const mock = makeSupabaseMock()
    const fetch = makeFacebookFetchMock({ caption: null })

    await expect(
      runExtractRecipe(FB_EVENT, { fetch, supabase: mock.supabase as any })
    ).rejects.toThrow('nie ma opisu z przepisem')

    // Firecrawl is not tried on facebook.com — its API 403s on the domain, so
    // the call would only mask the real reason with "Forbidden".
    expect(fetch.mock.calls.some((c) => String(c[0]).includes('firecrawl.dev'))).toBe(false)
    expect(mock.didInsert('recipes')).toBe(false)

    // The share carries the reason a reader can act on, not Firecrawl's 403.
    expect(
      mock.didUpdate('recipe_shares', {
        status: 'failed',
        error_message:
          'Ten post na Facebooku nie ma opisu z przepisem ani linku do niego (może być prywatny, usunięty albo przepis jest tylko w filmie)',
      }),
    ).toBe(true)
  })

  it('blames Facebook when the plugin refused to show the post at all', async () => {
    const mock = makeSupabaseMock()
    const fetch = makeFacebookFetchMock({ caption: null, embedRefused: true })

    await expect(
      runExtractRecipe(FB_EVENT, { fetch, supabase: mock.supabase as any })
    ).rejects.toThrow('Facebook nie udostępnia treści tego posta')

    // Never claims the post has no description — we never got to see it.
    expect(fetch.mock.calls.some((c) => String(c[0]).includes('firecrawl.dev'))).toBe(false)
    expect(mock.didInsert('recipes')).toBe(false)
  })

  it('asks the user to retry when the plugin page never came back', async () => {
    const mock = makeSupabaseMock()
    const base = makeFacebookFetchMock({ caption: null })
    const fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) =>
      String(url).includes('/plugins/video.php')
        ? Promise.resolve({ ok: false, status: 503, url, text: async () => '' })
        : base(url, init),
    )

    await expect(
      runExtractRecipe(FB_EVENT, { fetch, supabase: mock.supabase as any })
    ).rejects.toThrow('Nie udało się pobrać tego posta z Facebooka')
  })
})

describe('runExtractRecipe — Facebook short caption', () => {
  it('accepts a caption shorter than the junk-gate minimum', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 8 }, error: null })
    // 68 chars — a real but terse recipe, well under MIN_CONTENT_CHARS (150).
    const fetch = makeFacebookFetchMock({
      caption: 'Ciasto: 3 jajka, szklanka cukru, szklanka mąki. Piec 40 min w 180°C.',
    })

    const result = await runExtractRecipe(FB_EVENT, { fetch, supabase: mock.supabase as any })

    expect(result).toMatchObject({ recipeId: 8, status: 'completed' })
  })
})

describe('runExtractRecipe — recipe gallery', () => {
  const STEP_PHOTOS =
    '<img src="https://blog.example/a/ciasto-1080x1440.jpg"><img src="https://blog.example/a/krok-1080x1440.jpg">'

  function recipeUpdates(mock: ReturnType<typeof makeSupabaseMock>) {
    return mock.supabase.from.mock.results
      .flatMap((r) => r.value.update.mock.calls.map((c: unknown[]) => c[0]))
      .filter((args: Record<string, unknown>) => 'image_urls' in args)
  }

  it("archives the page's photos, cover first, and stores them", async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })
    const fetch = makeFetchMock({ firecrawlHtml: '<p>Przepis na ciasto.</p>'.repeat(20) + STEP_PHOTOS })

    await runExtractRecipe(BASE_EVENT, { fetch, supabase: mock.supabase as any })

    expect(archiveRecipeImages).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      7,
      'https://blog.example/a/ciasto-1080x1440.jpg',
      ['https://blog.example/a/ciasto-1080x1440.jpg', 'https://blog.example/a/krok-1080x1440.jpg'],
    )
    expect(recipeUpdates(mock)).toEqual([
      { image_urls: ['https://storage.example/u/7/0.jpg', 'https://storage.example/u/7/1.jpg'] },
    ])
  })

  it('leaves the gallery empty for a single photo', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })
    const fetch = makeFetchMock({
      firecrawlHtml: '<p>Przepis na ciasto.</p>'.repeat(20) + '<img src="https://blog.example/a/ciasto.jpg">',
    })

    await runExtractRecipe(BASE_EVENT, { fetch, supabase: mock.supabase as any })

    expect(archiveRecipeImages).toHaveBeenCalledWith(expect.anything(), 'user-1', 7, 'https://blog.example/a/ciasto.jpg', [])
    expect(recipeUpdates(mock)).toEqual([])
  })

  it('replaces the gallery on a refresh, emptying it when the photos are gone', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })

    await runExtractRecipe({ ...BASE_EVENT, force: true }, { fetch: makeFetchMock(), supabase: mock.supabase as any })

    // Called with no photos and clearStale, so the old files are cleared from Storage.
    expect(archiveRecipeImages).toHaveBeenCalledWith(expect.anything(), 'user-1', 7, undefined, [], { clearStale: true })
    expect(recipeUpdates(mock)).toEqual([{ image_urls: [] }])
  })

  it('keeps the stored gallery on a refresh when no photo archives', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })
    vi.mocked(archiveRecipeImages).mockResolvedValueOnce({ cover: null, gallery: null })
    const fetch = makeFetchMock({ firecrawlHtml: '<p>Przepis na ciasto.</p>'.repeat(20) + STEP_PHOTOS })

    await runExtractRecipe({ ...BASE_EVENT, force: true }, { fetch, supabase: mock.supabase as any })

    expect(recipeUpdates(mock)).toEqual([])
  })
})

describe('runExtractRecipe — Facebook thumbnail persistence', () => {
  const FB_THUMB = 'https://scontent.xx.fbcdn.net/thumb.jpg'

  function insertedImageUrl(mock: ReturnType<typeof makeSupabaseMock>) {
    const insert = mock.supabase.from.mock.results
      .map((r) => r.value.insert.mock.calls[0]?.[0])
      .find((args) => args?.source_url)
    return insert?.image_url
  }

  it('stores the archived copy when archiving succeeds', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })
    vi.mocked(archiveImage).mockResolvedValue('https://supabase.example/storage/v1/object/public/recipe-images/u/7.jpg')

    await runExtractRecipe(FB_EVENT, { fetch: makeFacebookFetchMock(), supabase: mock.supabase as any })

    expect(archiveImage).toHaveBeenCalledWith(expect.anything(), 'user-1', 7, FB_THUMB)
    expect(mock.didUpdate('recipes', { image_url: 'https://supabase.example/storage/v1/object/public/recipe-images/u/7.jpg' })).toBe(true)
  })

  it('never persists the signed fbcdn URL when archiving fails', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })

    await runExtractRecipe(FB_EVENT, { fetch: makeFacebookFetchMock(), supabase: mock.supabase as any })

    // Inserted with a null image (placeholder), not the expiring link…
    expect(insertedImageUrl(mock)).toBeNull()
    // …and no later update wrote it either.
    expect(mock.didUpdate('recipes', { image_url: FB_THUMB })).toBe(false)
  })

  it('keeps the existing cover when a refresh fails to re-archive it', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })

    await runExtractRecipe({ ...FB_EVENT, force: true }, { fetch: makeFacebookFetchMock(), supabase: mock.supabase as any })

    expect(archiveImage).toHaveBeenCalledWith(expect.anything(), 'user-1', 7, FB_THUMB)
    expect(mock.didUpdate('recipes', { image_url: null })).toBe(false)
    expect(mock.didUpdate('recipes', { image_url: FB_THUMB })).toBe(false)
  })

  it('replaces the cover when a refresh re-archives it', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })
    vi.mocked(archiveImage).mockResolvedValue('https://supabase.example/storage/v1/object/public/recipe-images/u/7.jpg')

    await runExtractRecipe({ ...FB_EVENT, force: true }, { fetch: makeFacebookFetchMock(), supabase: mock.supabase as any })

    expect(mock.didUpdate('recipes', { image_url: 'https://supabase.example/storage/v1/object/public/recipe-images/u/7.jpg' })).toBe(true)
  })

  it('keeps a stable blog og:image as the fallback when archiving fails', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })
    const fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('firecrawl.dev')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              markdown: 'Przepis na naleśniki. '.repeat(30),
              html: '<p>Przepis</p>'.repeat(20),
              metadata: { ogImage: 'https://blog.example/cover.jpg' },
            },
          }),
        })
      }
      return makeFetchMock()(url)
    })

    await runExtractRecipe(BASE_EVENT, { fetch, supabase: mock.supabase as any })

    expect(insertedImageUrl(mock)).toBe('https://blog.example/cover.jpg')
  })
})

// YouTube: the description is tried first; captions only when it yields no
// usable recipe. Firecrawl serves the watch page, Innertube the captions.
const YT_ID = 'TtK8ZUfOC40'
const YT_EVENT = {
  ...BASE_EVENT,
  sharedUrl: `https://www.youtube.com/watch?v=${YT_ID}`,
  sourceType: 'youtube' as const,
}
const CAPTION_XML =
  '<timedtext format="3"><body><p t="0" d="1">Trzy żółtka, pecorino, guanciale</p></body></timedtext>'

function makeYoutubeFetchMock({
  openaiContents,
  hasCaptions = true,
  ...base
}: {
  /** One OpenAI reply per call, in order. */
  openaiContents: string[]
  hasCaptions?: boolean
  firecrawlMarkdown?: string
  firecrawlHtml?: string
}) {
  const replies = [...openaiContents]
  const fallback = makeFetchMock(base)
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes('/youtubei/v1/player')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          playabilityStatus: { status: 'OK' },
          captions: {
            playerCaptionsTracklistRenderer: {
              captionTracks: hasCaptions
                ? [{ baseUrl: 'https://www.youtube.com/api/timedtext?v=x', languageCode: 'pl', kind: 'asr' }]
                : [],
            },
          },
        }),
      })
    }
    if (url.includes('/api/timedtext')) {
      return Promise.resolve({ ok: true, status: 200, text: async () => CAPTION_XML })
    }
    if (url.includes('openai.com') && isLabelingCall(init)) {
      return Promise.resolve({ ok: true, json: async () => ({ choices: [{ message: { content: '{}' } }] }) })
    }
    if (url.includes('openai.com')) {
      const content = replies.shift()
      if (content == null) return Promise.reject(new Error('OpenAI called more times than expected'))
      return Promise.resolve({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) })
    }
    return fallback(url, init)
  })
}

const openaiCalls = (fetch: ReturnType<typeof vi.fn>) =>
  fetch.mock.calls.filter(([url, init]) => String(url).includes('openai.com') && !isLabelingCall(init))
const transcriptCalls = (fetch: ReturnType<typeof vi.fn>) =>
  fetch.mock.calls.filter(([url]) => String(url).includes('/youtubei/v1/player'))
const promptOf = ([, init]: [string, RequestInit]) =>
  JSON.parse(String(init.body)).messages[1].content as string

describe('runExtractRecipe — YouTube transcript fallback', () => {
  it('never fetches captions when the description already carries the recipe', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })
    const fetch = makeYoutubeFetchMock({ openaiContents: [VALID_RECIPE_JSON] })

    await expect(runExtractRecipe(YT_EVENT, { fetch, supabase: mock.supabase as any })).resolves.toMatchObject({ recipeId: 7 })

    expect(transcriptCalls(fetch)).toHaveLength(0)
    expect(openaiCalls(fetch)).toHaveLength(1)
    expect(promptOf(openaiCalls(fetch)[0] as any)).not.toContain('Video transcript')
  })

  it('retries with the captions when the description yields no ingredients', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 8 }, error: null })
    const fetch = makeYoutubeFetchMock({ openaiContents: [JUNK_RECIPE_JSON, VALID_RECIPE_JSON] })

    await expect(runExtractRecipe(YT_EVENT, { fetch, supabase: mock.supabase as any })).resolves.toMatchObject({ recipeId: 8 })

    expect(transcriptCalls(fetch)).toHaveLength(1)
    const calls = openaiCalls(fetch)
    expect(calls).toHaveLength(2)
    expect(promptOf(calls[0] as any)).not.toContain('Video transcript')
    expect(promptOf(calls[1] as any)).toContain('Video transcript')
    expect(promptOf(calls[1] as any)).toContain('Trzy żółtka, pecorino, guanciale')
    expect(mock.didInsert('recipes')).toBe(true)
  })

  it('goes straight to the captions when the description is empty', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 9 }, error: null })
    const fetch = makeYoutubeFetchMock({
      openaiContents: [VALID_RECIPE_JSON],
      firecrawlMarkdown: '',
      firecrawlHtml: '',
    })

    await expect(runExtractRecipe(YT_EVENT, { fetch, supabase: mock.supabase as any })).resolves.toMatchObject({ recipeId: 9 })

    const calls = openaiCalls(fetch)
    expect(calls).toHaveLength(1)
    expect(promptOf(calls[0] as any)).toContain('Video transcript')
  })

  it('keeps the output-gate failure when there are no captions to fall back on', async () => {
    const mock = makeSupabaseMock()
    const fetch = makeYoutubeFetchMock({ openaiContents: [JUNK_RECIPE_JSON], hasCaptions: false })

    await expect(runExtractRecipe(YT_EVENT, { fetch, supabase: mock.supabase as any })).rejects.toThrow('no usable recipe')

    expect(openaiCalls(fetch)).toHaveLength(1)
    expect(mock.didInsert('recipes')).toBe(false)
  })

  it('reports an unreadable page when both the description and the captions are missing', async () => {
    const mock = makeSupabaseMock()
    const fetch = makeYoutubeFetchMock({
      openaiContents: [],
      hasCaptions: false,
      firecrawlMarkdown: '',
      firecrawlHtml: '',
    })

    await expect(runExtractRecipe(YT_EVENT, { fetch, supabase: mock.supabase as any })).rejects.toThrow('no readable recipe content')

    expect(openaiCalls(fetch)).toHaveLength(0)
    expect(mock.didInsert('recipes')).toBe(false)
  })
})
