'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { searchNavigation } from '@/lib/search-navigation'
import { useListTransition } from './list-transition'

interface RecipeSearchProps {
  query?: string | null
}

export function RecipeSearch({ query }: RecipeSearchProps) {
  const router = useRouter()
  const { startTransition } = useListTransition()
  const [value, setValue] = useState(query ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep the input in sync when the URL `q` changes externally (e.g. browser
  // back/forward). This is React's "adjust state during render" pattern, which
  // avoids the cascading re-render of doing it in an effect.
  const [lastQuery, setLastQuery] = useState(query ?? '')
  if ((query ?? '') !== lastQuery) {
    setLastQuery(query ?? '')
    setValue(query ?? '')
  }

  function navigateTo(next: string) {
    // The URL is read when the call runs, not from a render: the debounced call fires
    // later, and the address bar only changes once a navigation has finished, so it
    // tells whether a search is already on screen (refine it) or about to start.
    const target = searchNavigation(window.location.search, next)
    if (!target) return
    startTransition(() => {
      if (target.replace) {
        router.replace(target.href)
      } else {
        router.push(target.href)
      }
    })
  }

  function handleChange(next: string) {
    setValue(next)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => navigateTo(next), 300)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    navigateTo(value)
  }

  function handleClear() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    setValue('')
    navigateTo('')
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return (
    <form onSubmit={handleSubmit} role="search" className="relative">
      <Search
        aria-hidden="true"
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
      />
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        aria-label="Szukaj po nazwie lub składniku"
        placeholder="Szukaj po nazwie lub składniku…"
        className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Wyczyść wyszukiwanie"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  )
}
