'use server'

import { requireUser } from '@/lib/supabase/server'
import { getExaApiKey } from '@/lib/env'
import { exaSearchAllowed } from '@/lib/exa-rate-limit'
import { TRUSTED_RECIPE_DOMAINS } from '@/lib/recipe-source-domains'
import { classifyExisting, findPublicRecipeBySourceUrl, findRecipeBySourceUrl } from '@/lib/recipe-dedup'
import { normalizeUrl } from '@/lib/url-normalize'
import type { SupabaseClient } from '@supabase/supabase-js'

/** The recipe a found link already is in the app: the user's own, or anyone else's (one recipe per link). */
export type ExistingRecipe = { owner: 'own' | 'other'; slug: string }

export type ExaResult = {
  url: string
  title: string
  highlights?: string[]
  existing: ExistingRecipe | null
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

/**
 * Whether a found link is already a recipe here, checked against every user's
 * recipes (global dedup, E01-S30) under the same normalized key the intake uses.
 * A failed lookup only loses the hint: the result still shows, and a save goes
 * through addRecipeFromUrl's own dedup.
 */
async function existingRecipe(supabase: SupabaseClient, userId: string, url: string): Promise<ExistingRecipe | null> {
  try {
    const key = normalizeUrl(url)
    const own = await findRecipeBySourceUrl(supabase, userId, key)
    const other = own ? null : await findPublicRecipeBySourceUrl(supabase, key)
    const owner = classifyExisting({ ownMatch: own != null, globalMatch: other != null })
    if (owner === 'own' && own) return { owner, slug: own.slug }
    if (owner === 'other' && other) return { owner, slug: other.slug }
    return null
  } catch (err) {
    console.error('[searchViaExa] existing-recipe lookup failed', err)
    return null
  }
}

/** A dish or ingredient name fits easily; a longer string is cut before the paid call. */
const MAX_QUERY_LENGTH = 200

export async function searchViaExa(rawQuery: string): Promise<ExaSearchResponse> {
  const query = String(rawQuery ?? '').slice(0, MAX_QUERY_LENGTH)
  try {
    const { supabase, user } = await requireUser()
    const userId = user.id

    if (!query.trim()) return { results: [] }

    // Any signed-in account may search (the results page fallback, owner decision
    // 2026-10-19); adding a result still needs full access (addRecipeFromUrl). Exa
    // is paid, so each account is capped per minute.
    if (!(await exaSearchAllowed(userId))) return { error: 'rate_limited' }

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
        includeDomains: TRUSTED_RECIPE_DOMAINS,
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

    const results: ExaResult[] = await Promise.all(
      rawResults.map(async (r) => ({
        url: r.url,
        title: r.title,
        highlights: r.highlights,
        existing: await existingRecipe(supabase, userId, r.url),
      })),
    )

    return { results }
  } catch (err) {
    // Re-throw Next.js redirect/notFound signals — must not be swallowed.
    if (err && typeof err === 'object' && 'digest' in err) throw err
    console.error('[searchViaExa]', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { error: message }
  }
}
