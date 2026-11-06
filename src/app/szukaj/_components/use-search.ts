'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadBrowserClient } from '@/lib/browser-session'
import {
  loadSearchRows,
  narrowSearch,
  publicSearchClient,
  type SearchClient,
  type SearchParams,
  type SearchRow,
} from '@/lib/search'

/** Everyone's recipes need no session; „Moje” and „Ulubione” run under the reader's own. */
async function clientFor(scope: SearchParams['scope']): Promise<SearchClient> {
  if (scope === 'wszystkie') return publicSearchClient
  const supabase = await loadBrowserClient()
  return { rpc: (fn, args) => supabase.rpc(fn, args) }
}

type Loaded = { key: string; rows: SearchRow[] | null }

/**
 * One query per search: another page or category only narrows the rows already here.
 * `results` is null until they arrive, `failed` true when they cannot. `ready` is false
 * while the session that „Moje” and „Ulubione” need is unknown.
 */
export function useSearch({ q, scope, page, category }: SearchParams, ready: boolean) {
  const key = `${scope}:${q}`
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!ready || !q) return
    let current = true
    clientFor(scope)
      .then((client) => loadSearchRows(client, { q, scope }))
      .catch((e: unknown) => ({ error: String(e) }))
      .then((outcome) => {
        if (current) setLoaded({ key, rows: 'rows' in outcome ? outcome.rows : null })
      })
    return () => {
      current = false
    }
  }, [key, q, scope, ready, attempt])

  const retry = useCallback(() => {
    setLoaded(null)
    setAttempt((n) => n + 1)
  }, [])

  const rows = loaded?.key === key ? loaded.rows : undefined
  const results = useMemo(() => (rows ? narrowSearch(rows, { page, category }) : null), [rows, page, category])
  return { results, failed: rows === null, retry }
}
