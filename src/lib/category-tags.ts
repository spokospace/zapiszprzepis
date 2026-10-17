import { MAX_TAGS, RECIPE_TAGS, isRecipeTag, tagLabel, type RecipeTag } from '@/lib/recipe-tags'
import { recipesNoun } from '@/app/components/app-menu-model'

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

/**
 * The chips for a category: every selected tag, plus every other tag that would
 * still leave results under AND logic, with that number as its counter.
 * Order: selected first, then most results, then the RECIPE_TAGS order.
 */
export function tagFacets(rows: readonly { tags: readonly string[] | null }[], selected: readonly RecipeTag[]): TagFacet[] {
  const matching = rows.filter((r) => selected.every((t) => r.tags?.includes(t)))
  const counts = new Map<string, number>()
  for (const row of matching) {
    for (const tag of new Set(row.tags ?? [])) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
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
  const ranked = candidates
    .map((r) => ({ r, score: shared(r) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score) // stable: keeps newest-first within a score
    .map((x) => x.r)

  const seen = new Set<number>()
  const result: T[] = []
  for (const r of [...ranked, ...fill]) {
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

/** The category page's filter summary (screen 6): "3 przepisy: kruche i czekoladowe". */
export function tagSummary(count: number, selected: readonly string[]): string {
  return `${count} ${recipesNoun(count)}: ${joinWithAnd(selected.map(tagLabel))}`
}

/** Under a "Podobne" card: what it shares with the recipe ("też kruche i czekoladowe"), null when nothing. */
export function sharedTagsCaption(own: readonly string[], other: readonly string[] | null): string | null {
  const shared = own.filter((t) => other?.includes(t))
  return shared.length ? `też ${joinWithAnd(shared.map(tagLabel))}` : null
}

/**
 * "Podobne: kruche ciasteczka" — the recipe's tag most of the shown recipes
 * share (the recipe's own order breaks a tie), in front of the category.
 * Only an adjective-like tag reads right there: a capitalised one (an occasion,
 * "Boże Narodzenie") or one nobody shares leaves "Podobne: ciasteczka".
 */
export function similarHeading(
  own: readonly string[],
  similar: readonly { tags: readonly string[] | null }[],
  categoryLabel: string,
): string {
  const category = categoryLabel.toLocaleLowerCase('pl')
  let best: string | null = null
  let bestCount = 0
  for (const tag of own) {
    const label = tagLabel(tag)
    if (label !== label.toLocaleLowerCase('pl')) continue
    const count = similar.filter((r) => r.tags?.includes(tag)).length
    if (count > bestCount) {
      best = label
      bestCount = count
    }
  }
  return best ? `Podobne: ${best} ${category}` : `Podobne: ${category}`
}
