import type { SupabaseClient } from '@supabase/supabase-js'
import { RECIPE_CATEGORIES } from '@/lib/recipe-categories'
import { isRecipeTag, MAX_TAGS } from '@/lib/recipe-tags'
import { staffErrorCode, type StaffErrorCode } from './errors'
import { UUID_RE } from './users'

export { UUID_RE }

export interface StaffRecipe {
  id: number
  slug: string
  title: string
  category: string
  sourceType: string
  sourceUrl: string | null
  ownerId: string
  ownerUsername: string | null
  createdAt: string
  updatedAt: string | null
  hiddenAt: string | null
  hiddenReason: string | null
  favoriteCount: number
}

export interface DeletedRecipe {
  recipeId: number
  slug: string
  title: string
  deletedAt: string
  redirectToSlug: string | null
  favoriteCount: number
}

export interface RecipeMerge {
  mergeId: string
  mergedAt: string
  loserIds: number[]
  loserSlugs: string[]
}

export const RECIPES_PAGE_SIZE = 25

export const RECIPE_FILTERS = ['all', 'hidden', 'visible'] as const
export type RecipeFilter = (typeof RECIPE_FILTERS)[number]

export const RECIPE_FILTER_LABELS: Record<RecipeFilter, string> = {
  all: 'Wszystkie',
  hidden: 'Tylko ukryte',
  visible: 'Tylko widoczne',
}

export function parseRecipeFilter(raw: string | undefined): RecipeFilter {
  return (RECIPE_FILTERS as readonly string[]).includes(raw ?? '') ? (raw as RecipeFilter) : 'all'
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
// bigint columns arrive as numbers or numeric strings depending on the driver.
const num = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN)

/** A row from admin_recipe_row, or null when it does not have the expected shape. */
export function mapRecipeRow(raw: unknown): StaffRecipe | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const id = num(r.recipe_id)
  const slug = str(r.slug)
  const title = str(r.title)
  const ownerId = str(r.owner_id)
  const createdAt = str(r.created_at)
  const favoriteCount = num(r.favorite_count)
  if (!Number.isSafeInteger(id) || !slug || title === null || !ownerId || !createdAt || Number.isNaN(favoriteCount)) return null
  return {
    id,
    slug,
    title,
    category: str(r.category) ?? '',
    sourceType: str(r.source_type) ?? '',
    sourceUrl: str(r.source_url),
    ownerId,
    ownerUsername: str(r.owner_username),
    createdAt,
    updatedAt: str(r.updated_at),
    hiddenAt: str(r.hidden_at),
    hiddenReason: str(r.hidden_reason),
    favoriteCount,
  }
}

export interface RecipesCursor {
  createdAt: string
  id: number
}

export interface RecipesPage {
  recipes: StaffRecipe[]
  /** Where the next page starts; null on the last page. */
  next: RecipesCursor | null
}

/** The recipe id from a form field or URL segment; anything else is no id. */
export function parseRecipeId(raw: unknown): number | null {
  const n = typeof raw === 'string' && /^[0-9]{1,15}$/.test(raw.trim()) ? Number(raw.trim()) : null
  return n !== null && Number.isSafeInteger(n) && n > 0 ? n : null
}

/** The cursor parameters of the list URL back into a cursor; anything malformed is no cursor. */
export function parseRecipesCursor(after: string | undefined, afterId: string | undefined): RecipesCursor | null {
  const id = parseRecipeId(afterId)
  if (!after || id === null || Number.isNaN(Date.parse(after))) return null
  return { createdAt: after, id }
}

/** Reads one page of recipes, hidden ones included, through the caller's own session (admin_list_recipes). */
export async function listRecipes(
  supabase: SupabaseClient,
  opts: { query?: string; filter?: RecipeFilter; after?: RecipesCursor | null },
): Promise<RecipesPage | null> {
  const { data, error } = await supabase.rpc('admin_list_recipes', {
    p_query: opts.query?.trim() || null,
    p_filter: opts.filter ?? 'all',
    // One extra row tells whether another page exists.
    p_limit: RECIPES_PAGE_SIZE + 1,
    p_after_created: opts.after?.createdAt ?? null,
    p_after_id: opts.after?.id ?? null,
  })
  if (error || !Array.isArray(data)) {
    console.error('[staff] admin_list_recipes failed:', error?.message)
    return null
  }
  const rows = data.map(mapRecipeRow).filter((r): r is StaffRecipe => r !== null)
  const recipes = rows.slice(0, RECIPES_PAGE_SIZE)
  const last = recipes.at(-1)
  return {
    recipes,
    next: rows.length > RECIPES_PAGE_SIZE && last ? { createdAt: last.createdAt, id: last.id } : null,
  }
}

export async function getRecipe(supabase: SupabaseClient, id: number): Promise<StaffRecipe | null> {
  const { data, error } = await supabase.rpc('admin_get_recipe', { p_recipe: id })
  if (error || !Array.isArray(data)) {
    console.error('[staff] admin_get_recipe failed:', error?.message)
    return null
  }
  return data.length > 0 ? mapRecipeRow(data[0]) : null
}

/** Recipes staff deleted and have not restored, newest first. */
export async function listDeletedRecipes(supabase: SupabaseClient): Promise<DeletedRecipe[] | null> {
  const { data, error } = await supabase.rpc('admin_list_deleted_recipes', { p_limit: 50 })
  if (error || !Array.isArray(data)) {
    console.error('[staff] admin_list_deleted_recipes failed:', error?.message)
    return null
  }
  return data.flatMap((raw: Record<string, unknown>) => {
    const recipeId = num(raw.recipe_id)
    const slug = str(raw.slug)
    const deletedAt = str(raw.deleted_at)
    if (!Number.isSafeInteger(recipeId) || !slug || !deletedAt) return []
    return [
      {
        recipeId,
        slug,
        title: str(raw.title) ?? '',
        deletedAt,
        redirectToSlug: str(raw.redirect_to_slug),
        favoriteCount: num(raw.favorite_count) || 0,
      },
    ]
  })
}

/** Merges whose canonical recipe is `id`, newest first (each can be undone). */
export async function listMerges(supabase: SupabaseClient, id: number): Promise<RecipeMerge[] | null> {
  const { data, error } = await supabase.rpc('admin_list_merges', { p_canonical: id })
  if (error || !Array.isArray(data)) {
    console.error('[staff] admin_list_merges failed:', error?.message)
    return null
  }
  return data.flatMap((raw: Record<string, unknown>) => {
    const mergeId = str(raw.merge_id)
    const mergedAt = str(raw.merged_at)
    if (!mergeId || !mergedAt) return []
    const ids = Array.isArray(raw.loser_ids) ? raw.loser_ids.map(num).filter(Number.isSafeInteger) : []
    const slugs = Array.isArray(raw.loser_slugs) ? raw.loser_slugs.filter((s): s is string => typeof s === 'string') : []
    return [{ mergeId, mergedAt, loserIds: ids, loserSlugs: slugs }]
  })
}

// ── Input validation (before the call; the SQL functions check again) ───────

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** The phrase staff type to confirm deleting a recipe. */
export const DELETE_RECIPE_CONFIRMATION = 'USUŃ'

/** How many duplicates one merge takes (the SQL function allows 20). */
export const MAX_LOSERS = 20

/** A redirect target typed as a slug or pasted as the recipe's address; null for anything else. */
export function parseRedirectSlug(raw: string): string | null {
  const text = raw.trim().replace(/^https?:\/\/[^/]+/i, '').replace(/[?#].*$/, '').replace(/\/$/, '').replace(/^\/?przepis\//, '')
  return SLUG_RE.test(text) && text.length <= 200 ? text : null
}

/** "12, 15 18" → [12, 15, 18]; null when anything is not a recipe id, empty, repeated, or too many. */
export function parseLoserIds(raw: string, canonicalId: number): number[] | null {
  const parts = raw.split(/[\s,;]+/).filter(Boolean)
  const ids = parts.map(parseRecipeId)
  if (ids.length === 0 || ids.length > MAX_LOSERS || ids.some((id) => id === null)) return null
  const unique = new Set(ids as number[])
  if (unique.size !== ids.length || unique.has(canonicalId)) return null
  return [...unique]
}

export type TaxonomyInput = { category: string | null; tags: string[] | null }

/**
 * The category and tags from the form, checked against the closed lists in
 * recipe-categories.ts and recipe-tags.ts. A blank category keeps the current one;
 * the tag field is always sent (a blank one clears the tags). Null when anything is
 * outside the lists or there are more than MAX_TAGS tags.
 */
export function parseTaxonomy(category: string, tags: readonly string[]): TaxonomyInput | null {
  const categoryOk = category === '' || RECIPE_CATEGORIES.some((c) => c.value === category)
  const unique = [...new Set(tags)]
  if (!categoryOk || unique.length > MAX_TAGS || !unique.every(isRecipeTag)) return null
  return { category: category || null, tags: unique }
}

/**
 * Calls an admin_* wrapper that RETURNS something (a slug, a merge result) with the caller's own
 * session. Same contract as callAdmin: a stable error code, never the database's text.
 */
export async function callAdminData<T>(
  supabase: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<{ data: T; error: null } | { data: null; error: StaffErrorCode }> {
  try {
    const { data, error } = await supabase.rpc(fn, args)
    if (!error) return { data: data as T, error: null }
    const code = staffErrorCode(error)
    if (code === 'unknown') console.error(`[staff] ${fn} failed:`, error.message)
    return { data: null, error: code }
  } catch (err) {
    console.error(`[staff] ${fn} threw:`, err)
    return { data: null, error: 'unknown' }
  }
}
