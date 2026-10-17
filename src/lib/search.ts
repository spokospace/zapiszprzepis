import type { SupabaseClient } from '@supabase/supabase-js'
import { recipesNoun } from '@/app/components/app-menu-model'
import { SEARCH_SCOPES, type SearchScope } from '@/lib/routes'
import type { Database } from '@/lib/supabase.types'

/** Results per "Pokaż kolejne" step (E01-S05: „Pokaż kolejne 14”). */
export const SEARCH_PAGE_SIZE = 14

/** How many steps of SEARCH_PAGE_SIZE a URL may ask for; the RPC caps the rows at 140 too. */
export const SEARCH_MAX_PAGES = 10

/** Longer queries are cut; the RPC itself keeps at most 5 words of 50 chars. */
const MAX_QUERY_LENGTH = 100

export interface SearchParams {
  q: string
  scope: SearchScope
  page: number
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

/**
 * The /szukaj URL params, made safe. A guest always searches everything: "Moje"
 * and "Ulubione" need a session, and a shared link must never bounce to login.
 */
export function parseSearchParams(
  raw: { q?: string | string[]; zakres?: string | string[]; strona?: string | string[] },
  isAuthenticated: boolean,
): SearchParams {
  const q = first(raw.q).trim().slice(0, MAX_QUERY_LENGTH).trim()
  const zakres = first(raw.zakres)
  const scope: SearchScope =
    isAuthenticated && (SEARCH_SCOPES as readonly string[]).includes(zakres) ? (zakres as SearchScope) : 'wszystkie'
  const n = Number.parseInt(first(raw.strona), 10)
  const page = Number.isFinite(n) ? Math.min(Math.max(n, 1), SEARCH_MAX_PAGES) : 1
  return { q, scope, page }
}

/** „5 przepisów dla „zupa””. */
export function searchResultsLabel(count: number, q: string): string {
  return `${count} ${recipesNoun(count)} dla „${q}”`
}

/** A regular web search for the "Szukaj „q” w internecie" fallback (no full access). */
export function webSearchUrl(q: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`przepis ${q}`)}`
}

const RPC_SCOPE: Record<SearchScope, 'all' | 'mine' | 'fav'> = {
  wszystkie: 'all',
  moje: 'mine',
  ulubione: 'fav',
}

export interface SearchResult {
  id: number
  slug: string
  title: string
  image_url: string | null
  category: Database['public']['Enums']['recipe_category']
  description: string | null
  source_type: Database['public']['Enums']['recipe_source']
  source_url: string | null
  source_author: string | null
  total_time_minutes: number | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
}

type SearchRow = SearchResult & { total_count: number }

export type SearchOutcome = { rows: SearchResult[]; total: number } | { error: string }

/**
 * The one recipe search (E01-S05): the search_recipes RPC matches every word
 * against the title and ingredient names, title hits first, then newest.
 * Returns the first `page` × SEARCH_PAGE_SIZE rows and the total match count.
 */
export async function searchRecipes(supabase: SupabaseClient, { q, scope, page }: SearchParams): Promise<SearchOutcome> {
  if (!q) return { rows: [], total: 0 }
  const { data, error } = await supabase.rpc('search_recipes', {
    p_query: q,
    p_scope: RPC_SCOPE[scope],
    p_limit: page * SEARCH_PAGE_SIZE,
  })
  if (error) {
    console.error('[search] search_recipes failed:', error.message)
    return { error: error.message }
  }
  const rows = (data ?? []) as SearchRow[]
  // Every row carries the same window count; it rides along unused on the rows.
  return { rows, total: rows.length ? Number(rows[0].total_count) : 0 }
}

/** "Kategoria · czas" under a result title; the time is left out when unknown. */
export function recipeTime(row: Pick<SearchResult, 'total_time_minutes' | 'prep_time_minutes' | 'cook_time_minutes'>): number | null {
  if (row.total_time_minutes) return row.total_time_minutes
  const sum = (row.prep_time_minutes ?? 0) + (row.cook_time_minutes ?? 0)
  return sum > 0 ? sum : null
}
