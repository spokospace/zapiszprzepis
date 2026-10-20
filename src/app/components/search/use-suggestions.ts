'use client'

import { useEffect, useState } from 'react'
import { SUGGEST_MIN_LENGTH, type RecipeSuggestion } from '@/lib/search'
import { getSuggestions } from '@/app/szukaj/actions'

/** Wait for a pause in typing before asking the server. */
const DEBOUNCE_MS = 250

/**
 * The recipe suggestions for what is being typed (E01-S29): debounced, and only the
 * answer to the latest query is kept, so a slow reply never overwrites a newer one.
 * Shared by the /szukaj page „Podpowiedzi” and the desktop header search panel.
 */
export function useSuggestions(query: string): RecipeSuggestion[] {
  const [result, setResult] = useState<{ q: string; items: RecipeSuggestion[] }>({ q: '', items: [] })
  const active = query.length >= SUGGEST_MIN_LENGTH
  useEffect(() => {
    if (!active) return
    let current = true
    const timer = setTimeout(() => {
      getSuggestions(query)
        .then((items) => {
          if (current) setResult({ q: query, items })
        })
        .catch(() => {
          if (current) setResult({ q: query, items: [] })
        })
    }, DEBOUNCE_MS)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [query, active])
  return active && result.q === query ? result.items : []
}
