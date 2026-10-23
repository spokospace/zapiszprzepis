import { ingredientKey, ingredientNames, ingredientsNearMatch, ingredientsSubsume, sameAuthor } from './recipe-dedup'
import { groupDuplicates, type CollapseGroup } from './recipe-collapse'

/** A recipe as the content-duplicate scan reads it: enough to judge "same
 *  recipe" (title + ingredients, plus the author that gates the near-match
 *  tier) and to rank which copy to keep. */
export type ContentRow = {
  id: number
  user_id: string
  title: string
  ingredients: { name: string }[]
  source_author: string | null
  created_at: string
}

/**
 * Groups of recipes that are one recipe extracted more than once — same title
 * and ingredient lists that subsume one another (one a subset of the other,
 * see ingredientsSubsume) — which the global URL and fingerprint rules miss
 * because each copy came from a different link with different caption text
 * (the "miodownik z kaszą manną" pair). Recipes without such a twin are left
 * out.
 *
 * The kept (canonical) copy is the most complete — the most ingredient names —
 * so a partial extraction never wins over the full one; ties go to
 * `preferredOwnerId`'s copy, then the oldest, then the lowest id. Every other
 * copy in the group is a loser, folded into the canonical by
 * collapse_recipe_groups.
 */
export function buildContentDuplicateGroups(rows: ContentRow[], preferredOwnerId: string | null): CollapseGroup[] {
  // Lower sorts first = canonical: most ingredients, then preferred owner, then oldest, then lowest id.
  const nameCount = new Map(rows.map((r) => [r.id, ingredientNames(r.ingredients).size]))
  const rank = (r: ContentRow): [number, number, number, number] => [
    -(nameCount.get(r.id) ?? 0),
    r.user_id === preferredOwnerId ? 0 : 1,
    Date.parse(r.created_at),
    r.id,
  ]
  const before = (a: ContentRow, b: ContentRow) => {
    const [x, y] = [rank(a), rank(b)]
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] || x[3] - y[3]
  }

  return groupDuplicates(rows, (link) => {
    // Same exact ingredient set, whatever the title: two shares of one dish
    // added close together that the LLM named differently ("kanapki" vs
    // "zapiekanka" — #835/#836), which the title bucket below can never pair
    // because it buckets on the title. ingredientKey is null for a list too
    // short to identify a recipe across titles (see MIN_FINGERPRINT_NAMES).
    const firstByKey = new Map<string, number>()
    for (const row of rows) {
      const key = ingredientKey(row.ingredients)
      if (key == null) continue
      const first = firstByKey.get(key)
      if (first === undefined) firstByKey.set(key, row.id)
      else link(row.id, first)
    }

    // Compare only within a title bucket: the ingredient check is O(n²) per
    // bucket, and two differently-titled recipes are never one recipe here.
    const byTitle = new Map<string, ContentRow[]>()
    for (const row of rows) {
      const key = row.title.trim().toLowerCase()
      const bucket = byTitle.get(key)
      if (bucket) bucket.push(row)
      else byTitle.set(key, [row])
    }
    for (const bucket of byTitle.values()) {
      for (let i = 0; i < bucket.length; i++) {
        for (let j = i + 1; j < bucket.length; j++) {
          const a = bucket[i], b = bucket[j]
          // Subsume links one copy contained in the other; the near-match tier
          // links two sets that differ by a name or two, but only when the same
          // author posted both (the #639/#894 reposted-shortbread pair).
          if (
            ingredientsSubsume(a.ingredients, b.ingredients) ||
            (sameAuthor(a.source_author, b.source_author) && ingredientsNearMatch(a.ingredients, b.ingredients))
          ) {
            link(a.id, b.id)
          }
        }
      }
    }
  }, before)
}
