/**
 * "Is this recipe in category X's list?" — the one definition (issue #689).
 *
 * A recipe has a PRIMARY `category` and up to MAX_EXTRA_CATEGORIES `extra_categories`.
 * It belongs to a category's list, counts and facets when X is either. The SQL side
 * (`category_tag_facets`, `recipe_category_context`, `admin_usage_summary_as`) spells
 * the same predicate out; every TypeScript call site goes through here so none of them
 * re-implements it (and silently drops the extras).
 */

export const MAX_EXTRA_CATEGORIES = 2

/** The row fields membership needs; `extra_categories` is absent on a pre-migration schema. */
export interface CategoryMember {
  category: string | null
  extra_categories?: readonly string[] | null
}

/** True when `category` is the row's primary or one of its extras. */
export function inCategory(row: CategoryMember, category: string): boolean {
  return row.category === category || (row.extra_categories ?? []).includes(category)
}

/** Every category list the row appears in: the primary first, then the extras. */
export function rowCategories(row: CategoryMember): string[] {
  const all = row.category ? [row.category] : []
  for (const extra of row.extra_categories ?? []) if (!all.includes(extra)) all.push(extra)
  return all
}

/** Category slugs are lower-case ASCII; anything else must not reach a PostgREST filter string. */
const SLUG_RE = /^[a-z0-9_-]+$/

/** Anything with a PostgREST-style `or(filter)`. */
interface OrFilterable<Q> {
  or(filters: string): Q
}

/**
 * Narrows a PostgREST query to the recipes in `category`: primary OR extra. Use it on
 * `public_recipes` and on `recipes` reads alike. A value that is not a slug matches
 * nothing instead of being interpolated into the filter.
 */
export function whereInCategory<Q extends OrFilterable<Q>>(query: Q, category: string): Q {
  if (!SLUG_RE.test(category)) return query.or('id.lt.0')
  return query.or(`category.eq.${category},extra_categories.cs.{${category}}`)
}
