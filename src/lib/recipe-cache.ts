import 'server-only'
import { unstable_cache, revalidateTag } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAnonClient } from '@/lib/supabase/anon'
import { MY_RECIPE_CARD_COLUMNS, type MyRecipeCard } from '@/lib/my-recipes'
import type { TagCount } from '@/lib/category-tags'
import { dailyRecipeIndex, warsawDayKey } from '@/lib/recipe-of-the-day'
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
}

/** The one card shape the category list renders (#444): only what a `RecipeCard` shows + its tags. */
const CATEGORY_CARD_COLUMNS =
  'id, slug, title, image_url, category, source_type, source_url, source_author, tags, total_time_minutes, prep_time_minutes, cook_time_minutes'

/**
 * All user-independent public reads share one list tag so a single
 * `revalidateRecipeCaches()` clears the category listings, the home feed and the
 * recipe-of-the-day pick; each recipe also has its own tag so a write to one
 * recipe need not bust every list. The TTL is the owner-confirmed freshness
 * budget (#445): a guest sees a new/edited/deleted recipe at most this stale.
 */
export const RECIPES_LIST_TAG = 'recipes:list'
export const recipeTag = (slug: string) => `recipe:${slug}`
const REVALIDATE_SECONDS = 120

/** Throw (so `unstable_cache` never stores a failure) when a read errored. */
function must(error: { message?: string } | null | undefined, label: string): void {
  if (error) throw new Error(`[recipe-cache] ${label}: ${error.message}`)
}

/**
 * Invalidate the user-independent recipe caches after a write. Call from a Route
 * Handler or Server Action (where `revalidateTag` has the Next cache context).
 * `{ expire: 0 }` purges immediately (Next 16: the next request is a blocking
 * cache miss, not stale-while-revalidate) — the right choice outside a Server
 * Action, e.g. a delete, where stale content must not be served. Every cached
 * read carries the list tag, so a call without a slug purges the recipe pages too.
 *
 * Best-effort: the write it follows has already succeeded, so a failure here is
 * logged, not thrown — the TTL still bounds staleness. A no-op while OpenNext runs
 * its default dummy incremental + tag caches; real hits and invalidation need the
 * Phase-2 R2 + D1 caches (#445, `.ai/specs/2026-10-26-cache-guest-reads-phase2-plan.md`).
 */
export function revalidateRecipeCaches(slug?: string): void {
  try {
    revalidateTag(RECIPES_LIST_TAG, { expire: 0 })
    if (slug) revalidateTag(recipeTag(slug), { expire: 0 })
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
  let q = supabase.from('public_recipes').select(CATEGORY_CARD_COLUMNS, { count: 'exact' }).eq('category', category)
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
  const { count, error } = await supabase
    .from('public_recipes')
    .select('id', { count: 'exact', head: true })
    .eq('category', category)
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
 * with the shared 120 s TTL and the list tag (plus any extra per-entry tag).
 * Keeping the TTL and the list tag here, not in each wrapper, makes the
 * freshness / invalidation contract structural — a new read cannot forget them.
 */
function cached<T>(
  name: string,
  keyParts: string[],
  read: (supabase: SupabaseClient) => Promise<T>,
  extraTags: string[] = [],
): Promise<T> {
  return unstable_cache(() => read(createSupabaseAnonClient()), [name, ...keyParts], {
    revalidate: REVALIDATE_SECONDS,
    tags: [RECIPES_LIST_TAG, ...extraTags],
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

/** Cached guest-safe recipe read, keyed per slug, with the recipe's own tag alongside the list tag. */
export function getPublicRecipe(slug: string) {
  return cached('public-recipe', [slug], (c) => readPublicRecipe(c, slug), [recipeTag(slug)])
}

/** Cached „Ostatnio dodane” feed, keyed per limit. */
export function getRecentPublicRecipes(limit: number) {
  return cached('recent-public-recipes', [String(limit)], (c) => readRecentPublicRecipes(c, limit))
}

/** Cached „Przepis dnia”, keyed by the Warsaw day so it rolls over at Polish midnight. */
export function getRecipeOfTheDay(date: Date) {
  return cached('recipe-of-the-day', [warsawDayKey(date)], (c) => readRecipeOfTheDay(c, date))
}
