import 'server-only'
import { unstable_cache, revalidateTag } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAnonClient } from '@/lib/supabase/anon'
import { MY_RECIPE_CARD_COLUMNS, type MyRecipeCard } from '@/lib/my-recipes'
import { rankSimilar, type TagCount } from '@/lib/category-tags'
import { whereInCategory } from '@/lib/category-membership'
import { dailyRecipeIndex, warsawDayKey } from '@/lib/recipe-of-the-day'
import type { RecipeSource } from '@/lib/recipe-source'
import type { Database } from '@/lib/supabase.types'

type Recipe = Database['public']['Tables']['recipes']['Row']

/** A row of the guest-safe public_recipes view: no user_id, no gallery, plus the author. */
export type PublicRecipe = Omit<Recipe, 'user_id' | 'image_urls' | 'source_fingerprint' | 'extracted_at' | 'updated_at'> & {
  author_name: string | null
  /** Optional until the E01-S07 view migration is applied; the page degrades without them. */
  author_username?: string | null
  gallery_count?: number | null
  /** Optional until the E01-S21 view migration (#296); the versions feature stays hidden without them. */
  dish?: string | null
  dish_accusative?: string | null
  variant_note?: string | null
  /** coalesce(updated_at, created_at) for sitemap <lastmod>; optional until the Phase-1 view migration (#363). */
  last_modified?: string | null
  /** Per-step archived image URLs, index-aligned with `steps`; optional until the step-images column/view migration. */
  step_images?: string[] | null
  /** Further category lists the dish is in (#689); optional until the extra-categories view migration. */
  extra_categories?: string[] | null
}

/** The one card shape the category list renders (#444): only what a `RecipeCard` shows + its tags. */
const CATEGORY_CARD_COLUMNS =
  'id, slug, title, image_url, category, source_type, source_url, source_author, tags, total_time_minutes, prep_time_minutes, cook_time_minutes'

/** A card of the "Podobne" row on the recipe page. */
export interface SimilarCard {
  id: number
  slug: string
  title: string
  image_url: string | null
  category: string
  description: string | null
  source_type: RecipeSource
  source_url: string | null
  source_author: string | null
  tags: string[] | null
}

/** What the "Podobne" ranking reads from the recipe it is shown on. */
type SimilarSource = { id: number; category: string; tags: readonly string[]; dish?: string | null }

/** A pool row: a card plus the dish, so the recipe's other versions can be left out. */
type SimilarPoolRow = SimilarCard & { dish: string | null }

const SIMILAR_POOL_COLUMNS = 'id, slug, title, image_url, category, description, source_type, source_url, source_author, tags, dish'
/** Enough tag-sharing candidates to rank. */
const SIMILAR_CANDIDATES = 50
/** PostgREST's row cap; a category holds a few hundred at most. */
const SIMILAR_POOL_LIMIT = 1000

/**
 * Lists share one tag, so a single `revalidateRecipeCaches()` clears the category
 * listings, the home feed and the recipe-of-the-day pick. A recipe has a tag of its
 * own and not the list tag, so an import does not purge every recipe. Every write
 * invalidates by tag, so the TTL only bounds a purge that failed or a write made
 * outside the app, such as a backfill script.
 */
export const RECIPES_LIST_TAG = 'recipes:list'
export const recipeTag = (slug: string) => `recipe:${slug}`
const REVALIDATE_SECONDS = 3600

/** Throw (so `unstable_cache` never stores a failure) when a read errored. */
function must(error: { message?: string } | null | undefined, label: string): void {
  if (error) throw new Error(`[recipe-cache] ${label}: ${error.message}`)
}

/**
 * Invalidate the user-independent recipe caches after a write. Call from a Route
 * Handler or Server Action (where `revalidateTag` has the Next cache context).
 * `{ expire: 0 }` purges immediately (Next 16: the next request is a blocking
 * cache miss, not stale-while-revalidate) — the right choice outside a Server
 * Action, e.g. a delete, where stale content must not be served. Pass the slug of
 * every recipe written: a call without one purges only the lists.
 *
 * Best-effort: the write it follows has already succeeded, so a failure here is
 * logged, not thrown — the TTL still bounds staleness. A no-op while OpenNext runs
 * its default dummy incremental + tag caches; real hits and invalidation need the
 * Phase-2 R2 + D1 caches (#445, `.ai/specs/2026-10-26-cache-guest-reads-phase2-plan.md`).
 */
export function revalidateRecipeCaches(...slugs: string[]): void {
  try {
    revalidateTag(RECIPES_LIST_TAG, { expire: 0 })
    for (const slug of slugs) revalidateTag(recipeTag(slug), { expire: 0 })
  } catch (error) {
    console.error('[recipe-cache] invalidation failed:', error instanceof Error ? error.message : String(error))
  }
}

// ── Reads (take a client, so a fake client unit-tests them; no cookies/user) ──

/** The category list cards + the exact total (`count`) for „… w kategorii”. */
export async function readCategoryListing(
  supabase: SupabaseClient,
  { category, tags, limit }: { category: string; tags: readonly string[]; limit: number },
): Promise<{ recipes: PublicRecipe[]; count: number }> {
  let q = whereInCategory(supabase.from('public_recipes').select(CATEGORY_CARD_COLUMNS, { count: 'exact' }), category)
  if (tags.length > 0) q = q.contains('tags', tags)
  const { data, count, error } = await q
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(0, limit - 1)
  must(error, 'category listing failed')
  return { recipes: (data ?? []) as PublicRecipe[], count: count ?? 0 }
}

/** Per-tag counters for the chips, aggregated in Postgres (#444). */
export async function readCategoryFacets(
  supabase: SupabaseClient,
  { category, selected }: { category: string; selected: readonly string[] },
): Promise<TagCount[]> {
  const { data, error } = await supabase.rpc('category_tag_facets', { p_category: category, p_selected: selected })
  must(error, 'category facets failed')
  return (data ?? []) as TagCount[]
}

/** The whole-category head count, read only for a filtered view (#444). */
export async function readCategoryTotal(supabase: SupabaseClient, { category }: { category: string }): Promise<number> {
  const { count, error } = await whereInCategory(
    supabase.from('public_recipes').select('id', { count: 'exact', head: true }),
    category,
  )
  must(error, 'category total failed')
  return count ?? 0
}

/** The guest-safe recipe for a slug; the oldest row wins the bare slug (load-recipe §). */
export async function readPublicRecipe(supabase: SupabaseClient, slug: string): Promise<PublicRecipe | null> {
  const { data, error } = await supabase
    .from('public_recipes')
    .select('*')
    .eq('slug', slug)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(1)
  must(error, 'recipe read failed')
  return ((data ?? []) as PublicRecipe[])[0] ?? null
}

/**
 * Every card of one category, newest first: what "Podobne" picks from. One read per
 * category, not two per recipe: the recipe-file export renders every recipe, and the
 * per-recipe queries were about 30 MB of Supabase egress per build (2026-11-12,
 * docs/test-results.md). The largest category is about 250 rows, 120 kB.
 */
export async function readSimilarPool(supabase: SupabaseClient, category: string): Promise<SimilarPoolRow[]> {
  const { data, error } = await supabase
    .from('public_recipes')
    .select(SIMILAR_POOL_COLUMNS)
    .eq('category', category)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(SIMILAR_POOL_LIMIT)
  must(error, 'similar recipes failed')
  return (data ?? []) as SimilarPoolRow[]
}

/**
 * "Podobne" from a category pool: not this recipe, newest first, ranked by shared tags.
 * A recipe with a dish leaves out its other versions (they show in "Inne przepisy na …"),
 * keeping null-dish rows eligible. `total` is the whole category, this recipe included.
 */
export function pickSimilar(pool: readonly SimilarPoolRow[], recipe: SimilarSource): { cards: SimilarCard[]; total: number } {
  const own = new Set(recipe.tags)
  const candidates: SimilarPoolRow[] = []
  // A wider top-up pool: rankSimilar may drop recipes that contradict the diet.
  const fill: SimilarPoolRow[] = []
  for (const r of pool) {
    if (r.id === recipe.id || (recipe.dish && r.dish === recipe.dish)) continue
    if (fill.length < SIMILAR_CANDIDATES) fill.push(r)
    if (candidates.length < SIMILAR_CANDIDATES && (r.tags ?? []).some((t) => own.has(t))) candidates.push(r)
    if (fill.length === SIMILAR_CANDIDATES && (own.size === 0 || candidates.length === SIMILAR_CANDIDATES)) break
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the dish only filters; the cached cards leave it out
  const cards = rankSimilar(recipe.tags, candidates, fill).map(({ dish, ...card }) => card)
  return { cards, total: pool.length }
}

/** „Ostatnio dodane”: the newest public recipes across all users. */
export async function readRecentPublicRecipes(supabase: SupabaseClient, limit: number): Promise<MyRecipeCard[]> {
  const { data, error } = await supabase
    .from('public_recipes')
    .select(MY_RECIPE_CARD_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit)
  must(error, 'recent recipes failed')
  return (data ?? []) as MyRecipeCard[]
}

/** The pool „Przepis dnia” draws from: recent photographed non-YouTube recipes. */
const RECIPE_OF_DAY_POOL = 90

/** „Przepis dnia” for the given day: one deterministic pick from a bounded pool (home §). */
export async function readRecipeOfTheDay(supabase: SupabaseClient, date: Date): Promise<MyRecipeCard | null> {
  const { data: pool, error } = await supabase
    .from('public_recipes')
    .select('id')
    .not('image_url', 'is', null)
    .neq('source_type', 'youtube')
    .order('id', { ascending: false })
    .limit(RECIPE_OF_DAY_POOL)
  must(error, 'recipe-of-the-day pool failed')
  if (!pool || pool.length === 0) return null
  const pick = (pool as { id: number }[])[dailyRecipeIndex(date, pool.length)]
  const { data, error: pickError } = await supabase
    .from('public_recipes')
    .select(MY_RECIPE_CARD_COLUMNS)
    .eq('id', pick.id)
    .maybeSingle()
  must(pickError, 'recipe-of-the-day pick failed')
  return (data as MyRecipeCard | null) ?? null
}

// ── Cached wrappers (used by the routes): anon client + unstable_cache ─────────

/** A stable key fragment for a tag set — order-independent so `a,b` and `b,a` share an entry. */
const tagsKey = (tags: readonly string[]): string => [...tags].sort().join(',')

/**
 * Wrap a user-independent read: the cookie-free anon client + `unstable_cache`
 * with the shared TTL and, unless told otherwise, the list tag. Keeping both here,
 * not in each wrapper, makes the freshness / invalidation contract structural — a
 * new read cannot forget them.
 */
function cached<T>(
  name: string,
  keyParts: string[],
  read: (supabase: SupabaseClient) => Promise<T>,
  tags: string[] = [RECIPES_LIST_TAG],
): Promise<T> {
  return unstable_cache(() => read(createSupabaseAnonClient()), [name, ...keyParts], {
    revalidate: REVALIDATE_SECONDS,
    tags,
  })()
}

/** Cached category list + total, keyed per category/tags/page. */
export function getCategoryListing(params: { category: string; tags: readonly string[]; limit: number }) {
  return cached('category-listing', [params.category, tagsKey(params.tags), String(params.limit)], (c) =>
    readCategoryListing(c, params),
  )
}

/** Cached per-tag facet counters, keyed per category/selected. */
export function getCategoryFacets(params: { category: string; selected: readonly string[] }) {
  return cached('category-facets', [params.category, tagsKey(params.selected)], (c) => readCategoryFacets(c, params))
}

/** Cached whole-category head count, keyed per category. */
export function getCategoryTotal(params: { category: string }) {
  return cached('category-total', [params.category], (c) => readCategoryTotal(c, params))
}

/** Cached guest-safe recipe read, keyed per slug, purged by the recipe's own tag only. */
export function getPublicRecipe(slug: string) {
  return cached('public-recipe', [slug], (c) => readPublicRecipe(c, slug), [recipeTag(slug)])
}

/** Cached category pool for "Podobne", keyed per category. */
function getSimilarPool(category: string) {
  return cached('similar-pool', [category], (c) => readSimilarPool(c, category))
}

/**
 * Cached "Podobne" row, keyed by everything the ranking reads from the recipe. A miss
 * picks from the cached category pool, so a build reads each category once. The
 * per-recipe entry stays so a Worker hit loads ~12 cards, not the 120 kB pool.
 */
export function getSimilarRecipes(recipe: SimilarSource) {
  return cached('similar-recipes', [String(recipe.id), recipe.category, recipe.dish ?? '', tagsKey(recipe.tags)], async () =>
    pickSimilar(await getSimilarPool(recipe.category), recipe),
  )
}

/** Cached „Ostatnio dodane” feed, keyed per limit. */
export function getRecentPublicRecipes(limit: number) {
  return cached('recent-public-recipes', [String(limit)], (c) => readRecentPublicRecipes(c, limit))
}

/** Cached „Przepis dnia”, keyed by the Warsaw day so it rolls over at Polish midnight. */
export function getRecipeOfTheDay(date: Date) {
  return cached('recipe-of-the-day', [warsawDayKey(date)], (c) => readRecipeOfTheDay(c, date))
}
