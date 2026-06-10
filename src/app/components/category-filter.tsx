'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { Database } from '@/lib/supabase.types'

type RecipeCategory = Database['public']['Enums']['recipe_category']

const CategoryIcon = ({ value }: { value: RecipeCategory }) => {
  switch (value) {
    case 'obiady':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 13h18M3 17h18M9 3v4m6-4v4M5 21h14a2 2 0 002-2v-6H3v6a2 2 0 002 2z" />
        </svg>
      )
    case 'zupy':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6v2m0 0c-3.314 0-6 1.343-6 3s2.686 3 6 3 6-1.343 6-3-2.686-3-6-3zm0 0V4M7 14v3a2 2 0 002 2h6a2 2 0 002-2v-3" />
        </svg>
      )
    case 'desery':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 15a2 2 0 01-2 2H5a2 2 0 01-2-2v-1h18v1zM3 14V8a9 9 0 0118 0v6" />
        </svg>
      )
    case 'sniadania':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
        </svg>
      )
    case 'przekaski':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4m0 0h18" />
        </svg>
      )
    case 'wegetarianskie':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 3s0 8 3 11c1.657 1.657 4 2 4 2s-.343-2.343-2-4C7 9 5 3 5 3zm14 0s0 8-3 11c-1.657 1.657-4 2-4 2s.343-2.343 2-4c3-3 5-9 5-9z" />
        </svg>
      )
    case 'napoje':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 3h6l1 9H8L9 3zM8 12a5 5 0 0010 0M7 21h10" />
        </svg>
      )
    case 'inne':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
        </svg>
      )
  }
}

const CATEGORIES: { value: RecipeCategory; label: string }[] = [
  { value: 'obiady', label: 'Obiady' },
  { value: 'zupy', label: 'Zupy' },
  { value: 'desery', label: 'Desery' },
  { value: 'sniadania', label: 'Śniadania' },
  { value: 'przekaski', label: 'Przekąski' },
  { value: 'wegetarianskie', label: 'Wegetariańskie' },
  { value: 'napoje', label: 'Napoje' },
  { value: 'inne', label: 'Inne' },
]

interface CategoryFilterProps {
  activeCategory?: string | null
  counts?: Partial<Record<RecipeCategory, number>>
}

export function CategoryFilter({ activeCategory, counts }: CategoryFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleClick(value: RecipeCategory) {
    const params = new URLSearchParams(searchParams.toString())
    if (activeCategory === value) {
      params.delete('category')
    } else {
      params.set('category', value)
    }
    router.push(`/recipes?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map(({ value, label }) => {
        const isActive = activeCategory === value
        const count = counts?.[value]
        return (
          <button
            key={value}
            onClick={() => handleClick(value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              isActive
                ? 'bg-orange-500 text-white'
                : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
            }`}
          >
            <CategoryIcon value={value} />
            <span>{label}</span>
            {count !== undefined && (
              <span className={`ml-0.5 text-xs ${isActive ? 'text-orange-100' : 'text-orange-500'}`}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export { CATEGORIES }
export type { RecipeCategory }
