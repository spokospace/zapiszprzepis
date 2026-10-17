/**
 * "Where did I come from" for the recipe page's list bar (E01-S07). A list page
 * links its cards with `?from={key}` and writes a snapshot of what it rendered
 * to sessionStorage; the recipe page locates itself in that snapshot. Only
 * whitelisted keys count, so a hand-edited `?from` never reaches a storage key
 * or a rendered link. E01-S05 (search) and E01-S16 (category) add their keys here.
 */
export const LIST_KEYS = ['fav', 'moje', 'home'] as const
export type ListKey = (typeof LIST_KEYS)[number]

export interface ListItem {
  slug: string
  title: string
}

export interface ListSnapshot {
  /** Shown as "← {label}". */
  label: string
  /** Where "← {label}" goes back to (the list, with its filters). */
  href: string
  items: ListItem[]
}

export interface ListPosition {
  label: string
  /** null: no list page to link back to (the category page arrives with E01-S16). */
  href: string | null
  /** 1-based. */
  index: number
  total: number
  prev: ListItem | null
  next: ListItem | null
}

export function parseListKey(raw: unknown): ListKey | null {
  return typeof raw === 'string' && (LIST_KEYS as readonly string[]).includes(raw) ? (raw as ListKey) : null
}

export function listStorageKey(key: ListKey): string {
  return `zp-list:${key}`
}

function isItem(value: unknown): value is ListItem {
  if (!value || typeof value !== 'object') return false
  const { slug, title } = value as Record<string, unknown>
  return typeof slug === 'string' && slug.length > 0 && typeof title === 'string'
}

/** Defensive read of a stored snapshot; anything malformed is null. */
export function parseSnapshot(raw: string | null): ListSnapshot | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const { label, href, items } = parsed as Record<string, unknown>
    // href must be a same-site path: it becomes a link on the recipe page. Browsers
    // read both "//" and "/\" as protocol-relative, so neither may start it.
    if (typeof label !== 'string' || typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//') || href.startsWith('/\\')) {
      return null
    }
    if (!Array.isArray(items) || !items.every(isItem)) return null
    return { label, href, items }
  } catch {
    return null
  }
}

/** This recipe's place in the snapshot, or null when it is not in it (fall back). */
export function locate(snapshot: ListSnapshot | null, slug: string): ListPosition | null {
  if (!snapshot) return null
  const i = snapshot.items.findIndex((item) => item.slug === slug)
  if (i === -1) return null
  return {
    label: snapshot.label,
    href: snapshot.href,
    index: i + 1,
    total: snapshot.items.length,
    prev: snapshot.items[i - 1] ?? null,
    next: snapshot.items[i + 1] ?? null,
  }
}
