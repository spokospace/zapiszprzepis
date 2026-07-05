import { describe, it, expect, vi } from 'vitest'
import { runExtractRecipe } from '@/inngest/run-extract-recipe'

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
