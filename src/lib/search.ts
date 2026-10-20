import type { SupabaseClient } from '@supabase/supabase-js'
import { SEARCH_SCOPES, type SearchScope } from '@/lib/routes'
import { isRecipeCategory, type RecipeCategory } from '@/lib/recipe-categories'
import { categoryCounts, type CategoryCount } from '@/lib/public-profile'
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
  /** The "Kategoria" filter (`?kategoria=`, E01-S22); null = every category. */
  category: RecipeCategory | null
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

/**
 * The /szukaj URL params, made safe. A guest always searches everything: "Moje"
 * and "Ulubione" need a session, and a shared link must never bounce to login.
 */
export function parseSearchParams(
  raw: {
    q?: string | string[]
    zakres?: string | string[]
    strona?: string | string[]
    kategoria?: string | string[]
  },
  isAuthenticated: boolean,
): SearchParams {
  const q = first(raw.q).trim().slice(0, MAX_QUERY_LENGTH).trim()
  const zakres = first(raw.zakres)
  const scope: SearchScope =
    isAuthenticated && (SEARCH_SCOPES as readonly string[]).includes(zakres) ? (zakres as SearchScope) : 'wszystkie'
  const n = Number.parseInt(first(raw.strona), 10)
  const page = Number.isFinite(n) ? Math.min(Math.max(n, 1), SEARCH_MAX_PAGES) : 1
  const kategoria = first(raw.kategoria)
  return { q, scope, page, category: isRecipeCategory(kategoria) ? kategoria : null }
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

/** One option of the "Kategoria" filter: a category among the matches, with how many. */
export type SearchCategoryFacet = CategoryCount

export type SearchOutcome =
  | {
      rows: SearchResult[]
      /** Matches in the filtered list. */
      total: number
      /** Matches in every category: the "Wszystkie" option. */
      totalAll: number
      categories: SearchCategoryFacet[]
    }
  | { error: string }

/** Every row "Pokaż kolejne" can ever reach; also the RPC's own cap. */
const SEARCH_MAX_ROWS = SEARCH_MAX_PAGES * SEARCH_PAGE_SIZE

/**
 * The one recipe search (E01-S05): the search_recipes RPC matches every word
 * against the title and ingredient names, title hits first, then newest.
 *
 * It reads every reachable match (140, the paging cap) in one call, so the
 * "Kategoria" filter (E01-S22) can count the categories and narrow the list
 * without a second query or an RPC change. Returns the first `page` ×
 * SEARCH_PAGE_SIZE rows of the (filtered) list and its total: the RPC's exact
 * window count unfiltered, the count among those 140 when filtered.
 */
export async function searchRecipes(
  supabase: SupabaseClient,
  { q, scope, page, category }: SearchParams,
): Promise<SearchOutcome> {
  if (!q) return { rows: [], total: 0, totalAll: 0, categories: [] }
  const { data, error } = await supabase.rpc('search_recipes', {
    p_query: q,
    p_scope: RPC_SCOPE[scope],
    p_limit: SEARCH_MAX_ROWS,
  })
  if (error) {
    console.error('[search] search_recipes failed:', error.message)
    return { error: error.message }
  }
  const all = (data ?? []) as SearchRow[]
  const matching = category ? all.filter((r) => r.category === category) : all
  // Every row carries the same window count; it rides along unused on the rows.
  const totalAll = all.length ? Number(all[0].total_count) : 0
  return {
    rows: matching.slice(0, page * SEARCH_PAGE_SIZE),
    total: category ? matching.length : totalAll,
    totalAll,
    categories: categoryFacets(all),
  }
}

/** The categories among `rows`, most matches first, then the RECIPE_CATEGORIES order. */
export function categoryFacets(rows: readonly { category: string }[]): SearchCategoryFacet[] {
  return categoryCounts(rows).sort((a, b) => b.count - a.count) // stable: ties keep category order
}

/** Type-ahead on /szukaj (E01-S29): from 2 letters, at most 4 recipes. */
export const SUGGEST_MIN_LENGTH = 2
export const SUGGEST_LIMIT = 4

export interface RecipeSuggestion {
  slug: string
  title: string
  image_url: string | null
  category: string
}

/**
 * Up to SUGGEST_LIMIT recipes for a half-typed query, from the same public search
 * as the results (every recipe, title hits first). Empty below SUGGEST_MIN_LENGTH
 * letters or on any error: suggestions are a convenience, never a failure.
 */
export async function suggestRecipes(supabase: SupabaseClient, raw: string): Promise<RecipeSuggestion[]> {
  const q = raw.trim().slice(0, MAX_QUERY_LENGTH).trim()
  if (q.length < SUGGEST_MIN_LENGTH) return []
  const { data, error } = await supabase.rpc('search_recipes', { p_query: q, p_scope: 'all', p_limit: SUGGEST_LIMIT })
  if (error) {
    console.error('[search] suggestions failed:', error.message)
    return []
  }
  return ((data ?? []) as SearchRow[])
    .slice(0, SUGGEST_LIMIT)
    .map(({ slug, title, image_url, category }) => ({ slug, title, image_url, category }))
}

