'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { Database } from '@/lib/supabase.types'

type RecipeCategory = Database['public']['Enums']['recipe_category']

const CATEGORIES: { value: RecipeCategory; label: string; emoji: string }[] = [
  { value: 'obiady', label: 'Obiady', emoji: '🍽️' },
  { value: 'zupy', label: 'Zupy', emoji: '🥣' },
  { value: 'desery', label: 'Desery', emoji: '🍰' },
  { value: 'sniadania', label: 'Śniadania', emoji: '🥞' },
  { value: 'przekaski', label: 'Przekąski', emoji: '🥨' },
  { value: 'wegetarianskie', label: 'Wegetariańskie', emoji: '🥗' },
  { value: 'napoje', label: 'Napoje', emoji: '🥤' },
  { value: 'inne', label: 'Inne', emoji: '🍴' },
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
      {CATEGORIES.map(({ value, label, emoji }) => {
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
            <span>{emoji}</span>
            <span>{label}</span>
            {count !== undefined && (
              <span
                className={`ml-0.5 text-xs ${isActive ? 'text-orange-100' : 'text-orange-500'}`}
              >
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
