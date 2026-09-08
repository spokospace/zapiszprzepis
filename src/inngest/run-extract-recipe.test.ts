import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runExtractRecipe } from '@/inngest/run-extract-recipe'
import { archiveImage } from '@/lib/recipe-image-archive'

// archiveImage uses the global fetch, not the injected one, so it must be
// stubbed or a test with an og:image goes out to the network. Default: the
// archive fails, which is the branch where image_url persistence matters.
vi.mock('@/lib/recipe-image-archive', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/recipe-image-archive')>()),
  archiveImage: vi.fn().mockResolvedValue(null),
}))

beforeEach(() => {
  vi.mocked(archiveImage).mockResolvedValue(null)
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

    const openaiCall = fetch.mock.calls.find((c) => String(c[0]).includes('openai.com'))
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

    const openaiCall = fetch.mock.calls.find((c) => String(c[0]).includes('openai.com'))
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
