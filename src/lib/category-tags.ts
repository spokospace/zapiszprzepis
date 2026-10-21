import { MAX_TAGS, RECIPE_TAGS, isRecipeTag, tagLabel, type RecipeTag } from '@/lib/recipe-tags'
import { recipesNoun } from '@/app/components/app-menu-model'
import { bindOrphans } from '@/lib/polish-typography'

/**
 * Tag filtering on the public category page and "Podobne" on the recipe page
 * (E01-S16). Pure, so every branch is unit-tested without a database.
 */

/**
 * The tags selected in `?tag=`: comma-separated and/or repeated params, closed
 * list only, deduplicated, first-seen order kept. A recipe carries at most
 * MAX_TAGS, so more than that can never match under AND logic and is cut.
 */
export function parseTagParam(raw: string | string[] | undefined): RecipeTag[] {
  const parts = (Array.isArray(raw) ? raw : [raw ?? '']).flatMap((v) => v.split(','))
  const result = new Set<RecipeTag>()
  for (const part of parts) {
    const value = part.trim().toLowerCase()
    if (isRecipeTag(value)) result.add(value)
  }
  return [...result].slice(0, MAX_TAGS)
}

/** `?strona=`: a whole number ≥ 1, anything else is page 1. */
export function parsePageParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value || !/^\d{1,4}$/.test(value)) return 1
  return Math.max(1, Number(value))
}

export interface TagFacet {
  value: RecipeTag
  label: string
  /** How many recipes are left if this tag is (or stays) part of the selection. */
  count: number
  selected: boolean
}

/** A `(tag, count)` row as returned by the `category_tag_facets` RPC. */
export interface TagCount {
  tag: string
  count: number
}

/**
 * The category page's tag chips, from `category_tag_facets` RPC rows: every
 * selected tag, plus every other tag with a count, ordered selected-first, then
 * most results, then the RECIPE_TAGS order. The AND-logic conditioning on
 * `selected` is done in SQL (`tags @> selected`); this only maps and orders.
 */
export function tagFacetsFromCounts(rows: readonly TagCount[], selected: readonly RecipeTag[]): TagFacet[] {
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r.tag, r.count)
  return RECIPE_TAGS.map((t) => ({
    value: t.value,
    label: t.label,
    count: counts.get(t.value) ?? 0,
    selected: selected.includes(t.value),
  }))
    .filter((f) => f.selected || f.count > 0)
    // Stable sort: ties keep the RECIPE_TAGS order.
    .sort((a, b) => Number(b.selected) - Number(a.selected) || b.count - a.count)
}

/** How many similar recipes the recipe page shows. */
export const SIMILAR_LIMIT = 4

const MEATLESS_TAGS: ReadonlySet<string> = new Set(['wegetarianskie', 'weganskie'])
const MEAT_TAGS: ReadonlySet<string> = new Set(['miesne', 'rybne'])

/**
 * "Podobne": `candidates` (same category, newest first) ranked by how many tags
 * they share with the recipe — newest wins a tie — then topped up from `fill`
 * (newest in the category) when fewer than `limit` share a tag. Each recipe
 * appears once.
 */
export function rankSimilar<T extends { id: number; tags: readonly string[] | null }>(
  tags: readonly string[],
  candidates: readonly T[],
  fill: readonly T[],
  limit = SIMILAR_LIMIT,
): T[] {
  const own = new Set(tags)
  const shared = (r: T) => (r.tags ?? []).filter((t) => own.has(t)).length
  // A meatless recipe is never "similar" to a meat or fish one, even in the top-up.
  const meatless = tags.some((t) => MEATLESS_TAGS.has(t))
  const eligible = (r: T) => {
    if (!meatless) return true
    const rt = r.tags ?? []
    return rt.some((t) => MEATLESS_TAGS.has(t)) && !rt.some((t) => MEAT_TAGS.has(t))
  }
  const ranked = candidates
    .filter(eligible)
    .map((r) => ({ r, score: shared(r) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score) // stable: keeps newest-first within a score
    .map((x) => x.r)

  const seen = new Set<number>()
  const result: T[] = []
  for (const r of [...ranked, ...fill.filter(eligible)]) {
    if (result.length >= limit) break
    if (seen.has(r.id)) continue
    seen.add(r.id)
    result.push(r)
  }
  return result
}

/** "kruche", "kruche i maślane", "kruche, maślane i czekoladowe". */
export function joinWithAnd(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} i ${items[items.length - 1]}`
}

/**
 * The category page's filter summary (screen 6): "3 przepisy: kruche i czekoladowe".
 * Rendered text, so one-letter words are bound to the next word (see bindOrphans).
 */
export function tagSummary(count: number, selected: readonly string[]): string {
  return bindOrphans(`${count} ${recipesNoun(count)}: ${joinWithAnd(selected.map(tagLabel))}`)
}

/**
 * Under a "Podobne" card: what it shares with the recipe ("też kruche i czekoladowe"),
 * null when nothing. Rendered text, so one-letter words are bound (see bindOrphans).
 */
export function sharedTagsCaption(own: readonly string[], other: readonly string[] | null): string | null {
  const shared = own.filter((t) => other?.includes(t))
  return shared.length ? bindOrphans(`też ${joinWithAnd(shared.map(tagLabel))}`) : null
}

/**
 * A category as the noun of a phrase ("Jakie ciasteczka?", "Podobne: kruche
 * ciasteczka"). "Inne" is no noun, so it reads "przepisy" there.
 */
export function categoryNoun(categoryLabel: string): string {
  const noun = categoryLabel.toLocaleLowerCase('pl')
  return noun === 'inne' ? 'przepisy' : noun
}

/** A phrase-like tag goes after the noun: "zupy na zimno", "obiady dla dzieci", "ciasta bez pieczenia". */
const POSTPOSITIVE_TAG = /^(z|ze|bez|na|dla) /

/**
 * "Podobne: kruche ciasteczka" — the recipe's tag most of the shown recipes
 * share (the recipe's own order breaks a tie), around the category: an
 * adjective in front ("kruche ciasteczka"), a phrase after ("zupy na zimno").
 * A tag that reads as neither (an occasion, "Boże Narodzenie"; a noun, "grill")
 * or one nobody shares leaves "Podobne: ciasteczka".
 */
export function similarHeading(
  own: readonly string[],
  similar: readonly { tags: readonly string[] | null }[],
  categoryLabel: string,
): string {
  const category = categoryNoun(categoryLabel)
  let best: string | null = null
  let bestCount = 0
  for (const tag of own) {
    const label = tagLabel(tag)
    const adjective = /^\p{Ll}+e$/u.test(label)
    if (!adjective && !POSTPOSITIVE_TAG.test(label)) continue
    const count = similar.filter((r) => r.tags?.includes(tag)).length
    if (count > bestCount) {
      best = label
      bestCount = count
    }
  }
  if (!best) return `Podobne: ${category}`
  return POSTPOSITIVE_TAG.test(best) ? `Podobne: ${category} ${best}` : `Podobne: ${best} ${category}`
}
