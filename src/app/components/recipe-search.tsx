'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

interface RecipeSearchProps {
  query?: string | null
}

export function RecipeSearch({ query }: RecipeSearchProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
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

  function pushQuery(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    const trimmed = next.trim()
    if (trimmed) {
      params.set('q', trimmed)
    } else {
      params.delete('q')
    }
    router.push(`/recipes?${params.toString()}`)
  }

  function handleChange(next: string) {
    setValue(next)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => pushQuery(next), 300)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    pushQuery(value)
  }

  function handleClear() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    setValue('')
    pushQuery('')
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
