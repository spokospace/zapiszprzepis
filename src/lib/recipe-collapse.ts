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
 * The duplicate groups of the one-off collapse (E01-S03a): rows that are one
 * recipe because they share a link — exactly, or as another key of the same
 * Facebook group post — or the same author text, transitively. Each group's
 * canonical row is `preferredOwnerId`'s (the main recipe account), else the
 * oldest (decision Q2). Recipes without a duplicate are left out.
 */
export function buildCollapseGroups(rows: CollapseRow[], preferredOwnerId: string | null): CollapseGroup[] {
  const parent = new Map<number, number>(rows.map((r) => [r.id, r.id]))
  const find = (id: number): number => {
    let root = id
    while (parent.get(root) !== root) root = parent.get(root)!
    parent.set(id, root)
    return root
  }

  // The first row seen under each key; later rows under it join its group.
  const firstByKey = new Map<string, number>()
  for (const row of rows) {
    const keys: string[] = []
    if (row.source_url) keys.push(`url:${sourceUrlPattern(row.source_url) ?? row.source_url}`)
    if (row.source_fingerprint) keys.push(`fp:${row.source_fingerprint}`)
    for (const key of keys) {
      const first = firstByKey.get(key)
      if (first === undefined) firstByKey.set(key, row.id)
      else parent.set(find(row.id), find(first))
    }
  }

  const members = new Map<number, CollapseRow[]>()
  for (const row of rows) {
    const root = find(row.id)
    const group = members.get(root)
    if (group) group.push(row)
    else members.set(root, [row])
  }

  const rank = (r: CollapseRow) => [r.user_id === preferredOwnerId ? 0 : 1, Date.parse(r.created_at), r.id]
  const before = (a: CollapseRow, b: CollapseRow) => {
    const [x, y] = [rank(a), rank(b)]
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
  }

  return [...members.values()]
    .filter((group) => group.length > 1)
    .map((group) => {
      const [canonical, ...losers] = group.sort(before)
      return { canonicalId: canonical.id, loserIds: losers.map((r) => r.id).sort((a, b) => a - b) }
    })
    .sort((a, b) => a.canonicalId - b.canonicalId)
}
