export type SlugRow = {
  id: number
  slug: string
  created_at: string
}

export type SlugRename = { id: number; oldSlug: string; newSlug: string }

/**
 * The slug renames that make slugs globally unique (E01-S03b migration A). For
 * each slug used by more than one row the oldest row (created_at asc, then id
 * asc) keeps the bare slug; every later row gets the lowest free numeric suffix
 * (`{slug}-2`, `-3`, …) not already taken by ANY row's slug — existing or newly
 * assigned in this run. Rows whose slug is already unique are left out, so the
 * result is empty once slugs are globally unique (idempotent, like the SQL).
 *
 * The SQL in the migration implements the same rule row-for-row; this is the
 * testable mirror (no local DB), echoing S03a's buildCollapseGroups.
 */
export function buildSlugRenames(rows: SlugRow[]): SlugRename[] {
  // Every slug currently in use, so a suffix never collides with an unrelated
  // row (e.g. a real "tiramisu-2" recipe). Grows as suffixes are assigned.
  const taken = new Set(rows.map((r) => r.slug))

  const bySlug = new Map<string, SlugRow[]>()
  for (const row of rows) {
    const group = bySlug.get(row.slug)
    if (group) group.push(row)
    else bySlug.set(row.slug, [row])
  }

  const order = (a: SlugRow, b: SlugRow) =>
    Date.parse(a.created_at) - Date.parse(b.created_at) || a.id - b.id

  const renames: SlugRename[] = []
  for (const [slug, group] of bySlug) {
    if (group.length < 2) continue
    const [, ...losers] = [...group].sort(order) // oldest keeps the bare slug
    for (const loser of losers) {
      let n = 2
      while (taken.has(`${slug}-${n}`)) n++
      const newSlug = `${slug}-${n}`
      taken.add(newSlug)
      renames.push({ id: loser.id, oldSlug: slug, newSlug })
    }
  }
  return renames.sort((a, b) => a.id - b.id)
}
