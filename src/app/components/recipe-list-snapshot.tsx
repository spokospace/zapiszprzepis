'use client'

import { useEffect } from 'react'
import { readSessionStorage, writeSessionStorage } from '@/app/components/ui/use-session-storage'
import { listStorageKey, type ListItem, type ListKey } from '@/lib/recipe-list-context'

interface RecipeListSnapshotProps {
  listKey: ListKey
  label: string
  href: string
  items: ListItem[]
}

/**
 * Remembers, for this tab, the list a visitor is looking at, so the recipe page
 * opened from it can show "← {label} · N z M" with Poprzedni/Następny (E01-S07).
 * Renders nothing. Pair it with RecipeCard's `from={listKey}`.
 */
export function RecipeListSnapshot({ listKey, label, href, items }: RecipeListSnapshotProps) {
  const serialized = JSON.stringify({ label, href, items })
  useEffect(() => {
    const key = listStorageKey(listKey)
    if (readSessionStorage(key) !== serialized) writeSessionStorage(key, serialized)
  }, [listKey, serialized])
  return null
}
