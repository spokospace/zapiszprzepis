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
    // Same contract as the real one, without the download: one Storage URL per
    // step that has a source, '' otherwise, [] when no step has one.
    archiveStepImages: vi.fn(async (supabase: unknown, userId: string, recipeId: number, sources: (string | null)[]) =>
      sources.some(Boolean) ? sources.map((s, i) => (s ? `https://storage.example/u/${recipeId}/step-${i}.jpg` : '')) : [],
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
  const maybeQueues: Record<string, Array<{ data: any; error: any }>> = {}
  const listQueues: Record<string, Array<{ data: any; error: any }>> = {}
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
    chain.like = vi.fn().mockReturnValue(chain)
    chain.ilike = vi.fn().mockReturnValue(chain)
    chain.single = vi.fn().mockImplementation(() => {
      const val = queues[table]?.shift() ?? { data: null, error: null }
      return Promise.resolve(val)
    })
    chain.maybeSingle = vi.fn().mockImplementation(() =>
      Promise.resolve(maybeQueues[table]?.shift() ?? { data: null, error: null }),
    )
    // Make chain awaitable for update().eq() calls without .single()
    chain.then = (resolve: any, reject: any) =>
      Promise.resolve(listQueues[table]?.shift() ?? { data: null, error: null }).then(resolve, reject)
    return chain
  }

  const rpcQueues: Record<string, Array<{ data: any; error: any }>> = {}
  const supabase = {
    from: vi.fn().mockImplementation((table: string) => makeChain(table)),
    // RPCs resolve directly (no chain). Default: an empty dish vocabulary.
    rpc: vi.fn().mockImplementation((fn: string) =>
      Promise.resolve(rpcQueues[fn]?.shift() ?? { data: [], error: null }),
    ),
  }

  return {
    supabase,
    /** Queue the next result for an RPC (e.g. 'dish_vocabulary'). */
    queueRpc(fn: string, result: { data: any; error: any }) {
      if (!rpcQueues[fn]) rpcQueues[fn] = []
      rpcQueues[fn].push(result)
    },
    /** Queue a .single() result for the next call on this table */
    queue(table: string, result: { data: any; error: any }) {
      if (!queues[table]) queues[table] = []
      queues[table].push(result)
    },
    /** Queue a .maybeSingle() result for the next lookup on this table */
    queueMaybe(table: string, result: { data: any; error: any }) {
      if (!maybeQueues[table]) maybeQueues[table] = []
      maybeQueues[table].push(result)
    },
    /** Queue the result of the next awaited (list) query on this table */
    queueList(table: string, result: { data: any; error: any }) {
      if (!listQueues[table]) listQueues[table] = []
      listQueues[table].push(result)
    },
    didInsert: (table: string) => calls.some(c => c.table === table && c.op === 'insert'),
    insertArgs: (table: string) => calls.find(c => c.table === table && c.op === 'insert')?.args,
    insertArgsAll: (table: string) => calls.filter(c => c.table === table && c.op === 'insert').map(c => c.args),
    updateArgs: (table: string) => calls.filter(c => c.table === table && c.op === 'update').map(c => c.args),
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
  firecrawlStatusCode,
  oembedOk = true,
}: {
  firecrawlMarkdown?: string
  firecrawlHtml?: string
  openaiContent?: string
  /** The scraped page's own HTTP status, as Firecrawl reports it. */
  firecrawlStatusCode?: number
  /** Whether YouTube oEmbed answers 200 — i.e. the video is public and
   *  embeddable (false simulates a private / removed / embedding-disabled one). */
  oembedOk?: boolean
} = {}) {
  return vi.fn().mockImplementation((url: string) => {
    if (url.includes('firecrawl.dev')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: { markdown: firecrawlMarkdown, html: firecrawlHtml, metadata: { statusCode: firecrawlStatusCode } },
        }),
      })
    }
    if (url.startsWith('https://www.youtube.com/oembed')) {
      return Promise.resolve(
        oembedOk
          ? { ok: true, status: 200, json: async () => ({ author_name: 'PALCE LIZAĆ' }) }
          : { ok: false, status: 403, json: async () => ({}) },
      )
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

describe('runExtractRecipe — Jina Reader fallback when Firecrawl fails', () => {
  const JINA_MARKDOWN = 'Składniki: 200 g mąki, 2 jajka, mleko. Sposób przygotowania: wymieszaj i smaż na patelni. '.repeat(10)

  // Firecrawl out of credits; Jina and the page itself answer unless told not to.
  function makeOutOfCreditsFetch({ jinaOk = true }: { jinaOk?: boolean } = {}) {
    return vi.fn().mockImplementation((url: string) => {
      if (url.includes('firecrawl.dev')) {
        return Promise.resolve({ ok: false, status: 402, statusText: '', json: async () => ({ success: false }) })
      }
      if (url.startsWith('https://r.jina.ai/')) {
        return Promise.resolve(
          jinaOk
            ? {
                ok: true,
                status: 200,
                json: async () => ({
                  data: {
                    title: 'Naleśniki',
                    url: BASE_EVENT.sharedUrl,
                    content: JINA_MARKDOWN,
                    httpStatus: 200,
                    metadata: { 'og:image': 'https://example.com/nalesniki.jpg' },
                  },
                }),
              }
            : { ok: false, status: 451, json: async () => ({}) },
        )
      }
      if (url.includes('openai.com')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ choices: [{ message: { content: VALID_RECIPE_JSON } }] }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, headers: new Headers(), text: async () => '<p>Naleśniki</p>' })
    })
  }

  it('extracts the recipe from Jina Reader when Firecrawl answers 402', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })
    const fetch = makeOutOfCreditsFetch()

    await runExtractRecipe(BASE_EVENT, { fetch, supabase: mock.supabase as any })

    const extraction = fetch.mock.calls.find((c) => String(c[0]).includes('openai.com') && !isLabelingCall(c[1]))
    expect(JSON.parse(String(extraction?.[1]?.body)).messages[1].content).toContain(`# Naleśniki\n\n${JINA_MARKDOWN.trim()}`)
    // Archive-first invariant: the row is inserted with a null cover, never the
    // external og:image — the archive step fills it with a Supabase URL after.
    expect(mock.insertArgs('recipes')?.image_url).toBeNull()
    // The main scrape, its retry and the embed scan share one Jina read.
    expect(fetch.mock.calls.filter((c) => String(c[0]).startsWith('https://r.jina.ai/'))).toHaveLength(1)
  })

  it("leads with Firecrawl's error and adds Jina's reason when Jina has nothing either", async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const mock = makeSupabaseMock()

    await expect(
      runExtractRecipe(BASE_EVENT, { fetch: makeOutOfCreditsFetch({ jinaOk: false }), supabase: mock.supabase as any }),
    ).rejects.toThrow(/^Firecrawl failed: HTTP 402; Jina Reader: HTTP 451$/)

    expect(mock.didInsert('recipes')).toBe(false)
    expect(mock.didUpdate('recipe_shares', { error_message: 'Firecrawl failed: HTTP 402; Jina Reader: HTTP 451' })).toBe(true)
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

  it('asks for steps as impersonal infinitive instructions, not the author narration', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })
    const fetch = makeFetchMock({ openaiContent: VALID_RECIPE_JSON })

    await runExtractRecipe(BASE_EVENT, { fetch, supabase: mock.supabase as any })

    const extraction = fetch.mock.calls.find((c) => String(c[0]).includes('openai.com') && !isLabelingCall(c[1]))
    const system = JSON.parse(String(extraction?.[1]?.body)).messages[0].content as string
    expect(system).toContain('Steps are short, plain instructions in Polish')
    expect(system).toContain('"Pokroić mięso w kostkę."')
    expect(system).toContain('"pokroiłam", "zeszkliłam"')
    expect(system).toContain('"Następnie", "Potem"')
  })

  it('asks for preparations before their use, no empty closing step and tips as an optional last step', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })
    const fetch = makeFetchMock({ openaiContent: VALID_RECIPE_JSON })

    await runExtractRecipe(BASE_EVENT, { fetch, supabase: mock.supabase as any })

    const extraction = fetch.mock.calls.find((c) => String(c[0]).includes('openai.com') && !isLabelingCall(c[1]))
    const system = JSON.parse(String(extraction?.[1]?.body)).messages[0].content as string
    expect(system).toContain('moves before that step')
    expect(system).toContain('"Smacznego!", "Gotowe."')
    expect(system).toContain('starts with "Opcjonalnie: "')
    expect(system).toContain('details stated outside the step list')
  })

  it('files sweet cupcakes and muffins under desserts, not cakes', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })
    const fetch = makeFetchMock({ openaiContent: VALID_RECIPE_JSON })

    await runExtractRecipe(BASE_EVENT, { fetch, supabase: mock.supabase as any })

    const extraction = fetch.mock.calls.find((c) => String(c[0]).includes('openai.com') && !isLabelingCall(c[1]))
    const system = JSON.parse(String(extraction?.[1]?.body)).messages[0].content as string
    const cakes = system.slice(system.indexOf('Cakes, tortes'), system.indexOf('Reserve "desery"'))
    expect(cakes).not.toContain('babeczki')
    expect(system).toContain('Reserve "desery" for non-cake sweets only: sweet muffins and cupcakes ("babeczki", "muffiny")')
    expect(system).toContain('"rogaliki", "faworki") are "ciasteczka"')
    expect(system).toContain('salads and slaws ("sałatka", "surówka", "coleslaw") are "salatki"')
  })

  it('asks for a title that names the dish, not a how-to question or praise', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })
    const fetch = makeFetchMock({ openaiContent: VALID_RECIPE_JSON })

    await runExtractRecipe(BASE_EVENT, { fetch, supabase: mock.supabase as any })

    const extraction = fetch.mock.calls.find((c) => String(c[0]).includes('openai.com') && !isLabelingCall(c[1]))
    const system = JSON.parse(String(extraction?.[1]?.body)).messages[0].content as string
    expect(system).toContain('("Jak zrobić domowe lody?" → "Domowe lody")')
    expect(system).toContain('no praise words ("najlepszy", "pyszny", "idealny")')
    expect(system).toContain('no first person ("moje", "mojej mamy")')
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

  it('still rejects a scraped page whose recipe has ingredients but no steps', async () => {
    const mock = makeSupabaseMock()
    const fetch = makeFetchMock({ openaiContent: JSON.stringify({ ...JSON.parse(VALID_RECIPE_JSON), steps: [] }) })

    await expect(runExtractRecipe(BASE_EVENT, { fetch, supabase: mock.supabase as any })).rejects.toThrow(
      'no usable recipe',
    )
    expect(mock.didInsert('recipes')).toBe(false)
  })
})

describe('runExtractRecipe — OpenAI error', () => {
  it('names the HTTP status and OpenAI\'s reason, even with an empty statusText', async () => {
    const mock = makeSupabaseMock()
    const base = makeFetchMock()
    const fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) =>
      String(url).includes('openai.com')
        ? Promise.resolve({
            ok: false,
            status: 429,
            statusText: '',
            json: async () => ({ error: { message: 'Rate limit reached for gpt-4o-mini' } }),
          })
        : base(url, init),
    )

    await expect(runExtractRecipe(BASE_EVENT, { fetch, supabase: mock.supabase as any })).rejects.toThrow(
      'OpenAI failed: HTTP 429 — Rate limit reached for gpt-4o-mini',
    )
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

describe('runExtractRecipe — global slug collision (E01-S03b)', () => {
  it('retries with a -2 suffix when the global unique(slug) index rejects the insert', async () => {
    const mock = makeSupabaseMock()
    // First insert loses the global slug race; the retry with a suffix succeeds.
    mock.queue('recipes', {
      data: null,
      error: { message: 'duplicate key value violates unique constraint "recipes_slug_uniq"' },
    })
    mock.queue('recipes', { data: { id: 7 }, error: null })

    const result = await runExtractRecipe(BASE_EVENT, { fetch: makeFetchMock(), supabase: mock.supabase as any })

    expect(result.status).toBe('completed')
    // The base slug, then the lowest free suffix — the backfill rule, at insert time.
    expect(mock.insertArgsAll('recipes').map((a) => a.slug)).toEqual(['nalesniki', 'nalesniki-2'])
    expect(mock.didUpdate('recipe_shares', { status: 'completed' })).toBe(true)
  })

  it('saves an 11th recipe with the same title under a random suffix (#371)', async () => {
    const mock = makeSupabaseMock()
    // nalesniki … nalesniki-10 are all taken.
    for (let i = 0; i < 10; i++) {
      mock.queue('recipes', {
        data: null,
        error: { message: 'duplicate key value violates unique constraint "recipes_slug_uniq"' },
      })
    }
    mock.queue('recipes', { data: { id: 11 }, error: null })

    const result = await runExtractRecipe(BASE_EVENT, { fetch: makeFetchMock(), supabase: mock.supabase as any })

    expect(result.status).toBe('completed')
    const slugs = mock.insertArgsAll('recipes').map((a) => a.slug)
    expect(slugs).toHaveLength(11)
    expect(slugs.slice(0, 10)).toEqual([
      'nalesniki', 'nalesniki-2', 'nalesniki-3', 'nalesniki-4', 'nalesniki-5',
      'nalesniki-6', 'nalesniki-7', 'nalesniki-8', 'nalesniki-9', 'nalesniki-10',
    ])
    expect(slugs[10]).toMatch(/^nalesniki-[a-z0-9]{8}$/)
    expect(mock.didUpdate('recipe_shares', { status: 'completed' })).toBe(true)
  })

  it('saves a recipe whose title has no Latin letters under a fallback slug (#371)', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 12 }, error: null })

    const result = await runExtractRecipe(BASE_EVENT, {
      fetch: makeFetchMock({ openaiContent: JSON.stringify({ ...JSON.parse(VALID_RECIPE_JSON), title: '🍰🍓' }) }),
      supabase: mock.supabase as any,
    })

    expect(result.status).toBe('completed')
    expect(mock.insertArgs('recipes')).toMatchObject({ slug: 'przepis' })
  })
})

describe('runExtractRecipe — estimated times', () => {
  const URL_COLLISION = {
    data: null,
    error: { message: 'duplicate key value violates unique constraint "recipes_user_source_url_uniq"' },
  }
  const withTimes = (extra: Record<string, unknown>) =>
    JSON.stringify({ ...JSON.parse(VALID_RECIPE_JSON), ...extra })

  it('flags the times when the LLM says it estimated them', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 42 }, error: null })

    await runExtractRecipe(BASE_EVENT, {
      fetch: makeFetchMock({ openaiContent: withTimes({ timesEstimated: true }) }),
      supabase: mock.supabase as any,
    })

    expect(mock.insertArgs('recipes')).toMatchObject({ times_estimated: true })
  })

  it('treats a missing flag as stated times', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 42 }, error: null })

    await runExtractRecipe(BASE_EVENT, { fetch: makeFetchMock(), supabase: mock.supabase as any })

    expect(mock.insertArgs('recipes')).toMatchObject({ times_estimated: false })
  })

  it('ignores the flag when there are no times to mark', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 42 }, error: null })
    const openaiContent = withTimes({
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      totalTimeMinutes: null,
      timesEstimated: true,
    })

    await runExtractRecipe(BASE_EVENT, { fetch: makeFetchMock({ openaiContent }), supabase: mock.supabase as any })

    expect(mock.insertArgs('recipes')).toMatchObject({ times_estimated: false })
  })

  it('rewrites the flag on a refresh', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 42 }, error: null })

    await runExtractRecipe(
      { ...BASE_EVENT, force: true },
      { fetch: makeFetchMock({ openaiContent: withTimes({ timesEstimated: true }) }), supabase: mock.supabase as any },
    )

    expect(mock.didUpdate('recipes', { prep_time_minutes: 10, times_estimated: true })).toBe(true)
  })

  it('flags the existing recipe when it gap-fills a time from an estimate', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', URL_COLLISION)
    mock.queue('recipes', {
      data: { id: 99, prep_time_minutes: 5, cook_time_minutes: 20, total_time_minutes: null, tags: [] },
      error: null,
    })

    await runExtractRecipe(BASE_EVENT, {
      fetch: makeFetchMock({ openaiContent: withTimes({ timesEstimated: true }) }),
      supabase: mock.supabase as any,
    })

    expect(mock.didUpdate('recipes', { total_time_minutes: 30, times_estimated: true })).toBe(true)
    expect(mock.updateArgs('recipes').some(a => 'prep_time_minutes' in a)).toBe(false)
  })

  it('leaves the existing flag alone when the estimate fills no time', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', URL_COLLISION)
    mock.queue('recipes', {
      data: { id: 99, prep_time_minutes: 5, cook_time_minutes: 20, total_time_minutes: 25, tags: [] },
      error: null,
    })

    await runExtractRecipe(BASE_EVENT, {
      fetch: makeFetchMock({ openaiContent: withTimes({ timesEstimated: true }) }),
      supabase: mock.supabase as any,
    })

    expect(mock.updateArgs('recipes').some(a => 'times_estimated' in a)).toBe(false)
  })

  it('leaves the existing flag alone when stated times fill the gaps', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', URL_COLLISION)
    mock.queue('recipes', {
      data: { id: 99, prep_time_minutes: null, cook_time_minutes: null, total_time_minutes: null, tags: [] },
      error: null,
    })

    await runExtractRecipe(BASE_EVENT, {
      fetch: makeFetchMock({ openaiContent: withTimes({ timesEstimated: false }) }),
      supabase: mock.supabase as any,
    })

    expect(mock.didUpdate('recipes', { total_time_minutes: 30 })).toBe(true)
    expect(mock.updateArgs('recipes').some(a => 'times_estimated' in a)).toBe(false)
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
  firecrawlStatusCode?: number
  openaiContent?: string
} = {}) {
  const fallback = makeFetchMock({ firecrawlMarkdown: '', firecrawlHtml: '', ...base })
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes('/plugins/video.php')) {
      // The plugin's header names the poster, linked to their Watch page.
      const body = caption != null
        ? `<html><body><a title="Kulinarna Wiola" target="_blank" href="/watch/100069645633702/?ref=embed_video">Kulinarna Wiola</a><div data-testid="post_message"><p>${caption.replace(/\n/g, '<br />')}</p></div></body></html>`
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

  it('stores the recipe under the Facebook post, not the blog it links to', async () => {
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
    // The share link resolved to the reel, so the recipe is keyed by the reel.
    expect(inserted.source_url).toBe('https://www.facebook.com/reel/943809852095733')
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

  it('falls back to the caption when the linked blog is gone', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 9 }, error: null })
    // The blog's host answers with its own "Website Unavailable" page — long
    // enough to pass for content, but a 404.
    const fetch = makeFacebookFetchMock({
      caption: `Makaroniki kokosowe\nSkładniki: 2 szklanki wiórków, 2 białka\nPełny przepis 👇 ${BLOG_URL}`,
      firecrawlMarkdown: '# Website Unavailable\nThe website you are trying to reach is unavailable. '.repeat(10),
      firecrawlStatusCode: 404,
    })

    await expect(runExtractRecipe(FB_EVENT, { fetch, supabase: mock.supabase as any })).resolves.toMatchObject({
      recipeId: 9,
    })

    const openaiCall = fetch.mock.calls.find((c) => String(c[0]).includes('openai.com') && !isLabelingCall(c[1]))
    const prompt = JSON.parse(String(openaiCall?.[1]?.body)).messages[1].content
    expect(prompt).toContain('2 szklanki wiórków')
    expect(prompt).not.toContain('Website Unavailable')
  })
})

describe('runExtractRecipe — the same YouTube video under another link', () => {
  const VIDEO = 'dQw4w9WgXcQ'
  const videoEvent = { ...BASE_EVENT, sharedUrl: `https://www.youtube.com/watch?v=${VIDEO}`, sourceType: 'youtube' as const }

  it('links a video share to the saved blog recipe that embeds it, before any LLM call', async () => {
    const mock = makeSupabaseMock()
    mock.queueMaybe('recipes', { data: { id: 298, slug: 'babeczki', title: 'Babeczki', category: 'desery', user_id: 'user-1' }, error: null })
    const fetch = makeFetchMock()

    const result = await runExtractRecipe(videoEvent, { fetch, supabase: mock.supabase as any })

    expect(result).toMatchObject({ recipeId: 298, status: 'duplicate' })
    expect(mock.didInsert('recipes')).toBe(false)
    expect(fetch.mock.calls.some((c) => String(c[0]).includes('openai.com'))).toBe(false)
  })

  it('extracts the video when no recipe carries its id', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 8 }, error: null })

    await runExtractRecipe(videoEvent, { fetch: makeFetchMock(), supabase: mock.supabase as any })

    expect(mock.insertArgs('recipes')).toMatchObject({ youtube_id: VIDEO })
  })

  it('keeps the stored video on a refresh that finds none', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })

    await runExtractRecipe({ ...BASE_EVENT, force: true }, { fetch: makeFetchMock(), supabase: mock.supabase as any })

    expect(mock.updateArgs('recipes')[0]).not.toHaveProperty('youtube_id')
  })
})

describe('runExtractRecipe — a video that will not embed', () => {
  const VIDEO = 'dQw4w9WgXcQ'
  const EMBED_HTML = `<iframe src="https://www.youtube.com/embed/${VIDEO}"></iframe>`

  it('publishes a blog recipe but drops the id when its embedded video is private', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 5 }, error: null })
    // The blog page embeds a video that oEmbed refuses (403 = private).
    const fetch = makeFetchMock({
      firecrawlMarkdown: 'Przepis na naleśniki. '.repeat(30),
      firecrawlHtml: `${EMBED_HTML}<p>Przepis na naleśniki.</p>`.repeat(5),
      oembedOk: false,
    })

    const result = await runExtractRecipe(BASE_EVENT, { fetch, supabase: mock.supabase as any })

    expect(result.status).toBe('completed')
    // The recipe is saved (it is a real blog recipe) — only the broken embed is dropped.
    expect(mock.insertArgs('recipes').youtube_id).toBeNull()
  })

  it('stores the same embed when the video is public', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 5 }, error: null })
    const fetch = makeFetchMock({
      firecrawlMarkdown: 'Przepis na naleśniki. '.repeat(30),
      firecrawlHtml: `${EMBED_HTML}<p>Przepis na naleśniki.</p>`.repeat(5),
      oembedOk: true,
    })

    await runExtractRecipe(BASE_EVENT, { fetch, supabase: mock.supabase as any })

    expect(mock.insertArgs('recipes')).toMatchObject({ youtube_id: VIDEO })
  })

  it('fails a private shared YouTube link with a clear message and never inserts', async () => {
    const mock = makeSupabaseMock()
    const event = { ...BASE_EVENT, sharedUrl: `https://www.youtube.com/watch?v=${VIDEO}`, sourceType: 'youtube' as const }
    // Private video: oEmbed 403, no description, and the player (transcript) is
    // unreachable — nothing to extract, nothing to embed.
    const fetch = makeFetchMock({ firecrawlMarkdown: '', firecrawlHtml: '', oembedOk: false })

    await expect(runExtractRecipe(event, { fetch, supabase: mock.supabase as any })).rejects.toThrow('prywatny')
    expect(mock.didInsert('recipes')).toBe(false)
  })
})

describe('runExtractRecipe — the same post text saved before', () => {
  it('links the share to the saved recipe before any LLM call', async () => {
    const mock = makeSupabaseMock()
    // First lookup: the resolved post URL (not saved); second: the caption's fingerprint.
    mock.queueMaybe('recipes', { data: null, error: null })
    mock.queueMaybe('recipes', { data: { id: 70, slug: 'placki', title: 'Placki', category: 'sniadania', user_id: 'user-1' }, error: null })
    const fetch = makeFacebookFetchMock()

    const result = await runExtractRecipe(FB_EVENT, { fetch, supabase: mock.supabase as any })

    expect(result).toMatchObject({ recipeId: 70, status: 'duplicate' })
    expect(mock.didInsert('recipes')).toBe(false)
    expect(fetch.mock.calls.some((c) => String(c[0]).includes('openai.com'))).toBe(false)
  })

  it('stores the caption fingerprint with a new recipe', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })

    await runExtractRecipe(FB_EVENT, { fetch: makeFacebookFetchMock(), supabase: mock.supabase as any })

    expect(mock.insertArgs('recipes').source_fingerprint).toMatch(/^[0-9a-f]{64}$/)
  })

  it('gives a rendered web page no fingerprint', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })

    await runExtractRecipe(BASE_EVENT, { fetch: makeFetchMock(), supabase: mock.supabase as any })

    expect(mock.insertArgs('recipes').source_fingerprint).toBeNull()
  })
})

describe('runExtractRecipe — source author', () => {
  it('stores a known author named in the plugin header in full', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })
    const event = { ...FB_EVENT, sharedUrl: 'https://www.facebook.com/100069645633702/videos/1784278505620096/' }

    await runExtractRecipe(event, { fetch: makeFacebookFetchMock(), supabase: mock.supabase as any })

    expect(mock.insertArgs('recipes').source_author).toBe('Kulinarna Wiola')
  })

  it("never stores an unknown poster's full name", async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })

    // The share link resolves to no known profile, so the name is a person's.
    await runExtractRecipe(FB_EVENT, { fetch: makeFacebookFetchMock(), supabase: mock.supabase as any })

    expect(mock.insertArgs('recipes').source_author).toBe('Kulinarna W.')
  })

  it('stores no author for a blog, which is named by its domain', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })

    await runExtractRecipe(BASE_EVENT, { fetch: makeFetchMock(), supabase: mock.supabase as any })

    expect(mock.insertArgs('recipes').source_author).toBeNull()
  })
})

describe('runExtractRecipe — the same recipe from another post', () => {
  const SAVED = { id: 70, slug: 'nalesniki', title: 'Naleśniki', category: 'sniadania', user_id: 'user-1' }

  it('links the share to the saved recipe when title and ingredients match', async () => {
    const mock = makeSupabaseMock()
    mock.queueList('recipes', {
      // Casing, spacing and amounts differ between two extractions of one recipe.
      data: [{ ...SAVED, ingredients: [{ name: ' mąka', amount: '1', unit: 'szkl.' }] }],
      error: null,
    })
    const fetch = makeFetchMock()

    const result = await runExtractRecipe(BASE_EVENT, { fetch, supabase: mock.supabase as any })

    expect(result).toMatchObject({ recipeId: 70, status: 'duplicate' })
    expect(mock.didInsert('recipes')).toBe(false)
    expect(mock.didUpdate('recipe_shares', { recipe_id: 70, status: 'completed' })).toBe(true)
  })

  it('saves a variant whose ingredients differ', async () => {
    const mock = makeSupabaseMock()
    mock.queueList('recipes', { data: [{ ...SAVED, ingredients: [{ name: 'mąka' }, { name: 'kefir' }] }], error: null })
    mock.queue('recipes', { data: { id: 71 }, error: null })
    const fetch = makeFetchMock()

    const result = await runExtractRecipe(BASE_EVENT, { fetch, supabase: mock.supabase as any })

    expect(result).toMatchObject({ recipeId: 71, status: 'completed' })
  })
})

describe('runExtractRecipe — Facebook share link to a saved post', () => {
  it('links the share to the saved recipe without extracting it again', async () => {
    const mock = makeSupabaseMock()
    mock.queueMaybe('recipes', { data: { id: 5, slug: 'placki', title: 'Placki', category: 'sniadania', user_id: 'user-1' }, error: null })
    const fetch = makeFacebookFetchMock()

    const result = await runExtractRecipe(FB_EVENT, { fetch, supabase: mock.supabase as any })

    expect(result).toMatchObject({ recipeId: 5, status: 'duplicate' })
    expect(mock.didInsert('recipes')).toBe(false)
    expect(mock.didUpdate('recipe_shares', { recipe_id: 5, status: 'completed' })).toBe(true)
    expect(fetch.mock.calls.some((c) => String(c[0]).includes('openai.com'))).toBe(false)
  })
})

describe('runExtractRecipe — a link someone else saved first (E01-S03a)', () => {
  const GLOBAL_URL_COLLISION = {
    data: null,
    error: { message: 'duplicate key value violates unique constraint "recipes_source_url_uniq"' },
  }
  const THEIRS = {
    id: 99,
    user_id: 'user-2',
    slug: 'nalesniki',
    title: 'Naleśniki',
    category: 'sniadania',
    prep_time_minutes: null,
    cook_time_minutes: null,
    total_time_minutes: null,
    image_url: null,
    youtube_id: null,
    source_author: null,
    description: null,
    tags: [],
  }

  it("favorites the other owner's recipe on a cross-owner insert conflict, never writing their row", async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', GLOBAL_URL_COLLISION)
    mock.queue('recipes', { data: THEIRS, error: null })

    const result = await runExtractRecipe(BASE_EVENT, { fetch: makeFetchMock(), supabase: mock.supabase as any })

    expect(result).toMatchObject({ recipeId: 99, status: 'favorited' })
    expect(mock.insertArgs('favorites')).toEqual({ user_id: 'user-1', recipe_id: 99 })
    expect(mock.didUpdate('recipe_shares', { recipe_id: 99, status: 'completed' })).toBe(true)
    // Their row is never gap-filled, and their images are never re-archived.
    expect(mock.didUpdate('recipes')).toBe(false)
    expect(archiveRecipeImages).not.toHaveBeenCalled()
  })

  it("still gap-fills the user's own recipe when the global index reports the conflict", async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', GLOBAL_URL_COLLISION)
    mock.queue('recipes', { data: { ...THEIRS, user_id: 'user-1' }, error: null })

    const result = await runExtractRecipe(BASE_EVENT, { fetch: makeFetchMock(), supabase: mock.supabase as any })

    expect(result).toMatchObject({ recipeId: 99, status: 'completed' })
    expect(mock.didUpdate('recipes', { prep_time_minutes: 10 })).toBe(true)
    expect(mock.didInsert('favorites')).toBe(false)
  })

  it('favorites the same recipe another user saved from a different post, without inserting a copy', async () => {
    const mock = makeSupabaseMock()
    mock.queueList('recipes', { data: [{ ...THEIRS, ingredients: [{ name: 'mąka' }] }], error: null })

    const result = await runExtractRecipe(BASE_EVENT, { fetch: makeFetchMock(), supabase: mock.supabase as any })

    expect(result).toMatchObject({ recipeId: 99, status: 'favorited' })
    expect(mock.didInsert('recipes')).toBe(false)
    expect(mock.insertArgs('favorites')).toEqual({ user_id: 'user-1', recipe_id: 99 })
  })

  it("prefers the user's own copy when several users saved the same recipe", async () => {
    const mock = makeSupabaseMock()
    mock.queueList('recipes', {
      data: [
        { ...THEIRS, ingredients: [{ name: 'mąka' }] },
        { ...THEIRS, id: 5, user_id: 'user-1', ingredients: [{ name: 'mąka' }] },
      ],
      error: null,
    })

    const result = await runExtractRecipe(BASE_EVENT, { fetch: makeFetchMock(), supabase: mock.supabase as any })

    expect(result).toMatchObject({ recipeId: 5, status: 'duplicate' })
    expect(mock.didInsert('favorites')).toBe(false)
  })

  it("favorites the same post text another user saved, before any LLM call", async () => {
    const mock = makeSupabaseMock()
    // First lookup: the resolved post URL (nobody has it); second: the caption's fingerprint.
    mock.queueMaybe('recipes', { data: null, error: null })
    mock.queueMaybe('recipes', { data: THEIRS, error: null })
    const fetch = makeFacebookFetchMock()

    const result = await runExtractRecipe(FB_EVENT, { fetch, supabase: mock.supabase as any })

    expect(result).toMatchObject({ recipeId: 99, status: 'favorited' })
    expect(mock.didInsert('recipes')).toBe(false)
    expect(fetch.mock.calls.some((c) => String(c[0]).includes('openai.com'))).toBe(false)
  })

  it('treats a favorite the user already has as done', async () => {
    const mock = makeSupabaseMock()
    mock.queueList('recipes', { data: [{ ...THEIRS, ingredients: [{ name: 'mąka' }] }], error: null })
    mock.queueList('favorites', { data: null, error: { code: '23505', message: 'duplicate key' } })

    const result = await runExtractRecipe(BASE_EVENT, { fetch: makeFetchMock(), supabase: mock.supabase as any })

    expect(result).toMatchObject({ recipeId: 99, status: 'favorited' })
  })

  it('fails the share, instead of reporting success, when the share cannot be completed', async () => {
    const mock = makeSupabaseMock()
    mock.queueList('recipes', { data: [{ ...THEIRS, ingredients: [{ name: 'mąka' }] }], error: null })
    mock.queueList('recipe_shares', { data: null, error: { message: 'connection reset' } })

    await expect(
      runExtractRecipe(BASE_EVENT, { fetch: makeFetchMock(), supabase: mock.supabase as any }),
    ).rejects.toThrow('Share update failed: connection reset')
    expect(mock.didUpdate('recipe_shares', { status: 'failed' })).toBe(true)
  })

  it('fails the share when the favorite cannot be saved', async () => {
    const mock = makeSupabaseMock()
    mock.queueList('recipes', { data: [{ ...THEIRS, ingredients: [{ name: 'mąka' }] }], error: null })
    mock.queueList('favorites', { data: null, error: { code: '42501', message: 'permission denied' } })

    await expect(
      runExtractRecipe(BASE_EVENT, { fetch: makeFetchMock(), supabase: mock.supabase as any }),
    ).rejects.toThrow('Favorite insert failed: permission denied')
    expect(mock.didUpdate('recipe_shares', { status: 'failed' })).toBe(true)
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

  it('saves an ingredient-only caption — the method is in the video', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 8 }, error: null })
    const fetch = makeFacebookFetchMock({
      caption: 'Deska wędlin 🧀\nIngredients\n- salami\n- mozzarella\n- olives',
      openaiContent: JSON.stringify({ ...JSON.parse(VALID_RECIPE_JSON), steps: null }),
    })

    await expect(runExtractRecipe(FB_EVENT, { fetch, supabase: mock.supabase as any })).resolves.toMatchObject({
      recipeId: 8,
    })

    const inserted = mock.supabase.from.mock.results
      .map((r) => r.value.insert.mock.calls[0]?.[0])
      .find((args) => args?.source_url)
    expect(inserted.steps).toEqual([])
  })

  it('says in Polish that the caption holds no recipe when it is only a video teaser', async () => {
    const mock = makeSupabaseMock()
    const fetch = makeFacebookFetchMock({
      caption: 'Puff it up! 9 folds to make impressive puff pastry treats!',
      openaiContent: JSON.stringify({ ...JSON.parse(VALID_RECIPE_JSON), ingredients: [], steps: [] }),
    })

    await expect(runExtractRecipe(FB_EVENT, { fetch, supabase: mock.supabase as any })).rejects.toThrow(
      'Opis tego posta na Facebooku nie zawiera przepisu',
    )
    expect(mock.didInsert('recipes')).toBe(false)
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

  it('stores per-step photos on a refresh, as on insert', async () => {
    // "Odśwież przepis" used to archive the cover and gallery only, so an
    // existing recipe could never gain step photos from a better extraction.
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })
    const openaiContent = JSON.stringify({
      ...JSON.parse(VALID_RECIPE_JSON),
      steps: [
        { text: 'Wymieszaj składniki', image: 'https://blog.example/a/krok-1080x1440.jpg' },
        { text: 'Smaż na patelni', image: null },
      ],
    })
    const fetch = makeFetchMock({ firecrawlHtml: '<p>Przepis na ciasto.</p>'.repeat(20) + STEP_PHOTOS, openaiContent })

    await runExtractRecipe({ ...BASE_EVENT, force: true }, { fetch, supabase: mock.supabase as any })

    expect(recipeUpdates(mock)).toEqual([
      expect.objectContaining({ step_images: ['https://storage.example/u/7/step-0.jpg', ''] }),
    ])
  })

  it('keeps the stored step photos on a refresh that finds none', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 7 }, error: null })

    await runExtractRecipe({ ...BASE_EVENT, force: true }, { fetch: makeFetchMock(), supabase: mock.supabase as any })

    expect(recipeUpdates(mock)[0]).not.toHaveProperty('step_images')
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

describe('runExtractRecipe — cover persistence (archive-first invariant)', () => {
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

  it('never persists a blog og:image either — the invariant keeps image_url Supabase-or-null', async () => {
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

    // Archiving fails here (no archive mock), so image_url stays null rather than
    // falling back to the external og:image — no external URL reaches the page.
    expect(insertedImageUrl(mock)).toBeNull()
    expect(mock.didUpdate('recipes', { image_url: 'https://blog.example/cover.jpg' })).toBe(false)
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
    if (url.startsWith('https://www.youtube.com/oembed')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ author_name: 'PALCE LIZAĆ' }) })
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
    expect(mock.insertArgs('recipes').source_author).toBe('PALCE LIZAĆ')

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

  // A channel often lists only the ingredients and shows the method on
  // screen; with no usable captions (music only, or auto captions in another
  // language) the ingredient list is all there is, and the page embeds the video.
  const INGREDIENTS_ONLY_JSON = JSON.stringify({ ...JSON.parse(VALID_RECIPE_JSON), steps: [] })

  it('saves the description ingredients when the video has no captions', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 10 }, error: null })
    const fetch = makeYoutubeFetchMock({ openaiContents: [INGREDIENTS_ONLY_JSON], hasCaptions: false })

    await expect(runExtractRecipe(YT_EVENT, { fetch, supabase: mock.supabase as any })).resolves.toMatchObject({ recipeId: 10 })

    expect(transcriptCalls(fetch)).toHaveLength(1)
    expect(mock.insertArgs('recipes')).toMatchObject({ steps: [] })
  })

  it('keeps the description ingredients when the captions yield nothing', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 11 }, error: null })
    const fetch = makeYoutubeFetchMock({ openaiContents: [INGREDIENTS_ONLY_JSON, JUNK_RECIPE_JSON] })

    await expect(runExtractRecipe(YT_EVENT, { fetch, supabase: mock.supabase as any })).resolves.toMatchObject({ recipeId: 11 })

    expect(openaiCalls(fetch)).toHaveLength(2)
    expect(mock.insertArgs('recipes')?.ingredients).toHaveLength(1)
  })

  it('prefers the captions when they add the steps the description lacks', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 12 }, error: null })
    const fetch = makeYoutubeFetchMock({ openaiContents: [INGREDIENTS_ONLY_JSON, VALID_RECIPE_JSON] })

    await expect(runExtractRecipe(YT_EVENT, { fetch, supabase: mock.supabase as any })).resolves.toMatchObject({ recipeId: 12 })

    expect(mock.insertArgs('recipes')?.steps).toHaveLength(2)
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

describe('runExtractRecipe — servings', () => {
  const withServings = (servings: unknown) => JSON.stringify({ ...JSON.parse(VALID_RECIPE_JSON), servings })
  const ldHtml = (recipeYield: unknown) =>
    `<script type="application/ld+json">${JSON.stringify({ '@type': 'Recipe', recipeYield })}</script>` +
    '<p>Przepis na naleśniki.</p>'.repeat(20)

  it('stores the servings the LLM read from the text', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 42 }, error: null })

    await runExtractRecipe(BASE_EVENT, {
      fetch: makeFetchMock({ openaiContent: withServings(4) }),
      supabase: mock.supabase as any,
    })

    expect(mock.insertArgs('recipes')).toMatchObject({ servings: 4 })
  })

  it('prefers the JSON-LD recipeYield over the LLM', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 42 }, error: null })

    await runExtractRecipe(BASE_EVENT, {
      fetch: makeFetchMock({ firecrawlHtml: ldHtml(['6', '6 porcji']), openaiContent: withServings(4) }),
      supabase: mock.supabase as any,
    })

    expect(mock.insertArgs('recipes')).toMatchObject({ servings: 6 })
  })

  it('stores null when neither states servings, and drops an out-of-range answer', async () => {
    for (const servings of [undefined, null, 0, 150, 'kilka']) {
      const mock = makeSupabaseMock()
      mock.queue('recipes', { data: { id: 42 }, error: null })

      await runExtractRecipe(BASE_EVENT, {
        fetch: makeFetchMock({ openaiContent: withServings(servings) }),
        supabase: mock.supabase as any,
      })

      expect(mock.insertArgs('recipes')).toMatchObject({ servings: null })
    }
  })
})

describe('runExtractRecipe — share update errors are not ignored (#382)', () => {
  it('fails the share, instead of reporting success, when marking a new recipe completed fails', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 42 }, error: null })
    mock.queueList('recipe_shares', { data: null, error: { message: 'connection reset' } })

    await expect(
      runExtractRecipe(BASE_EVENT, { fetch: makeFetchMock(), supabase: mock.supabase as any }),
    ).rejects.toThrow('Share update failed: connection reset')
    expect(mock.didUpdate('recipe_shares', { status: 'failed' })).toBe(true)
  })
})

describe('runExtractRecipe — malformed model output (#381)', () => {
  const withFields = (fields: Record<string, unknown>) => JSON.stringify({ ...JSON.parse(VALID_RECIPE_JSON), ...fields })

  it('saves the recipe without a nameless ingredient instead of crashing the dedup', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 42 }, error: null })
    const ingredients = [{ amount: '2', unit: 'szt.' }, { name: '  ' }, { name: 'Mąka', amount: 200, unit: 'g' }]

    await runExtractRecipe(BASE_EVENT, {
      fetch: makeFetchMock({ openaiContent: withFields({ ingredients }) }),
      supabase: mock.supabase as any,
    })

    expect(mock.insertArgs('recipes')).toMatchObject({
      ingredients: [{ name: 'Mąka', amount: '200', unit: 'g', section: '' }],
    })
    expect(mock.didUpdate('recipe_shares', { status: 'completed' })).toBe(true)
  })

  it('stores null for a time the int column cannot take, and keeps a whole-number string', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 42 }, error: null })

    await runExtractRecipe(BASE_EVENT, {
      fetch: makeFetchMock({ openaiContent: withFields({ prepTimeMinutes: '15-20', cookTimeMinutes: 37.5, totalTimeMinutes: '45' }) }),
      supabase: mock.supabase as any,
    })

    expect(mock.insertArgs('recipes')).toMatchObject({
      prep_time_minutes: null,
      cook_time_minutes: null,
      total_time_minutes: 45,
    })
  })

  it('fails with the no-usable-recipe reason, and saves nothing, when no ingredient has a name', async () => {
    const mock = makeSupabaseMock()

    await expect(
      runExtractRecipe(BASE_EVENT, {
        fetch: makeFetchMock({ openaiContent: withFields({ ingredients: [{ amount: '2' }, 'mąka', null] }) }),
        supabase: mock.supabase as any,
      }),
    ).rejects.toThrow('no usable recipe')
    expect(mock.didInsert('recipes')).toBe(false)
    expect(mock.didUpdate('recipe_shares', { status: 'failed' })).toBe(true)
  })
})

describe('runExtractRecipe — dish classification (E01-S21)', () => {
  // Routes the two gpt-4.1 calls (labelling vs dish) and the extraction call by
  // the request body, so the dish classifier gets a dish answer.
  function makeDishFetchMock({
    dishContent = JSON.stringify({ dish: 'Naleśniki', dishAccusative: 'naleśniki', confidence: 'high' }),
    noteContent = JSON.stringify({ variantNote: 'Na maślance' }),
    dishOk = true,
  }: { dishContent?: string; noteContent?: string; dishOk?: boolean } = {}) {
    return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes('firecrawl.dev')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { markdown: 'Przepis na naleśniki. '.repeat(30), html: '<p>x</p>' } }),
        })
      }
      if (url.includes('openai.com')) {
        const body = JSON.parse(String(init?.body))
        const sys = String(body.messages?.[0]?.content ?? '')
        if (body.model === 'gpt-4o-mini') {
          return Promise.resolve({ ok: true, json: async () => ({ choices: [{ message: { content: VALID_RECIPE_JSON } }] }) })
        }
        if (sys.includes('DISH grouping key')) {
          return Promise.resolve({ ok: dishOk, status: dishOk ? 200 : 500, json: async () => ({ choices: [{ message: { content: dishContent } }] }) })
        }
        if (sys.includes('VARIANT NOTE')) {
          return Promise.resolve({ ok: true, json: async () => ({ choices: [{ message: { content: noteContent } }] }) })
        }
        // Labelling call.
        return Promise.resolve({
          ok: true,
          json: async () => ({ choices: [{ message: { content: JSON.stringify({ title: 'Naleśniki', description: null, metaDescription: null, tags: [] }) } }] }),
        })
      }
      return Promise.reject(new Error(`Unexpected fetch URL: ${url}`))
    })
  }

  it('writes the four dish columns on insert when classification succeeds', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 42 }, error: null })

    await runExtractRecipe(BASE_EVENT, { fetch: makeDishFetchMock(), supabase: mock.supabase as any })

    const args = mock.insertArgs('recipes')
    expect(args.dish).toBe('naleśniki')
    expect(args.dish_accusative).toBe('naleśniki')
    expect(args.variant_note).toBe('Na maślance')
    expect(typeof args.dish_classified_at).toBe('string')
  })

  it('reuses an existing vocabulary name and reads the vocabulary RPC', async () => {
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 42 }, error: null })
    mock.queueRpc('dish_vocabulary', { data: [{ dish: 'naleśniki', dish_accusative: 'naleśniki', recipes: 3 }], error: null })

    await runExtractRecipe(BASE_EVENT, { fetch: makeDishFetchMock(), supabase: mock.supabase as any })

    expect(mock.supabase.rpc).toHaveBeenCalledWith('dish_vocabulary')
    expect(mock.insertArgs('recipes').dish).toBe('naleśniki')
  })

  it('leaves the dish columns unset when the classification call fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const mock = makeSupabaseMock()
    mock.queue('recipes', { data: { id: 42 }, error: null })

    await runExtractRecipe(BASE_EVENT, { fetch: makeDishFetchMock({ dishOk: false }), supabase: mock.supabase as any })

    const args = mock.insertArgs('recipes')
    expect('dish' in args).toBe(false)
    expect('dish_classified_at' in args).toBe(false)
  })

  it('does not overwrite the dish on a refresh of an already-classified row', async () => {
    const mock = makeSupabaseMock()
    // The dish_classified_at pre-read: this row was classified before.
    mock.queueMaybe('recipes', { data: { dish_classified_at: '2026-10-17T00:00:00Z' }, error: null })
    mock.queue('recipes', { data: { id: 42 }, error: null })

    await runExtractRecipe({ ...BASE_EVENT, force: true }, { fetch: makeDishFetchMock(), supabase: mock.supabase as any })

    // The refresh update must carry none of the dish columns.
    const updates = mock.updateArgs('recipes')
    expect(updates.some((a) => 'dish' in a || 'dish_classified_at' in a)).toBe(false)
  })

  it('writes the dish on a refresh when the row was never classified', async () => {
    const mock = makeSupabaseMock()
    mock.queueMaybe('recipes', { data: { dish_classified_at: null }, error: null })
    mock.queue('recipes', { data: { id: 42 }, error: null })

    await runExtractRecipe({ ...BASE_EVENT, force: true }, { fetch: makeDishFetchMock(), supabase: mock.supabase as any })

    expect(mock.didUpdate('recipes', { dish: 'naleśniki' })).toBe(true)
  })
})
