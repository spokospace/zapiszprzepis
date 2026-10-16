'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import {
  Utensils,
  Soup,
  CakeSlice,
  Cake,
  Cookie,
  Coffee,
  Croissant,
  Sandwich,
  Salad,
  GlassWater,
  FlaskRound,
  UtensilsCrossed,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { RECIPE_CATEGORIES, type RecipeCategory } from '@/lib/recipe-categories'

const CATEGORY_ICONS: Record<RecipeCategory, LucideIcon> = {
  obiady: Utensils,
  zupy: Soup,
  desery: CakeSlice,
  ciasta: Cake,
  ciasteczka: Cookie,
  sniadania: Coffee,
  pieczywo: Croissant,
  przekaski: Sandwich,
  salatki: Salad,
  napoje: GlassWater,
  syropy: FlaskRound,
  inne: UtensilsCrossed,
}

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
      {RECIPE_CATEGORIES.map(({ value, label }) => {
        const Icon = CATEGORY_ICONS[value]
        const isActive = activeCategory === value
        const count = counts?.[value]
        return (
          <button
            key={value}
            onClick={() => handleClick(value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-base font-medium transition-colors ${
              isActive
                ? 'bg-orange-500 text-white'
                : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
            }`}
          >
            <Icon size={17} strokeWidth={1.75} />
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

