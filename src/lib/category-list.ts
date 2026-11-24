import type { TagCount } from './category-tags'
import type { RecipeSource } from './recipe-source'

/** What a category card shows, plus its tags for the filter (the CATEGORY_CARD_COLUMNS read). */
export interface CategoryCard {
  id: number
  slug: string
  title: string
  image_url: string | null
  /** The recipe's primary category: a card listed through `extra_categories` keeps its own. */
  category: string
  source_type: RecipeSource
  source_url: string | null
  source_author: string | null
  tags: string[] | null
}

/** Newest first, this many more per "Pokaż kolejne". */
export const CATEGORY_PAGE_SIZE = 24

/** The cards whose tags include every selected tag (AND), in the order given. */
export function withTags<T extends { tags: readonly string[] | null }>(cards: readonly T[], selected: readonly string[]): T[] {
  if (selected.length === 0) return [...cards]
  return cards.filter((card) => selected.every((tag) => card.tags?.includes(tag)))
}

/** Per-tag counters for the chips, over the cards that match the selection (`tags @> selected`). */
export function tagCounts(cards: readonly { tags: readonly string[] | null }[], selected: readonly string[]): TagCount[] {
  const counts = new Map<string, number>()
  for (const card of withTags(cards, selected)) {
    for (const tag of new Set(card.tags ?? [])) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts].map(([tag, count]) => ({ tag, count }))
}

/** `?strona=` capped to the last page of `total` cards (page 1 for an empty list). */
export function clampPage(page: number, total: number): number {
  return Math.min(Math.max(1, page), Math.max(1, Math.ceil(total / CATEGORY_PAGE_SIZE)))
}
