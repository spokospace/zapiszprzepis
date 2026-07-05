'use server'

import { requireUser } from '@/lib/supabase/server'
import { getExaApiKey } from '@/lib/env'

export type ExaResult = {
  url: string
  title: string
  highlights?: string[]
  alreadySaved: boolean
}

export type ExaSearchResponse =
  | { results: ExaResult[] }
  | { error: string }

type ExaApiResult = {
  url: string
  title: string
  highlights?: string[]
}

type ExaApiResponse = {
  results: ExaApiResult[]
}

export async function searchViaExa(query: string): Promise<ExaSearchResponse> {
  try {
    const { supabase, user } = await requireUser()
    const userId = user.id

    if (!query.trim()) return { results: [] }

    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': getExaApiKey(),
      },
      body: JSON.stringify({
        query,
        numResults: 5,
        type: 'auto',
        // Without contents, Exa returns raw page text which is unparseable
        // as a recipe preview. 3 recipe-focused highlight sentences give users
        // enough context to pick the right result without loading the full page.
        contents: {
          highlights: { query: 'składniki i sposób przygotowania przepisu', numSentences: 3, highlightsPerUrl: 3 },
        },
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      console.error('[searchViaExa] Exa API error', res.status, text)
      return { error: 'exa_unavailable' }
    }

    const data: ExaApiResponse = await res.json()
    const rawResults = data.results ?? []
    const urls = rawResults.map((r) => r.url)

    if (urls.length === 0) return { results: [] }

    const { data: savedRows, error: savedRowsError } = await supabase
      .from('recipes')
      .select('source_url')
      .eq('user_id', userId)
      .in('source_url', urls)
    if (savedRowsError) console.error('[searchViaExa] savedRows query failed', savedRowsError)

    const savedUrls = new Set((savedRows ?? []).map((r) => r.source_url))

    const results: ExaResult[] = rawResults.map((r) => ({
      url: r.url,
      title: r.title,
      highlights: r.highlights,
      alreadySaved: savedUrls.has(r.url),
    }))

    return { results }
  } catch (err) {
    // Re-throw Next.js redirect/notFound signals — must not be swallowed.
    if (err && typeof err === 'object' && 'digest' in err) throw err
    console.error('[searchViaExa]', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { error: message }
  }
}
