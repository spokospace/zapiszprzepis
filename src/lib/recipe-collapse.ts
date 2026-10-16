import { sourceUrlPattern } from './url-normalize'

export type CollapseRow = {
  id: number
  user_id: string
  source_url: string | null
  source_fingerprint: string | null
  created_at: string
}

export type CollapseGroup = { canonicalId: number; loserIds: number[] }

/**
 * Union-find grouping shared by the duplicate collapses: `buildEdges` links the
 * ids that belong together (through the `link` callback it is given), `before`
 * ranks each group so the canonical (kept) row sorts first. Rows without a
 * duplicate are dropped; every returned group is `{ canonicalId, loserIds }`,
 * the shape collapse_recipe_groups takes.
 */
export function groupDuplicates<R extends { id: number }>(
  rows: R[],
  buildEdges: (link: (a: number, b: number) => void) => void,
  before: (a: R, b: R) => number,
): CollapseGroup[] {
  const parent = new Map<number, number>(rows.map((r) => [r.id, r.id]))
  const find = (id: number): number => {
    let root = id
    while (parent.get(root) !== root) root = parent.get(root)!
    parent.set(id, root)
    return root
  }

  buildEdges((a, b) => parent.set(find(a), find(b)))

  const members = new Map<number, R[]>()
  for (const row of rows) {
    const root = find(row.id)
    const group = members.get(root)
    if (group) group.push(row)
    else members.set(root, [row])
  }

  return [...members.values()]
    .filter((group) => group.length > 1)
    .map((group) => {
      const [canonical, ...losers] = [...group].sort(before)
      return { canonicalId: canonical.id, loserIds: losers.map((r) => r.id).sort((a, b) => a - b) }
    })
    .sort((a, b) => a.canonicalId - b.canonicalId)
}

/**
 * The duplicate groups of the one-off collapse (E01-S03a): rows that are one
 * recipe because they share a link — exactly, or as another key of the same
 * Facebook group post — or the same author text, transitively. Each group's
 * canonical row is `preferredOwnerId`'s (the main recipe account), else the
 * oldest (decision Q2). Recipes without a duplicate are left out.
 */
export function buildCollapseGroups(rows: CollapseRow[], preferredOwnerId: string | null): CollapseGroup[] {
  const rank = (r: CollapseRow) => [r.user_id === preferredOwnerId ? 0 : 1, Date.parse(r.created_at), r.id]
  const before = (a: CollapseRow, b: CollapseRow) => {
    const [x, y] = [rank(a), rank(b)]
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
  }

  // The first row seen under each key; later rows under it join its group.
  return groupDuplicates(rows, (link) => {
    const firstByKey = new Map<string, number>()
    for (const row of rows) {
      const keys: string[] = []
      if (row.source_url) keys.push(`url:${sourceUrlPattern(row.source_url) ?? row.source_url}`)
      if (row.source_fingerprint) keys.push(`fp:${row.source_fingerprint}`)
      for (const key of keys) {
        const first = firstByKey.get(key)
        if (first === undefined) firstByKey.set(key, row.id)
        else link(row.id, first)
      }
    }
  }, before)
}
